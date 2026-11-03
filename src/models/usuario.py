
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, ConfigDict


# Datos que recibiremos al registrar un usuario
class UsuarioRegistro(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str = Field(
        min_length=2,
        max_length=100
    )

    correo: EmailStr

    contrasena: str = Field(
        min_length=8,
        max_length=128
    )

    rol: Literal["cliente", "tecnico"]

    colonia: str = Field(
        min_length=2,
        max_length=100
    )

    ciudad: str = Field(
        min_length=2,
        max_length=100
    )

    foto_perfil: str | None = None


# Datos que recibiremos al iniciar sesion
class UsuarioLogin(BaseModel):
    correo: EmailStr
    contrasena: str


# Datos publicos que devolveremos desde la API
class UsuarioRespuesta(BaseModel):
    id: str
    nombre: str
    correo: EmailStr
    rol: Literal["cliente", "tecnico"]
    colonia: str
    ciudad: str
    foto_perfil: str | None = None
    activo: bool = True


# Respuesta al iniciar sesion
class TokenRespuesta(BaseModel):
    access_token: str
    token_type: str = "bearer"
