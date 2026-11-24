from datetime import datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import PyMongoError

from src.database import db
from src.services.admin_service import obtener_administrador


router = APIRouter(
    prefix="/admin/estadisticas",
    tags=["Estadisticas avanzadas"],
)

ZONA = "America/Mexico_City"

usuarios = db["usuarios"]
perfiles = db["perfiles_tecnicos"]
solicitudes = db["solicitudes"]
servicios = db["servicios"]
resenas = db["resenas"]
conversaciones = db["conversaciones"]
mensajes = db["mensajes"]
cotizaciones = db["cotizaciones"]

FILTRO_USUARIOS = {
    "rol": {"$in": ["cliente", "tecnico"]},
}

FILTRO_SOLICITUDES = {
    "cliente_id": {"$type": "objectId"},
    "registro_legacy": {"$ne": True},
}

FILTRO_SERVICIOS = {
    "archivado_administrativamente": {"$ne": True},
}

FILTRO_RESENAS = {
    "archivada_administrativamente": {"$ne": True},
    "oculta_administrativamente": {"$ne": True},
    "calificacion": {"$in": [1, 2, 3, 4, 5]},
}

CATEGORIAS = {
    "electricidad": "Electricidad",
    "plomeria": "Plomería",
    "climatizacion": "Climatización",
    "pintura": "Pintura",
    "reparaciones": "Reparaciones",
    "limpieza": "Limpieza",
}


def filtro_periodo(filtro, campo, inicio, fin):
    return {
        **filtro,
        campo: {
            "$type": "date",
            "$gte": inicio,
            "$lt": fin,
        },
    }


def porcentaje(numerador, denominador):
    if not denominador:
        return 0.0

    return round(
        numerador / denominador * 100,
        2,
    )


def distribucion(coleccion, filtro, campo):
    resultados = coleccion.aggregate([
        {"$match": filtro},
        {
            "$group": {
                "_id": f"${campo}",
                "total": {"$sum": 1},
            },
        },
        {"$sort": {"total": -1}},
    ])

    return [
        {
            "nombre": str(
                resultado["_id"] or "Sin especificar"
            ),
            "total": resultado["total"],
        }
        for resultado in resultados
    ]


def expresion_periodo(campo, agrupacion):
    expresion = {
        "date": f"${campo}",
        "unit": agrupacion,
        "timezone": ZONA,
    }

    if agrupacion == "week":
        expresion["startOfWeek"] = "monday"

    return {"$dateTrunc": expresion}


def serie_temporal(
    coleccion,
    filtro,
    campo,
    agrupacion,
):
    resultados = coleccion.aggregate([
        {"$match": filtro},
        {
            "$group": {
                "_id": expresion_periodo(
                    campo,
                    agrupacion,
                ),
                "total": {"$sum": 1},
            },
        },
        {"$sort": {"_id": 1}},
    ])

    return [
        {
            "fecha": resultado["_id"].replace(
                tzinfo=timezone.utc
            ).astimezone(
                ZoneInfo(ZONA)
            ).strftime("%Y-%m-%d"),
            "total": resultado["total"],
        }
        for resultado in resultados
    ]


def crecimiento_usuarios(filtro, agrupacion):
    resultados = usuarios.aggregate([
        {"$match": filtro},
        {
            "$group": {
                "_id": expresion_periodo(
                    "fecha_registro",
                    agrupacion,
                ),
                "clientes": {
                    "$sum": {
                        "$cond": [
                            {"$eq": ["$rol", "cliente"]},
                            1,
                            0,
                        ],
                    },
                },
                "tecnicos": {
                    "$sum": {
                        "$cond": [
                            {"$eq": ["$rol", "tecnico"]},
                            1,
                            0,
                        ],
                    },
                },
            },
        },
        {"$sort": {"_id": 1}},
    ])

    return [
        {
            "fecha": resultado["_id"].replace(
                tzinfo=timezone.utc
            ).astimezone(
                ZoneInfo(ZONA)
            ).strftime("%Y-%m-%d"),
            "clientes": resultado["clientes"],
            "tecnicos": resultado["tecnicos"],
            "total": (
                resultado["clientes"]
                + resultado["tecnicos"]
            ),
        }
        for resultado in resultados
    ]


