
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError

from src.database import db
from src.services.auth_service import verificar_token
from src.services.imagenes_service import (
    MAX_IMAGENES,
    eliminar_imagen_cloudinary,
    subir_imagen,
)


# ==========================================
# RUTAS DE SOLICITUDES - POZASYNC
# ==========================================

router = APIRouter(
    prefix="/solicitudes",
    tags=["Solicitudes"],
)

solicitudes = db["solicitudes"]
usuarios = db["usuarios"]

seguridad = HTTPBearer(auto_error=False)

CATEGORIAS = {
    "electricidad": "Electricidad",
    "plomeria": "Plomería",
    "climatizacion": "Climatización",
    "pintura": "Pintura",
    "reparaciones": "Reparaciones",
    "limpieza": "Limpieza",
}


# ==========================================
# MODELOS
# ==========================================

class SolicitudCrear(BaseModel):
    categoria: str = Field(min_length=2, max_length=50)
    titulo: str = Field(min_length=5, max_length=100)
    descripcion: str = Field(min_length=15, max_length=1000)
    colonia: str = Field(min_length=2, max_length=100)


class SolicitudEditar(BaseModel):
    titulo: str = Field(min_length=5, max_length=100)
    descripcion: str = Field(min_length=15, max_length=1000)
    colonia: str = Field(min_length=2, max_length=100)


# ==========================================
# AUTENTICACIÓN Y ROLES
# ==========================================

def obtener_usuario_actual(
    credenciales: HTTPAuthorizationCredentials | None = Depends(
        seguridad
    ),
):
    if credenciales is None:
        raise HTTPException(
            status_code=401,
            detail="Debes iniciar sesión.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if credenciales.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Tipo de autenticación no válido.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    usuario_id = verificar_token(credenciales.credentials)

    if (
        not usuario_id
        or not isinstance(usuario_id, str)
        or not ObjectId.is_valid(usuario_id)
    ):
        raise HTTPException(
            status_code=401,
            detail="Token inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        usuario = usuarios.find_one({
            "_id": ObjectId(usuario_id)
        })
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar tu cuenta.",
        )

    if not usuario or not usuario.get("activo", False):
        raise HTTPException(
            status_code=401,
            detail="Usuario no encontrado o desactivado.",
        )

    if usuario.get("correo_verificado", True) is False:
        raise HTTPException(
            status_code=403,
            detail="Debes verificar tu correo electrónico.",
        )

    return usuario


def obtener_cliente_actual(
    usuario=Depends(obtener_usuario_actual),
):
    if usuario.get("rol") != "cliente":
        raise HTTPException(
            status_code=403,
            detail="Esta función es exclusiva para clientes.",
        )

    return usuario


def obtener_tecnico_actual(
    usuario=Depends(obtener_usuario_actual),
):
    if usuario.get("rol") != "tecnico":
        raise HTTPException(
            status_code=403,
            detail="Esta función es exclusiva para técnicos.",
        )

    return usuario


# ==========================================
# CONVERTIR SOLICITUD A JSON
# ==========================================

def convertir_solicitud(documento, cliente_publico=None):
    fecha = documento.get("fecha_creacion")
    fecha_publicacion = documento.get("fecha_publicacion")

    resultado = {
        "id": str(documento["_id"]),
        "categoria": documento["categoria"],
        "categoria_id": documento.get("categoria_id"),
        "titulo": documento["titulo"],
        "descripcion": documento["descripcion"],
        "colonia": documento["colonia"],
        "ciudad": documento.get("ciudad", "Poza Rica"),
        "estado": documento.get("estado", "borrador"),
        "imagenes": documento.get("imagenes", []),
        "fecha_creacion": (
            fecha.isoformat() if fecha else None
        ),
        "fecha_publicacion": (
            fecha_publicacion.isoformat()
            if fecha_publicacion
            else None
        ),
    }

    # Solamente agregamos información pública del cliente.
    # No devolvemos correo, teléfono ni contraseñas.
    if cliente_publico is not None:
        resultado["cliente"] = {
            "nombre": cliente_publico.get(
                "nombre", "Cliente de PozaSync"
            ),
            "foto_perfil": cliente_publico.get("foto_perfil"),
        }

    return resultado


# ==========================================
# CREAR SOLICITUD
# ==========================================

