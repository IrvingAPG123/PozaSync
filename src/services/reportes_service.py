from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Literal


TipoReporte = Literal[
    "general",
    "usuarios",
    "solicitudes",
    "servicios",
    "reputacion",
]


ZONA_HORARIA = ZoneInfo("America/Mexico_City")


TITULOS_REPORTES = {
    "general": "Reporte general de la plataforma",
    "usuarios": "Reporte de usuarios y técnicos",
    "solicitudes": "Reporte de solicitudes",
    "servicios": "Reporte de servicios",
    "reputacion": "Reporte de reputación y satisfacción",
}


NOMBRES_ESTADOS = {
    "cliente": "Clientes",
    "tecnico": "Técnicos",
    "publicada": "Publicadas",
    "retirada": "Retiradas",
    "borrador": "Borradores",
    "pendiente": "Pendientes",
    "acordado": "Acordados",
    "finalizado": "Finalizados",
    "rechazado": "Rechazados",
}


def traducir_nombre(nombre):
    return NOMBRES_ESTADOS.get(nombre, nombre)


def crear_indicador(nombre, valor, descripcion=""):
    return {
        "nombre": nombre,
        "valor": valor,
        "descripcion": descripcion,
    }


def crear_tabla(titulo, columnas, filas):
    return {
        "titulo": titulo,
        "columnas": columnas,
        "filas": filas,
    }


def tabla_distribucion(titulo, registros):
    filas = [
        [
            traducir_nombre(registro["nombre"]),
            registro["total"],
        ]
        for registro in registros
    ]

    filas.sort(
        key=lambda fila: (
            -fila[1],
            str(fila[0]).casefold(),
            str(fila[0]),
        )
    )

    return crear_tabla(
        titulo,
        ["Concepto", "Cantidad"],
        filas,
    )


def crear_seccion(
    titulo,
    descripcion,
    indicadores=None,
    tablas=None,
    observaciones=None,
):
    return {
        "titulo": titulo,
        "descripcion": descripcion,
        "indicadores": indicadores or [],
        "tablas": tablas or [],
        "observaciones": observaciones or [],
    }


def seccion_general(datos):
    resumen = datos["resumen"]

    reputacion = (
        resumen["calificacion_promedio"]
        if resumen["resenas_visibles"] > 0
        else "Sin calificaciones"
    )

    return crear_seccion(
        "Resumen ejecutivo",
        "Indicadores generales del periodo seleccionado.",
        indicadores=[
            crear_indicador(
                "Nuevos usuarios",
                resumen["nuevos_usuarios"],
            ),
            crear_indicador(
                "Nuevas solicitudes",
                resumen["nuevas_solicitudes"],
            ),
            crear_indicador(
                "Nuevos servicios",
                resumen["nuevos_servicios"],
            ),
            crear_indicador(
                "Servicios finalizados",
                resumen["servicios_finalizados"],
                "Finalizaciones ocurridas durante el periodo.",
            ),
            crear_indicador(
                "Nuevas conversaciones",
                resumen["nuevas_conversaciones"],
            ),
            crear_indicador(
                "Calificación promedio",
                reputacion,
            ),
            crear_indicador(
                "Reseñas visibles",
                resumen["resenas_visibles"],
            ),
        ],
    )


def seccion_usuarios(datos):
    usuarios = datos["usuarios"]
    tecnicos = datos["tecnicos"]

    return crear_seccion(
        "Usuarios y técnicos",
        "Crecimiento de usuarios y disponibilidad actual.",
        indicadores=[
            crear_indicador(
                "Usuarios públicos registrados",
                usuarios["registrados"],
                "Total histórico.",
            ),
            crear_indicador(
                "Usuarios activos",
                usuarios["activos"],
                "Estado actual.",
            ),
            crear_indicador(
                "Usuarios suspendidos o inactivos",
                usuarios["registrados"] - usuarios["activos"],
                "Estado actual.",
            ),
            crear_indicador(
                "Perfiles técnicos válidos",
                tecnicos["registrados"],
                "Total actual.",
            ),
            crear_indicador(
                "Técnicos disponibles",
                tecnicos["disponibles"],
                "Disponibilidad actual.",
            ),
            crear_indicador(
                "Técnicos no disponibles",
                tecnicos["no_disponibles"],
                "Disponibilidad actual.",
            ),
        ],
        tablas=[
            tabla_distribucion(
                "Distribución de nuevos usuarios",
                usuarios["distribucion"],
            ),
            crear_tabla(
                "Crecimiento de usuarios",
                [
                    "Fecha",
                    "Clientes",
                    "Técnicos",
                    "Total",
                ],
                [
                    [
                        item["fecha"],
                        item["clientes"],
                        item["tecnicos"],
                        item["total"],
                    ]
                    for item in usuarios["crecimiento"]
                ],
            ),
        ],
        observaciones=[
            "Las cuentas administrativas no se incluyen "
            "en las estadísticas de usuarios públicos.",
            "Los indicadores de disponibilidad representan "
            "el estado actual de la plataforma.",
        ],
    )


