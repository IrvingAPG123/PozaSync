from datetime import datetime, timezone

from fastapi import HTTPException
from pymongo.errors import PyMongoError

from src.database import db


ORIGENES_AUDITORIA = {
    "usuarios": "Usuarios y cuentas",
    "perfiles_tecnicos": "Técnicos",
    "solicitudes": "Solicitudes",
    "servicios": "Servicios",
    "resenas": "Reseñas",
    "configuracion_general": "Configuración general",
}


def normalizar_fecha(fecha):

    if not isinstance(fecha, datetime):
        return None

    if fecha.tzinfo is None:
        fecha = fecha.replace(
            tzinfo=timezone.utc
        )

    return fecha.astimezone(timezone.utc)


def texto_seguro(valor, limite=300):

    if not isinstance(valor, str):
        return None

    return valor[:limite]


def serializar_evento(documento):

    fecha = normalizar_fecha(
        documento.get("fecha")
    )

    return {
        "id": (
            f'{documento["origen"]}:'
            f'{documento["registro_id"]}:'
            f'{documento["indice"]}'
        ),
        "origen": documento["origen"],
        "modulo": ORIGENES_AUDITORIA.get(
            documento["origen"],
            "Administración",
        ),
        "registro_id": str(
            documento["registro_id"]
        ),
        "accion": texto_seguro(
            documento.get("accion"),
            100,
        ) or "accion_administrativa",
        "administrador_id": (
            str(documento["administrador_id"])
            if documento.get("administrador_id")
            is not None
            else None
        ),
        "fecha": fecha,
        "motivo": texto_seguro(
            documento.get("motivo")
        ),
    }


def pipeline_origen(nombre):

    return [
        {
            "$match": {
                "historial_administrativo.0": {
                    "$exists": True
                }
            }
        },
        {
            "$unwind": {
                "path": "$historial_administrativo",
                "includeArrayIndex": "indice",
            }
        },
        {
            "$project": {
                "_id": 0,
                "origen": {
                    "$literal": nombre
                },
                "registro_id": "$_id",
                "indice": 1,
                "accion": (
                    "$historial_administrativo.accion"
                ),
                "administrador_id": (
                    "$historial_administrativo.administrador_id"
                ),
                "fecha": (
                    "$historial_administrativo.fecha"
                ),
                "motivo": (
                    "$historial_administrativo.motivo"
                ),
            }
        },
    ]


def obtener_auditoria_administrativa(
    pagina=1,
    limite=20,
    origen="todos",
    accion=None,
):

    if origen != "todos":

        if origen not in ORIGENES_AUDITORIA:

            raise HTTPException(
                status_code=422,
                detail="Origen de auditoría inválido.",
            )

        origenes = [origen]

    else:

        origenes = list(
            ORIGENES_AUDITORIA.keys()
        )

    principal = origenes[0]

    pipeline = pipeline_origen(principal)

    for nombre in origenes[1:]:

        pipeline.append({
            "$unionWith": {
                "coll": nombre,
                "pipeline": pipeline_origen(
                    nombre
                ),
            }
        })

    if accion:

        pipeline.append({
            "$match": {
                "accion": accion
            }
        })

    pipeline.append({
        "$facet": {
            "total": [
                {
                    "$count": "cantidad"
                }
            ],
            "eventos": [
                {
                    "$sort": {
                        "fecha": -1,
                        "origen": 1,
                        "registro_id": 1,
                        "indice": -1,
                    }
                },
                {
                    "$skip": (
                        (pagina - 1) * limite
                    )
                },
                {
                    "$limit": limite
                },
            ],
        }
    })

    try:

        resultado = list(
            db[principal].aggregate(
                pipeline,
                allowDiskUse=True,
                maxTimeMS=10000,
            )
        )

    except PyMongoError:

        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible consultar "
                "la auditoría administrativa."
            ),
        ) from None

    datos = resultado[0] if resultado else {}

    conteo = datos.get("total", [])

    total = (
        conteo[0]["cantidad"]
        if conteo
        else 0
    )

    eventos = [
        serializar_evento(evento)
        for evento in datos.get("eventos", [])
    ]

    return {
        "pagina": pagina,
        "limite": limite,
        "total": total,
        "total_paginas": (
            (total + limite - 1) // limite
        ),
        "eventos": eventos,
        "alcance": (
            "Historiales administrativos registrados "
            "en los módulos de PozaSync."
        ),
        "origenes": [
            {
                "valor": clave,
                "nombre": nombre,
            }
            for clave, nombre
            in ORIGENES_AUDITORIA.items()
        ],
    }