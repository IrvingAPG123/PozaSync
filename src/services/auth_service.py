
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from dotenv import load_dotenv
from pwdlib import PasswordHash
from jwt.exceptions import InvalidTokenError

# Cargar configuracion privada
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not JWT_SECRET_KEY or len(JWT_SECRET_KEY) < 32:
    raise ValueError(
        "Configura una JWT_SECRET_KEY segura en .env"
    )

JWT_ALGORITHM = "HS256"
TOKEN_EXPIRACION_MINUTOS = 60

# Algoritmo seguro para contrasenas
password_hash = PasswordHash.recommended()


def proteger_contrasena(contrasena: str) -> str:
    return password_hash.hash(contrasena)


def verificar_contrasena(
    contrasena: str,
    contrasena_hash: str
) -> bool:
    return password_hash.verify(
        contrasena,
        contrasena_hash
    )


def crear_token(usuario_id: str) -> str:
    ahora = datetime.now(timezone.utc)

    datos = {
        "sub": usuario_id,
        "iat": ahora,
        "exp": ahora + timedelta(
            minutes=TOKEN_EXPIRACION_MINUTOS
        )
    }

    return jwt.encode(
        datos,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM
    )


def verificar_token(token: str) -> str | None:
    try:
        datos = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM]
        )

        usuario_id = datos.get("sub")

        if not isinstance(usuario_id, str) or not usuario_id:
            return None

        return usuario_id

    except InvalidTokenError:
        return None