def obtener_categorias(filtro):
    resultados = solicitudes.aggregate([
        {"$match": filtro},
        {
            "$group": {
                "_id": "$categoria_id",
                "total": {"$sum": 1},
            },
        },
        {"$sort": {"total": -1}},
    ])

    return [
        {
            "categoria_id": resultado["_id"],
            "nombre": CATEGORIAS.get(
                resultado["_id"],
                "Sin clasificar",
            ),
            "total": resultado["total"],
        }
        for resultado in resultados
    ]


def obtener_colonias(filtro):
    resultados = solicitudes.aggregate([
        {"$match": filtro},
        {
            "$group": {
                "_id": {
                    "$toLower": {
                        "$trim": {
                            "input": {
                                "$ifNull": [
                                    "$colonia",
                                    "",
                                ],
                            },
                        },
                    },
                },
                "total": {"$sum": 1},
            },
        },
    ])

    acumulados = {}

    equivalencias = {
        "chapulteopec": "chapultepec",
    }

    for resultado in resultados:
        colonia = resultado["_id"]

        colonia = equivalencias.get(
            colonia,
            colonia,
        )

        colonia = (
            colonia.title()
            if colonia
            else "Sin especificar"
        )

        acumulados[colonia] = (
            acumulados.get(colonia, 0)
            + resultado["total"]
        )

    return sorted(
        [
            {
                "nombre": nombre,
                "total": total,
            }
            for nombre, total in acumulados.items()
        ],
        key=lambda elemento: elemento["total"],
        reverse=True,
    )


def obtener_perfiles_validos():
    resultados = list(perfiles.aggregate([
        {
            "$lookup": {
                "from": "usuarios",
                "localField": "usuario_id",
                "foreignField": "_id",
                "as": "usuario",
            },
        },
        {"$unwind": "$usuario"},
        {
            "$match": {
                "usuario.rol": "tecnico",
            },
        },
        {
            "$group": {
                "_id": None,
                "registrados": {"$sum": 1},
                "disponibles": {
                    "$sum": {
                        "$cond": [
                            {
                                "$and": [
                                    {
                                        "$eq": [
                                            "$usuario.activo",
                                            True,
                                        ],
                                    },
                                    {
                                        "$ne": [
                                            {
                                                "$ifNull": [
                                                    "$disponible",
                                                    True,
                                                ],
                                            },
                                            False,
                                        ],
                                    },
                                ],
                            },
                            1,
                            0,
                        ],
                    },
                },
            },
        },
    ]))

    if not resultados:
        return {
            "registrados": 0,
            "disponibles": 0,
            "no_disponibles": 0,
        }

    datos = resultados[0]

    return {
        "registrados": datos["registrados"],
        "disponibles": datos["disponibles"],
        "no_disponibles": (
            datos["registrados"]
            - datos["disponibles"]
        ),
    }


def rendimiento_servicios(filtro):
    estados = {
        "pendiente": 0,
        "acordado": 0,
        "finalizado": 0,
        "rechazado": 0,
    }

    resultados = distribucion(
        servicios,
        filtro,
        "estado",
    )

    total = sum(
        elemento["total"]
        for elemento in resultados
    )

    for elemento in resultados:
        nombre = elemento["nombre"]

        if nombre in estados:
            estados[nombre] = elemento["total"]

    aceptados = (
        estados["acordado"]
        + estados["finalizado"]
    )

    decididos = (
        aceptados
        + estados["rechazado"]
    )

    return {
        "total": total,
        "pendientes": estados["pendiente"],
        "acordados": estados["acordado"],
        "finalizados": estados["finalizado"],
        "rechazados": estados["rechazado"],
        "otros": total - sum(estados.values()),
        "aceptados": aceptados,
        "tasa_aceptacion": porcentaje(
            aceptados,
            decididos,
        ),
        "tasa_finalizacion": porcentaje(
            estados["finalizado"],
            total,
        ),
        "distribucion": resultados,
    }


