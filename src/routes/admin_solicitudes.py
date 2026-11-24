
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
import re
from typing import Literal

from bson import ObjectId
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)
from pymongo.errors import PyMongoError

from src.database import db
from src.services.admin_service import obtener_administrador


# ==========================================
# ADMINISTRACION DE SOLICITUDES - POZASYNC
# ==========================================

router = APIRouter(
    prefix="/admin/solicitudes",
    tags=["Administracion de solicitudes"],
)

solicitudes = db["solicitudes"]
usuarios = db["usuarios"]
conversaciones = db["conversaciones"]
servicios = db["servicios"]
cotizaciones = db["cotizaciones"]


# ==========================================
# FUNCIONES AUXILIARES
# ==========================================

def serializar(valor):
    if isinstance(valor, ObjectId):
        return str(valor)

    if isinstance(valor, dict):
        return {
            clave: serializar(contenido)
            for clave, contenido in valor.items()
        }

    if isinstance(valor, list):
        return [
            serializar(elemento)
            for elemento in valor
        ]

    return valor


def pipeline_solicitudes():
    return [
        {
            "$lookup": {
                "from": "usuarios",
                "let": {
                    "cliente_id": "$cliente_id",
                },
                "pipeline": [
                    {
                        "$match": {
                            "$expr": {
                                "$eq": [
                                    "$_id",
                                    "$$cliente_id",
                                ]
                            }
                        }
                    },
                    {
                        "$project": {
                            "_id": 1,
                            "nombre": 1,
                            "correo": 1,
                            "activo": 1,
                            "rol": 1,
                            "foto_perfil": 1,
                        }
                    },
                ],
                "as": "cliente",
            }
        },
        {
            "$unwind": {
                "path": "$cliente",
                "preserveNullAndEmptyArrays": True,
            }
        },
    ]


def formatear_solicitud(documento):
    cliente = documento.get("cliente") or {}

    return serializar({
        "id": documento["_id"],
        "cliente_id": documento.get("cliente_id"),
        "titulo": documento.get(
            "titulo", "Sin titulo"
        ),
        "descripcion": documento.get(
            "descripcion", ""
        ),
        "categoria": documento.get(
            "categoria", "Sin categoria"
        ),
        "categoria_id": documento.get(
            "categoria_id", ""
        ),
        "colonia": documento.get("colonia", ""),
        "ciudad": documento.get(
            "ciudad", "Poza Rica"
        ),
        "estado": documento.get(
            "estado", "borrador"
        ),
        "imagenes": documento.get("imagenes", []),
        "fecha_creacion": documento.get(
            "fecha_creacion"
        ),
        "fecha_publicacion": documento.get(
            "fecha_publicacion"
        ),
        "fecha_actualizacion": documento.get(
            "fecha_actualizacion"
        ),
        "bloqueada": (
            documento.get(
                "bloqueada_administrativamente"
            ) is True
        ),
        "cliente": {
            "id": cliente.get("_id"),
            "nombre": cliente.get(
                "nombre", "Cliente no encontrado"
            ),
            "correo": cliente.get("correo", ""),
            "activo": cliente.get("activo") is True,
            "foto_perfil": cliente.get(
                "foto_perfil"
            ),
            "existe": bool(cliente),
        },
    })


# ==========================================
# 1. LISTAR SOLICITUDES
# ==========================================