@router.post("", status_code=status.HTTP_201_CREATED)
def crear_solicitud(
    datos: SolicitudCrear,
    cliente=Depends(obtener_cliente_actual),
):
    categoria = datos.categoria.strip().lower()
    titulo = datos.titulo.strip()
    descripcion = datos.descripcion.strip()
    colonia = datos.colonia.strip()

    if categoria not in CATEGORIAS:
        raise HTTPException(
            status_code=422,
            detail="Categoría de servicio no válida.",
        )

    if len(titulo) < 5:
        raise HTTPException(
            status_code=422,
            detail="El título debe tener al menos 5 caracteres.",
        )

    if len(descripcion) < 15:
        raise HTTPException(
            status_code=422,
            detail="La descripción debe tener al menos 15 caracteres.",
        )

    if len(colonia) < 2:
        raise HTTPException(
            status_code=422,
            detail="Debes indicar una colonia válida.",
        )

    fecha_actual = datetime.now(timezone.utc)

    nueva_solicitud = {
        "cliente_id": cliente["_id"],
        "categoria_id": categoria,
        "categoria": CATEGORIAS[categoria],
        "titulo": titulo,
        "descripcion": descripcion,
        "colonia": colonia,
        "ciudad": cliente.get("ciudad") or "Poza Rica",
        "estado": "borrador",
        "imagenes": [],
        "fecha_creacion": fecha_actual,
        "fecha_actualizacion": fecha_actual,
        "fecha_publicacion": None,
    }

    try:
        resultado = solicitudes.insert_one(nueva_solicitud)
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo guardar la solicitud.",
        )

    nueva_solicitud["_id"] = resultado.inserted_id

    return {
        "mensaje": "Solicitud guardada correctamente.",
        "solicitud": convertir_solicitud(nueva_solicitud),
    }


# ==========================================
# MIS SOLICITUDES
# ==========================================

@router.get("")
def obtener_mis_solicitudes(
    cliente=Depends(obtener_cliente_actual),
):
    try:
        documentos = list(
            solicitudes.find({
                "cliente_id": cliente["_id"],
                "estado": {"$ne": "retirada"},
            })
            .sort("fecha_creacion", -1)
            .limit(100)
        )
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron consultar tus solicitudes.",
        )

    return {
        "total": len(documentos),
        "solicitudes": [
            convertir_solicitud(documento)
            for documento in documentos
        ],
    }


# ==========================================
# SOLICITUDES DISPONIBLES PARA TÉCNICOS
# ==========================================

@router.get("/disponibles")
def obtener_solicitudes_disponibles(
    tecnico=Depends(obtener_tecnico_actual),
):
    try:
        documentos = list(
            solicitudes.find({
                "estado": "publicada"
            })
            .sort("fecha_publicacion", -1)
            .limit(100)
        )

        # Consultar todos los clientes de una sola vez.
        # Evita una consulta independiente por publicación.
        ids_clientes = {
            documento["cliente_id"]
            for documento in documentos
            if isinstance(
                documento.get("cliente_id"),
                ObjectId,
            )
        }

        clientes = {}

        if ids_clientes:
            cursor = usuarios.find(
                {"_id": {"$in": list(ids_clientes)}},
                {
                    "nombre": 1,
                    "foto_perfil": 1,
                },
            )

            clientes = {
                usuario["_id"]: usuario
                for usuario in cursor
            }

        publicaciones = []

        for documento in documentos:
            cliente = clientes.get(
                documento.get("cliente_id")
            )

            datos_publicos = {
                "nombre": (
                    cliente.get("nombre")
                    if cliente
                    else "Cliente de PozaSync"
                ),
                "foto_perfil": (
                    cliente.get("foto_perfil")
                    if cliente
                    else None
                ),
            }

            publicaciones.append(
                convertir_solicitud(
                    documento,
                    cliente_publico=datos_publicos,
                )
            )

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail=(
                "No se pudieron consultar "
                "las solicitudes disponibles."
            ),
        )

    return {
        "total": len(publicaciones),
        "solicitudes": publicaciones,
    }


# ==========================================
# CONSULTAR UNA SOLICITUD PROPIA
# ==========================================

@router.get("/{solicitud_id}")
def obtener_solicitud(
    solicitud_id: str,
    cliente=Depends(obtener_cliente_actual),
):
    if not ObjectId.is_valid(solicitud_id):
        raise HTTPException(
            status_code=404,
            detail="Solicitud no encontrada.",
        )

    try:
        documento = solicitudes.find_one({
            "_id": ObjectId(solicitud_id),
            "cliente_id": cliente["_id"],
        })
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar la solicitud.",
        )

    if not documento:
        raise HTTPException(
            status_code=404,
            detail="Solicitud no encontrada.",
        )

    return convertir_solicitud(documento)


# ==========================================
# AGREGAR FOTOGRAFÍA
# ==========================================

