
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo.errors import PyMongoError

from src.database import db
from src.routes.auth import router as auth_router
from src.routes.tecnicos import router as tecnicos_router


# ==========================================
# CONFIGURACION PRINCIPAL DE POZASYNC
# ==========================================

app = FastAPI(
    title="PozaSync API",
    description="API para conectar clientes y tecnicos",
    version="1.0.0"
)


# ==========================================
# CONFIGURACION DE CORS
# ==========================================

# Permite que el frontend de Expo se comunique
# con FastAPI desde el navegador.
#
# Estos origenes son exclusivamente para
# desarrollo local.

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:8082",
        "http://127.0.0.1:8082",
    ],
    allow_credentials=False,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
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

# Registro, inicio de sesion y usuario actual
app.include_router(auth_router)

# Perfiles profesionales de tecnicos
app.include_router(tecnicos_router)


# ==========================================
# RUTA PRINCIPAL
# ==========================================

@app.get("/")
def inicio():
    return {
        "mensaje": "Bienvenido a PozaSync",
        "estado": "API funcionando"
    }


# ==========================================
# CONSULTAR USUARIOS
# ==========================================

@app.get("/usuarios")
def obtener_usuarios():
    try:
        usuarios = list(
            db["usuarios"].find(
                {},
                {
                    "_id": 0,
                    "nombre": 1,
                    "rol": 1,
                    "ciudad": 1
                }
            )
        )

        return {
            "total": len(usuarios),
            "usuarios": usuarios
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron consultar los usuarios"
        )


# ==========================================
# CONSULTAR TECNICOS
# ==========================================

@app.get("/tecnicos")
def obtener_tecnicos():
    try:
        tecnicos = list(
            db["perfiles_tecnicos"].find(
                {},
                {
                    "_id": 0,
                    "nombre": 1,
                    "especialidad": 1,
                    "ciudad": 1,
                    "disponible": 1
                }
            )
        )

        return {
            "total": len(tecnicos),
            "tecnicos": tecnicos
        }

    except PyMongoError:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron consultar los tecnicos"
        )
