from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import (
    Font,
    PatternFill,
    Alignment,
    Border,
    Side,
)
from openpyxl.utils import get_column_letter

from src.services.reportes_pdf import fecha_local


AZUL = "208AEF"
AZUL_OSCURO = "17365D"
AZUL_CLARO = "EAF4FF"
BLANCO = "FFFFFF"
GRIS_CLARO = "F5F7FB"
GRIS = "64748B"
TEXTO = "263548"
BORDE = "DCE4EE"


def escribir_celda(hoja, fila, columna, valor):
    celda = hoja.cell(
        row=fila,
        column=columna,
    )

    if isinstance(valor, str):
        celda.value = valor

        # Evitar interpretar textos como formulas.
        celda.data_type = "s"

    elif valor is None:
        celda.value = "No disponible"

    else:
        celda.value = valor

    return celda


def configurar_hoja(hoja):
    hoja.sheet_view.showGridLines = False
    hoja.sheet_properties.pageSetUpPr.fitToPage = True
    hoja.sheet_properties.tabColor = AZUL

    hoja.freeze_panes = "A5"

    hoja.page_setup.orientation = "landscape"
    hoja.page_setup.paperSize = hoja.PAPERSIZE_A4
    hoja.page_setup.fitToWidth = 1
    hoja.page_setup.fitToHeight = 0

    hoja.oddFooter.left.text = (
        "PozaSync | Uso administrativo interno"
    )

    hoja.oddFooter.right.text = (
        "Página &P de &N"
    )


def bloque_texto(
    hoja,
    fila,
    texto,
    columnas=4,
    fondo=BLANCO,
    color=TEXTO,
    tamano=11,
    negrita=False,
    altura=28,
):
    hoja.merge_cells(
        start_row=fila,
        start_column=1,
        end_row=fila,
        end_column=columnas,
    )

    celda = escribir_celda(
        hoja,
        fila,
        1,
        texto,
    )

    celda.font = Font(
        name="Calibri",
        size=tamano,
        bold=negrita,
        color=color,
    )

    celda.fill = PatternFill(
        "solid",
        fgColor=fondo,
    )

    celda.alignment = Alignment(
        vertical="center",
        horizontal="left",
        wrap_text=True,
        indent=1,
    )

    hoja.row_dimensions[fila].height = altura


def encabezado_hoja(
    hoja,
    titulo,
    descripcion,
    columnas=4,
):
    configurar_hoja(hoja)

    bloque_texto(
        hoja,
        1,
        "PozaSync | Panel administrativo",
        columnas,
        fondo=AZUL_OSCURO,
        color=BLANCO,
        tamano=18,
        negrita=True,
        altura=38,
    )

    bloque_texto(
        hoja,
        2,
        titulo,
        columnas,
        fondo=AZUL_CLARO,
        color=AZUL_OSCURO,
        tamano=15,
        negrita=True,
        altura=34,
    )

    bloque_texto(
        hoja,
        3,
        descripcion,
        columnas,
        color=GRIS,
        altura=36,
    )

    return 5


