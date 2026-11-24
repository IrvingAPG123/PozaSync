from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    Query,
    Response,
)

from src.services.admin_service import (
    obtener_administrador,
)

from src.routes.admin_estadisticas import (
    obtener_estadisticas_avanzadas,
)

from src.services.reportes_service import (
    TipoReporte,
    TITULOS_REPORTES,
    construir_reporte,
)

from src.services.reportes_pdf import (
    generar_reporte_pdf,
)

from src.services.reportes_excel import (
    generar_reporte_excel,
)


router = APIRouter(
    prefix="/admin/reportes",
    tags=["Reportes administrativos"],
)

Agrupacion = Literal[
    "dia",
    "semana",
    "mes",
]

MIME_EXCEL = (
    "application/vnd.openxmlformats-"
    "officedocument.spreadsheetml.sheet"
)


def preparar_reporte(
    tipo,
    dias,
    agrupacion,
    administrador,
):
    datos = obtener_estadisticas_avanzadas(
        dias=dias,
        agrupacion=agrupacion,
        administrador=administrador,
    )

    return construir_reporte(
        tipo=tipo,
        datos=datos,
    )


def respuesta_archivo(
    contenido,
    reporte,
    tipo,
    dias,
    agrupacion,
    extension,
    media_type,
):
    fecha = str(
        reporte["fecha_generacion"]
    )[:10]

    nombre = (
        f"PozaSync_{tipo}_"
        f"{dias}dias_{agrupacion}_{fecha}.{extension}"
    )

    return Response(
        content=contenido,
        media_type=media_type,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{nombre}"'
            ),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Access-Control-Expose-Headers": (
                "Content-Disposition"
            ),
        },
    )


@router.get("/tipos")
def listar_tipos_reportes(
    response: Response,
    administrador=Depends(obtener_administrador),
):
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"

    return {
        "reportes": [
            {
                "tipo": tipo,
                "titulo": titulo,
            }
            for tipo, titulo in TITULOS_REPORTES.items()
        ],
        "periodos": [7, 30, 90, 365],
        "agrupaciones": ["dia", "semana", "mes"],
        "formatos_disponibles": [
            "json",
            "pdf",
            "excel",
        ],
    }


@router.get("/vista-previa")
def obtener_vista_previa(
    response: Response,
    tipo: TipoReporte = Query("general"),
    dias: int = Query(30, ge=7, le=365),
    agrupacion: Agrupacion = Query("dia"),
    administrador=Depends(obtener_administrador),
):
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"

    return preparar_reporte(
        tipo,
        dias,
        agrupacion,
        administrador,
    )


@router.get(
    "/pdf",
    response_class=Response,
    responses={
        200: {
            "description": "Reporte PDF",
            "content": {
                "application/pdf": {},
            },
        },
    },
)
def descargar_reporte_pdf(
    tipo: TipoReporte = Query("general"),
    dias: int = Query(30, ge=7, le=365),
    agrupacion: Agrupacion = Query("dia"),
    administrador=Depends(obtener_administrador),
):
    reporte = preparar_reporte(
        tipo,
        dias,
        agrupacion,
        administrador,
    )

    contenido = generar_reporte_pdf(reporte)

    return respuesta_archivo(
        contenido,
        reporte,
        tipo,
        dias,
        agrupacion,
        "pdf",
        "application/pdf",
    )


@router.get(
    "/excel",
    response_class=Response,
    responses={
        200: {
            "description": "Reporte Excel",
            "content": {
                MIME_EXCEL: {},
            },
        },
    },
)
def descargar_reporte_excel(
    tipo: TipoReporte = Query("general"),
    dias: int = Query(30, ge=7, le=365),
    agrupacion: Agrupacion = Query("dia"),
    administrador=Depends(obtener_administrador),
):
    reporte = preparar_reporte(
        tipo,
        dias,
        agrupacion,
        administrador,
    )

    contenido = generar_reporte_excel(reporte)

    return respuesta_archivo(
        contenido,
        reporte,
        tipo,
        dias,
        agrupacion,
        "xlsx",
        MIME_EXCEL,
    )