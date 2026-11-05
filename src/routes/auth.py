
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
import secrets

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from pydantic import BaseModel, EmailStr, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from src.database import db
from src.models.usuario import (
    TokenRespuesta,
    UsuarioLogin,
    UsuarioRegistro,
    UsuarioRespuesta,
)
from src.services.auth_service import (
    crear_token,
    proteger_contrasena,
    verificar_contrasena,
    verificar_token,
)
from src.services.email_service import enviar_codigo_verificacion


router = APIRouter(
    prefix="/auth",
    tags=["Autenticacion"],
)

usuarios = db["usuarios"]
seguridad = HTTPBearer(auto_error=False)

DURACION_CODIGO = timedelta(minutes=10)
ESPERA_REENVIO = timedelta(seconds=60)
MAX_INTENTOS = 5


class VerificarCorreo(BaseModel):
    correo: EmailStr
    codigo: str = Field(
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
    )


class ReenviarCodigo(BaseModel):
    correo: EmailStr


def ahora_utc() -> datetime:
    return datetime.now(timezone.utc)


def fecha_utc(fecha):
    if fecha is None:
        return None

    if fecha.tzinfo is None:
        return fecha.replace(tzinfo=timezone.utc)

    return fecha.astimezone(timezone.utc)


def generar_codigo() -> str:
    return f"{secrets.randbelow(1000000):06d}"


def hash_codigo(codigo: str, usuario_id: str) -> str:
    secreto = os.getenv("JWT_SECRET_KEY", "")

    if not secreto:
        raise RuntimeError(
            "JWT_SECRET_KEY no está configurada."
        )

    contenido = f"{usuario_id}:{codigo}".encode("utf-8")

    return hmac.new(
        secreto.encode("utf-8"),
        contenido,
        hashlib.sha256,
    ).hexdigest()


def respuesta_usuario(usuario):
    return {
        "id": str(usuario["_id"]),
        "nombre": usuario["nombre"],
        "correo": usuario["correo"],
        "rol": usuario["rol"],
        "colonia": usuario.get("colonia", ""),
        "ciudad": usuario["ciudad"],
        "foto_perfil": usuario.get("foto_perfil"),
        "activo": usuario.get("activo", True),
    }


def enviar_codigo_a_usuario(usuario):
    codigo = generar_codigo()
    momento = ahora_utc()

    # Guardamos únicamente el hash, nunca el PIN original.
    usuarios.update_one(
        {"_id": usuario["_id"]},
        {
            "$set": {
                "codigo_verificacion_hash": hash_codigo(
                    codigo,
                    str(usuario["_id"]),
                ),
                "codigo_verificacion_expira": (
                    momento + DURACION_CODIGO
                ),
                "codigo_verificacion_enviado": momento,
                "codigo_verificacion_intentos": 0,
            }
        },
    )

    enviar_codigo_verificacion(
        usuario["correo"],
        codigo,
    )


@router.post(
    "/registro",
    response_model=UsuarioRespuesta,
    status_code=status.HTTP_201_CREATED,
)
def registrar_usuario(datos: UsuarioRegistro):
    correo = str(datos.correo).strip().lower()

    if usuarios.find_one({"correo": correo}):
        raise HTTPException(
            status_code=409,
            detail="Este correo ya está registrado.",
        )

    nuevo_usuario = {
        "nombre": datos.nombre,
        "correo": correo,
        "contrasena_hash": proteger_contrasena(
            datos.contrasena
        ),
        "rol": datos.rol,
        "colonia": datos.colonia,
        "ciudad": datos.ciudad,
        "foto_perfil": datos.foto_perfil,
        "activo": True,
        "correo_verificado": False,
        "fecha_registro": ahora_utc(),
    }

    try:
        resultado = usuarios.insert_one(nuevo_usuario)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Este correo ya está registrado.",
        )

    nuevo_usuario["_id"] = resultado.inserted_id

    try:
        enviar_codigo_a_usuario(nuevo_usuario)
    except Exception:
        # La cuenta ya fue guardada.
        # No mostramos información interna de SMTP.
        raise HTTPException(
            status_code=503,
            detail=(
                "La cuenta se guardó, pero no fue posible "
                "enviar el correo. Intenta reenviar el código."
            ),
        )

    return respuesta_usuario(nuevo_usuario)


