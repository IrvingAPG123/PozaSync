
from pydantic import BaseModel, Field, ConfigDict


class PerfilTecnicoCrear(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    especialidad: str = Field(
        min_length=2,
        max_length=100
    )

    descripcion: str = Field(
        min_length=10,
        max_length=1000
    )

    experiencia_anios: int = Field(
        ge=0,
        le=70
    )

    colonias_cobertura: list[str] = Field(
        min_length=1
    )

    disponible: bool = True

    portafolio: list[str] = Field(
        default_factory=list
    )


class PerfilTecnicoRespuesta(PerfilTecnicoCrear):
    id: str
    usuario_id: str
    nombre: str
    ciudad: str
    calificacion_promedio: float = 0.0
    total_resenas: int = 0
