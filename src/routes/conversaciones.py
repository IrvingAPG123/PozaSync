
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from pydantic import BaseModel, ConfigDict, Field
from pymongo.errors import DuplicateKeyError, PyMongoError

from src.database import db
from src.services.auth_service import verificar_token
from src.services.imagenes_service import (
    subir_imagen,
    eliminar_imagen_cloudinary,
)


# ==========================================
# CHAT PRIVADO - POZASYNC
# ==========================================

router = APIRouter(
    prefix="/conversaciones",
    tags=["Conversaciones y mensajes"],
)

usuarios = db["usuarios"]
solicitudes = db["solicitudes"]
perfiles_tecnicos = db["perfiles_tecnicos"]
conversaciones = db["conversaciones"]
mensajes = db["mensajes"]

seguridad = HTTPBearer(auto_error=False)

MAX_CONVERSACIONES = 100
MAX_MENSAJES_POR_CONSULTA = 100


# ==========================================
# MODELOS
# ==========================================

class IniciarConversacion(BaseModel):
    solicitud_id: str = Field(
        min_length=24,
        max_length=24,
    )


class EnviarMensaje(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True
    )

    contenido: str = Field(
        min_length=1,
        max_length=2000,
    )


# ==========================================
# AUTENTICACION
# ==========================================

def obtener_usuario_actual(
    credenciales: HTTPAuthorizationCredentials | None = Depends(
        seguridad
    ),
):
    if (
        credenciales is None
        or credenciales.scheme.lower() != "bearer"
    ):
        raise HTTPException(
            status_code=401,
            detail="Debes iniciar sesión.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    usuario_id = verificar_token(
        credenciales.credentials
    )

    if (
        not isinstance(usuario_id, str)
        or not ObjectId.is_valid(usuario_id)
    ):
        raise HTTPException(
            status_code=401,
            detail="Token inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        usuario = usuarios.find_one({
            "_id": ObjectId(usuario_id),
        })
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar tu cuenta.",
        )

    if not usuario or not usuario.get("activo", False):
        raise HTTPException(
            status_code=401,
            detail="Cuenta inexistente o desactivada.",
        )

    if usuario.get("correo_verificado", True) is False:
        raise HTTPException(
            status_code=403,
            detail="Debes verificar tu correo electrónico.",
        )

    return usuario


# ==========================================
# VALIDACIONES
# ==========================================

def validar_object_id(
    valor: str,
    nombre: str,
) -> ObjectId:
    if not ObjectId.is_valid(valor):
        raise HTTPException(
            status_code=404,
            detail=f"{nombre} no encontrado.",
        )

    return ObjectId(valor)


def validar_id_conversacion(
    conversacion_id: str,
):
    if not isinstance(conversacion_id, str):
        raise HTTPException(
            status_code=404,
            detail="Conversación no encontrada.",
        )

    if ObjectId.is_valid(conversacion_id):
        return ObjectId(conversacion_id)

    partes = conversacion_id.split(":")

    if (
        len(partes) == 2
        and all(
            ObjectId.is_valid(parte)
            for parte in partes
        )
    ):
        return conversacion_id

    raise HTTPException(
        status_code=404,
        detail="Conversación no encontrada.",
    )


def verificar_participante(
    conversacion,
    usuario,
):
    usuario_id = usuario["_id"]

    if usuario_id not in (
        conversacion.get("cliente_id"),
        conversacion.get("tecnico_id"),
    ):
        raise HTTPException(
            status_code=403,
            detail="No participas en esta conversación.",
        )


def obtener_conversacion_autorizada(
    conversacion_id: str,
    usuario,
):
    identificador = validar_id_conversacion(
        conversacion_id
    )

    try:
        conversacion = conversaciones.find_one({
            "_id": identificador,
        })
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar la conversación.",
        )

    if conversacion is None:
        raise HTTPException(
            status_code=404,
            detail="Conversación no encontrada.",
        )

    verificar_participante(
        conversacion,
        usuario,
    )

    return conversacion


# ==========================================
# FORMATO DE RESPUESTAS
# ==========================================