@router.post("/verificar-correo")
def verificar_correo(datos: VerificarCorreo):
    correo = str(datos.correo).strip().lower()

    usuario = usuarios.find_one({"correo": correo})

    if not usuario:
        raise HTTPException(
            status_code=400,
            detail="Código incorrecto o expirado.",
        )

    if usuario.get("correo_verificado", False):
        return {
            "mensaje": "El correo ya está verificado."
        }

    codigo_guardado = usuario.get(
        "codigo_verificacion_hash"
    )

    vencimiento = fecha_utc(
        usuario.get("codigo_verificacion_expira")
    )

    if (
        not codigo_guardado
        or vencimiento is None
        or ahora_utc() > vencimiento
    ):
        raise HTTPException(
            status_code=400,
            detail="El código expiró. Solicita uno nuevo.",
        )

    intentos = usuario.get(
        "codigo_verificacion_intentos",
        0,
    )

    if intentos >= MAX_INTENTOS:
        raise HTTPException(
            status_code=429,
            detail=(
                "Superaste el máximo de intentos. "
                "Solicita un código nuevo."
            ),
        )

    codigo_recibido = hash_codigo(
        datos.codigo,
        str(usuario["_id"]),
    )

    # Se utiliza una actualización condicional para evitar
    # que solicitudes simultáneas superen el límite.
    if not hmac.compare_digest(
        codigo_recibido,
        codigo_guardado,
    ):
        resultado = usuarios.update_one(
            {
                "_id": usuario["_id"],
                "correo_verificado": False,
                "codigo_verificacion_hash": codigo_guardado,
                "codigo_verificacion_intentos": {
                    "$lt": MAX_INTENTOS
                },
            },
            {
                "$inc": {
                    "codigo_verificacion_intentos": 1
                }
            },
        )

        if resultado.modified_count == 0:
            raise HTTPException(
                status_code=429,
                detail=(
                    "No se pudo validar el código. "
                    "Solicita uno nuevo si agotaste "
                    "los intentos."
                ),
            )

        raise HTTPException(
            status_code=400,
            detail="El código ingresado es incorrecto.",
        )

    # La verificación se completa únicamente si el código
    # sigue siendo el mismo y quedan intentos disponibles.
    usuario_actualizado = usuarios.find_one_and_update(
        {
            "_id": usuario["_id"],
            "correo_verificado": False,
            "codigo_verificacion_hash": codigo_guardado,
            "codigo_verificacion_intentos": {
                "$lt": MAX_INTENTOS
            },
            "codigo_verificacion_expira": {
                "$gt": ahora_utc()
            },
        },
        {
            "$set": {
                "correo_verificado": True,
                "fecha_verificacion": ahora_utc(),
            },
            "$unset": {
                "codigo_verificacion_hash": "",
                "codigo_verificacion_expira": "",
                "codigo_verificacion_enviado": "",
                "codigo_verificacion_intentos": "",
            },
        },
        return_document=ReturnDocument.AFTER,
    )

    if usuario_actualizado is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "No fue posible validar el código. "
                "Comprueba que no haya expirado."
            ),
        )

    return {
        "mensaje": (
            "Correo verificado correctamente. "
            "Ya puedes iniciar sesión."
        )
    }


@router.post("/reenviar-codigo")
def reenviar_codigo(datos: ReenviarCodigo):
    correo = str(datos.correo).strip().lower()

    respuesta = {
        "mensaje": (
            "Si existe una cuenta pendiente, "
            "se procesará el envío del código."
        )
    }

    usuario = usuarios.find_one({"correo": correo})

    # Respuesta genérica para evitar revelar
    # si una dirección está registrada.
    if not usuario:
        return respuesta

    if usuario.get("correo_verificado", False):
        return respuesta

    ultimo_envio = fecha_utc(
        usuario.get("codigo_verificacion_enviado")
    )

    if (
        ultimo_envio is not None
        and ahora_utc() - ultimo_envio < ESPERA_REENVIO
    ):
        return respuesta

    try:
        enviar_codigo_a_usuario(usuario)
    except Exception:
        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible enviar el código. "
                "Inténtalo más tarde."
            ),
        )

    return respuesta


@router.post(
    "/login",
    response_model=TokenRespuesta,
)
def iniciar_sesion(datos: UsuarioLogin):
    correo = str(datos.correo).strip().lower()

    usuario = usuarios.find_one({"correo": correo})

    if not usuario:
        raise HTTPException(
            status_code=401,
            detail="Correo o contraseña incorrectos.",
        )

    contrasena_hash = usuario.get("contrasena_hash")

    if (
        not contrasena_hash
        or not verificar_contrasena(
            datos.contrasena,
            contrasena_hash,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Correo o contraseña incorrectos.",
        )

    if not usuario.get("activo", False):
        raise HTTPException(
            status_code=403,
            detail="Esta cuenta está desactivada.",
        )

    # Las cuentas antiguas sin el campo
    # correo_verificado conservan el acceso.
    if usuario.get("correo_verificado", True) is False:
        raise HTTPException(
            status_code=403,
            detail=(
                "Debes verificar tu correo electrónico "
                "antes de iniciar sesión."
            ),
        )

    token = crear_token(str(usuario["_id"]))

    return {
        "access_token": token,
        "token_type": "bearer",
    }


@router.get(
    "/yo",
    response_model=UsuarioRespuesta,
)
def obtener_mi_perfil(
    credenciales: HTTPAuthorizationCredentials | None = Depends(
        seguridad
    ),
):
    if credenciales is None:
        raise HTTPException(
            status_code=401,
            detail="Debes iniciar sesión.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    usuario_id = verificar_token(
        credenciales.credentials
    )

    if not usuario_id or not ObjectId.is_valid(usuario_id):
        raise HTTPException(
            status_code=401,
            detail="Token inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    usuario = usuarios.find_one({
        "_id": ObjectId(usuario_id)
    })

    if not usuario or not usuario.get("activo", False):
        raise HTTPException(
            status_code=401,
            detail="Usuario no encontrado o desactivado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if usuario.get("correo_verificado", True) is False:
        raise HTTPException(
            status_code=403,
            detail="Debes verificar tu correo electrónico.",
        )

    return respuesta_usuario(usuario)
