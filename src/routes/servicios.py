from datetime import datetime, timezone

from bson import ObjectId
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError, PyMongoError

from src.database import db
from src.routes.tecnicos import obtener_usuario_actual


# ==========================================
# SERVICIOS - POZASYNC
# ==========================================

router = APIRouter(
    prefix="/servicios",
    tags=["Servicios"],
)

servicios = db["servicios"]
conversaciones = db["conversaciones"]
solicitudes = db["solicitudes"]
usuarios = db["usuarios"]


# ==========================================
# MODELOS
# ==========================================

class ServicioCrear(BaseModel):
    conversacion_id: str = Field(
        min_length=1,
        max_length=200,
    )


# ==========================================
# VALIDACIONES
# ==========================================

def exigir_rol(usuario, rol):
    if usuario.get("rol") != rol:
        raise HTTPException(
            status_code=403,
            detail=f"Solo los usuarios con rol {rol} pueden realizar esta acción.",
        )


def formatear_servicio(servicio):
    fecha_creacion = servicio.get("fecha_creacion")
    fecha_aceptacion = servicio.get("fecha_aceptacion")
    fecha_finalizacion = servicio.get("fecha_finalizacion")
    fecha_rechazo = servicio.get("fecha_rechazo")

    def formatear_fecha(fecha):
        return fecha.isoformat() if fecha else None

    return {
        "id": str(servicio["_id"]),
        "conversacion_id": str(servicio["conversacion_id"]),
        "solicitud_id": str(servicio["solicitud_id"]),
        "cliente_id": str(servicio["cliente_id"]),
        "tecnico_id": str(servicio["tecnico_id"]),
        "estado": servicio["estado"],
        "fecha_creacion": formatear_fecha(fecha_creacion),
        "fecha_aceptacion": formatear_fecha(fecha_aceptacion),
        "fecha_rechazo": formatear_fecha(fecha_rechazo),
        "fecha_finalizacion": formatear_fecha(fecha_finalizacion),
        "puede_calificar": servicio["estado"] == "finalizado",
    }


def obtener_servicio_autorizado(servicio_id, usuario):
    try:
        servicio = servicios.find_one({
            "_id": servicio_id,
        })
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar el servicio.",
        )

    if servicio is None:
        raise HTTPException(
            status_code=404,
            detail="Servicio no encontrado.",
        )

    if usuario["_id"] not in (
        servicio.get("cliente_id"),
        servicio.get("tecnico_id"),
    ):
        raise HTTPException(
            status_code=403,
            detail="No tienes acceso a este servicio.",
        )

    return servicio


# ==========================================
# 1. CLIENTE SOLICITA ACUERDO
# ==========================================

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
def crear_servicio(
    datos: ServicioCrear,
    usuario=Depends(obtener_usuario_actual),
):
    exigir_rol(usuario, "cliente")

    conversacion_id = datos.conversacion_id.strip()

    try:
        conversacion = conversaciones.find_one({
            "_id": conversacion_id,
            "cliente_id": usuario["_id"],
        })
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar la conversación.",
        )

    if conversacion is None:
        raise HTTPException(
            status_code=404,
            detail="No se encontró una conversación válida.",
        )

    solicitud_id = conversacion.get("solicitud_id")
    tecnico_id = conversacion.get("tecnico_id")

    if (
        not isinstance(solicitud_id, ObjectId)
        or not isinstance(tecnico_id, ObjectId)
    ):
        raise HTTPException(
            status_code=409,
            detail="La conversación tiene datos inválidos.",
        )

    try:
        solicitud = solicitudes.find_one({
            "_id": solicitud_id,
            "cliente_id": usuario["_id"],
            "estado": "publicada",
            "bloqueada_administrativamente": {"$ne": True},
        })

        tecnico = usuarios.find_one({
            "_id": tecnico_id,
            "rol": "tecnico",
            "activo": True,
        })
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron validar los participantes.",
        )

    if solicitud is None:
        raise HTTPException(
            status_code=409,
            detail="La solicitud debe estar publicada para registrar un acuerdo.",
        )

    if tecnico is None:
        raise HTTPException(
            status_code=404,
            detail="El técnico no está disponible.",
        )

    fecha = datetime.now(timezone.utc)

    nuevo_servicio = {
        "_id": conversacion_id,
        "conversacion_id": conversacion_id,
        "solicitud_id": solicitud_id,
        "cliente_id": usuario["_id"],
        "tecnico_id": tecnico_id,
        "estado": "pendiente",
        "fecha_creacion": fecha,
        "fecha_aceptacion": None,
        "fecha_rechazo": None,
        "fecha_finalizacion": None,
    }

    try:
        servicios.insert_one(nuevo_servicio)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Ya existe un servicio para esta conversación.",
        )
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo registrar la propuesta.",
        )

    return {
        "mensaje": "Propuesta enviada al técnico.",
        "servicio": formatear_servicio(nuevo_servicio),
    }


# ==========================================
# 2. CONSULTAR MIS SERVICIOS
# ==========================================

