from io import BytesIO
from datetime import datetime
from zoneinfo import ZoneInfo
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import (
    ParagraphStyle,
    getSampleStyleSheet,
)
from reportlab.lib.units import mm

from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    LongTable,
)


AZUL = colors.HexColor("#208AEF")
AZUL_OSCURO = colors.HexColor("#17365D")
AZUL_CLARO = colors.HexColor("#EAF4FF")

TEXTO = colors.HexColor("#263548")
GRIS = colors.HexColor("#64748B")
GRIS_CLARO = colors.HexColor("#F5F7FB")
BORDE = colors.HexColor("#DCE4EE")

BLANCO = colors.white

ZONA = ZoneInfo("America/Mexico_City")


def texto_seguro(valor):
    if valor is None:
        return "No disponible"

    return escape(str(valor)).replace("\n", "<br/>")


def fecha_local(valor):
    if valor is None:
        return "No disponible"

    if isinstance(valor, datetime):
        fecha = valor

    elif isinstance(valor, str):
        fecha = datetime.fromisoformat(
            valor.replace("Z", "+00:00")
        )

    else:
        raise TypeError(
            f"Formato de fecha no compatible: {type(valor).__name__}"
        )

    if fecha.tzinfo is None:
        fecha = fecha.replace(
            tzinfo=ZoneInfo("UTC")
        )

    return fecha.astimezone(ZONA).strftime(
        "%d/%m/%Y %H:%M"
    )


def crear_estilos():
    estilos = getSampleStyleSheet()

    estilos.add(
        ParagraphStyle(
            name="ReporteTitulo",
            fontName="Helvetica-Bold",
            fontSize=23,
            leading=29,
            textColor=AZUL_OSCURO,
            spaceAfter=12,
        )
    )

    estilos.add(
        ParagraphStyle(
            name="ReporteSubtitulo",
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=AZUL_OSCURO,
            spaceBefore=15,
            spaceAfter=8,
            keepWithNext=True,
        )
    )

    estilos.add(
        ParagraphStyle(
            name="ReporteTexto",
            fontName="Helvetica",
            fontSize=10,
            leading=15,
            textColor=TEXTO,
            spaceAfter=7,
        )
    )

    estilos.add(
        ParagraphStyle(
            name="ReporteNota",
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=GRIS,
            spaceAfter=5,
        )
    )

    estilos.add(
        ParagraphStyle(
            name="ReporteTablaTitulo",
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=15,
            textColor=AZUL_OSCURO,
            spaceBefore=10,
            spaceAfter=6,
            keepWithNext=True,
        )
    )

    estilos.add(
        ParagraphStyle(
            name="ReporteCelda",
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=TEXTO,
            alignment=TA_LEFT,
        )
    )

    estilos.add(
        ParagraphStyle(
            name="ReporteCabecera",
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=13,
            textColor=BLANCO,
        )
    )

    return estilos


def parrafo(valor, estilo):
    return Paragraph(
        texto_seguro(valor),
        estilo,
    )


def encabezado_pagina(canvas, documento):
    ancho, alto = A4

    canvas.saveState()

    canvas.setFillColor(AZUL)
    canvas.rect(
        0,
        alto - 7 * mm,
        ancho,
        7 * mm,
        fill=1,
        stroke=0,
    )

    canvas.setFillColor(AZUL_OSCURO)
    canvas.setFont("Helvetica-Bold", 19)

    canvas.drawString(
        18 * mm,
        alto - 19 * mm,
        "PozaSync",
    )

    canvas.setFillColor(GRIS)
    canvas.setFont("Helvetica", 9)

    canvas.drawRightString(
        ancho - 18 * mm,
        alto - 19 * mm,
        "Panel administrativo",
    )

    canvas.setStrokeColor(BORDE)

    canvas.line(
        18 * mm,
        alto - 24 * mm,
        ancho - 18 * mm,
        alto - 24 * mm,
    )

    canvas.line(
        18 * mm,
        19 * mm,
        ancho - 18 * mm,
        19 * mm,
    )

    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GRIS)

    canvas.drawString(
        18 * mm,
        13 * mm,
        "PozaSync | Uso administrativo interno",
    )

    canvas.drawRightString(
        ancho - 18 * mm,
        13 * mm,
        f"Página {documento.page}",
    )

    canvas.restoreState()


def crear_tabla_pdf(
    columnas,
    filas,
    estilos,
    ancho,
    anchos=None,
):
    cabecera = [
        parrafo(
            columna,
            estilos["ReporteCabecera"],
        )
        for columna in columnas
    ]

    contenido = [cabecera]

    for fila in filas:
        contenido.append([
            parrafo(
                valor,
                estilos["ReporteCelda"],
            )
            for valor in fila
        ])

    if anchos is None:
        anchos = [
            ancho / len(columnas)
        ] * len(columnas)

    tabla = LongTable(
        contenido,
        colWidths=anchos,
        repeatRows=1,
        hAlign="LEFT",
        splitByRow=1,
        splitInRow=1,
    )

    tabla.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                AZUL_OSCURO,
            ),
            (
                "ROWBACKGROUNDS",
                (0, 1),
                (-1, -1),
                [BLANCO, GRIS_CLARO],
            ),
            (
                "VALIGN",
                (0, 0),
                (-1, -1),
                "TOP",
            ),
            (
                "LEFTPADDING",
                (0, 0),
                (-1, -1),
                9,
            ),
            (
                "RIGHTPADDING",
                (0, 0),
                (-1, -1),
                9,
            ),
            (
                "TOPPADDING",
                (0, 0),
                (-1, -1),
                8,
            ),
            (
                "BOTTOMPADDING",
                (0, 0),
                (-1, -1),
                8,
            ),
            (
                "LINEBELOW",
                (0, 0),
                (-1, -1),
                0.4,
                BORDE,
            ),
        ])
    )

    return tabla