@router.post(
    "/{solicitud_id}/imagenes",
    status_code=status.HTTP_201_CREATED,
)
async def agregar_imagen_solicitud(
    solicitud_id: str,
    archivo: UploadFile = File(...),
    cliente=Depends(obtener_cliente_actual),
):
    if not ObjectId.is_valid(solicitud_id):
        raise HTTPException(
            status_code=404,
            detail="Solicitud no encontrada.",
        )

    filtro = {
        "_id": ObjectId(solicitud_id),
        "cliente_id": cliente["_id"],
        "estado": "borrador",
    }

    try:
        documento = solicitudes.find_one(filtro)
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar la solicitud.",
        )

    if documento is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "No se encontró un borrador "
                "que te pertenezca."
            ),
        )

    if len(documento.get("imagenes", [])) >= MAX_IMAGENES:
        raise HTTPException(
            status_code=409,
            detail="Solo puedes adjuntar 5 fotografías.",
        )

    imagen = await subir_imagen(
        archivo,
        solicitud_id,
    )

    fecha_actual = datetime.now(timezone.utc)

    filtro_actualizacion = {
        **filtro,
        "imagenes.4": {"$exists": False},
    }

    try:
        actualizado = solicitudes.find_one_and_update(
            filtro_actualizacion,
            {
                "$push": {"imagenes": imagen},
                "$set": {
                    "fecha_actualizacion": fecha_actual,
                },
            },
            return_document=ReturnDocument.AFTER,
        )
    except PyMongoError:
        eliminar_imagen_cloudinary(imagen["public_id"])
        raise HTTPException(
            status_code=503,
            detail="No se pudo guardar la fotografía.",
        )

    if actualizado is None:
        eliminar_imagen_cloudinary(imagen["public_id"])
        raise HTTPException(
            status_code=409,
            detail=(
                "El borrador cambió o ya alcanzó "
                "el máximo de fotografías."
            ),
        )

    return {
        "mensaje": "Fotografía agregada correctamente.",
        "imagen": imagen,
        "solicitud": convertir_solicitud(actualizado),
    }


# ==========================================
# ELIMINAR FOTOGRAFÍA
# ==========================================

@router.delete(
    "/{solicitud_id}/imagenes/{public_id:path}"
)
def eliminar_imagen_solicitud(
    solicitud_id: str,
    public_id: str,
    cliente=Depends(obtener_cliente_actual),
):
    if not ObjectId.is_valid(solicitud_id):
        raise HTTPException(
            status_code=404,
            detail="Solicitud no encontrada.",
        )

    filtro = {
        "_id": ObjectId(solicitud_id),
        "cliente_id": cliente["_id"],
        "estado": "borrador",
        "imagenes.public_id": public_id,
    }

    try:
        documento = solicitudes.find_one(filtro)
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar la fotografía.",
        )

    if documento is None:
        raise HTTPException(
            status_code=404,
            detail="Fotografía no encontrada en tu borrador.",
        )

    if not eliminar_imagen_cloudinary(public_id):
        raise HTTPException(
            status_code=502,
            detail="No se pudo eliminar la fotografía.",
        )

    try:
        actualizado = solicitudes.find_one_and_update(
            filtro,
            {
                "$pull": {
                    "imagenes": {
                        "public_id": public_id,
                    },
                },
                "$set": {
                    "fecha_actualizacion": datetime.now(
                        timezone.utc
                    ),
                },
            },
            return_document=ReturnDocument.AFTER,
        )
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail=(
                "La fotografía se eliminó de Cloudinary, "
                "pero no se pudo actualizar MongoDB."
            ),
        )

    if actualizado is None:
        raise HTTPException(
            status_code=409,
            detail="El borrador cambió durante la operación.",
        )

    return {
        "mensaje": "Fotografía eliminada correctamente.",
        "solicitud": convertir_solicitud(actualizado),
    }


# ==========================================
# PUBLICAR SOLICITUD
# ==========================================

@router.patch("/{solicitud_id}/publicar")
def publicar_solicitud(
    solicitud_id: str,
    cliente=Depends(obtener_cliente_actual),
):
    if not ObjectId.is_valid(solicitud_id):
        raise HTTPException(
            status_code=404,
            detail="Solicitud no encontrada.",
        )

    fecha_actual = datetime.now(timezone.utc)

    try:
        documento = solicitudes.find_one_and_update(
            {
                "_id": ObjectId(solicitud_id),
                "cliente_id": cliente["_id"],
                "estado": "borrador",
            },
            {
                "$set": {
                    "estado": "publicada",
                    "fecha_publicacion": fecha_actual,
                    "fecha_actualizacion": fecha_actual,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo publicar la solicitud.",
        )

    if documento is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "La solicitud no existe, "
                "no te pertenece o ya fue publicada."
            ),
        )

    return {
        "mensaje": "Solicitud publicada correctamente.",
        "solicitud": convertir_solicitud(documento),
    }


