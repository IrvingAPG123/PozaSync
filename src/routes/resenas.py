from datetime import datetime, timezone

from bson import ObjectId
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from pymongo.errors import DuplicateKeyError, PyMongoError

from src.database import db
from src.models.resena import ResenaCrear
from src.routes.tecnicos import obtener_usuario_actual


# ==========================================
# RESENAS Y CALIFICACIONES - POZASYNC
# ==========================================

router = APIRouter(
    prefix="/resenas",
    tags=["Reseñas y calificaciones"],
)

resenas = db["resenas"]
servicios = db["servicios"]
perfiles = db["perfiles_tecnicos"]
usuarios = db["usuarios"]


# ==========================================
# FUNCIONES AUXILIARES
# ==========================================

def formatear_resena(resena):
    return {
        "id": str(resena["_id"]),
        "servicio_id": str(resena["servicio_id"]),
        "cliente_id": str(resena["cliente_id"]),
        "tecnico_id": str(resena["tecnico_id"]),
        "calificacion": resena["calificacion"],
        "comentario": resena.get("comentario", ""),
        "fecha_creacion": (
            resena["fecha_creacion"].isoformat()
            if resena.get("fecha_creacion")
            else None
        ),
    }


def actualizar_calificacion_tecnico(tecnico_id):
    """
    Recalcula la calificacion usando las resenas
    realmente almacenadas en MongoDB.
    """

    resultados = list(
        resenas.aggregate([
            {
                "$match": {
                    "tecnico_id": tecnico_id,
                }
            },
            {
                "$group": {
                    "_id": "$tecnico_id",
                    "promedio": {
                        "$avg": "$calificacion"
                    },
                    "total": {
                        "$sum": 1
                    },
                }
            },
        ])
    )

    if resultados:
        promedio = round(
            resultados[0]["promedio"], 2
        )
        total = resultados[0]["total"]
    else:
        promedio = 0.0
        total = 0

    perfiles.update_one(
        {"usuario_id": tecnico_id},
        {
            "$set": {
                "calificacion_promedio": promedio,
                "total_resenas": total,
            }
        },
    )


# ==========================================
# 1. CREAR RESENA
# ==========================================

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
def crear_resena(
    datos: ResenaCrear,
    usuario=Depends(obtener_usuario_actual),
):
    if usuario.get("rol") != "cliente":
        raise HTTPException(
            status_code=403,
            detail="Solo los clientes pueden publicar reseñas.",
        )

    servicio_id = datos.servicio_id.strip()

    try:
        servicio = servicios.find_one({
            "_id": servicio_id,
            "cliente_id": usuario["_id"],
        })
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar el servicio.",
        )

    if servicio is None:
        raise HTTPException(
            status_code=404,
            detail="No se encontró un servicio asociado a tu cuenta.",
        )

    if servicio.get("estado") != "finalizado":
        raise HTTPException(
            status_code=409,
            detail="Solo puedes calificar servicios finalizados.",
        )

    tecnico_id = servicio.get("tecnico_id")

    if not isinstance(tecnico_id, ObjectId):
        raise HTTPException(
            status_code=409,
            detail="El servicio no tiene un técnico válido.",
        )

    try:
        perfil = perfiles.find_one({
            "usuario_id": tecnico_id,
        })
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar el perfil técnico.",
        )

    if perfil is None:
        raise HTTPException(
            status_code=404,
            detail="El técnico no tiene un perfil profesional.",
        )

    nueva_resena = {
        # La clave del servicio evita duplicados:
        # solo puede existir una reseña por servicio.
        "_id": servicio_id,
        "servicio_id": servicio_id,
        "cliente_id": usuario["_id"],
        "tecnico_id": tecnico_id,
        "calificacion": datos.calificacion,
        "comentario": datos.comentario,
        "fecha_creacion": datetime.now(timezone.utc),
    }

    try:
        resenas.insert_one(nueva_resena)

    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Ya calificaste este servicio.",
        )

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo publicar la reseña.",
        )

    # La reseña ya quedó guardada.
    # Actualizamos las estadísticas del perfil.
    try:
        actualizar_calificacion_tecnico(tecnico_id)

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail=(
                "La reseña se guardó, pero no se pudieron "
                "actualizar las estadísticas del técnico."
            ),
        )

    return {
        "mensaje": "Reseña publicada correctamente.",
        "resena": formatear_resena(nueva_resena),
    }


# ==========================================
# 2. CONSULTAR MIS RESENAS
# ==========================================

@router.get("/mis-resenas")
def consultar_mis_resenas(
    usuario=Depends(obtener_usuario_actual),
):
    try:
        documentos = list(
            resenas.find({
                "cliente_id": usuario["_id"],
            })
            .sort("fecha_creacion", -1)
            .limit(100)
        )
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron consultar tus reseñas.",
        )

    return {
        "total": len(documentos),
        "resenas": [
            formatear_resena(documento)
            for documento in documentos
        ],
    }


# ==========================================
# 3. CONSULTAR RESENAS DE UN TECNICO
# ==========================================

@router.get("/tecnico/{tecnico_id}")
def consultar_resenas_tecnico(
    tecnico_id: str,
):
    if not ObjectId.is_valid(tecnico_id):
        raise HTTPException(
            status_code=400,
            detail="Identificador de técnico inválido.",
        )

    tecnico_object_id = ObjectId(tecnico_id)

    try:
        tecnico = usuarios.find_one({
            "_id": tecnico_object_id,
            "rol": "tecnico",
            "activo": True,
        })

        perfil = perfiles.find_one({
            "usuario_id": tecnico_object_id,
        })

        if tecnico is None or perfil is None:
            raise HTTPException(
                status_code=404,
                detail="Perfil técnico no encontrado.",
            )

        documentos = list(
            resenas.find({
                "tecnico_id": tecnico_object_id,
            })
            .sort("fecha_creacion", -1)
            .limit(100)
        )

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron consultar las reseñas.",
        )

    return {
        "tecnico_id": tecnico_id,
        "nombre": tecnico.get("nombre", "Técnico"),
        "calificacion_promedio": perfil.get(
            "calificacion_promedio", 0.0
        ),
        "total_resenas": perfil.get(
            "total_resenas", 0
        ),
        "resenas": [
            formatear_resena(documento)
            for documento in documentos
        ],
    }