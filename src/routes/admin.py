import re
from datetime import datetime, timezone
from typing import Literal

from bson import ObjectId
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)

from pymongo.errors import PyMongoError

from src.database import (
    usuarios,
    perfiles_tecnicos,
    solicitudes,
    servicios,
    conversaciones,
    mensajes,
    resenas,
    cotizaciones,
)

from src.models.usuario import (
    UsuarioLogin,
    TokenRespuesta,
)

from src.services.auth_service import (
    crear_token_admin,
    verificar_contrasena,
)

from src.services.admin_service import (
    obtener_administrador,
)


# ==========================================
# RUTAS ADMINISTRATIVAS
# ==========================================

router = APIRouter(
    prefix="/admin",
    tags=["Administracion"],
)


# ==========================================
# INICIO DE SESION ADMINISTRATIVO
# ==========================================

@router.post(
    "/login",
    response_model=TokenRespuesta,
)
def iniciar_sesion_admin(datos: UsuarioLogin):

    correo = str(datos.correo).strip().lower()

    administrador = usuarios.find_one({
        "correo": correo,
        "rol": "administrador",
    })

    if not administrador:
        raise HTTPException(
            status_code=401,
            detail="Correo o contraseña incorrectos.",
        )

    contrasena_hash = administrador.get(
        "contrasena_hash"
    )

    if (
        not contrasena_hash
        or not verificar_contrasena(
            datos.contrasena,
            contrasena_hash,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Correo o contraseña incorrectos.",
        )

    if administrador.get("activo") is not True:
        raise HTTPException(
            status_code=403,
            detail="La cuenta está desactivada.",
        )

    if administrador.get("correo_verificado") is not True:
        raise HTTPException(
            status_code=403,
            detail="El correo no está verificado.",
        )

    version_token_admin = administrador.get(
        "version_token_admin", 0
    )

    if (
        not isinstance(version_token_admin, int)
        or isinstance(version_token_admin, bool)
        or version_token_admin < 0
    ):
        raise HTTPException(
            status_code=503,
            detail="No fue posible iniciar la sesión administrativa.",
        )

    token = crear_token_admin(
        str(administrador["_id"]),
        version_token_admin=version_token_admin,
    )

    return {
        "access_token": token,
        "token_type": "bearer",
    }


# ==========================================
# PERFIL DEL ADMINISTRADOR
# ==========================================

@router.get("/yo")
def perfil_administrador(
    administrador=Depends(obtener_administrador),
):
    return {
        "id": str(administrador["_id"]),
        "nombre": administrador["nombre"],
        "correo": administrador["correo"],
        "rol": administrador["rol"],
        "activo": administrador["activo"],
    }


# ==========================================
# ESTADISTICAS GENERALES
# ==========================================

@router.get("/estadisticas")
def obtener_estadisticas(
    administrador=Depends(obtener_administrador),
):
    try:
        filtro_publico = {
            "rol": {
                "$in": ["cliente", "tecnico"]
            }
        }

        total_usuarios = usuarios.count_documents(
            filtro_publico
        )

        total_clientes = usuarios.count_documents({
            "rol": "cliente"
        })

        total_tecnicos = usuarios.count_documents({
            "rol": "tecnico"
        })

        usuarios_activos = usuarios.count_documents({
            **filtro_publico,
            "activo": True,
        })

        usuarios_inactivos = usuarios.count_documents({
            **filtro_publico,
            "activo": {"$ne": True},
        })

        estadisticas_tecnicos = list(
            perfiles_tecnicos.aggregate([
                *pipeline_tecnicos(),
                {
                    "$group": {
                        "_id": None,
                        "perfiles": {"$sum": 1},
                        "disponibles": {
                            "$sum": {
                                "$cond": [
                                    {
                                        "$and": [
                                            {
                                                "$eq": [
                                                    "$usuario.activo",
                                                    True,
                                                ]
                                            },
                                            {
                                                "$ne": [
                                                    {
                                                        "$ifNull": [
                                                            "$disponible",
                                                            True,
                                                        ]
                                                    },
                                                    False,
                                                ]
                                            },
                                        ]
                                    },
                                    1,
                                    0,
                                ]
                            }
                        },
                    }
                },
            ])
        )

        resumen_tecnicos = (
            estadisticas_tecnicos[0]
            if estadisticas_tecnicos
            else {
                "perfiles": 0,
                "disponibles": 0,
            }
        )

        return {
            "usuarios": {
                "total": total_usuarios,
                "clientes": total_clientes,
                "tecnicos": total_tecnicos,
                "activos": usuarios_activos,
                "inactivos": usuarios_inactivos,
            },

            "tecnicos": {
                "perfiles": resumen_tecnicos["perfiles"],
                "disponibles": resumen_tecnicos["disponibles"],
            },

            "actividad": {
                "solicitudes": (
                    solicitudes.count_documents({})
                ),
                "servicios": (
                    servicios.count_documents({"archivado_administrativamente": {"$ne": True}})
                ),
                "cotizaciones": (
                    cotizaciones.count_documents({})
                ),
                "conversaciones": (
                    conversaciones.count_documents({})
                ),
                "mensajes": (
                    mensajes.count_documents({})
                ),
                "resenas": (
                    resenas.count_documents({
                        "archivada_administrativamente": {"$ne": True},
                    })
                ),
            },
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No fue posible consultar las estadísticas.",
        )


# ==========================================
# CONSULTAR USUARIOS
# ==========================================


PROYECCION_USUARIO = {
    "nombre": 1,
    "correo": 1,
    "rol": 1,
    "ciudad": 1,
    "colonia": 1,
    "activo": 1,
    "correo_verificado": 1,
    "fecha_registro": 1,
    "fecha_cambio_estado": 1,
}

ROLES_PUBLICOS = ["cliente", "tecnico"]


class CambioEstadoUsuario(BaseModel):
    activo: bool
    motivo: str = Field(
        min_length=5,
        max_length=300,
    )


def serializar_usuario(usuario):
    usuario["id"] = str(usuario.pop("_id"))
    usuario["activo"] = usuario.get("activo") is True
    return usuario


@router.get("/usuarios")
def obtener_usuarios_admin(
    pagina: int = Query(default=1, ge=1),
    limite: int = Query(default=20, ge=1, le=100),
    busqueda: str = Query(default="", max_length=100),
    rol: Literal["todos", "cliente", "tecnico"] = "todos",
    estado: Literal["todos", "activo", "suspendido"] = "todos",
    administrador=Depends(obtener_administrador),
):
    try:
        filtro_publico = {
            "rol": {"$in": ROLES_PUBLICOS}
        }

        filtro = dict(filtro_publico)

        if rol != "todos":
            filtro["rol"] = rol

        if estado == "activo":
            filtro["activo"] = True

        elif estado == "suspendido":
            filtro["activo"] = {"$ne": True}

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
                    "nombre",
                    "correo",
                    "ciudad",
                    "colonia",
                ]
            ]

        registros = usuarios.find(
            filtro,
            PROYECCION_USUARIO,
        ).sort(
            "_id", -1
        ).skip(
            (pagina - 1) * limite
        ).limit(limite)

        return {
            "total": usuarios.count_documents(filtro),
            "pagina": pagina,
            "limite": limite,
            "usuarios": [
                serializar_usuario(usuario)
                for usuario in registros
            ],
            "resumen": {
                "registrados": usuarios.count_documents(
                    filtro_publico
                ),
                "activos": usuarios.count_documents({
                    **filtro_publico,
                    "activo": True,
                }),
                "suspendidos": usuarios.count_documents({
                    **filtro_publico,
                    "activo": {"$ne": True},
                }),
            },
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No fue posible consultar los usuarios.",
        )


