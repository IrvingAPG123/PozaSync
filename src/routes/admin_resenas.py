import re
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import PyMongoError

from src.database import db
from src.services.admin_service import obtener_administrador


router = APIRouter(
    prefix="/admin/resenas",
    tags=["Administracion de resenas"],
)

resenas = db["resenas"]


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


def convertir_id(valor):
    return str(valor) if valor is not None else None


def pipeline_resenas():
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
                "from": "servicios",
                "localField": "servicio_id",
                "foreignField": "_id",
                "as": "servicio",
            }
        },
        {
            "$unwind": {
                "path": "$servicio",
                "preserveNullAndEmptyArrays": True,
            }
        },
        {
            "$lookup": {
                "from": "solicitudes",
                "localField": "servicio.solicitud_id",
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


def formatear_usuario(usuario, identificador):
    usuario = usuario or {}

    return {
        "id": convertir_id(
            usuario.get("_id", identificador)
        ),
        "nombre": usuario.get(
            "nombre",
            "Usuario no encontrado",
        ),
        "correo": usuario.get("correo"),
        "foto_perfil": usuario.get("foto_perfil"),
        "ciudad": usuario.get("ciudad"),
        "activo": usuario.get("activo") is True,
        "existe": bool(usuario),
    }


def formatear_resena(documento):
    cliente = documento.get("cliente") or {}
    tecnico = documento.get("tecnico") or {}
    servicio = documento.get("servicio") or {}
    solicitud = documento.get("solicitud") or {}

    archivada = (
        documento.get(
            "archivada_administrativamente"
        ) is True
    )

    oculta = (
        documento.get(
            "oculta_administrativamente"
        ) is True
    )

    if archivada:
        estado = "archivada"
    elif oculta:
        estado = "oculta"
    else:
        estado = "visible"

    integridad = (
        bool(cliente)
        and bool(tecnico)
        and bool(servicio)
        and servicio.get("estado") == "finalizado"
        and cliente.get("rol") == "cliente"
        and tecnico.get("rol") == "tecnico"
        and servicio.get("cliente_id")
        == documento.get("cliente_id")
        and servicio.get("tecnico_id")
        == documento.get("tecnico_id")
    )

    return {
        "id": str(documento["_id"]),

        "cliente_id": convertir_id(
            documento.get("cliente_id")
        ),

        "tecnico_id": convertir_id(
            documento.get("tecnico_id")
        ),

        "servicio_id": convertir_id(
            documento.get("servicio_id")
        ),

        "calificacion": documento.get(
            "calificacion"
        ),

        "comentario": documento.get(
            "comentario",
            "",
        ),

        "estado": estado,
        "archivada": archivada,
        "oculta": oculta,
        "integridad": integridad,

        "registro_legacy": (
            documento.get("registro_legacy") is True
        ),

        "cliente": formatear_usuario(
            cliente,
            documento.get("cliente_id"),
        ),

        "tecnico": formatear_usuario(
            tecnico,
            documento.get("tecnico_id"),
        ),

        "servicio": {
            "id": convertir_id(
                servicio.get("_id")
            ),
            "estado": servicio.get("estado"),
            "fecha_finalizacion": servicio.get(
                "fecha_finalizacion"
            ),
            "existe": bool(servicio),
        },

        "solicitud": {
            "id": convertir_id(
                solicitud.get("_id")
            ),
            "titulo": solicitud.get(
                "titulo",
                "Solicitud no encontrada",
            ),
            "categoria": solicitud.get("categoria"),
            "categoria_id": solicitud.get(
                "categoria_id"
            ),
            "colonia": solicitud.get("colonia"),
            "ciudad": solicitud.get("ciudad"),
            "existe": bool(solicitud),
        },

        "fecha_creacion": documento.get(
            "fecha_creacion"
        ),

        "fecha_actualizacion": documento.get(
            "fecha_actualizacion"
        ),

        "fecha_archivado": documento.get(
            "fecha_archivado"
        ),

        "motivo_archivado": documento.get(
            "motivo_archivado"
        ),

        "fecha_moderacion": documento.get(
            "fecha_moderacion"
        ),

        "motivo_moderacion": documento.get(
            "motivo_moderacion"
        ),
    }


def obtener_resumen():
    filtro_operativas = {
        "archivada_administrativamente": {
            "$ne": True
        }
    }

    filtro_visibles = {
        **filtro_operativas,
        "oculta_administrativamente": {
            "$ne": True
        },
    }

    filtro_ocultas = {
        **filtro_operativas,
        "oculta_administrativamente": True,
    }

    filtro_archivadas = {
        "archivada_administrativamente": True
    }

    operativas = resenas.count_documents(
        filtro_operativas
    )

    visibles = resenas.count_documents(
        filtro_visibles
    )

    ocultas = resenas.count_documents(
        filtro_ocultas
    )

    archivadas = resenas.count_documents(
        filtro_archivadas
    )

    distribucion = {
        "1": 0,
        "2": 0,
        "3": 0,
        "4": 0,
        "5": 0,
    }

    resultados = list(
        resenas.aggregate([
            {
                "$match": {
                    **filtro_visibles,
                    "calificacion": {
                        "$in": [1, 2, 3, 4, 5]
                    },
                }
            },
            {
                "$group": {
                    "_id": "$calificacion",
                    "cantidad": {"$sum": 1},
                }
            },
        ])
    )

    suma = 0
    calificadas = 0

    for resultado in resultados:
        estrellas = int(resultado["_id"])
        cantidad = resultado["cantidad"]

        distribucion[str(estrellas)] += cantidad

        suma += estrellas * cantidad
        calificadas += cantidad

    promedio = (
        round(suma / calificadas, 2)
        if calificadas
        else 0
    )

    return {
        "registradas": operativas + archivadas,
        "operativas": operativas,
        "visibles": visibles,
        "ocultas": ocultas,
        "archivadas": archivadas,
        "calificacion_promedio": promedio,
        "distribucion": distribucion,
        "calificaciones_validas": calificadas,
        "calificaciones_invalidas": (
            visibles - calificadas
        ),
    }


@router.get("")
def listar_resenas(
    pagina: int = Query(1, ge=1),

    limite: int = Query(
        20,
        ge=1,
        le=100,
    ),

    busqueda: str = Query(
        "",
        max_length=100,
    ),

    calificacion: int = Query(
        0,
        ge=0,
        le=5,
    ),

    estado: Literal[
        "operativas",
        "visibles",
        "ocultas",
        "archivadas",
        "todas",
    ] = "operativas",

    administrador=Depends(
        obtener_administrador
    ),
):
    try:
        filtros = {}

        if estado in (
            "operativas",
            "visibles",
            "ocultas",
        ):
            filtros[
                "archivada_administrativamente"
            ] = {"$ne": True}

        if estado == "visibles":
            filtros[
                "oculta_administrativamente"
            ] = {"$ne": True}

        elif estado == "ocultas":
            filtros[
                "oculta_administrativamente"
            ] = True

        elif estado == "archivadas":
            filtros[
                "archivada_administrativamente"
            ] = True

        if calificacion != 0:
            filtros["calificacion"] = calificacion

        pipeline = []

        if filtros:
            pipeline.append({
                "$match": filtros
            })

        pipeline.extend(
            pipeline_resenas()
        )

        if busqueda.strip():
            expresion = {
                "$regex": re.escape(
                    busqueda.strip()
                ),
                "$options": "i",
            }

            pipeline.append({
                "$match": {
                    "$or": [
                        {
                            "comentario": expresion
                        },
                        {
                            "cliente.nombre": expresion
                        },
                        {
                            "cliente.correo": expresion
                        },
                        {
                            "tecnico.nombre": expresion
                        },
                        {
                            "tecnico.correo": expresion
                        },
                        {
                            "solicitud.titulo": expresion
                        },
                        {
                            "solicitud.categoria": expresion
                        },
                    ]
                }
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
                    {
                        "$limit": limite
                    },
                ],

                "conteo": [
                    {
                        "$count": "total"
                    }
                ],
            }
        })

        resultado = next(
            resenas.aggregate(pipeline),
            {
                "registros": [],
                "conteo": [],
            },
        )

        conteo = resultado.get(
            "conteo",
            [],
        )

        total = (
            conteo[0]["total"]
            if conteo
            else 0
        )

        return {
            "total": total,
            "pagina": pagina,
            "limite": limite,
            "resumen": obtener_resumen(),
            "resenas": [
                formatear_resena(documento)
                for documento in resultado.get(
                    "registros",
                    [],
                )
            ],
        }

    except PyMongoError as error:
        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible consultar las resenas."
            ),
        ) from error


