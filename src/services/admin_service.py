from bson import ObjectId

from fastapi import (
    Depends,
    HTTPException,
    status,
)

from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)

from src.database import usuarios

from src.services.auth_service import (
    verificar_token_admin,
)


# ==========================================
# SEGURIDAD ADMINISTRATIVA
# ==========================================

seguridad_admin = HTTPBearer(
    auto_error=False,
    scheme_name="TokenAdministrativo",
)


# ==========================================
# VERIFICAR ADMINISTRADOR
# ==========================================

def obtener_administrador(
    credenciales: HTTPAuthorizationCredentials | None = Depends(
        seguridad_admin
    ),
):
    if credenciales is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Debes iniciar sesión.",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    usuario_id = verificar_token_admin(
        credenciales.credentials
    )

    if (
        not usuario_id
        or not ObjectId.is_valid(usuario_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión administrativa inválida o expirada.",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    usuario = usuarios.find_one(
        {
            "_id": ObjectId(usuario_id),
        },
        {
            "nombre": 1,
            "correo": 1,
            "rol": 1,
            "activo": 1,
            "correo_verificado": 1,
            "version_token_admin": 1,
        },
    )

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado.",
        )

    if usuario.get("rol") != "administrador":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos administrativos.",
        )

    if usuario.get("activo") is not True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta está desactivada.",
        )

    if usuario.get("correo_verificado") is not True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El correo no está verificado.",
        )

    from src.services import auth_service

    try:
        datos_token = auth_service.jwt.decode(
            credenciales.credentials,
            auth_service.JWT_SECRET_KEY,
            algorithms=[auth_service.JWT_ALGORITHM],
            audience=auth_service.JWT_ADMIN_AUDIENCE,
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
    except auth_service.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Sesion administrativa invalida.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    version_autenticada = datos_token.get(
        "version_token_admin"
    )

    version_actual = usuario.get(
        "version_token_admin", 0
    )

    if (
        type(version_autenticada) is not int
        or version_autenticada < 0
        or not isinstance(version_actual, int)
        or isinstance(version_actual, bool)
        or version_autenticada != version_actual
    ):
        raise HTTPException(
            status_code=401,
            detail="La sesion administrativa fue revocada.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    usuario["version_token_admin"] = version_autenticada

    return usuario