def seccion_solicitudes(datos):
    solicitudes = datos["solicitudes"]

    return crear_seccion(
        "Solicitudes de servicios",
        "Distribución de solicitudes creadas durante "
        "el periodo seleccionado.",
        indicadores=[
            crear_indicador(
                "Solicitudes creadas",
                solicitudes["total"],
            ),
            crear_indicador(
                "Publicaciones durante el periodo",
                solicitudes["publicaciones"],
            ),
            crear_indicador(
                "Solicitudes bloqueadas",
                solicitudes["bloqueadas"],
                "Solicitudes del periodo actualmente bloqueadas.",
            ),
        ],
        tablas=[
            tabla_distribucion(
                "Solicitudes por categoría",
                solicitudes["categorias"],
            ),
            tabla_distribucion(
                "Solicitudes por colonia",
                solicitudes["colonias"],
            ),
            tabla_distribucion(
                "Estado actual de las solicitudes",
                solicitudes["estados"],
            ),
            crear_tabla(
                "Evolución de solicitudes",
                ["Fecha", "Cantidad"],
                [
                    [item["fecha"], item["total"]]
                    for item in solicitudes["evolucion"]
                ],
            ),
        ],
        observaciones=[
            "Las categorías y colonias se calculan "
            "según la fecha de creación de las solicitudes.",
            "Las publicaciones se contabilizan según "
            "su fecha de publicación.",
            "Los registros antiguos identificados como "
            "legacy se excluyen de estos indicadores.",
        ],
    )


def seccion_servicios(datos):
    servicios = datos["servicios"]

    decididos = (
        servicios["aceptados"]
        + servicios["rechazados"]
    )

    tasa_aceptacion = (
        f'{servicios["tasa_aceptacion"]:.2f}%'
        if decididos > 0
        else "No disponible"
    )

    tasa_finalizacion = (
        f'{servicios["tasa_finalizacion"]:.2f}%'
        if servicios["total"] > 0
        else "No disponible"
    )

    observaciones = [
        "Los servicios archivados no se incluyen "
        "en los indicadores operativos.",
        "La tasa de aceptación se calcula sobre "
        "los servicios aceptados o rechazados.",
        "La tasa de finalización se calcula sobre "
        "los servicios creados durante el periodo.",
    ]

    if servicios["total"] < 10:
        observaciones.append(
            "La muestra es reducida. Los porcentajes "
            "deben interpretarse considerando el número "
            "de servicios registrados."
        )

    return crear_seccion(
        "Rendimiento de servicios",
        "Seguimiento de acuerdos y finalizaciones.",
        indicadores=[
            crear_indicador(
                "Servicios creados",
                servicios["total"],
            ),
            crear_indicador(
                "Servicios pendientes",
                servicios["pendientes"],
            ),
            crear_indicador(
                "Servicios acordados",
                servicios["acordados"],
            ),
            crear_indicador(
                "Servicios finalizados",
                servicios["finalizados"],
                "Estado actual de servicios creados en el periodo.",
            ),
            crear_indicador(
                "Servicios rechazados",
                servicios["rechazados"],
            ),
            crear_indicador(
                "Tasa de aceptación",
                tasa_aceptacion,
            ),
            crear_indicador(
                "Tasa de finalización",
                tasa_finalizacion,
            ),
            crear_indicador(
                "Finalizaciones durante el periodo",
                servicios["finalizados_en_periodo"],
            ),
        ],
        tablas=[
            tabla_distribucion(
                "Distribución de servicios",
                servicios["distribucion"],
            ),
            crear_tabla(
                "Evolución de servicios creados",
                ["Fecha", "Cantidad"],
                [
                    [item["fecha"], item["total"]]
                    for item in servicios["evolucion"]
                ],
            ),
            crear_tabla(
                "Evolución de finalizaciones",
                ["Fecha", "Cantidad"],
                [
                    [item["fecha"], item["total"]]
                    for item in servicios[
                        "evolucion_finalizaciones"
                    ]
                ],
            ),
        ],
        observaciones=observaciones,
    )