@router.get("")
def listar_mis_servicios(
    usuario=Depends(obtener_usuario_actual),
):
    filtro = {
        "$or": [
            {"cliente_id": usuario["_id"]},
            {"tecnico_id": usuario["_id"]},
        ]
    }

    try:
        documentos = list(
            servicios.find(filtro)
            .sort("fecha_creacion", -1)
            .limit(100)
        )
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron consultar los servicios.",
        )

    return {
        "total": len(documentos),
        "servicios": [
            formatear_servicio(documento)
            for documento in documentos
        ],
    }


# ==========================================
# 3. CONSULTAR UN SERVICIO
# ==========================================

@router.get("/{servicio_id}")
def consultar_servicio(
    servicio_id: str,
    usuario=Depends(obtener_usuario_actual),
):
    servicio = obtener_servicio_autorizado(
        servicio_id,
        usuario,
    )

    return formatear_servicio(servicio)


# ==========================================
# 4. TECNICO ACEPTA ACUERDO
# ==========================================

@router.patch("/{servicio_id}/aceptar")
def aceptar_servicio(
    servicio_id: str,
    usuario=Depends(obtener_usuario_actual),
):
    exigir_rol(usuario, "tecnico")

    servicio = obtener_servicio_autorizado(
        servicio_id,
        usuario,
    )

    if servicio["tecnico_id"] != usuario["_id"]:
        raise HTTPException(
            status_code=403,
            detail="Solo el técnico asignado puede aceptar este servicio.",
        )

    if servicio["estado"] != "pendiente":
        raise HTTPException(
            status_code=409,
            detail="Solo se pueden aceptar propuestas pendientes.",
        )

    fecha = datetime.now(timezone.utc)

    try:
        resultado = servicios.update_one(
            {
                "_id": servicio_id,
                "tecnico_id": usuario["_id"],
                "estado": "pendiente",
            },
            {
                "$set": {
                    "estado": "acordado",
                    "fecha_aceptacion": fecha,
                }
            },
        )
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo aceptar el servicio.",
        )

    if resultado.modified_count != 1:
        raise HTTPException(
            status_code=409,
            detail="El estado del servicio cambió.",
        )

    return {
        "mensaje": "Servicio aceptado correctamente.",
        "servicio_id": servicio_id,
        "estado": "acordado",
    }


# ==========================================
# 5. TECNICO RECHAZA ACUERDO
# ==========================================

@router.patch("/{servicio_id}/rechazar")
def rechazar_servicio(
    servicio_id: str,
    usuario=Depends(obtener_usuario_actual),
):
    exigir_rol(usuario, "tecnico")

    servicio = obtener_servicio_autorizado(
        servicio_id,
        usuario,
    )

    if servicio["tecnico_id"] != usuario["_id"]:
        raise HTTPException(
            status_code=403,
            detail="Solo el técnico asignado puede rechazar este servicio.",
        )

    if servicio["estado"] != "pendiente":
        raise HTTPException(
            status_code=409,
            detail="Solo se pueden rechazar propuestas pendientes.",
        )

    fecha = datetime.now(timezone.utc)

    try:
        resultado = servicios.update_one(
            {
                "_id": servicio_id,
                "tecnico_id": usuario["_id"],
                "estado": "pendiente",
            },
            {
                "$set": {
                    "estado": "rechazado",
                    "fecha_rechazo": fecha,
                }
            },
        )
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo rechazar el servicio.",
        )

    if resultado.modified_count != 1:
        raise HTTPException(
            status_code=409,
            detail="El estado del servicio cambió.",
        )

    return {
        "mensaje": "Propuesta rechazada.",
        "servicio_id": servicio_id,
        "estado": "rechazado",
    }


# ==========================================
# 6. CLIENTE FINALIZA SERVICIO
# ==========================================

@router.patch("/{servicio_id}/finalizar")
def finalizar_servicio(
    servicio_id: str,
    usuario=Depends(obtener_usuario_actual),
):
    exigir_rol(usuario, "cliente")

    servicio = obtener_servicio_autorizado(
        servicio_id,
        usuario,
    )

    if servicio["cliente_id"] != usuario["_id"]:
        raise HTTPException(
            status_code=403,
            detail="Solo el cliente puede finalizar este servicio.",
        )

    if servicio["estado"] != "acordado":
        raise HTTPException(
            status_code=409,
            detail="Solo puedes finalizar un servicio aceptado por el técnico.",
        )

    fecha = datetime.now(timezone.utc)

    try:
        resultado = servicios.update_one(
            {
                "_id": servicio_id,
                "cliente_id": usuario["_id"],
                "estado": "acordado",
            },
            {
                "$set": {
                    "estado": "finalizado",
                    "fecha_finalizacion": fecha,
                }
            },
        )
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo finalizar el servicio.",
        )

    if resultado.modified_count != 1:
        raise HTTPException(
            status_code=409,
            detail="El estado del servicio cambió.",
        )

    return {
        "mensaje": "Servicio finalizado correctamente.",
        "servicio_id": servicio_id,
        "estado": "finalizado",
        "fecha_finalizacion": fecha.isoformat(),
        "puede_calificar": True,
    }