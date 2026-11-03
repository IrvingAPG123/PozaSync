
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pymongo.errors import DuplicateKeyError

from src.database import db
from src.models.usuario import (
    UsuarioRegistro,
    UsuarioLogin,
    UsuarioRespuesta,
    TokenRespuesta,
)
from src.services.auth_service import (
    proteger_contrasena,
    verificar_contrasena,
    crear_token,
    verificar_token,
)


# Configuracion de las rutas de autenticacion
router = APIRouter(
    prefix="/auth",
    tags=["Autenticacion"]
)

# Coleccion de usuarios en MongoDB Atlas
usuarios = db["usuarios"]

# Seguridad mediante token Bearer
seguridad = HTTPBearer(auto_error=False)


# ==========================================
# REGISTRO DE USUARIOS
# ==========================================

@router.post(
    "/registro",
    response_model=UsuarioRespuesta,
    status_code=status.HTTP_201_CREATED,
)
def registrar_usuario(datos: UsuarioRegistro):
    correo = str(datos.correo).lower()

    if usuarios.find_one({"correo": correo}):
        raise HTTPException(
            status_code=409,
            detail="Este correo ya esta registrado",
        )

    nuevo_usuario = {
        "nombre": datos.nombre,
        "correo": correo,
        "contrasena_hash": proteger_contrasena(datos.contrasena),
        "rol": datos.rol,
        "colonia": datos.colonia,
        "ciudad": datos.ciudad,
        "foto_perfil": datos.foto_perfil,
        "activo": True,
        "fecha_registro": datetime.now(timezone.utc),
    }

    try:
        resultado = usuarios.insert_one(nuevo_usuario)

    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Este correo ya esta registrado",
        )

    return {
        "id": str(resultado.inserted_id),
        "nombre": datos.nombre,
        "correo": correo,
        "rol": datos.rol,
        "colonia": datos.colonia,
        "ciudad": datos.ciudad,
        "foto_perfil": datos.foto_perfil,
        "activo": True,
    }


# ==========================================
# INICIO DE SESION
# ==========================================

@router.post(
    "/login",
    response_model=TokenRespuesta
)
def iniciar_sesion(datos: UsuarioLogin):
    correo = str(datos.correo).lower()

    usuario = usuarios.find_one({"correo": correo})

    if not usuario:
        raise HTTPException(
            status_code=401,
            detail="Correo o contrasena incorrectos",
        )

    contrasena_hash = usuario.get("contrasena_hash")

    if (
        not contrasena_hash
        or not verificar_contrasena(
            datos.contrasena,
            contrasena_hash,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Correo o contrasena incorrectos",
        )

    if not usuario.get("activo", False):
        raise HTTPException(
            status_code=403,
            detail="Esta cuenta esta desactivada",
        )

    token = crear_token(str(usuario["_id"]))

    return {
        "access_token": token,
        "token_type": "bearer",
    }


# ==========================================
# PERFIL DEL USUARIO AUTENTICADO
# ==========================================

@router.get(
    "/yo",
    response_model=UsuarioRespuesta
)
def obtener_mi_perfil(
    credenciales: HTTPAuthorizationCredentials | None = Depends(seguridad)
):
    # Comprobar que se envio un token
    if credenciales is None:
        raise HTTPException(
            status_code=401,
            detail="Debes iniciar sesion",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validar el token JWT
    usuario_id = verificar_token(credenciales.credentials)

    if not usuario_id or not ObjectId.is_valid(usuario_id):
        raise HTTPException(
            status_code=401,
            detail="Token invalido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Buscar al usuario en MongoDB Atlas
    usuario = usuarios.find_one({
        "_id": ObjectId(usuario_id)
    })

    if not usuario or not usuario.get("activo", False):
        raise HTTPException(
            status_code=401,
            detail="Usuario no encontrado o desactivado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Devolver solamente datos permitidos
    return {
        "id": str(usuario["_id"]),
        "nombre": usuario["nombre"],
        "correo": usuario["correo"],
        "rol": usuario["rol"],
        "colonia": usuario["colonia"],
        "ciudad": usuario["ciudad"],
        "foto_perfil": usuario.get("foto_perfil"),
        "activo": usuario["activo"],
    }