@router.get("/usuarios/{usuario_id}")
def obtener_usuario_admin(
    usuario_id: str,
    administrador=Depends(obtener_administrador),
):
    if not ObjectId.is_valid(usuario_id):
        raise HTTPException(
            status_code=400,
            detail="Identificador invalido.",
        )

    try:
        usuario = usuarios.find_one(
            {
                "_id": ObjectId(usuario_id),
                "rol": {"$in": ROLES_PUBLICOS},
            },
            PROYECCION_USUARIO,
        )

        if not usuario:
            raise HTTPException(
                status_code=404,
                detail="Usuario no encontrado.",
            )

        return serializar_usuario(usuario)

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No fue posible consultar el usuario.",
        )


@router.patch("/usuarios/{usuario_id}/estado")
def cambiar_estado_usuario(
    usuario_id: str,
    datos: CambioEstadoUsuario,
    administrador=Depends(obtener_administrador),
):
    if not ObjectId.is_valid(usuario_id):
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

    if usuario_id == str(administrador["_id"]):
        raise HTTPException(
            status_code=403,
            detail="No puedes modificar tu propia cuenta.",
        )

    filtro = {
        "_id": ObjectId(usuario_id),
        "rol": {"$in": ROLES_PUBLICOS},
    }

    try:
        momento = datetime.now(timezone.utc)

        accion = (
            "reactivacion"
            if datos.activo
            else "suspension"
        )

        filtro_cambio = {
            **filtro,
            "activo": (
                {"$ne": True}
                if datos.activo
                else True
            ),
        }

        registro = {
            "accion": accion,
            "administrador_id": str(
                administrador["_id"]
            ),
            "motivo": motivo,
            "fecha": momento,
        }

        usuario = usuarios.find_one_and_update(
            filtro_cambio,
            {
                "$set": {
                    "activo": datos.activo,
                    "fecha_cambio_estado": momento,
                },
                "$inc": {
                    "version_token": 1,
                },
                "$push": {
                    "historial_administrativo": registro,
                },
            },
            projection=PROYECCION_USUARIO,
            return_document=ReturnDocument.AFTER,
        )

        if usuario is None:
            existente = usuarios.find_one(
                filtro,
                {"_id": 1},
            )

            if existente is None:
                raise HTTPException(
                    status_code=404,
                    detail="Usuario no encontrado.",
                )

            raise HTTPException(
                status_code=409,
                detail="La cuenta ya tiene ese estado.",
            )

        return {
            "mensaje": (
                "Cuenta reactivada correctamente."
                if datos.activo
                else "Cuenta suspendida correctamente."
            ),
            "usuario": serializar_usuario(usuario),
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No fue posible modificar la cuenta.",
        )


