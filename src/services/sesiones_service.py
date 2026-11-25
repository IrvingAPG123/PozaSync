
import hashlib
import secrets

from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import HTTPException
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError

from src.database import db
from src.services.auth_service import crear_token


sesiones = db["sesiones_moviles"]
usuarios = db["usuarios"]

DURACION_SESION = timedelta(days=30)


def ahora_utc():
    return datetime.now(timezone.utc)


def generar_token_renovacion():
    return secrets.token_urlsafe(48)


def hash_token(token: str):
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def sesion_invalida():
    return HTTPException(
        status_code=401,
        detail="La sesión expiró o fue revocada.",
    )


def crear_sesion_movil(usuario: dict):
    version = usuario.get("version_token", 0)

    if (
        usuario.get("rol") not in ("cliente", "tecnico")
        or usuario.get("activo") is not True
        or usuario.get("correo_verificado", True) is False
        or type(version) is not int
        or version < 0
    ):
        raise sesion_invalida()

    token = generar_token_renovacion()
    ahora = ahora_utc()

    sesion_id = ObjectId()

    acceso = crear_token(
        str(usuario["_id"]),
        version_token=version,
        sesion_id=str(sesion_id),
    )

    try:
        sesiones.insert_one({
            "_id": sesion_id,
            "usuario_id": usuario["_id"],
            "token_hash": hash_token(token),
            "version_token": version,
            "fecha_creacion": ahora,
            "fecha_actualizacion": ahora,
            "fecha_expiracion": ahora + DURACION_SESION,
        })

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo guardar la sesión.",
        ) from None

    return {
        "access_token": acceso,
        "refresh_token": token,
        "token_type": "bearer",
    }


def renovar_sesion_movil(refresh_token: str):
    if not 32 <= len(refresh_token) <= 256:
        raise sesion_invalida()

    ahora = ahora_utc()
    token_hash = hash_token(refresh_token)

    try:
        sesion = sesiones.find_one({
            "token_hash": token_hash,
            "fecha_expiracion": {"$gt": ahora},
        })

        if sesion is None:
            raise sesion_invalida()

        usuario = usuarios.find_one({
            "_id": sesion["usuario_id"],
            "rol": {"$in": ["cliente", "tecnico"]},
            "activo": True,
            "correo_verificado": {"$ne": False},
        })

        if usuario is None:
            raise sesion_invalida()

        version = usuario.get("version_token", 0)

        if (
            type(version) is not int
            or version < 0
            or version != sesion.get("version_token")
        ):
            raise sesion_invalida()

        nuevo_token = generar_token_renovacion()

        acceso = crear_token(
            str(usuario["_id"]),
            version_token=version,
            sesion_id=str(sesion["_id"]),
        )

        actualizada = sesiones.find_one_and_update(
            {
                "_id": sesion["_id"],
                "token_hash": token_hash,
                "fecha_expiracion": {"$gt": ahora_utc()},
                "version_token": version,
            },
            {
                "$set": {
                    "token_hash": hash_token(nuevo_token),
                    "fecha_actualizacion": ahora_utc(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )

        if actualizada is None:
            raise sesion_invalida()

        return {
            "access_token": acceso,
            "refresh_token": nuevo_token,
            "token_type": "bearer",
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo renovar la sesión.",
        ) from None


def cerrar_sesion_movil(refresh_token: str):
    if not 32 <= len(refresh_token) <= 256:
        raise sesion_invalida()

    try:
        sesiones.delete_one({
            "token_hash": hash_token(refresh_token),
        })

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo cerrar la sesión.",
        ) from None

    return {
        "mensaje": "Sesión cerrada correctamente."
    }
