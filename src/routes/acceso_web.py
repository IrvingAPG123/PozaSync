from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.database import usuarios

from src.models.usuario import UsuarioLogin

from src.services.auth_service import (
    verificar_contrasena,
)

from src.services.sesiones_service import (
    crear_sesion_movil,
)

from src.services.acceso_web_service import (
    crear_codigo_acceso_web,
    canjear_codigo_acceso_web,
)


# ==========================================
# CONFIGURACION DE RUTAS
# ==========================================

router = APIRouter(
    tags=["Acceso web"],
)


# ==========================================
# MODELOS DE RESPUESTA
# ==========================================

class SesionUsuarioWeb(BaseModel):

    rol: Literal["cliente", "tecnico"]

    access_token: str

    refresh_token: str

    token_type: str = "bearer"


class AccesoAdministradorWeb(BaseModel):

    rol: Literal["administrador"]

    codigo_acceso: str

    expira_en: int = 60


class CanjeAccesoWeb(BaseModel):

    codigo: str = Field(
        min_length=32,
        max_length=128,
    )


class SesionAdministradorWeb(BaseModel):

    access_token: str

    token_type: str = "bearer"


# ==========================================
# INICIO DE SESION WEB UNIFICADO
# ==========================================

@router.post(
    "/auth/login-web",
    response_model=(
        SesionUsuarioWeb | AccesoAdministradorWeb
    ),
)
def iniciar_sesion_web(datos: UsuarioLogin):

    correo = str(datos.correo).strip().lower()

    usuario = usuarios.find_one({
        "correo": correo,

        "rol": {
            "$in": [
                "cliente",
                "tecnico",
                "administrador",
            ]
        },
    })

    if usuario is None:

        raise HTTPException(
            status_code=401,
            detail="Correo o contraseña incorrectos.",
        )

    contrasena_hash = usuario.get(
        "contrasena_hash"
    )

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

    if usuario.get("activo") is not True:

        raise HTTPException(
            status_code=403,
            detail="La cuenta está desactivada.",
        )

    rol = usuario.get("rol")

    # ======================================
    # ACCESO ADMINISTRATIVO
    # ======================================

    if rol == "administrador":

        if usuario.get("correo_verificado") is not True:

            raise HTTPException(
                status_code=403,
                detail="El correo no está verificado.",
            )

        codigo = crear_codigo_acceso_web(
            usuario
        )

        return {
            "rol": "administrador",

            "codigo_acceso": codigo,

            "expira_en": 60,
        }

    # ======================================
    # ACCESO DE CLIENTES Y TECNICOS
    # ======================================

    if usuario.get("correo_verificado", True) is False:

        raise HTTPException(
            status_code=403,
            detail=(
                "Debes verificar tu correo electrónico "
                "antes de iniciar sesión."
            ),
        )

    sesion = crear_sesion_movil(usuario)

    return {
        **sesion,

        "rol": rol,
    }


# ==========================================
# CANJEAR ACCESO ADMINISTRATIVO
# ==========================================

@router.post(
    "/admin/canjear-acceso",
    response_model=SesionAdministradorWeb,
)
def canjear_acceso_administrativo(
    datos: CanjeAccesoWeb,
):

    return canjear_codigo_acceso_web(
        datos.codigo
    )