# ==========================================
# CONSULTAR PERFILES TECNICOS
# ==========================================


# ==========================================
# INFORMACION ADMINISTRATIVA DE TECNICOS
# ==========================================

def pipeline_tecnicos():
    return [
        {
            "$lookup": {
                "from": "usuarios",
                "localField": "usuario_id",
                "foreignField": "_id",
                "as": "usuario",
            }
        },
        {
            "$unwind": "$usuario",
        },
        {
            "$match": {
                "usuario.rol": "tecnico",
            }
        },
    ]


def serializar_tecnico(perfil):
    usuario = perfil["usuario"]
    usuario_id = usuario["_id"]

    return {
        "id": str(perfil["_id"]),
        "usuario_id": str(usuario_id),
        "nombre": usuario.get("nombre", "Tecnico"),
        "correo": usuario.get("correo", ""),
        "ciudad": usuario.get("ciudad", ""),
        "colonia": usuario.get("colonia", ""),
        "foto_perfil": usuario.get("foto_perfil"),
        "activo": usuario.get("activo") is True,
        "correo_verificado": usuario.get(
            "correo_verificado", False
        ),
        "especialidades": perfil.get(
            "especialidades",
            [perfil["especialidad"]]
            if perfil.get("especialidad")
            else [],
        ),
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
        "fecha_registro": usuario.get("fecha_registro"),
        "fecha_creacion": perfil.get("fecha_creacion"),
    }


# ==========================================
# LISTADO ADMINISTRATIVO DE TECNICOS
# ==========================================

