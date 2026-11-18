
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from pymongo.errors import DuplicateKeyError, PyMongoError

from src.database import db
from src.models.perfil_tecnico import (
    PerfilTecnicoCrear,
    PerfilTecnicoRespuesta,
)
from src.services.auth_service import verificar_token


router = APIRouter(
    prefix="/perfiles-tecnicos",
    tags=["Perfiles de tecnicos"],
)

usuarios = db["usuarios"]
perfiles = db["perfiles_tecnicos"]

seguridad = HTTPBearer(auto_error=False)

CATEGORIAS = {
    "electricidad": "electricidad",
    "plomeria": "plomeria",
    "plomería": "plomeria",
    "climatizacion": "climatizacion",
    "climatización": "climatizacion",
    "pintura": "pintura",
    "reparaciones": "reparaciones",
    "limpieza": "limpieza",
}


# ==========================================
# AUTENTICACION
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
        )

    if credenciales.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Autenticación no válida.",
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


def obtener_tecnico_actual(
    usuario=Depends(obtener_usuario_actual),
):
    if usuario.get("rol") != "tecnico":
        raise HTTPException(
            status_code=403,
            detail="Solo los técnicos pueden realizar esta acción.",
        )

    return usuario


# ==========================================
# COMPATIBILIDAD CON PERFILES ANTIGUOS
# ==========================================

def obtener_especialidades(perfil):
    valores = perfil.get("especialidades")

    if not isinstance(valores, list):
        anterior = perfil.get("especialidad")
        valores = [anterior] if anterior else []

    resultado = []

    for valor in valores:
        if not isinstance(valor, str):
            continue

        clave = valor.strip().lower()
        normalizada = CATEGORIAS.get(clave)

        if normalizada and normalizada not in resultado:
            resultado.append(normalizada)

    return resultado


def formatear_perfil(perfil, usuario):
    return {
        "id": str(perfil["_id"]),
        "usuario_id": str(perfil["usuario_id"]),
        "nombre": usuario.get("nombre", "Técnico"),
        "ciudad": usuario.get("ciudad", "Poza Rica"),
        "especialidades": obtener_especialidades(perfil),
        "descripcion": perfil.get("descripcion", ""),
        "experiencia_anios": perfil.get(
            "experiencia_anios", 0
        ),
        "colonias_cobertura": perfil.get(
            "colonias_cobertura", []
        ),
        "disponible": perfil.get("disponible", True),
        "portafolio": perfil.get("portafolio", []),
        "calificacion_promedio": perfil.get(
            "calificacion_promedio", 0.0
        ),
        "total_resenas": perfil.get(
            "total_resenas", 0
        ),
    }


# ==========================================
# CREAR PERFIL
# ==========================================

@router.post(
    "/",
    response_model=PerfilTecnicoRespuesta,
    status_code=status.HTTP_201_CREATED,
)
def crear_perfil(
    datos: PerfilTecnicoCrear,
    usuario=Depends(obtener_tecnico_actual),
):
    usuario_id = usuario["_id"]

    try:
        existente = perfiles.find_one({
            "usuario_id": usuario_id
        })

        if existente:
            raise HTTPException(
                status_code=409,
                detail="Ya tienes un perfil profesional.",
            )

        nuevo_perfil = datos.model_dump()

        nuevo_perfil.update({
            "usuario_id": usuario_id,
            "calificacion_promedio": 0.0,
            "total_resenas": 0,
            "fecha_creacion": datetime.now(timezone.utc),
        })

        resultado = perfiles.insert_one(nuevo_perfil)
        nuevo_perfil["_id"] = resultado.inserted_id

    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Ya tienes un perfil profesional.",
        )
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo crear el perfil.",
        )

    return formatear_perfil(nuevo_perfil, usuario)


# ==========================================
# CONSULTAR MI PERFIL
# ==========================================

@router.get(
    "/yo",
    response_model=PerfilTecnicoRespuesta,
)
def consultar_mi_perfil(
    usuario=Depends(obtener_tecnico_actual),
):
    try:
        perfil = perfiles.find_one({
            "usuario_id": usuario["_id"]
        })
    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar tu perfil.",
        )

    if perfil is None:
        raise HTTPException(
            status_code=404,
            detail="Todavía no tienes un perfil profesional.",
        )

    return formatear_perfil(perfil, usuario)


# ==========================================
# CONSULTAR PERFILES PUBLICOS
# ==========================================

@router.get(
    "/",
    response_model=list[PerfilTecnicoRespuesta],
)
def listar_perfiles():
    resultados = []

    try:
        for perfil in perfiles.find():
            usuario = usuarios.find_one({
                "_id": perfil.get("usuario_id"),
                "activo": True,
                "rol": "tecnico",
            })

            if usuario:
                datos = formatear_perfil(perfil, usuario)

                # Un perfil antiguo sin especialidad válida
                # necesita actualizarse antes de publicarse.
                if datos["especialidades"]:
                    resultados.append(datos)

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron consultar los perfiles.",
        )

    return resultados


# ==========================================
# ACTUALIZAR MI PERFIL
# ==========================================

@router.put(
    "/yo",
    response_model=PerfilTecnicoRespuesta,
)
def actualizar_mi_perfil(
    datos: PerfilTecnicoCrear,
    usuario=Depends(obtener_tecnico_actual),
):
    usuario_id = usuario["_id"]

    try:
        perfil = perfiles.find_one_and_update(
            {"usuario_id": usuario_id},
            {
                "$set": {
                    **datos.model_dump(),
                    "fecha_actualizacion": datetime.now(
                        timezone.utc
                    ),
                },
                "$unset": {
                    "especialidad": "",
                },
            },
            return_document=True,
        )

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo actualizar el perfil.",
        )

    if perfil is None:
        raise HTTPException(
            status_code=404,
            detail="Primero debes crear tu perfil profesional.",
        )

    return formatear_perfil(perfil, usuario)