# ==========================================
# EDITAR BORRADOR
# ==========================================

@router.patch("/{solicitud_id}")
def editar_solicitud(
    solicitud_id: str,
    datos: SolicitudEditar,
    cliente=Depends(obtener_cliente_actual),
):
    if not ObjectId.is_valid(solicitud_id):
        raise HTTPException(
            status_code=404,
            detail="Solicitud no encontrada.",
        )

    titulo = datos.titulo.strip()
    descripcion = datos.descripcion.strip()
    colonia = datos.colonia.strip()

    if len(titulo) < 5:
        raise HTTPException(
            status_code=422,
            detail="El título debe tener al menos 5 caracteres.",
        )

    if len(descripcion) < 15:
        raise HTTPException(
            status_code=422,
            detail="La descripción debe tener al menos 15 caracteres.",
        )

    if len(colonia) < 2:
        raise HTTPException(
            status_code=422,
            detail="Debes indicar una colonia válida.",
        )

    try:
        documento = solicitudes.find_one_and_update(
            {
                "_id": ObjectId(solicitud_id),
                "cliente_id": cliente["_id"],
                "estado": "borrador",
            },
            {
                "$set": {
                    "titulo": titulo,
                    "descripcion": descripcion,
                    "colonia": colonia,
                    "fecha_actualizacion": datetime.now(
                        timezone.utc
                    ),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo actualizar la solicitud.",
        )

    if documento is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "La solicitud no existe, no te pertenece "
                "o ya fue publicada."
            ),
        )

    return {
        "mensaje": "Borrador actualizado correctamente.",
        "solicitud": convertir_solicitud(documento),
    }


# ==========================================
# RETIRAR PUBLICACIÓN
# ==========================================

@router.patch("/{solicitud_id}/retirar")
def retirar_solicitud(
    solicitud_id: str,
    cliente=Depends(obtener_cliente_actual),
):
    if not ObjectId.is_valid(solicitud_id):
        raise HTTPException(
            status_code=404,
            detail="Solicitud no encontrada.",
        )

    filtro = {
        "_id": ObjectId(solicitud_id),
        "cliente_id": cliente["_id"],
        "estado": "publicada",
    }

    fecha_actual = datetime.now(timezone.utc)

    try:
        documento = solicitudes.find_one_and_update(
            filtro,
            {
                "$set": {
                    "estado": "retirada",
                    "fecha_actualizacion": fecha_actual,
                    "fecha_retiro": fecha_actual,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo retirar la solicitud.",
        )

    if documento is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "La solicitud no existe, no te pertenece "
                "o ya no está publicada."
            ),
        )

    return {
        "mensaje": "Publicación retirada correctamente.",
        "solicitud": convertir_solicitud(documento),
    }


# ==========================================
# ELIMINAR BORRADOR
# ==========================================

@router.delete("/{solicitud_id}")
def eliminar_solicitud(
    solicitud_id: str,
    cliente=Depends(obtener_cliente_actual),
):
    if not ObjectId.is_valid(solicitud_id):
        raise HTTPException(
            status_code=404,
            detail="Solicitud no encontrada.",
        )

    filtro = {
        "_id": ObjectId(solicitud_id),
        "cliente_id": cliente["_id"],
        "estado": "borrador",
    }

    try:
        documento = solicitudes.find_one(filtro)
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar el borrador.",
        )

    if documento is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "No se encontró un borrador "
                "que puedas eliminar."
            ),
        )

    # Eliminar primero las imágenes de Cloudinary.
    # Si falla alguna, conservar el borrador.
    for imagen in documento.get("imagenes", []):
        public_id = imagen.get("public_id")

        if public_id and not eliminar_imagen_cloudinary(public_id):
            raise HTTPException(
                status_code=502,
                detail=(
                    "No se pudieron eliminar todas "
                    "las fotografías. Intenta nuevamente."
                ),
            )

    try:
        resultado = solicitudes.delete_one(filtro)
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo eliminar la solicitud.",
        )

    if resultado.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail=(
                "No se encontró un borrador "
                "que puedas eliminar."
            ),
        )

    return {
        "mensaje": "Borrador eliminado correctamente."
    }