@router.get("")
def listar_solicitudes_admin(
    pagina: int = Query(
        default=1,
        ge=1,
    ),
    limite: int = Query(
        default=20,
        ge=1,
        le=100,
    ),
    busqueda: str = Query(
        default="",
        max_length=100,
    ),
    estado: Literal[
        "todos",
        "borrador",
        "publicada",
        "retirada",
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
    moderacion: Literal[
        "todas",
        "bloqueadas",
        "sin_bloqueo",
    ] = "todas",
    administrador=Depends(obtener_administrador),
):
    filtro = {}

    if estado != "todos":
        filtro["estado"] = estado

    if categoria != "todas":
        filtro["categoria_id"] = categoria

    if moderacion == "bloqueadas":
        filtro[
            "bloqueada_administrativamente"
        ] = True

    elif moderacion == "sin_bloqueo":
        filtro[
            "bloqueada_administrativamente"
        ] = {"$ne": True}

    texto = busqueda.strip()

    if texto:
        patron = re.escape(texto)

        filtro["$or"] = [
            {
                campo: {
                    "$regex": patron,
                    "$options": "i",
                }
            }
            for campo in [
                "titulo",
                "descripcion",
                "categoria",
                "categoria_id",
                "colonia",
                "ciudad",
                "cliente.nombre",
                "cliente.correo",
            ]
        ]

    try:
        resultado = list(
            solicitudes.aggregate([
                *pipeline_solicitudes(),
                {
                    "$match": filtro,
                },
                {
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
                            {
                                "$limit": limite,
                            },
                        ],
                        "conteo": [
                            {
                                "$count": "total",
                            }
                        ],
                    }
                },
            ])
        )

        datos = (
            resultado[0]
            if resultado
            else {
                "registros": [],
                "conteo": [],
            }
        )

        total = (
            datos["conteo"][0]["total"]
            if datos["conteo"]
            else 0
        )

        resumen = {
            "registradas": (
                solicitudes.count_documents({})
            ),
            "publicadas": (
                solicitudes.count_documents({
                    "estado": "publicada",
                    "bloqueada_administrativamente": {
                        "$ne": True
                    },
                })
            ),
            "borradores": (
                solicitudes.count_documents({
                    "estado": "borrador",
                })
            ),
            "retiradas": (
                solicitudes.count_documents({
                    "estado": "retirada",
                })
            ),
            "bloqueadas": (
                solicitudes.count_documents({
                    "bloqueada_administrativamente": True,
                })
            ),
        }

        return {
            "total": total,
            "pagina": pagina,
            "limite": limite,
            "resumen": resumen,
            "solicitudes": [
                formatear_solicitud(documento)
                for documento in datos["registros"]
            ],
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible consultar "
                "las solicitudes."
            ),
        )


# ==========================================
# 2. CONSULTAR SOLICITUD INDIVIDUAL
# ==========================================

@router.get("/{solicitud_id}")
def consultar_solicitud_admin(
    solicitud_id: str,
    administrador=Depends(obtener_administrador),
):
    if not ObjectId.is_valid(solicitud_id):
        raise HTTPException(
            status_code=400,
            detail="Identificador de solicitud invalido.",
        )

    identificador = ObjectId(solicitud_id)

    try:
        documentos = list(
            solicitudes.aggregate([
                {
                    "$match": {
                        "_id": identificador,
                    }
                },
                *pipeline_solicitudes(),
                {
                    "$limit": 1,
                },
            ])
        )

        if not documentos:
            raise HTTPException(
                status_code=404,
                detail="Solicitud no encontrada.",
            )

        documento = documentos[0]

        resultado = formatear_solicitud(
            documento
        )

        filtro_relacion = {
            "solicitud_id": identificador,
        }

        # No se consulta el contenido de los mensajes.

        resultado["conversaciones"] = {
            "total": conversaciones.count_documents(
                filtro_relacion
            ),
        }

        resultado["cotizaciones"] = {
            "total": cotizaciones.count_documents(
                filtro_relacion
            ),
        }

        resultado["servicios"] = {
            "total": servicios.count_documents(
                filtro_relacion
            ),
            "pendientes": servicios.count_documents({
                **filtro_relacion,
                "estado": "pendiente",
            }),
            "acordados": servicios.count_documents({
                **filtro_relacion,
                "estado": "acordado",
            }),
            "finalizados": servicios.count_documents({
                **filtro_relacion,
                "estado": "finalizado",
            }),
            "rechazados": servicios.count_documents({
                **filtro_relacion,
                "estado": "rechazado",
            }),
        }

        registros_servicios = list(
            servicios.find(
                filtro_relacion,
                {
                    "_id": 1,
                    "tecnico_id": 1,
                    "estado": 1,
                    "fecha_creacion": 1,
                    "fecha_aceptacion": 1,
                    "fecha_finalizacion": 1,
                    "fecha_rechazo": 1,
                },
            )
            .sort("fecha_creacion", -1)
            .limit(100)
        )

        detalle_servicios = []

        for servicio in registros_servicios:
            tecnico = usuarios.find_one(
                {
                    "_id": servicio.get("tecnico_id"),
                    "rol": "tecnico",
                },
                {
                    "_id": 0,
                    "nombre": 1,
                },
            ) or {}

            detalle_servicios.append({
                "id": str(servicio["_id"]),
                "tecnico_id": servicio.get(
                    "tecnico_id"
                ),
                "tecnico": tecnico.get(
                    "nombre", "Tecnico no encontrado"
                ),
                "estado": servicio.get("estado"),
                "fecha_creacion": servicio.get(
                    "fecha_creacion"
                ),
                "fecha_aceptacion": servicio.get(
                    "fecha_aceptacion"
                ),
                "fecha_finalizacion": servicio.get(
                    "fecha_finalizacion"
                ),
                "fecha_rechazo": servicio.get(
                    "fecha_rechazo"
                ),
            })

        resultado["detalle_servicios"] = (
            detalle_servicios
        )

        resultado["historial_administrativo"] = (
            documento.get(
                "historial_administrativo", []
            )
        )

        return serializar(resultado)

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible consultar "
                "el detalle de la solicitud."
            ),
        )

