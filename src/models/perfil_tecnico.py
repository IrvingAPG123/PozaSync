
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

Especialidad = Literal[
    "electricidad",
    "plomeria",
    "climatizacion",
    "pintura",
    "reparaciones",
    "limpieza",
]


class PerfilTecnicoCrear(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    especialidades: list[Especialidad] = Field(
        min_length=1,
        max_length=6,
    )

    descripcion: str = Field(
        min_length=10,
        max_length=1000,
    )

    experiencia_anios: int = Field(
        ge=0,
        le=70,
    )

    colonias_cobertura: list[str] = Field(
        min_length=1,
        max_length=30,
    )

    disponible: bool = True

    portafolio: list[str] = Field(
        default_factory=list,
    )

    @field_validator("especialidades")
    @classmethod
    def validar_especialidades(cls, valores):
        if len(valores) != len(set(valores)):
            raise ValueError(
                "No puedes repetir una especialidad."
            )
        return valores

    @field_validator("colonias_cobertura")
    @classmethod
    def validar_colonias(cls, valores):
        colonias = [colonia.strip() for colonia in valores]

        if any(len(colonia) < 2 for colonia in colonias):
            raise ValueError(
                "Cada colonia debe tener al menos dos caracteres."
            )

        if len({c.lower() for c in colonias}) != len(colonias):
            raise ValueError(
                "No puedes repetir colonias."
            )

        return colonias


class PerfilTecnicoRespuesta(PerfilTecnicoCrear):
    id: str
    usuario_id: str
    nombre: str
    ciudad: str
    calificacion_promedio: float = 0.0
    total_resenas: int = 0
