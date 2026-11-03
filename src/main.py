
from fastapi import FastAPI, HTTPException
from pymongo.errors import PyMongoError

from src.database import db
from src.routes.auth import router as auth_router


app = FastAPI(
    title="PozaSync API",
    description="API para conectar clientes y tecnicos",
    version="1.0.0"
)

# Registrar las rutas de autenticacion
app.include_router(auth_router)


@app.get("/")
def inicio():
    return {
        "mensaje": "Bienvenido a PozaSync",
        "estado": "API funcionando"
    }


@app.get("/usuarios")
def obtener_usuarios():
    try:
        usuarios = list(
            db["usuarios"].find(
                {},
                {"_id": 0, "nombre": 1, "rol": 1, "ciudad": 1}
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
