from datetime import datetime, timezone
from hmac import compare_digest

from fastapi import HTTPException
from pymongo.errors import PyMongoError

from src.database import db

from src.services.auth_service import (
    proteger_contrasena,
    verificar_contrasena,
)

from src.models.configuracion import (
    CambiarContrasenaAdministrativa,
    RevocarSesionesAdministrativas,
)


coleccion_usuarios = db["usuarios"]


def filtro_administrador(administrador):

    return {
        "_id": administrador["_id"],
        "rol": "administrador",
        "activo": True,
        "correo_verificado": True,
    }


def verificar_credenciales(
    administrador,
    contrasena_actual,
):

    documento = coleccion_usuarios.find_one(
        filtro_administrador(administrador),
        {
            "contrasena_hash": 1,
            "version_token_admin": 1,
        },
    )

    if documento is None:

        raise HTTPException(
            status_code=403,
            detail="Cuenta administrativa no disponible.",
        )

    hash_actual = documento.get(
        "contrasena_hash"
    )

    if not isinstance(hash_actual, str) or not hash_actual:

        raise HTTPException(
            status_code=503,
            detail="Credenciales administrativas no disponibles.",
        )

    try:

        correcta = verificar_contrasena(
            contrasena_actual,
            hash_actual,
        )

    except Exception:

        raise HTTPException(
            status_code=503,
            detail="No fue posible verificar las credenciales.",
        ) from None

    if not correcta:

        raise HTTPException(
            status_code=400,
            detail="La contraseña actual es incorrecta.",
        )

    version = documento.get(
        "version_token_admin", 0
    )

    if (
        not isinstance(version, int)
        or isinstance(version, bool)
        or version < 0
        or version >= 2**63 - 1
    ):

        raise HTTPException(
            status_code=503,
            detail="Estado de sesión administrativa inválido.",
        )

    version_autenticada = administrador.get(
        "version_token_admin"
    )

    if (
        type(version_autenticada) is not int
        or version_autenticada < 0
        or version_autenticada != version
    ):
        raise HTTPException(
            status_code=401,
            detail="La sesion administrativa fue revocada.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return documento


def filtro_operacion(
    administrador,
    documento,
):

    filtro = {
        **filtro_administrador(administrador),
        "contrasena_hash": documento["contrasena_hash"],
    }

    if "version_token_admin" in documento:

        filtro["version_token_admin"] = (
            documento["version_token_admin"]
        )

    else:

        filtro["version_token_admin"] = {
            "$exists": False,
        }

    return filtro


def cambiar_contrasena_administrativa(
    solicitud: CambiarContrasenaAdministrativa,
    administrador,
):

    if not compare_digest(
        solicitud.contrasena_nueva.encode("utf-8"),
        solicitud.confirmar_contrasena.encode("utf-8"),
    ):

        raise HTTPException(
            status_code=400,
            detail="Las contraseñas nuevas no coinciden.",
        )

    try:

        documento = verificar_credenciales(
            administrador,
            solicitud.contrasena_actual,
        )

        if compare_digest(
            solicitud.contrasena_actual.encode("utf-8"),
            solicitud.contrasena_nueva.encode("utf-8"),
        ):

            raise HTTPException(
                status_code=400,
                detail=(
                    "La nueva contraseña debe ser "
                    "diferente de la actual."
                ),
            )

        nuevo_hash = proteger_contrasena(
            solicitud.contrasena_nueva
        )

        ahora = datetime.now(timezone.utc)

        evento = {
            "accion": "cambio_contrasena_administrativa",
            "administrador_id": str(
                administrador["_id"]
            ),
            "fecha": ahora,
            "sesiones_revocadas": True,
        }

        resultado = coleccion_usuarios.update_one(
            filtro_operacion(
                administrador,
                documento,
            ),
            {
                "$set": {
                    "contrasena_hash": nuevo_hash,
                    "fecha_cambio_contrasena": ahora,
                    "fecha_revocacion_sesiones_admin": ahora,
                },
                "$inc": {
                    "version_token_admin": 1,
                },
                "$push": {
                    "historial_administrativo": evento,
                },
            },
        )

        if resultado.modified_count != 1:

            raise HTTPException(
                status_code=409,
                detail=(
                    "La cuenta fue modificada durante "
                    "la operación. Inicia sesión nuevamente."
                ),
            )

        return {
            "mensaje": (
                "Contraseña actualizada correctamente."
            ),
            "sesiones_revocadas": True,
            "requiere_nuevo_inicio_sesion": True,
            "fecha": ahora,
        }

    except PyMongoError:

        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible confirmar el cambio "
                "de contraseña."
            ),
        ) from None


def revocar_sesiones_administrativas(
    solicitud: RevocarSesionesAdministrativas,
    administrador,
):

    try:

        documento = verificar_credenciales(
            administrador,
            solicitud.contrasena_actual,
        )

        ahora = datetime.now(timezone.utc)

        evento = {
            "accion": "revocacion_sesiones_administrativas",
            "administrador_id": str(
                administrador["_id"]
            ),
            "fecha": ahora,
            "sesiones_revocadas": True,
        }

        resultado = coleccion_usuarios.update_one(
            filtro_operacion(
                administrador,
                documento,
            ),
            {
                "$set": {
                    "fecha_revocacion_sesiones_admin": ahora,
                },
                "$inc": {
                    "version_token_admin": 1,
                },
                "$push": {
                    "historial_administrativo": evento,
                },
            },
        )

        if resultado.modified_count != 1:

            raise HTTPException(
                status_code=409,
                detail=(
                    "La cuenta fue modificada durante "
                    "la operación. Inicia sesión nuevamente."
                ),
            )

        return {
            "mensaje": (
                "Todas las sesiones de tu cuenta "
                "administrativa fueron revocadas."
            ),
            "sesiones_revocadas": True,
            "requiere_nuevo_inicio_sesion": True,
            "fecha": ahora,
        }

    except PyMongoError:

        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible confirmar "
                "la revocación de sesiones."
            ),
        ) from None