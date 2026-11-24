import re
from bson import ObjectId
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import PyMongoError

from src.database import db
from src.services.admin_service import obtener_administrador


router = APIRouter(
    prefix="/admin/servicios",
    tags=["Administracion de servicios"],
)

servicios = db["servicios"]

ESTADOS = [
    "pendiente",
    "acordado",
    "finalizado",
    "rechazado",
]


def pipeline_servicios():
    return [
        {
            "$lookup": {
                "from": "usuarios",
                "localField": "cliente_id",
                "foreignField": "_id",
                "as": "cliente",
            }
        },
        {
            "$unwind": {
                "path": "$cliente",
                "preserveNullAndEmptyArrays": True,
            }
        },
        {
            "$lookup": {
                "from": "usuarios",
                "localField": "tecnico_id",
                "foreignField": "_id",
                "as": "tecnico",
            }
        },
        {
            "$unwind": {
                "path": "$tecnico",
                "preserveNullAndEmptyArrays": True,
            }
        },
        {
            "$lookup": {
                "from": "solicitudes",
                "localField": "solicitud_id",
                "foreignField": "_id",
                "as": "solicitud",
            }
        },
        {
            "$unwind": {
                "path": "$solicitud",
                "preserveNullAndEmptyArrays": True,
            }
        },
    ]


def convertir_id(valor):
    return str(valor) if valor is not None else None


def formatear_usuario(usuario, identificador):
    usuario = usuario or {}

    return {
        "id": convertir_id(identificador),
        "nombre": usuario.get(
            "nombre",
            "Usuario no encontrado",
        ),
        "correo": usuario.get("correo", ""),
        "ciudad": usuario.get("ciudad", ""),
        "foto_perfil": usuario.get("foto_perfil"),
        "activo": usuario.get("activo") is True,
        "existe": bool(usuario),
    }


def formatear_servicio(documento):
    solicitud = documento.get("solicitud") or {}

    return {
        "id": str(documento["_id"]),

        "conversacion_id": convertir_id(
            documento.get("conversacion_id")
        ),

        "solicitud_id": convertir_id(
            documento.get("solicitud_id")
        ),

        "cliente_id": convertir_id(
            documento.get("cliente_id")
        ),

        "tecnico_id": convertir_id(
            documento.get("tecnico_id")
        ),

        "estado": documento.get(
            "estado",
            "desconocido",
        ),

        "archivado": (
            documento.get(
                "archivado_administrativamente"
            ) is True
        ),

        "registro_legacy": (
            documento.get("registro_legacy") is True
        ),

        "fecha_archivado": documento.get(
            "fecha_archivado"
        ),

        "motivo_archivado": documento.get(
            "motivo_archivado"
        ),

        "cliente": formatear_usuario(
            documento.get("cliente"),
            documento.get("cliente_id"),
        ),

        "tecnico": formatear_usuario(
            documento.get("tecnico"),
            documento.get("tecnico_id"),
        ),

        "solicitud": {
            "id": convertir_id(
                documento.get("solicitud_id")
            ),
            "titulo": solicitud.get(
                "titulo",
                documento.get("titulo", "Solicitud no encontrada"),
            ),
            "descripcion": solicitud.get(
                "descripcion",
                documento.get("descripcion", ""),
            ),
            "categoria": solicitud.get(
                "categoria",
                "",
            ),
            "categoria_id": solicitud.get(
                "categoria_id",
                "",
            ),
            "colonia": solicitud.get("colonia", ""),
            "ciudad": solicitud.get("ciudad", ""),
            "estado": solicitud.get("estado"),
            "bloqueada": (
                solicitud.get(
                    "bloqueada_administrativamente"
                ) is True
            ),
            "existe": bool(solicitud),
        },

        "fecha_creacion": documento.get(
            "fecha_creacion"
        ),

        "fecha_actualizacion": documento.get(
            "fecha_actualizacion"
        ),

        "fecha_aceptacion": documento.get(
            "fecha_aceptacion"
        ),

        "fecha_rechazo": documento.get(
            "fecha_rechazo"
        ),

        "fecha_finalizacion": documento.get(
            "fecha_finalizacion"
        ),
    }