def agregar_metadatos(
    elementos,
    reporte,
    estilos,
    ancho,
):
    periodo = reporte["periodo"]

    agrupaciones = {
        "dia": "Diaria",
        "semana": "Semanal",
        "mes": "Mensual",
    }

    filas = [
        [
            "Periodo consultado",
            f'{periodo["dias"]} días',
        ],
        [
            "Desde",
            fecha_local(periodo["inicio"]),
        ],
        [
            "Hasta",
            fecha_local(periodo["fin"]),
        ],
        [
            "Agrupación",
            agrupaciones.get(
                periodo["agrupacion"],
                periodo["agrupacion"],
            ),
        ],
        [
            "Fecha de generación",
            reporte["fecha_generacion_local"],
        ],
        [
            "Zona horaria",
            periodo["zona_horaria"],
        ],
    ]

    contenido = [
        [
            parrafo(
                nombre,
                estilos["ReporteCelda"],
            ),
            parrafo(
                valor,
                estilos["ReporteCelda"],
            ),
        ]
        for nombre, valor in filas
    ]

    tabla = Table(
        contenido,
        colWidths=[
            ancho * 0.35,
            ancho * 0.65,
        ],
        hAlign="LEFT",
    )

    tabla.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (-1, -1),
                AZUL_CLARO,
            ),
            (
                "VALIGN",
                (0, 0),
                (-1, -1),
                "TOP",
            ),
            (
                "TOPPADDING",
                (0, 0),
                (-1, -1),
                7,
            ),
            (
                "BOTTOMPADDING",
                (0, 0),
                (-1, -1),
                7,
            ),
            (
                "LEFTPADDING",
                (0, 0),
                (-1, -1),
                10,
            ),
        ])
    )

    elementos.append(tabla)
    elementos.append(Spacer(1, 10))


def agregar_seccion(
    elementos,
    seccion,
    numero,
    estilos,
    ancho,
):
    elementos.append(
        parrafo(
            f'{numero}. {seccion["titulo"]}',
            estilos["ReporteSubtitulo"],
        )
    )

    elementos.append(
        parrafo(
            seccion["descripcion"],
            estilos["ReporteTexto"],
        )
    )

    indicadores = seccion.get(
        "indicadores",
        [],
    )

    if indicadores:
        filas = [
            [
                indicador["nombre"],
                indicador["valor"],
                indicador.get("descripcion") or "—",
            ]
            for indicador in indicadores
        ]

        elementos.append(
            crear_tabla_pdf(
                [
                    "Indicador",
                    "Resultado",
                    "Descripción",
                ],
                filas,
                estilos,
                ancho,
                [
                    ancho * 0.40,
                    ancho * 0.20,
                    ancho * 0.40,
                ],
            )
        )

        elementos.append(Spacer(1, 8))

    for tabla in seccion.get("tablas", []):
        elementos.append(
            parrafo(
                tabla["titulo"],
                estilos["ReporteTablaTitulo"],
            )
        )

        if not tabla["filas"]:
            elementos.append(
                parrafo(
                    "No existen registros para "
                    "el periodo seleccionado.",
                    estilos["ReporteNota"],
                )
            )

            continue

        elementos.append(
            crear_tabla_pdf(
                tabla["columnas"],
                tabla["filas"],
                estilos,
                ancho,
            )
        )

        elementos.append(Spacer(1, 8))

    observaciones = seccion.get(
        "observaciones",
        [],
    )

    if observaciones:
        elementos.append(
            parrafo(
                "Observaciones",
                estilos["ReporteTablaTitulo"],
            )
        )

        for observacion in observaciones:
            elementos.append(
                parrafo(
                    f"• {observacion}",
                    estilos["ReporteNota"],
                )
            )

    elementos.append(Spacer(1, 12))


def generar_reporte_pdf(reporte: dict) -> bytes:
    memoria = BytesIO()

    documento = SimpleDocTemplate(
        memoria,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=32 * mm,
        bottomMargin=25 * mm,
        title=reporte["titulo"],
        author="PozaSync",
        subject="Reporte administrativo",
        creator="Sistema administrativo PozaSync",
        allowSplitting=1,
    )

    estilos = crear_estilos()

    ancho = documento.width - 12

    elementos = []

    elementos.append(
        parrafo(
            reporte["titulo"],
            estilos["ReporteTitulo"],
        )
    )

    elementos.append(
        parrafo(
            "Sistema de gestión y análisis "
            "de servicios de PozaSync.",
            estilos["ReporteTexto"],
        )
    )

    agregar_metadatos(
        elementos,
        reporte,
        estilos,
        ancho,
    )

    for numero, seccion in enumerate(
        reporte["secciones"],
        start=1,
    ):
        agregar_seccion(
            elementos,
            seccion,
            numero,
            estilos,
            ancho,
        )

    elementos.append(
        parrafo(
            f'Fuente: {reporte["fuente"]}',
            estilos["ReporteNota"],
        )
    )

    elementos.append(
        parrafo(
            "Documento generado automáticamente. "
            "Los indicadores corresponden a la "
            "información disponible al momento "
            "de su generación.",
            estilos["ReporteNota"],
        )
    )

    documento.build(
        elementos,
        onFirstPage=encabezado_pagina,
        onLaterPages=encabezado_pagina,
    )

    resultado = memoria.getvalue()

    memoria.close()

    return resultado