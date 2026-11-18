from pydantic import BaseModel, ConfigDict, Field


class ResenaCrear(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    servicio_id: str = Field(
        min_length=1,
        max_length=200,
    )

    calificacion: int = Field(
        ge=1,
        le=5,
        strict=True,
    )

    comentario: str = Field(
        default="",
        max_length=1000,
    )