@router.get("/{resena_id}")
def obtener_resena(
    resena_id: str,

    administrador=Depends(
        obtener_administrador
    ),
):
    if not resena_id.strip() or len(resena_id) > 200:
        raise HTTPException(
            status_code=400,
            detail="Identificador de resena invalido.",
        )

    try:
        identificador = resena_id

        existe = resenas.find_one(
            {"_id": identificador},
            {"_id": 1},
        )

        if not existe and ObjectId.is_valid(resena_id):
            identificador = ObjectId(resena_id)

        pipeline = [
            {
                "$match": {
                    "_id": identificador
                }
            }
        ]

        pipeline.extend(
            pipeline_resenas()
        )

        pipeline.append({
            "$limit": 1
        })

        documento = next(
            resenas.aggregate(pipeline),
            None,
        )

        if documento is None:
            raise HTTPException(
                status_code=404,
                detail="Resena no encontrada.",
            )

        resultado = formatear_resena(
            documento
        )

        resultado["historial_administrativo"] = (
            serializar(
                documento.get(
                    "historial_administrativo",
                    [],
                )
            )
        )

        return resultado

    except PyMongoError as error:
        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible consultar la resena."
            ),
        ) from error



# ==========================================
# MODERACION ADMINISTRATIVA DE RESENAS
# ==========================================

