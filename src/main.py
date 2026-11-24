from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo.errors import PyMongoError

from src.database import db
from src.services.seguridad_http import instalar_seguridad_http

from src.routes.auth import router as auth_router
from src.routes.tecnicos import router as tecnicos_router
from src.routes.solicitudes import router as solicitudes_router
from src.routes.conversaciones import router as conversaciones_router
from src.routes.servicios import router as servicios_router
from src.routes.resenas import router as resenas_router
from src.routes.admin import router as admin_router
from src.routes.admin_solicitudes import router as admin_solicitudes_router


# ==========================================
# CONFIGURACION PRINCIPAL DE POZASYNC
# ==========================================

app = FastAPI(
    title="PozaSync API",
    description=(
        "API para conectar clientes y tecnicos, "
        "publicar solicitudes, gestionar conversaciones, "
        "registrar servicios, publicar calificaciones "
        "y administrar la plataforma."
    ),
    version="1.4.0",
)


# ==========================================
# CONFIGURACION DE CORS
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:8082",
        "http://127.0.0.1:8082",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
    ],
)


# ==========================================
# REGISTRAR RUTAS
# ==========================================

app.include_router(auth_router)
app.include_router(tecnicos_router)
app.include_router(solicitudes_router)
app.include_router(conversaciones_router)
app.include_router(servicios_router)
app.include_router(resenas_router)
app.include_router(admin_router)
app.include_router(admin_solicitudes_router)


# ==========================================
# RUTA PRINCIPAL
# ==========================================

@app.get("/")
def inicio():
    return {
        "mensaje": "Bienvenido a PozaSync",
        "estado": "API funcionando",
    }


# ==========================================
# CONSULTAR USUARIOS
# ==========================================

@app.get("/usuarios")
def obtener_usuarios():
    try:
        usuarios = list(
            db["usuarios"].find(
                {
                    "rol": {
                        "$in": ["cliente", "tecnico"]
                    },
                    "activo": True,
                },
                {
                    "_id": 0,
                    "nombre": 1,
                    "rol": 1,
                    "ciudad": 1,
                },
            )
        )

        return {
            "total": len(usuarios),
            "usuarios": usuarios,
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron consultar los usuarios",
        )


# ==========================================
# CONSULTAR TECNICOS ACTIVOS
# ==========================================

@app.get("/tecnicos")
def obtener_tecnicos():
    try:
        tecnicos = list(
            db["perfiles_tecnicos"].aggregate([
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
                        "usuario.activo": True,
                        "usuario.rol": "tecnico",
                    }
                },
                {
                    "$project": {
                        "_id": 0,
                        "especialidades": 1,
                        "especialidad": 1,
                        "disponible": 1,
                        "descripcion": 1,
                        "experiencia_anios": 1,
                        "colonias_cobertura": 1,
                    }
                },
            ])
        )

        return {
            "total": len(tecnicos),
            "tecnicos": tecnicos,
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron consultar los tecnicos",
        )

from src.routes.admin_servicios import router as admin_servicios_router

app.include_router(admin_servicios_router)


from src.routes.admin_resenas import router as admin_resenas_router
app.include_router(admin_resenas_router)


from src.routes.admin_estadisticas import router as admin_estadisticas_router

app.include_router(admin_estadisticas_router)

from src.routes.admin_reportes import router as admin_reportes_router
app.include_router(admin_reportes_router)

from src.routes.admin_configuracion import router as admin_configuracion_router

app.include_router(admin_configuracion_router)

# PROTECCION GENERAL HTTP
instalar_seguridad_http(app)
