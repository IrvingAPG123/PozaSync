import hashlib
import secrets

from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import HTTPException

from src.database import db, usuarios

from src.services.auth_service import crear_token_admin


# ==========================================
# CONFIGURACION DEL ACCESO WEB
# ==========================================

codigos_acceso = db["codigos_acceso_web"]

DURACION_CODIGO_SEGUNDOS = 60


# ==========================================
# INDICE DE EXPIRACION AUTOMATICA
# ==========================================

def configurar_indices_acceso_web():

    codigos_acceso.create_index(
        "fecha_expiracion",
        expireAfterSeconds=0,
    )


# ==========================================
# FECHA ACTUAL UTC
# ==========================================

def ahora_utc() -> datetime:

    return datetime.now(timezone.utc)


# ==========================================
# PROTEGER CODIGO TEMPORAL
# ==========================================

def proteger_codigo(codigo: str) -> str:

    return hashlib.sha256(
        codigo.encode("utf-8")
    ).hexdigest()


# ==========================================
# VALIDAR VERSION ADMINISTRATIVA
# ==========================================

def validar_version_admin(administrador):

    version = administrador.get(
        "version_token_admin", 0
    )

    if type(version) is not int or version < 0:

        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible establecer "
                "la sesión administrativa."
            ),
        )

    return version


# ==========================================
# GENERAR CODIGO DE ACCESO TEMPORAL
# ==========================================

def crear_codigo_acceso_web(administrador):

    if (
        administrador.get("rol") != "administrador"
        or administrador.get("activo") is not True
        or administrador.get("correo_verificado") is not True
    ):

        raise HTTPException(
            status_code=403,
            detail="Acceso no autorizado.",
        )

    version = validar_version_admin(
        administrador
    )

    codigo = secrets.token_urlsafe(32)

    momento = ahora_utc()

    codigos_acceso.insert_one({
        "_id": proteger_codigo(codigo),

        "usuario_id": administrador["_id"],

        "version_token_admin": version,

        "fecha_creacion": momento,

        "fecha_expiracion": (
            momento + timedelta(
                seconds=DURACION_CODIGO_SEGUNDOS
            )
        ),
    })

    return codigo


# ==========================================
# CANJEAR CODIGO TEMPORAL
# ==========================================

def canjear_codigo_acceso_web(codigo: str):

    if (
        not isinstance(codigo, str)
        or not 32 <= len(codigo) <= 128
    ):

        raise HTTPException(
            status_code=401,
            detail="Código de acceso inválido.",
        )

    # El código se elimina al recuperarlo.
    # Esto evita que pueda utilizarse dos veces.

    registro = codigos_acceso.find_one_and_delete({
        "_id": proteger_codigo(codigo),

        "fecha_expiracion": {
            "$gt": ahora_utc(),
        },
    })

    if registro is None:

        raise HTTPException(
            status_code=401,
            detail=(
                "El código de acceso es inválido, "
                "expiró o ya fue utilizado."
            ),
        )

    usuario_id = registro.get("usuario_id")

    if not isinstance(usuario_id, ObjectId):

        raise HTTPException(
            status_code=401,
            detail="Acceso inválido.",
        )

    administrador = usuarios.find_one({
        "_id": usuario_id,

        "rol": "administrador",

        "activo": True,

        "correo_verificado": True,
    })

    if administrador is None:

        raise HTTPException(
            status_code=403,
            detail="Acceso no autorizado.",
        )

    version_actual = validar_version_admin(
        administrador
    )

    version_codigo = registro.get(
        "version_token_admin"
    )

    if (
        type(version_codigo) is not int
        or version_actual != version_codigo
    ):

        raise HTTPException(
            status_code=401,
            detail="La sesión fue revocada.",
        )

    token = crear_token_admin(
        str(administrador["_id"]),

        version_token_admin=version_actual,
    )

    return {
        "access_token": token,

        "token_type": "bearer",
    }