from datetime import datetime, timezone
from pydantic import BaseModel, Field
from src.routes.resenas import actualizar_calificacion_tecnico


class ModeracionResena(BaseModel):
    oculta: bool
    motivo: str = Field(
        min_length=5,
        max_length=300,
    )


@router.patch("/{resena_id}/moderacion")
def moderar_resena(
    resena_id: str,
    datos: ModeracionResena,
    administrador=Depends(obtener_administrador),
):
    motivo = datos.motivo.strip()

    if len(motivo) < 5:
        raise HTTPException(
            status_code=422,
            detail="Debes proporcionar un motivo valido.",
        )

    if not resena_id.strip() or len(resena_id) > 200:
        raise HTTPException(
            status_code=400,
            detail="Identificador de resena invalido.",
        )

    identificadores = [resena_id]

    if ObjectId.is_valid(resena_id):
        identificadores.append(ObjectId(resena_id))

    try:
        documento = resenas.find_one({
            "_id": {"$in": identificadores},
        })

        if documento is None:
            raise HTTPException(
                status_code=404,
                detail="Resena no encontrada.",
            )

        if documento.get("archivada_administrativamente") is True:
            raise HTTPException(
                status_code=409,
                detail="Las resenas archivadas no pueden moderarse.",
            )

        estado_actual = (
            documento.get("oculta_administrativamente") is True
        )

        tecnico_id = documento.get("tecnico_id")
        cliente_id = documento.get("cliente_id")
        servicio_id = documento.get("servicio_id")

        if (
            not isinstance(tecnico_id, ObjectId)
            or not isinstance(cliente_id, ObjectId)
            or not servicio_id
        ):
            raise HTTPException(
                status_code=409,
                detail="La resena no tiene referencias validas.",
            )

        servicio = db["servicios"].find_one({
            "_id": servicio_id,
            "cliente_id": cliente_id,
            "tecnico_id": tecnico_id,
            "estado": "finalizado",
            "archivado_administrativamente": {"$ne": True},
        })

        if servicio is None:
            raise HTTPException(
                status_code=409,
                detail="La resena no tiene un servicio finalizado valido.",
            )

        perfil = db["perfiles_tecnicos"].find_one({
            "usuario_id": tecnico_id,
        })

        if perfil is None:
            raise HTTPException(
                status_code=409,
                detail="El tecnico no tiene un perfil profesional.",
            )

        if estado_actual == datos.oculta:
            # Permite reparar las estadisticas si una
            # operacion anterior no termino correctamente.
            actualizar_calificacion_tecnico(tecnico_id)

            raise HTTPException(
                status_code=409,
                detail="La resena ya tiene el estado solicitado.",
            )

        ahora = datetime.now(timezone.utc)

        accion = (
            "ocultacion"
            if datos.oculta
            else "restauracion"
        )

        filtro_estado = (
            True
            if estado_actual
            else {"$ne": True}
        )

        resultado = resenas.update_one(
            {
                "_id": documento["_id"],
                "archivada_administrativamente": {"$ne": True},
                "oculta_administrativamente": filtro_estado,
            },
            {
                "$set": {
                    "oculta_administrativamente": datos.oculta,
                    "fecha_moderacion": ahora,
                    "motivo_moderacion": motivo,
                    "administrador_moderacion_id": str(
                        administrador["_id"]
                    ),
                },
                "$push": {
                    "historial_administrativo": {
                        "accion": accion,
                        "oculta": datos.oculta,
                        "motivo": motivo,
                        "administrador_id": str(
                            administrador["_id"]
                        ),
                        "fecha": ahora,
                    },
                },
            },
        )

        if resultado.modified_count != 1:
            raise HTTPException(
                status_code=409,
                detail="La resena fue modificada por otra operacion.",
            )

        try:
            actualizar_calificacion_tecnico(tecnico_id)

        except PyMongoError:
            raise HTTPException(
                status_code=503,
                detail=(
                    "La moderacion se guardo, pero no fue "
                    "posible actualizar la reputacion. "
                    "Reintenta la operacion."
                ),
            )

        perfil_actualizado = db["perfiles_tecnicos"].find_one({
            "usuario_id": tecnico_id,
        }) or {}

        return {
            "mensaje": (
                "Resena ocultada correctamente."
                if datos.oculta
                else "Resena restaurada correctamente."
            ),
            "resena_id": str(documento["_id"]),
            "oculta": datos.oculta,
            "estado": (
                "oculta" if datos.oculta else "visible"
            ),
            "motivo": motivo,
            "fecha_moderacion": ahora,
            "tecnico": {
                "id": str(tecnico_id),
                "calificacion_promedio": perfil_actualizado.get(
                    "calificacion_promedio", 0.0
                ),
                "total_resenas": perfil_actualizado.get(
                    "total_resenas", 0
                ),
            },
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No fue posible completar la moderacion.",
        )