def agregar_tabla(
    hoja,
    fila,
    titulo,
    columnas,
    registros,
    ancho_total=4,
):
    bloque_texto(
        hoja,
        fila,
        titulo,
        ancho_total,
        fondo=AZUL_CLARO,
        color=AZUL_OSCURO,
        negrita=True,
        tamano=12,
    )

    fila += 1

    for indice, nombre in enumerate(
        columnas,
        start=1,
    ):
        celda = escribir_celda(
            hoja,
            fila,
            indice,
            nombre,
        )

        celda.font = Font(
            name="Calibri",
            bold=True,
            color=BLANCO,
            size=11,
        )

        celda.fill = PatternFill(
            "solid",
            fgColor=AZUL_OSCURO,
        )

        celda.alignment = Alignment(
            vertical="center",
            wrap_text=True,
        )

    hoja.row_dimensions[fila].height = 28

    fila += 1

    if not registros:
        bloque_texto(
            hoja,
            fila,
            "No existen registros para el periodo seleccionado.",
            ancho_total,
            color=GRIS,
        )

        return fila + 2

    for posicion, registro in enumerate(registros):

        altura = 25

        for indice, valor in enumerate(
            registro,
            start=1,
        ):
            celda = escribir_celda(
                hoja,
                fila,
                indice,
                valor,
            )

            celda.font = Font(
                name="Calibri",
                size=11,
                color=TEXTO,
            )

            celda.fill = PatternFill(
                "solid",
                fgColor=(
                    BLANCO
                    if posicion % 2 == 0
                    else GRIS_CLARO
                ),
            )

            celda.alignment = Alignment(
                vertical="center",
                wrap_text=True,
                horizontal=(
                    "right"
                    if isinstance(valor, (int, float))
                    else "left"
                ),
            )

            celda.border = Border(
                bottom=Side(
                    style="thin",
                    color=BORDE,
                )
            )

            if isinstance(valor, float):
                celda.number_format = "0.00"

            elif (
                isinstance(valor, str)
                and valor.endswith("%")
            ):
                try:
                    numero = float(valor[:-1])

                    celda.value = numero / 100
                    celda.number_format = "0.00%"

                except ValueError:
                    pass

            if isinstance(valor, str):
                altura = max(
                    altura,
                    min(
                        100,
                        18 * ((len(valor) // 30) + 1),
                    ),
                )

        hoja.row_dimensions[fila].height = altura

        fila += 1

    return fila + 2


def ajustar_columnas(hoja, cantidad=4):
    for indice in range(1, cantidad + 1):

        letra = get_column_letter(indice)

        ancho = 18

        for celdas in hoja.iter_rows(
            min_row=5,
            min_col=indice,
            max_col=indice,
        ):
            celda = celdas[0]

            if celda.value is None:
                continue

            if celda.coordinate in hoja.merged_cells:
                continue

            ancho = max(
                ancho,
                len(str(celda.value)) + 3,
            )

        hoja.column_dimensions[letra].width = min(
            ancho,
            55,
        )


def agregar_observaciones(
    hoja,
    fila,
    observaciones,
    columnas=4,
):
    if not observaciones:
        return fila

    bloque_texto(
        hoja,
        fila,
        "Observaciones",
        columnas,
        fondo=AZUL_CLARO,
        color=AZUL_OSCURO,
        negrita=True,
    )

    fila += 1

    for observacion in observaciones:

        bloque_texto(
            hoja,
            fila,
            f"• {observacion}",
            columnas,
            color=GRIS,
            altura=36,
        )

        fila += 1

    return fila + 2


def crear_hoja_informacion(libro, reporte):
    hoja = libro.active
    hoja.title = "Información"

    fila = encabezado_hoja(
        hoja,
        reporte["titulo"],
        "Información general del documento generado.",
    )

    periodo = reporte["periodo"]

    agrupaciones = {
        "dia": "Diaria",
        "semana": "Semanal",
        "mes": "Mensual",
    }

    registros = [
        ["Plataforma", reporte["plataforma"]],
        ["Tipo de reporte", reporte["tipo"]],
        ["Periodo en días", periodo["dias"]],
        ["Desde", fecha_local(periodo["inicio"])],
        ["Hasta", fecha_local(periodo["fin"])],
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
        ["Zona horaria", periodo["zona_horaria"]],
        ["Fuente", reporte["fuente"]],
        [
            "Confidencialidad",
            reporte["confidencialidad"],
        ],
    ]

    fila = agregar_tabla(
        hoja,
        fila,
        "Datos del reporte",
        ["Concepto", "Información"],
        registros,
    )

    agregar_observaciones(
        hoja,
        fila,
        [
            "Documento generado automáticamente.",
            "Los datos corresponden a la información "
            "disponible al momento de su generación.",
        ],
    )

    ajustar_columnas(hoja)


def crear_hoja_seccion(
    libro,
    seccion,
    nombre,
):
    hoja = libro.create_sheet(
        title=nombre[:31],
    )

    cantidad_columnas = max(
        [4] + [
            len(tabla["columnas"])
            for tabla in seccion.get("tablas", [])
        ]
    )

    fila = encabezado_hoja(
        hoja,
        seccion["titulo"],
        seccion["descripcion"],
        cantidad_columnas,
    )

    indicadores = seccion.get(
        "indicadores",
        [],
    )

    if indicadores:
        registros = [
            [
                indicador["nombre"],
                indicador["valor"],
                indicador.get("descripcion") or "—",
            ]
            for indicador in indicadores
        ]

        fila = agregar_tabla(
            hoja,
            fila,
            "Indicadores principales",
            [
                "Indicador",
                "Resultado",
                "Descripción",
            ],
            registros,
            cantidad_columnas,
        )

    for tabla in seccion.get("tablas", []):

        fila = agregar_tabla(
            hoja,
            fila,
            tabla["titulo"],
            tabla["columnas"],
            tabla["filas"],
            cantidad_columnas,
        )

    agregar_observaciones(
        hoja,
        fila,
        seccion.get("observaciones", []),
        cantidad_columnas,
    )

    ajustar_columnas(
        hoja,
        cantidad_columnas,
    )


def generar_reporte_excel(reporte: dict) -> bytes:
    libro = Workbook()

    libro.properties.title = reporte["titulo"]
    libro.properties.creator = "PozaSync"
    libro.properties.subject = "Reporte administrativo"
    libro.properties.description = (
        "Documento de uso administrativo interno."
    )

    nombres = {
        "Resumen ejecutivo": "Resumen ejecutivo",
        "Usuarios y técnicos": "Usuarios y técnicos",
        "Solicitudes de servicios": "Solicitudes",
        "Rendimiento de servicios": "Servicios",
        "Reputación y satisfacción": "Reputación",
        "Actividad histórica y calidad de datos":
            "Actividad y calidad",
    }

    crear_hoja_informacion(
        libro,
        reporte,
    )

    for numero, seccion in enumerate(
        reporte["secciones"],
        start=1,
    ):
        nombre = nombres.get(
            seccion["titulo"],
            f"Sección {numero}",
        )

        crear_hoja_seccion(
            libro,
            seccion,
            nombre,
        )

    libro.active = 0

    with BytesIO() as memoria:

        libro.save(memoria)

        resultado = memoria.getvalue()

    libro.close()

    return resultado