def formatear_fecha(fecha):
    if isinstance(fecha, datetime):
        if fecha.tzinfo is None:
            fecha = fecha.replace(tzinfo=timezone.utc)

        return fecha.astimezone(timezone.utc).isoformat()

    return None


def formatear_mensaje(mensaje):
    return {
        "id": str(mensaje["_id"]),
        "conversacion_id": str(
            mensaje["conversacion_id"]
        ),
        "remitente_id": str(
            mensaje["remitente_id"]
        ),
        "contenido": mensaje["contenido"],
        "imagen": mensaje.get("imagen"),
        "fecha_envio": formatear_fecha(
            mensaje.get("fecha_envio")
        ),
        "leido": mensaje.get(
            "leido",
            False,
        ),
    }


def formatear_conversacion(
    conversacion,
    usuario_actual,
    participantes=None,
    publicaciones=None,
    pendientes=None,
):
    participantes = participantes or {}
    publicaciones = publicaciones or {}
    pendientes = pendientes or {}

    cliente = participantes.get(
        conversacion["cliente_id"],
        {},
    )

    tecnico = participantes.get(
        conversacion["tecnico_id"],
        {},
    )

    solicitud = publicaciones.get(
        conversacion["solicitud_id"],
        {},
    )

    es_cliente = (
        usuario_actual["_id"]
        == conversacion["cliente_id"]
    )

    otro_usuario = (
        tecnico if es_cliente else cliente
    )

    return {
        "id": str(conversacion["_id"]),
        "solicitud_id": str(
            conversacion["solicitud_id"]
        ),
        "cliente_id": str(
            conversacion["cliente_id"]
        ),
        "tecnico_id": str(
            conversacion["tecnico_id"]
        ),
        "titulo_solicitud": solicitud.get(
            "titulo",
            "Solicitud de servicio",
        ),
        "categoria_solicitud": solicitud.get(
            "categoria",
            "",
        ),
        "otro_participante": {
            "nombre": otro_usuario.get(
                "nombre",
                "Usuario de PozaSync",
            ),
            "foto_perfil": otro_usuario.get(
                "foto_perfil"
            ),
        },
        "ultimo_mensaje": conversacion.get(
            "ultimo_mensaje"
        ),
        "fecha_creacion": formatear_fecha(
            conversacion.get("fecha_creacion")
        ),
        "fecha_actualizacion": formatear_fecha(
            conversacion.get("fecha_actualizacion")
        ),
        "mensajes_sin_leer": pendientes.get(
            conversacion["_id"],
            0,
        ),
    }


def obtener_datos_relacionados(documentos):
    ids_usuarios = set()
    ids_solicitudes = set()

    for conversacion in documentos:
        ids_usuarios.add(
            conversacion["cliente_id"]
        )
        ids_usuarios.add(
            conversacion["tecnico_id"]
        )
        ids_solicitudes.add(
            conversacion["solicitud_id"]
        )

    participantes = {}
    publicaciones = {}

    if ids_usuarios:
        participantes = {
            usuario["_id"]: usuario
            for usuario in usuarios.find(
                {
                    "_id": {
                        "$in": list(ids_usuarios)
                    }
                },
                {
                    "nombre": 1,
                    "foto_perfil": 1,
                },
            )
        }

    if ids_solicitudes:
        publicaciones = {
            solicitud["_id"]: solicitud
            for solicitud in solicitudes.find(
                {
                    "_id": {
                        "$in": list(ids_solicitudes)
                    }
                },
                {
                    "titulo": 1,
                    "categoria": 1,
                },
            )
        }

    return participantes, publicaciones


# ==========================================
# MENSAJES PENDIENTES
# ==========================================

def filtro_mensajes_pendientes(usuario_id):
    return {
        "remitente_id": {
            "$ne": usuario_id
        },
        "leido": {
            "$ne": True
        },
    }