@router.get("/tecnicos")
def obtener_tecnicos_admin(
    pagina: int = Query(default=1, ge=1),
    limite: int = Query(default=20, ge=1, le=100),
    busqueda: str = Query(default="", max_length=100),
    estado: Literal[
        "todos", "activo", "suspendido"
    ] = "todos",
    disponibilidad: Literal[
        "todos", "disponible", "no_disponible"
    ] = "todos",
    administrador=Depends(obtener_administrador),
):
    try:
        pipeline = pipeline_tecnicos()

        filtro = {}

        if estado == "activo":
            filtro["usuario.activo"] = True

        elif estado == "suspendido":
            filtro["usuario.activo"] = {"$ne": True}

        if disponibilidad == "disponible":
            filtro["disponible"] = {"$ne": False}
            filtro["usuario.activo"] = True

            if estado == "suspendido":
                filtro["usuario.activo"] = {
                    "$in": []
                }

        elif disponibilidad == "no_disponible":
            filtro["$and"] = [
                {
                    "$or": [
                        {"disponible": False},
                        {"usuario.activo": {"$ne": True}},
                    ]
                }
            ]

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
                    "usuario.nombre",
                    "usuario.correo",
                    "usuario.ciudad",
                    "especialidades",
                    "especialidad",
                    "colonias_cobertura",
                ]
            ]

        if filtro:
            pipeline.append({"$match": filtro})

        pipeline.append({
            "$facet": {
                "total": [
                    {"$count": "cantidad"}
                ],
                "tecnicos": [
                    {"$sort": {"_id": -1}},
                    {"$skip": (pagina - 1) * limite},
                    {"$limit": limite},
                ],
            }
        })

        resultado = list(
            perfiles_tecnicos.aggregate(pipeline)
        )[0]

        total = (
            resultado["total"][0]["cantidad"]
            if resultado["total"]
            else 0
        )

        resumen_pipeline = pipeline_tecnicos()

        resumen_pipeline.append({
            "$group": {
                "_id": None,
                "registrados": {"$sum": 1},
                "disponibles": {
                    "$sum": {
                        "$cond": [
                            {
                                "$and": [
                                    {
                                        "$eq": [
                                            "$usuario.activo",
                                            True,
                                        ]
                                    },
                                    {
                                        "$ne": [
                                            {
                                                "$ifNull": [
                                                    "$disponible",
                                                    True,
                                                ]
                                            },
                                            False,
                                        ]
                                    },
                                ]
                            },
                            1,
                            0,
                        ]
                    }
                },
                "suspendidos": {
                    "$sum": {
                        "$cond": [
                            {
                                "$eq": [
                                    "$usuario.activo",
                                    True,
                                ]
                            },
                            0,
                            1,
                        ]
                    }
                },
            }
        })

        resumen = list(
            perfiles_tecnicos.aggregate(
                resumen_pipeline
            )
        )

        estadisticas = (
            resumen[0]
            if resumen
            else {
                "registrados": 0,
                "disponibles": 0,
                "suspendidos": 0,
            }
        )

        estadisticas.pop("_id", None)

        return {
            "total": total,
            "pagina": pagina,
            "limite": limite,
            "resumen": estadisticas,
            "tecnicos": [
                serializar_tecnico(perfil)
                for perfil in resultado["tecnicos"]
            ],
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No fue posible consultar los tecnicos.",
        )


# ==========================================
# CONSULTAR PERFIL TECNICO INDIVIDUAL
# ==========================================

