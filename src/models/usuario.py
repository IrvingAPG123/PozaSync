
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)


# ==========================================
# MODELO BASE DE POZASYNC
# ==========================================

class ModeloPozaSync(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )


# ==========================================
# REGISTRO DE USUARIOS
# ==========================================

class UsuarioRegistro(ModeloPozaSync):
    nombre: str = Field(
        min_length=2,
        max_length=100,
    )

    correo: EmailStr

    contrasena: str = Field(
        min_length=8,
        max_length=128,
    )

    rol: Literal["cliente", "tecnico"]

    colonia: str = Field(
        min_length=2,
        max_length=100,
    )

    ciudad: str = Field(
        min_length=2,
        max_length=100,
    )

    foto_perfil: str | None = None

    @field_validator("nombre", "colonia", "ciudad")
    @classmethod
    def validar_texto(cls, valor: str) -> str:
        if not valor.strip():
            raise ValueError(
                "Este campo no puede estar vacío."
            )

        return valor

    @field_validator("contrasena")
    @classmethod
    def validar_contrasena(cls, valor: str) -> str:
        if not any(
            caracter.isalpha()
            for caracter in valor
        ):
            raise ValueError(
                "La contraseña debe contener "
                "al menos una letra."
            )

        if not any(
            caracter.isdigit()
            for caracter in valor
        ):
            raise ValueError(
                "La contraseña debe contener "
                "al menos un número."
            )

        return valor


# ==========================================
# INICIO DE SESION
# ==========================================

class UsuarioLogin(ModeloPozaSync):
    correo: EmailStr

    contrasena: str


# ==========================================
# RESPUESTA PUBLICA DEL USUARIO
# ==========================================

class UsuarioRespuesta(BaseModel):
    id: str

    nombre: str

    correo: EmailStr

    rol: Literal["cliente", "tecnico"]

    colonia: str

    ciudad: str

    foto_perfil: str | None = None

    activo: bool = True


# ==========================================
# RESPUESTA DE AUTENTICACION JWT
# ==========================================

class TokenRespuesta(BaseModel):
    access_token: str

    token_type: str = "bearer"
