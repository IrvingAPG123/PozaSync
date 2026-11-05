
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials,
)
from pymongo.errors import DuplicateKeyError

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


# ==========================================
# IDENTIFICAR AL USUARIO AUTENTICADO
# ==========================================

def obtener_usuario_actual(
    credenciales: HTTPAuthorizationCredentials | None = Depends(seguridad),
):
    if credenciales is None:
        raise HTTPException(
            status_code=401,
            detail="Debes iniciar sesion",
        )

    usuario_id = verificar_token(
        credenciales.credentials
    )

    if not usuario_id or not ObjectId.is_valid(usuario_id):
        raise HTTPException(
            status_code=401,
            detail="Token invalido o expirado",
        )

    usuario = usuarios.find_one({
        "_id": ObjectId(usuario_id)
    })

    if not usuario or not usuario.get("activo", False):
        raise HTTPException(
            status_code=401,
            detail="Usuario no encontrado o desactivado",
        )

    return usuario


# ==========================================
# COMPROBAR QUE EL USUARIO SEA TECNICO
# ==========================================

def obtener_tecnico_actual(
    usuario=Depends(obtener_usuario_actual),
):
    if usuario.get("rol") != "tecnico":
        raise HTTPException(
            status_code=403,
            detail="Solo los tecnicos pueden realizar esta accion",
        )

    return usuario


# ==========================================
# FORMATO PUBLICO DEL PERFIL
# ==========================================

def formatear_perfil(perfil, usuario):
    return {
        "id": str(perfil["_id"]),
        "usuario_id": str(perfil["usuario_id"]),
        "nombre": usuario["nombre"],
        "ciudad": usuario["ciudad"],
        "especialidad": perfil["especialidad"],
        "descripcion": perfil["descripcion"],
        "experiencia_anios": perfil["experiencia_anios"],
        "colonias_cobertura": perfil["colonias_cobertura"],
        "disponible": perfil["disponible"],
        "portafolio": perfil.get("portafolio", []),
        "calificacion_promedio": perfil.get(
            "calificacion_promedio", 0.0
        ),
        "total_resenas": perfil.get(
            "total_resenas", 0
        ),
    }


# ==========================================
# CREAR PERFIL PROFESIONAL
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

    if perfiles.find_one({"usuario_id": usuario_id}):
        raise HTTPException(
            status_code=409,
            detail="Ya tienes un perfil profesional",
        )

    nuevo_perfil = datos.model_dump()

    nuevo_perfil.update({
        "usuario_id": usuario_id,
        "calificacion_promedio": 0.0,
        "total_resenas": 0,
        "fecha_creacion": datetime.now(timezone.utc),
    })

    try:
        resultado = perfiles.insert_one(nuevo_perfil)

    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Ya tienes un perfil profesional",
        )

    nuevo_perfil["_id"] = resultado.inserted_id

    return formatear_perfil(nuevo_perfil, usuario)


# ==========================================
# CONSULTAR PERFILES PUBLICOS
# ==========================================

@router.get(
    "/",
    response_model=list[PerfilTecnicoRespuesta],
)
def listar_perfiles():
    resultados = []

    for perfil in perfiles.find():
        usuario = usuarios.find_one({
            "_id": perfil.get("usuario_id"),
            "activo": True,
            "rol": "tecnico",
        })

        if usuario:
            resultados.append(
                formatear_perfil(perfil, usuario)
            )

    return resultados


# ==========================================
# ACTUALIZAR MI PERFIL PROFESIONAL
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

    resultado = perfiles.update_one(
        {"usuario_id": usuario_id},
        {
            "$set": {
                **datos.model_dump(),
                "fecha_actualizacion": datetime.now(
                    timezone.utc
                ),
            }
        },
    )

    if resultado.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Primero debes crear tu perfil profesional",
        )

    perfil = perfiles.find_one({
        "usuario_id": usuario_id
    })

    return formatear_perfil(perfil, usuario)