def obtener_reputacion(filtro, agrupacion):
    resultados = list(resenas.aggregate([
        {"$match": filtro},
        {
            "$group": {
                "_id": None,
                "promedio": {"$avg": "$calificacion"},
                "total": {"$sum": 1},
            },
        },
    ]))

    resumen = resultados[0] if resultados else {}

    estrellas = {
        str(numero): 0
        for numero in range(1, 6)
    }

    for elemento in distribucion(
        resenas,
        filtro,
        "calificacion",
    ):
        if elemento["nombre"] in estrellas:
            estrellas[elemento["nombre"]] = (
                elemento["total"]
            )

    evolucion = resenas.aggregate([
        {"$match": filtro},
        {
            "$group": {
                "_id": expresion_periodo(
                    "fecha_creacion",
                    agrupacion,
                ),
                "promedio": {"$avg": "$calificacion"},
                "total": {"$sum": 1},
            },
        },
        {"$sort": {"_id": 1}},
    ])

    return {
        "promedio": round(
            resumen.get("promedio", 0.0),
            2,
        ),
        "total": resumen.get("total", 0),
        "distribucion": estrellas,
        "evolucion": [
            {
                "fecha": elemento["_id"].replace(
                    tzinfo=timezone.utc
                ).astimezone(
                    ZoneInfo(ZONA)
                ).strftime("%Y-%m-%d"),
                "promedio": round(
                    elemento["promedio"],
                    2,
                ),
                "total": elemento["total"],
            }
            for elemento in evolucion
        ],
    }


