from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)


class ConfiguracionGeneral(BaseModel):

    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    nombre_plataforma: str = Field(
        default="PozaSync",
        min_length=2,
        max_length=80,
    )

    descripcion: str = Field(
        default="Plataforma de servicios técnicos",
        max_length=500,
    )

    correo_contacto: EmailStr | None = None

    correo_soporte: EmailStr | None = None

    telefono_soporte: str = Field(
        default="",
        max_length=25,
    )

    ciudad: str = Field(
        default="Poza Rica",
        min_length=2,
        max_length=100,
    )

    estado: str = Field(
        default="Veracruz",
        min_length=2,
        max_length=100,
    )

    pais: str = Field(
        default="México",
        min_length=2,
        max_length=100,
    )

    zona_horaria: Literal[
        "America/Mexico_City"
    ] = "America/Mexico_City"

    mensaje_informativo: str = Field(
        default="",
        max_length=500,
    )

    @field_validator(
        "correo_contacto",
        "correo_soporte",
        mode="before",
    )
    @classmethod
    def normalizar_correo(cls, valor):

        if isinstance(valor, str):

            valor = valor.strip()

            if not valor:
                return None

        return valor

    @field_validator("telefono_soporte")
    @classmethod
    def validar_telefono(cls, valor):

        permitidos = set(
            "0123456789+()- "
        )

        if any(
            caracter not in permitidos
            for caracter in valor
        ):
            raise ValueError(
                "El teléfono contiene caracteres inválidos."
            )

        if valor:

            cantidad_digitos = sum(
                caracter in "0123456789"
                for caracter in valor
            )

            if not 7 <= cantidad_digitos <= 15:

                raise ValueError(
                    "El teléfono debe contener entre "
                    "7 y 15 dígitos."
                )

        return valor


class ActualizarConfiguracion(
    ConfiguracionGeneral
):

    version: int = Field(
        ge=0,
    )

    motivo: str = Field(
        min_length=5,
        max_length=300,
    )


class ConfiguracionRespuesta(
    ConfiguracionGeneral
):

    version: int = Field(
        default=0,
        ge=0,
    )

    fecha_creacion: datetime | None = None

    fecha_actualizacion: datetime | None = None


class ActualizarCuentaAdministrativa(
    BaseModel
):

    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    nombre: str = Field(
        min_length=2,
        max_length=100,
    )


class CambiarContrasenaAdministrativa(
    BaseModel
):

    model_config = ConfigDict(
        extra="forbid",
    )

    contrasena_actual: str = Field(
        min_length=1,
        max_length=128,
        repr=False,
    )

    contrasena_nueva: str = Field(
        min_length=12,
        max_length=128,
        repr=False,
    )

    confirmar_contrasena: str = Field(
        min_length=12,
        max_length=128,
        repr=False,
    )

    @field_validator("contrasena_nueva")
    @classmethod
    def validar_contrasena(cls, valor):

        if not any(
            caracter.isupper()
            for caracter in valor
        ):
            raise ValueError(
                "La contraseña debe contener "
                "una letra mayúscula."
            )

        if not any(
            caracter.islower()
            for caracter in valor
        ):
            raise ValueError(
                "La contraseña debe contener "
                "una letra minúscula."
            )

        if not any(
            caracter.isdigit()
            for caracter in valor
        ):
            raise ValueError(
                "La contraseña debe contener "
                "un número."
            )

        if valor != valor.strip():
            raise ValueError(
                "La contraseña no debe comenzar "
                "ni terminar con espacios."
            )

        return valor


class RevocarSesionesAdministrativas(
    BaseModel
):

    model_config = ConfigDict(
        extra="forbid",
    )

    contrasena_actual: str = Field(
        min_length=1,
        max_length=128,
        repr=False,
    )