def contar_pendientes_por_conversacion(
    ids_conversaciones,
    usuario_id,
):
    if not ids_conversaciones:
        return {}

    filtro = {
        "conversacion_id": {
            "$in": ids_conversaciones
        },
        **filtro_mensajes_pendientes(
            usuario_id
        ),
    }

    resultado = mensajes.aggregate([
        {
            "$match": filtro
        },
        {
            "$group": {
                "_id": "$conversacion_id",
                "total": {
                    "$sum": 1
                },
            }
        },
    ])

    return {
        documento["_id"]: documento["total"]
        for documento in resultado
    }


# ==========================================
# INICIAR O RECUPERAR CONVERSACION
# ==========================================

@router.post(
    "",
    status_code=status.HTTP_200_OK,
)
def iniciar_conversacion(
    datos: IniciarConversacion,
    tecnico=Depends(obtener_usuario_actual),
):
    if tecnico.get("rol") != "tecnico":
        raise HTTPException(
            status_code=403,
            detail="Solo un técnico puede iniciar una conversación.",
        )

    solicitud_id = validar_object_id(
        datos.solicitud_id,
        "Solicitud",
    )

    try:
        solicitud = solicitudes.find_one({
            "_id": solicitud_id,
            "estado": "publicada",
            "bloqueada_administrativamente": {"$ne": True},
        })

        perfil = perfiles_tecnicos.find_one({
            "usuario_id": tecnico["_id"],
        })
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo validar la solicitud.",
        )

    if solicitud is None:
        raise HTTPException(
            status_code=404,
            detail="La solicitud no está disponible.",
        )

    if perfil is None:
        raise HTTPException(
            status_code=403,
            detail="Primero debes crear tu perfil profesional.",
        )

    if not perfil.get("disponible", True):
        raise HTTPException(
            status_code=403,
            detail="Activa tu disponibilidad para contactar clientes.",
        )

    cliente_id = solicitud.get(
        "cliente_id"
    )

    if not isinstance(cliente_id, ObjectId):
        raise HTTPException(
            status_code=409,
            detail="La solicitud no tiene un cliente válido.",
        )

    try:
        cliente = usuarios.find_one({
            "_id": cliente_id,
            "rol": "cliente",
            "activo": True,
        })
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar al cliente.",
        )

    if cliente is None:
        raise HTTPException(
            status_code=404,
            detail="El cliente ya no está disponible.",
        )

    clave_unica = (
        f"{solicitud_id}:{tecnico['_id']}"
    )

    filtro = {
        "solicitud_id": solicitud_id,
        "cliente_id": cliente_id,
        "tecnico_id": tecnico["_id"],
    }

    fecha = datetime.now(timezone.utc)

    nueva_conversacion = {
        "_id": clave_unica,
        **filtro,
        "ultimo_mensaje": None,
        "fecha_creacion": fecha,
        "fecha_actualizacion": fecha,
    }

    try:
        conversacion = conversaciones.find_one(
            filtro
        )

        if conversacion is None:
            try:
                conversaciones.insert_one(
                    nueva_conversacion
                )
                conversacion = nueva_conversacion

            except DuplicateKeyError:
                conversacion = conversaciones.find_one(
                    filtro
                )

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo iniciar la conversación.",
        )

    if conversacion is None:
        raise HTTPException(
            status_code=409,
            detail="No se pudo recuperar la conversación.",
        )

    return {
        "mensaje": "Conversación disponible.",
        "conversacion": {
            "id": str(
                conversacion["_id"]
            ),
            "solicitud_id": str(
                conversacion["solicitud_id"]
            ),
            "cliente_id": str(
                conversacion["cliente_id"]
            ),
            "tecnico_id": str(
                conversacion["tecnico_id"]
            ),
        },
    }


# ==========================================
# LISTAR MIS CONVERSACIONES
# ==========================================

