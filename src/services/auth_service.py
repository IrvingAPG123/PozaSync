import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt

from bson import ObjectId
from dotenv import load_dotenv
from pwdlib import PasswordHash
from jwt.exceptions import InvalidTokenError

from src.database import usuarios


# ==========================================
# CONFIGURACION PRIVADA
# ==========================================

BASE_DIR = Path(__file__).resolve().parent.parent.parent

load_dotenv(BASE_DIR / ".env")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not JWT_SECRET_KEY or len(JWT_SECRET_KEY) < 32:
    raise ValueError(
        "Configura una JWT_SECRET_KEY segura en .env"
    )

JWT_ALGORITHM = "HS256"

TOKEN_EXPIRACION_MINUTOS = 60
TOKEN_ADMIN_EXPIRACION_MINUTOS = 30

JWT_ADMIN_AUDIENCE = "pozasync-admin"

password_hash = PasswordHash.recommended()


# ==========================================
# SEGURIDAD DE CONTRASENAS
# ==========================================

def proteger_contrasena(contrasena: str) -> str:
    return password_hash.hash(contrasena)


def verificar_contrasena(
    contrasena: str,
    contrasena_hash: str,
) -> bool:
    return password_hash.verify(
        contrasena,
        contrasena_hash,
    )


# ==========================================
# VERSION DE SESION
# ==========================================

def obtener_version_token(usuario_id: str) -> int:
    if not ObjectId.is_valid(usuario_id):
        raise ValueError("Identificador invalido.")

    usuario = usuarios.find_one(
        {
            "_id": ObjectId(usuario_id),
        },
        {
            "version_token": 1,
        },
    )

    if usuario is None:
        raise ValueError("Usuario no encontrado.")

    version = usuario.get("version_token", 0)

    if type(version) is not int or version < 0:
        raise ValueError("Version de token invalida.")

    return version


# ==========================================
# GENERAR TOKEN PARA ANDROID
# ==========================================

def crear_token(
    usuario_id: str,
    version_token: int | None = None,
) -> str:

    if version_token is None:
        version_token = obtener_version_token(
            usuario_id
        )

    if type(version_token) is not int or version_token < 0:
        raise ValueError("Version de token invalida.")

    ahora = datetime.now(timezone.utc)

    datos = {
        "sub": usuario_id,
        "iat": ahora,
        "exp": ahora + timedelta(
            minutes=TOKEN_EXPIRACION_MINUTOS
        ),
        "version_token": version_token,
    }

    return jwt.encode(
        datos,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


# ==========================================
# VERIFICAR TOKEN PARA ANDROID
# ==========================================

def verificar_token(token: str) -> str | None:
    try:
        datos = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={
                "require": ["sub", "iat", "exp"],
            },
        )

        usuario_id = datos.get("sub")

        if (
            not isinstance(usuario_id, str)
            or not ObjectId.is_valid(usuario_id)
        ):
            return None

        version_token = datos.get(
            "version_token", 0
        )

        if (
            type(version_token) is not int
            or version_token < 0
        ):
            return None

        usuario = usuarios.find_one(
            {
                "_id": ObjectId(usuario_id),
                "rol": {
                    "$in": ["cliente", "tecnico"]
                },
                "activo": True,
                "correo_verificado": {
                    "$ne": False
                },
            },
            {
                "_id": 1,
                "version_token": 1,
            },
        )

        if not usuario:
            return None

        version_actual = usuario.get(
            "version_token", 0
        )

        if (
            type(version_actual) is not int
            or version_actual < 0
            or version_token != version_actual
        ):
            return None

        return usuario_id

    except InvalidTokenError:
        return None


# ==========================================
# GENERAR TOKEN ADMINISTRATIVO
# ==========================================

def obtener_version_token_admin(usuario_id: str) -> int:

    if not ObjectId.is_valid(usuario_id):
        raise ValueError("Identificador invalido.")

    administrador = usuarios.find_one(
        {
            "_id": ObjectId(usuario_id),
            "rol": "administrador",
            "activo": True,
            "correo_verificado": True,
        },
        {
            "version_token_admin": 1,
        },
    )

    if administrador is None:
        raise ValueError("Administrador no disponible.")

    version = administrador.get(
        "version_token_admin", 0
    )

    if (
        not isinstance(version, int)
        or isinstance(version, bool)
        or version < 0
    ):
        raise ValueError("Version administrativa invalida.")

    return version


def crear_token_admin(
    usuario_id: str,
    version_token_admin: int | None = None,
) -> str:

    if version_token_admin is None:

        version_token_admin = obtener_version_token_admin(
            usuario_id
        )

    if (
        not isinstance(version_token_admin, int)
        or isinstance(version_token_admin, bool)
        or version_token_admin < 0
    ):
        raise ValueError("Version administrativa invalida.")

    ahora = datetime.now(timezone.utc)

    datos = {
        "sub": usuario_id,
        "iat": ahora,
        "exp": ahora + timedelta(
            minutes=TOKEN_ADMIN_EXPIRACION_MINUTOS
        ),
        "aud": JWT_ADMIN_AUDIENCE,
        "scope": "administrador",
        "version_token_admin": version_token_admin,
    }

    return jwt.encode(
        datos,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


# ==========================================
# VERIFICAR TOKEN ADMINISTRATIVO
# ==========================================

def verificar_token_admin(token: str) -> str | None:

    try:

        datos = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            audience=JWT_ADMIN_AUDIENCE,
            options={
                "require": [
                    "sub",
                    "iat",
                    "exp",
                    "aud",
                    "scope",
                    "version_token_admin",
                ],
            },
        )

        if datos.get("scope") != "administrador":
            return None

        usuario_id = datos.get("sub")

        if (
            not isinstance(usuario_id, str)
            or not ObjectId.is_valid(usuario_id)
        ):
            return None

        version_token = datos.get(
            "version_token_admin"
        )

        if (
            type(version_token) is not int
            or version_token < 0
        ):
            return None

        administrador = usuarios.find_one(
            {
                "_id": ObjectId(usuario_id),
                "rol": "administrador",
                "activo": True,
                "correo_verificado": True,
            },
            {
                "version_token_admin": 1,
            },
        )

        if administrador is None:
            return None

        version_actual = administrador.get(
            "version_token_admin", 0
        )

        if (
            not isinstance(version_actual, int)
            or isinstance(version_actual, bool)
            or version_actual < 0
            or version_token != version_actual
        ):
            return None

        return usuario_id

    except InvalidTokenError:
        return None