def obtener_resumen():
    resultado = list(
        servicios.aggregate([
            {
                "$match": {
                    "archivado_administrativamente": {
                        "$ne": True
                    }
                }
            },
            {
                "$group": {
                    "_id": "$estado",
                    "cantidad": {"$sum": 1},
                }
            }
        ])
    )

    cantidades = {
        item["_id"]: item["cantidad"]
        for item in resultado
    }

    registrados = sum(cantidades.values())
    pendientes = cantidades.get("pendiente", 0)
    acordados = cantidades.get("acordado", 0)
    finalizados = cantidades.get("finalizado", 0)
    rechazados = cantidades.get("rechazado", 0)

    return {
        "registrados": registrados,

        "archivados": servicios.count_documents({
            "archivado_administrativamente": True,
        }),

        "pendientes": pendientes,
        "acordados": acordados,
        "finalizados": finalizados,
        "rechazados": rechazados,
        "otros": (
            registrados
            - pendientes
            - acordados
            - finalizados
            - rechazados
        ),
        "tasa_finalizacion": (
            round(finalizados / registrados * 100, 2)
            if registrados
            else 0
        ),
    }


@router.get("")
def listar_servicios_admin(
    pagina: int = Query(default=1, ge=1),
    limite: int = Query(default=20, ge=1, le=100),

    busqueda: str = Query(
        default="",
        max_length=100,
    ),

    estado: Literal[
        "todos",
        "pendiente",
        "acordado",
        "finalizado",
        "rechazado",
    ] = "todos",

    categoria: Literal[
        "todas",
        "electricidad",
        "plomeria",
        "climatizacion",
        "pintura",
        "reparaciones",
        "limpieza",
    ] = "todas",

    archivo: Literal[
        "operativos",
        "archivados",
        "todos",
    ] = "operativos",

    administrador=Depends(obtener_administrador),
):
    try:
        pipeline = []

        if archivo == "operativos":
            pipeline.append({
                "$match": {
                    "archivado_administrativamente": {
                        "$ne": True
                    }
                }
            })

        elif archivo == "archivados":
            pipeline.append({
                "$match": {
                    "archivado_administrativamente": True
                }
            })

        if estado != "todos":
            pipeline.append({
                "$match": {
                    "estado": estado,
                }
            })

        pipeline.extend(pipeline_servicios())

        filtros = {}

        if categoria != "todas":
            filtros["solicitud.categoria_id"] = categoria

        texto = busqueda.strip()

        if texto:
            expresion = {
                "$regex": re.escape(texto),
                "$options": "i",
            }

            filtros["$or"] = [
                {"cliente.nombre": expresion},
                {"cliente.correo": expresion},
                {"tecnico.nombre": expresion},
                {"tecnico.correo": expresion},
                {"solicitud.titulo": expresion},
                {"titulo": expresion},
                {"solicitud.categoria": expresion},
                {"solicitud.colonia": expresion},
                {"solicitud.ciudad": expresion},
            ]

        if filtros:
            pipeline.append({
                "$match": filtros,
            })

        pipeline.append({
            "$facet": {
                "registros": [
                    {
                        "$sort": {
                            "fecha_creacion": -1,
                            "_id": -1,
                        }
                    },
                    {
                        "$skip": (
                            (pagina - 1) * limite
                        )
                    },
                    {"$limit": limite},
                ],
                "conteo": [
                    {"$count": "total"}
                ],
            }
        })

        resultado = list(
            servicios.aggregate(pipeline)
        )

        datos = resultado[0] if resultado else {
            "registros": [],
            "conteo": [],
        }

        total = (
            datos["conteo"][0]["total"]
            if datos["conteo"]
            else 0
        )

        return {
            "total": total,
            "pagina": pagina,
            "limite": limite,
            "resumen": obtener_resumen(),
            "servicios": [
                formatear_servicio(documento)
                for documento in datos["registros"]
            ],
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No fue posible consultar los servicios.",
        )


@router.get("/{servicio_id}")
def detalle_servicio_admin(
    servicio_id: str,
    administrador=Depends(obtener_administrador),
):
    if not servicio_id.strip() or len(servicio_id) > 200:
        raise HTTPException(
            status_code=400,
            detail="Identificador de servicio invalido.",
        )

    try:
        identificadores = [servicio_id]

        if ObjectId.is_valid(servicio_id):
            identificadores.append(
                ObjectId(servicio_id)
            )

        pipeline = [
            {
                "$match": {
                    "_id": {
                        "$in": identificadores
                    },
                }
            }
        ]

        pipeline.extend(pipeline_servicios())

        pipeline.append({"$limit": 1})

        resultado = list(
            servicios.aggregate(pipeline)
        )

        if not resultado:
            raise HTTPException(
                status_code=404,
                detail="Servicio no encontrado.",
            )

        return formatear_servicio(resultado[0])

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No fue posible consultar el servicio.",
        )