@router.get("/tecnicos/{perfil_id}")
def consultar_tecnico_admin(
    perfil_id: str,
    administrador=Depends(obtener_administrador),
):
    if not ObjectId.is_valid(perfil_id):
        raise HTTPException(
            status_code=400,
            detail="Identificador invalido.",
        )

    try:
        pipeline = [
            {
                "$match": {
                    "_id": ObjectId(perfil_id),
                }
            },
            *pipeline_tecnicos(),
        ]

        resultado = list(
            perfiles_tecnicos.aggregate(pipeline)
        )

        if not resultado:
            raise HTTPException(
                status_code=404,
                detail="Perfil tecnico no encontrado.",
            )

        perfil = resultado[0]
        datos = serializar_tecnico(perfil)

        tecnico_id = perfil["usuario"]["_id"]

        datos["servicios"] = {
            "total": servicios.count_documents({
                "tecnico_id": tecnico_id,
            }),
            "pendientes": servicios.count_documents({
                "tecnico_id": tecnico_id,
                "estado": "pendiente",
            }),
            "acordados": servicios.count_documents({
                "tecnico_id": tecnico_id,
                "estado": "acordado",
            }),
            "finalizados": servicios.count_documents({
                "tecnico_id": tecnico_id,
                "estado": "finalizado",
            }),
            "rechazados": servicios.count_documents({
                "tecnico_id": tecnico_id,
                "estado": "rechazado",
            }),
        }

        estadisticas_resenas = list(
            resenas.aggregate([
                {
                    "$match": {
                        "tecnico_id": tecnico_id,
                        "oculta_administrativamente": {"$ne": True},
                        "archivada_administrativamente": {"$ne": True},
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "promedio": {
                            "$avg": "$calificacion",
                        },
                        "total": {"$sum": 1},
                    }
                },
            ])
        )

        datos["calificacion_promedio"] = (
            round(
                estadisticas_resenas[0]["promedio"],
                2,
            )
            if estadisticas_resenas
            else 0.0
        )

        datos["total_resenas"] = (
            estadisticas_resenas[0]["total"]
            if estadisticas_resenas
            else 0
        )

        datos["resenas"] = [
            {
                "id": str(resena["_id"]),
                "calificacion": resena.get(
                    "calificacion", 0
                ),
                "comentario": resena.get(
                    "comentario", ""
                ),
                "fecha_creacion": resena.get(
                    "fecha_creacion"
                ),
            }
            for resena in resenas.find({
                "tecnico_id": tecnico_id,
                "oculta_administrativamente": {"$ne": True},
                "archivada_administrativamente": {"$ne": True},
            }).sort(
                "fecha_creacion", -1
            ).limit(20)
        ]

        return datos

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No fue posible consultar el perfil.",
        )


# ==========================================
# MODIFICAR DISPONIBILIDAD DEL TECNICO
# ==========================================

class CambioDisponibilidadTecnico(BaseModel):
    disponible: bool
    motivo: str = Field(
        min_length=5,
        max_length=300,
    )


@router.patch("/tecnicos/{perfil_id}/disponibilidad")
def cambiar_disponibilidad_tecnico(
    perfil_id: str,
    datos: CambioDisponibilidadTecnico,
    administrador=Depends(obtener_administrador),
):
    if not ObjectId.is_valid(perfil_id):
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

    try:
        perfil = perfiles_tecnicos.find_one({
            "_id": ObjectId(perfil_id),
        })

        if not perfil:
            raise HTTPException(
                status_code=404,
                detail="Perfil tecnico no encontrado.",
            )

        usuario = usuarios.find_one({
            "_id": perfil.get("usuario_id"),
            "rol": "tecnico",
        })

        if not usuario:
            raise HTTPException(
                status_code=404,
                detail="Cuenta de tecnico no encontrada.",
            )

        if datos.disponible and usuario.get("activo") is not True:
            raise HTTPException(
                status_code=409,
                detail="La cuenta del tecnico esta suspendida.",
            )

        momento = datetime.now(timezone.utc)

        resultado = perfiles_tecnicos.update_one(
            {
                "_id": ObjectId(perfil_id),
            },
            {
                "$set": {
                    "disponible": datos.disponible,
                    "fecha_actualizacion": momento,
                },
                "$push": {
                    "historial_administrativo": {
                        "accion": "cambio_disponibilidad",
                        "disponible": datos.disponible,
                        "motivo": motivo,
                        "administrador_id": str(
                            administrador["_id"]
                        ),
                        "fecha": momento,
                    }
                },
            },
        )

        if resultado.matched_count != 1:
            raise HTTPException(
                status_code=404,
                detail="Perfil tecnico no encontrado.",
            )

        return {
            "mensaje": "Disponibilidad actualizada.",
            "perfil_id": perfil_id,
            "disponible": datos.disponible,
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No fue posible cambiar la disponibilidad.",
        )