@router.get("")
def listar_mis_conversaciones(
    usuario=Depends(obtener_usuario_actual),
):
    if usuario.get("rol") not in (
        "cliente",
        "tecnico",
    ):
        raise HTTPException(
            status_code=403,
            detail="No tienes acceso a conversaciones.",
        )

    filtro = {
        "$or": [
            {
                "cliente_id": usuario["_id"]
            },
            {
                "tecnico_id": usuario["_id"]
            },
        ]
    }

    try:
        documentos = list(
            conversaciones.find(filtro)
            .sort("fecha_actualizacion", -1)
            .limit(MAX_CONVERSACIONES)
        )

        participantes, publicaciones = (
            obtener_datos_relacionados(
                documentos
            )
        )

        pendientes = contar_pendientes_por_conversacion(
            [
                documento["_id"]
                for documento in documentos
            ],
            usuario["_id"],
        )

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron consultar tus conversaciones.",
        )

    return {
        "total": len(documentos),
        "conversaciones": [
            formatear_conversacion(
                documento,
                usuario,
                participantes,
                publicaciones,
                pendientes,
            )
            for documento in documentos
        ],
    }


# ==========================================
# CONTADOR GENERAL DE NOTIFICACIONES
# ==========================================

@router.get("/notificaciones")
def consultar_notificaciones(
    usuario=Depends(obtener_usuario_actual),
):
    try:
        documentos = list(
            conversaciones.find(
                {
                    "$or": [
                        {
                            "cliente_id": usuario["_id"]
                        },
                        {
                            "tecnico_id": usuario["_id"]
                        },
                    ]
                },
                {
                    "_id": 1
                },
            )
        )

        pendientes = contar_pendientes_por_conversacion(
            [
                documento["_id"]
                for documento in documentos
            ],
            usuario["_id"],
        )

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron consultar las notificaciones.",
        )

    return {
        "mensajes_sin_leer": sum(
            pendientes.values()
        ),
        "conversaciones_con_pendientes": len(
            pendientes
        ),
    }


# ==========================================
# CONSULTAR UNA CONVERSACION
# ==========================================

@router.get("/{conversacion_id}")
def consultar_conversacion(
    conversacion_id: str,
    usuario=Depends(obtener_usuario_actual),
):
    conversacion = obtener_conversacion_autorizada(
        conversacion_id,
        usuario,
    )

    try:
        participantes, publicaciones = (
            obtener_datos_relacionados(
                [conversacion]
            )
        )

        pendientes = contar_pendientes_por_conversacion(
            [conversacion["_id"]],
            usuario["_id"],
        )

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar la conversación.",
        )

    return formatear_conversacion(
        conversacion,
        usuario,
        participantes,
        publicaciones,
        pendientes,
    )


# ==========================================
# LEER MENSAJES
# ==========================================

@router.get("/{conversacion_id}/mensajes")
def listar_mensajes(
    conversacion_id: str,
    usuario=Depends(obtener_usuario_actual),
):
    conversacion = obtener_conversacion_autorizada(
        conversacion_id,
        usuario,
    )

    try:
        documentos = list(
            mensajes.find({
                "conversacion_id": conversacion["_id"],
            })
            .sort("fecha_envio", -1)
            .limit(MAX_MENSAJES_POR_CONSULTA)
        )

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron consultar los mensajes.",
        )

    documentos.reverse()

    return {
        "total": len(documentos),
        "mensajes": [
            formatear_mensaje(mensaje)
            for mensaje in documentos
        ],
    }


# ==========================================
# MARCAR MENSAJES COMO LEIDOS
# ==========================================

@router.post("/{conversacion_id}/leer")
def marcar_mensajes_leidos(
    conversacion_id: str,
    usuario=Depends(obtener_usuario_actual),
):
    conversacion = obtener_conversacion_autorizada(
        conversacion_id,
        usuario,
    )

    fecha = datetime.now(timezone.utc)

    filtro = {
        "conversacion_id": conversacion["_id"],
        **filtro_mensajes_pendientes(
            usuario["_id"]
        ),
    }

    try:
        resultado = mensajes.update_many(
            filtro,
            {
                "$set": {
                    "leido": True,
                    "fecha_lectura": fecha,
                }
            },
        )

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron marcar los mensajes como leídos.",
        )

    return {
        "mensaje": "Mensajes marcados como leídos.",
        "mensajes_marcados": resultado.modified_count,
        "mensajes_sin_leer": 0,
    }