# ==========================================
# MODERACION ADMINISTRATIVA DE SOLICITUDES
# ==========================================

class ModeracionSolicitud(BaseModel):
    bloqueada: bool
    motivo: str = Field(
        min_length=5,
        max_length=300,
    )


@router.patch("/{solicitud_id}/moderacion")
def moderar_solicitud_admin(
    solicitud_id: str,
    datos: ModeracionSolicitud,
    administrador=Depends(obtener_administrador),
):
    if not ObjectId.is_valid(solicitud_id):
        raise HTTPException(
            status_code=400,
            detail="Identificador invalido.",
        )

    motivo = datos.motivo.strip()

    if len(motivo) < 5:
        raise HTTPException(
            status_code=400,
            detail="Escribe un motivo valido.",
        )

    identificador = ObjectId(solicitud_id)

    try:
        solicitud = solicitudes.find_one({
            "_id": identificador,
        })

        if not solicitud:
            raise HTTPException(
                status_code=404,
                detail="Solicitud no encontrada.",
            )

        bloqueada_actualmente = (
            solicitud.get(
                "bloqueada_administrativamente"
            ) is True
        )

        if bloqueada_actualmente == datos.bloqueada:
            raise HTTPException(
                status_code=409,
                detail="La solicitud ya tiene ese estado de moderacion.",
            )

        if not datos.bloqueada:
            cliente_id = solicitud.get("cliente_id")

            cliente = usuarios.find_one({
                "_id": cliente_id,
                "rol": "cliente",
                "activo": True,
            })

            if not cliente:
                raise HTTPException(
                    status_code=409,
                    detail="La solicitud no tiene un cliente activo.",
                )

        fecha = datetime.now(timezone.utc)

        accion = (
            "bloqueo"
            if datos.bloqueada
            else "desbloqueo"
        )

        filtro = {
            "_id": identificador,
            "bloqueada_administrativamente": (
                {"$ne": True}
                if datos.bloqueada
                else True
            ),
        }

        actualizada = solicitudes.find_one_and_update(
            filtro,
            {
                "$set": {
                    "bloqueada_administrativamente": (
                        datos.bloqueada
                    ),
                    "fecha_actualizacion": fecha,
                    "fecha_moderacion": fecha,
                    "motivo_moderacion": motivo,
                    "administrador_moderacion_id": str(
                        administrador["_id"]
                    ),
                },
                "$push": {
                    "historial_administrativo": {
                        "accion": accion,
                        "motivo": motivo,
                        "bloqueada": datos.bloqueada,
                        "administrador_id": str(
                            administrador["_id"]
                        ),
                        "fecha": fecha,
                    }
                },
            },
            return_document=ReturnDocument.AFTER,
        )

        if not actualizada:
            raise HTTPException(
                status_code=409,
                detail="La solicitud cambio durante la operacion.",
            )

        return {
            "mensaje": (
                "Solicitud bloqueada correctamente."
                if datos.bloqueada
                else "Solicitud desbloqueada correctamente."
            ),
            "solicitud_id": solicitud_id,
            "bloqueada": datos.bloqueada,
            "estado": actualizada.get("estado"),
            "motivo": motivo,
            "fecha_moderacion": fecha,
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No fue posible moderar la solicitud.",
        )