@router.get("/avanzadas")
def obtener_estadisticas_avanzadas(
    dias: int = Query(30, ge=7, le=365),
    agrupacion: Literal[
        "dia",
        "semana",
        "mes",
    ] = Query("dia"),
    administrador=Depends(obtener_administrador),
):
    if dias not in (7, 30, 90, 365):
        raise HTTPException(
            status_code=422,
            detail="Los periodos permitidos son 7, 30, 90 y 365 dias.",
        )

    unidades = {
        "dia": "day",
        "semana": "week",
        "mes": "month",
    }

    unidad = unidades[agrupacion]

    ahora = datetime.now(ZoneInfo(ZONA))

    hoy = ahora.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    inicio = (
        hoy - timedelta(days=dias - 1)
    ).astimezone(timezone.utc)

    fin = ahora.astimezone(timezone.utc)

    filtro_usuarios = filtro_periodo(
        FILTRO_USUARIOS,
        "fecha_registro",
        inicio,
        fin,
    )

    filtro_solicitudes = filtro_periodo(
        FILTRO_SOLICITUDES,
        "fecha_creacion",
        inicio,
        fin,
    )

    filtro_servicios = filtro_periodo(
        FILTRO_SERVICIOS,
        "fecha_creacion",
        inicio,
        fin,
    )

    filtro_resenas = filtro_periodo(
        FILTRO_RESENAS,
        "fecha_creacion",
        inicio,
        fin,
    )

    filtro_conversaciones = filtro_periodo(
        {
            "cliente_id": {"$type": "objectId"},
            "tecnico_id": {"$type": "objectId"},
        },
        "fecha_creacion",
        inicio,
        fin,
    )

    filtro_finalizados = filtro_periodo(
        {
            **FILTRO_SERVICIOS,
            "estado": "finalizado",
        },
        "fecha_finalizacion",
        inicio,
        fin,
    )

    filtro_publicaciones = filtro_periodo(
        FILTRO_SOLICITUDES,
        "fecha_publicacion",
        inicio,
        fin,
    )

    try:
        rendimiento = rendimiento_servicios(
            filtro_servicios
        )

        reputacion = obtener_reputacion(
            filtro_resenas,
            unidad,
        )

        nuevos_usuarios = usuarios.count_documents(
            filtro_usuarios
        )

        nuevas_solicitudes = solicitudes.count_documents(
            filtro_solicitudes
        )

        nuevas_conversaciones = (
            conversaciones.count_documents(
                filtro_conversaciones
            )
        )

        finalizados_periodo = servicios.count_documents(
            filtro_finalizados
        )

        return {
            "periodo": {
                "dias": dias,
                "agrupacion": agrupacion,
                "inicio": inicio,
                "fin": fin,
                "zona_horaria": ZONA,
            },

            "resumen": {
                "nuevos_usuarios": nuevos_usuarios,
                "nuevas_solicitudes": nuevas_solicitudes,
                "nuevos_servicios": rendimiento["total"],
                "servicios_finalizados": finalizados_periodo,
                "nuevas_conversaciones": nuevas_conversaciones,
                "calificacion_promedio": reputacion["promedio"],
                "resenas_visibles": reputacion["total"],
            },

            "usuarios": {
                "registrados": usuarios.count_documents(
                    FILTRO_USUARIOS
                ),
                "activos": usuarios.count_documents({
                    **FILTRO_USUARIOS,
                    "activo": True,
                }),
                "distribucion": distribucion(
                    usuarios,
                    filtro_usuarios,
                    "rol",
                ),
                "crecimiento": crecimiento_usuarios(
                    filtro_usuarios,
                    unidad,
                ),
            },

            "tecnicos": obtener_perfiles_validos(),

            "solicitudes": {
                "total": nuevas_solicitudes,
                "publicaciones": solicitudes.count_documents(
                    filtro_publicaciones
                ),
                "bloqueadas": solicitudes.count_documents({
                    **filtro_solicitudes,
                    "bloqueada_administrativamente": True,
                }),
                "estados": distribucion(
                    solicitudes,
                    filtro_solicitudes,
                    "estado",
                ),
                "categorias": obtener_categorias(
                    filtro_solicitudes
                ),
                "colonias": obtener_colonias(
                    filtro_solicitudes
                ),
                "evolucion": serie_temporal(
                    solicitudes,
                    filtro_solicitudes,
                    "fecha_creacion",
                    unidad,
                ),
            },

            "servicios": {
                **rendimiento,
                "finalizados_en_periodo": finalizados_periodo,
                "evolucion": serie_temporal(
                    servicios,
                    filtro_servicios,
                    "fecha_creacion",
                    unidad,
                ),
                "evolucion_finalizaciones": serie_temporal(
                    servicios,
                    filtro_finalizados,
                    "fecha_finalizacion",
                    unidad,
                ),
            },

            "reputacion": reputacion,

            "actividad": {
                "conversaciones": nuevas_conversaciones,
                "evolucion_conversaciones": serie_temporal(
                    conversaciones,
                    filtro_conversaciones,
                    "fecha_creacion",
                    unidad,
                ),
                "mensajes_historicos": mensajes.count_documents({}),
                "cotizaciones_historicas": cotizaciones.count_documents({}),
            },

            "calidad_datos": {
                "servicios_archivados": servicios.count_documents({
                    "archivado_administrativamente": True,
                }),
                "resenas_archivadas": resenas.count_documents({
                    "archivada_administrativamente": True,
                }),
                "resenas_ocultas": resenas.count_documents({
                    "archivada_administrativamente": {"$ne": True},
                    "oculta_administrativamente": True,
                }),
                "mensajes_sin_fecha_creacion": mensajes.count_documents({
                    "fecha_creacion": {
                        "$not": {"$type": "date"},
                    },
                }),
            },
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible obtener las "
                "estadisticas de la plataforma."
            ),
        )