# ==========================================
# ENVIAR MENSAJE DE TEXTO
# ==========================================

@router.post(
    "/{conversacion_id}/mensajes",
    status_code=status.HTTP_201_CREATED,
)
def enviar_mensaje(
    conversacion_id: str,
    datos: EnviarMensaje,
    usuario=Depends(obtener_usuario_actual),
):
    conversacion = obtener_conversacion_autorizada(
        conversacion_id,
        usuario,
    )

    fecha = datetime.now(timezone.utc)

    nuevo_mensaje = {
        "conversacion_id": conversacion["_id"],
        "remitente_id": usuario["_id"],
        "contenido": datos.contenido,
        "fecha_envio": fecha,
        "leido": False,
        "fecha_lectura": None,
    }

    try:
        resultado = mensajes.insert_one(
            nuevo_mensaje
        )

        nuevo_mensaje["_id"] = (
            resultado.inserted_id
        )

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo enviar el mensaje.",
        )

    try:
        conversaciones.update_one(
            {
                "_id": conversacion["_id"],
                "fecha_actualizacion": {
                    "$lte": fecha
                },
            },
            {
                "$set": {
                    "ultimo_mensaje": (
                        datos.contenido[:150]
                    ),
                    "fecha_actualizacion": fecha,
                }
            },
        )

    except PyMongoError:
        # El mensaje ya quedó almacenado.
        pass

    return {
        "mensaje": "Mensaje enviado correctamente.",
        "datos": formatear_mensaje(
            nuevo_mensaje
        ),
    }


# ==========================================
# ENVIAR FOTOGRAFIA EN EL CHAT
# ==========================================

@router.post(
    "/{conversacion_id}/imagenes",
    status_code=status.HTTP_201_CREATED,
)
async def enviar_imagen_mensaje(
    conversacion_id: str,
    archivo: UploadFile = File(...),
    contenido: str = Form(default=""),
    usuario=Depends(obtener_usuario_actual),
):
    # Verificar que el usuario pertenece al chat.
    conversacion = obtener_conversacion_autorizada(
        conversacion_id,
        usuario,
    )

    # El texto que acompaña la foto es opcional.
    texto = contenido.strip()

    if len(texto) > 2000:
        raise HTTPException(
            status_code=422,
            detail="El texto no puede superar los 2000 caracteres.",
        )

    # Subir la fotografía a Cloudinary.
    imagen = await subir_imagen(
        archivo,
        str(conversacion["_id"]),
        tipo_destino="conversaciones",
    )

    fecha = datetime.now(timezone.utc)

    # Guardar el mensaje con su imagen.
    nuevo_mensaje = {
        "conversacion_id": conversacion["_id"],
        "remitente_id": usuario["_id"],
        "contenido": texto,
        "imagen": imagen,
        "fecha_envio": fecha,
        "leido": False,
        "fecha_lectura": None,
    }

    try:
        resultado = mensajes.insert_one(
            nuevo_mensaje
        )

        nuevo_mensaje["_id"] = (
            resultado.inserted_id
        )

    except PyMongoError:
        # Evitar dejar una imagen sin mensaje.
        eliminar_imagen_cloudinary(
            imagen["public_id"]
        )

        raise HTTPException(
            status_code=503,
            detail="No se pudo guardar la fotografía en el chat.",
        )

    # Actualizar la vista previa de la conversación.
    try:
        conversaciones.update_one(
            {
                "_id": conversacion["_id"],
                "fecha_actualizacion": {
                    "$lte": fecha
                },
            },
            {
                "$set": {
                    "ultimo_mensaje": (
                        f"📷 {texto[:147]}"
                        if texto
                        else "📷 Fotografía"
                    ),
                    "fecha_actualizacion": fecha,
                }
            },
        )

    except PyMongoError:
        # La fotografía y su mensaje ya están guardados.
        pass

    return {
        "mensaje": "Fotografía enviada correctamente.",
        "datos": formatear_mensaje(
            nuevo_mensaje
        ),
    }