def seccion_reputacion(datos):
    reputacion = datos["reputacion"]

    promedio = (
        reputacion["promedio"]
        if reputacion["total"] > 0
        else "Sin calificaciones"
    )

    return crear_seccion(
        "Reputación y satisfacción",
        "Calificaciones visibles de los servicios.",
        indicadores=[
            crear_indicador(
                "Calificación promedio",
                promedio,
            ),
            crear_indicador(
                "Reseñas visibles",
                reputacion["total"],
            ),
        ],
        tablas=[
            crear_tabla(
                "Distribución de calificaciones",
                ["Estrellas", "Cantidad"],
                [
                    [
                        estrellas,
                        reputacion["distribucion"].get(
                            str(estrellas),
                            0,
                        ),
                    ]
                    for estrellas in range(5, 0, -1)
                ],
            ),
            crear_tabla(
                "Evolución de reputación",
                ["Fecha", "Promedio", "Reseñas"],
                [
                    [
                        item["fecha"],
                        item["promedio"],
                        item["total"],
                    ]
                    for item in reputacion["evolucion"]
                ],
            ),
        ],
        observaciones=[
            "Las reseñas ocultas y archivadas "
            "no se incluyen en la reputación.",
            "La ausencia de reseñas no equivale "
            "a una calificación de cero estrellas.",
        ],
    )


def seccion_calidad(datos):
    calidad = datos["calidad_datos"]
    actividad = datos["actividad"]

    return crear_seccion(
        "Actividad histórica y calidad de datos",
        "Información general independiente "
        "del periodo seleccionado.",
        indicadores=[
            crear_indicador(
                "Mensajes históricos",
                actividad["mensajes_historicos"],
            ),
            crear_indicador(
                "Cotizaciones históricas",
                actividad["cotizaciones_historicas"],
            ),
            crear_indicador(
                "Servicios archivados",
                calidad["servicios_archivados"],
            ),
            crear_indicador(
                "Reseñas archivadas",
                calidad["resenas_archivadas"],
            ),
            crear_indicador(
                "Reseñas ocultas",
                calidad["resenas_ocultas"],
            ),
            crear_indicador(
                "Mensajes sin fecha de creación válida",
                calidad["mensajes_sin_fecha_creacion"],
            ),
        ],
        observaciones=[
            "Los totales históricos pueden incluir "
            "registros antiguos.",
            "No representan actividad exclusiva "
            "del periodo seleccionado.",
        ],
    )


def construir_reporte(
    tipo: TipoReporte,
    datos: dict,
):
    if tipo not in TITULOS_REPORTES:
        raise ValueError("Tipo de reporte no válido.")

    generadores = {
        "usuarios": seccion_usuarios,
        "solicitudes": seccion_solicitudes,
        "servicios": seccion_servicios,
        "reputacion": seccion_reputacion,
    }

    if tipo == "general":
        secciones = [
            seccion_general(datos),
            seccion_usuarios(datos),
            seccion_solicitudes(datos),
            seccion_servicios(datos),
            seccion_reputacion(datos),
            seccion_calidad(datos),
        ]

    else:
        secciones = [
            generadores[tipo](datos),
        ]

    ahora = datetime.now(timezone.utc)

    return {
        "plataforma": "PozaSync",
        "tipo": tipo,
        "titulo": TITULOS_REPORTES[tipo],
        "fecha_generacion": ahora.isoformat(),
        "fecha_generacion_local": ahora.astimezone(
            ZONA_HORARIA
        ).strftime("%d/%m/%Y %H:%M:%S"),
        "periodo": datos["periodo"],
        "secciones": secciones,
        "confidencialidad": "Uso administrativo interno",
        "fuente": "Base de datos MongoDB de PozaSync",
    }