from datetime import datetime, timezone

from fastapi import HTTPException

from pymongo import ReturnDocument
from pymongo.errors import PyMongoError

from src.database import db

from src.models.configuracion import (
    ActualizarCuentaAdministrativa,
)


coleccion_usuarios = db["usuarios"]


PROYECCION_CUENTA = {
    "_id": 1,
    "nombre": 1,
    "correo": 1,
    "rol": 1,
    "activo": 1,
    "correo_verificado": 1,
    "fecha_registro": 1,
    "fecha_actualizacion_perfil": 1,
    "fecha_cambio_contrasena": 1,
}


def filtro_administrador(administrador):

    return {
        "_id": administrador["_id"],
        "rol": "administrador",
        "activo": True,
        "correo_verificado": True,
    }


def serializar_cuenta(documento):

    return {
        "id": str(documento["_id"]),
        "nombre": documento.get("nombre", ""),
        "correo": documento.get("correo", ""),
        "rol": documento.get("rol"),
        "activo": documento.get("activo") is True,
        "correo_verificado": (
            documento.get("correo_verificado") is True
        ),
        "fecha_registro": documento.get(
            "fecha_registro"
        ),
        "fecha_actualizacion_perfil": documento.get(
            "fecha_actualizacion_perfil"
        ),
        "fecha_cambio_contrasena": documento.get(
            "fecha_cambio_contrasena"
        ),
    }


def obtener_cuenta_administrativa(administrador):

    try:

        documento = coleccion_usuarios.find_one(
            filtro_administrador(administrador),
            PROYECCION_CUENTA,
        )

        if documento is None:

            raise HTTPException(
                status_code=403,
                detail="Cuenta administrativa no disponible.",
            )

        return serializar_cuenta(documento)

    except PyMongoError as error:

        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible consultar "
                "la cuenta administrativa."
            ),
        ) from error


def actualizar_cuenta_administrativa(
    solicitud: ActualizarCuentaAdministrativa,
    administrador,
):

    try:

        filtro = filtro_administrador(
            administrador
        )

        documento = coleccion_usuarios.find_one(
            filtro,
            PROYECCION_CUENTA,
        )

        if documento is None:

            raise HTTPException(
                status_code=403,
                detail="Cuenta administrativa no disponible.",
            )

        nombre_anterior = documento.get(
            "nombre", ""
        )

        nombre_nuevo = solicitud.nombre

        if nombre_anterior == nombre_nuevo:

            return serializar_cuenta(documento)

        ahora = datetime.now(timezone.utc)

        evento = {
            "accion": "actualizacion_perfil_administrativo",
            "administrador_id": str(
                administrador["_id"]
            ),
            "fecha": ahora,
            "cambios": {
                "nombre": {
                    "anterior": nombre_anterior,
                    "nuevo": nombre_nuevo,
                },
            },
        }

        actualizado = (
            coleccion_usuarios.find_one_and_update(
                {
                    **filtro,
                    "nombre": nombre_anterior,
                },
                {
                    "$set": {
                        "nombre": nombre_nuevo,
                        "fecha_actualizacion_perfil": ahora,
                    },
                    "$push": {
                        "historial_administrativo": evento,
                    },
                },
                projection=PROYECCION_CUENTA,
                return_document=ReturnDocument.AFTER,
            )
        )

        if actualizado is None:

            raise HTTPException(
                status_code=409,
                detail=(
                    "La cuenta fue modificada durante "
                    "la operación. Actualiza los datos "
                    "antes de continuar."
                ),
            )

        return serializar_cuenta(actualizado)

    except PyMongoError as error:

        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible confirmar la actualización "
                "de la cuenta administrativa."
            ),
        ) from error