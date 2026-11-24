from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import (
    request_validation_exception_handler,
)
from fastapi.responses import JSONResponse


# ==========================================
# IDENTIFICAR RUTAS SENSIBLES
# ==========================================

def es_ruta_sensible(ruta: str) -> bool:

    return (
        ruta == "/admin"
        or ruta.startswith("/admin/")
        or ruta == "/auth"
        or ruta.startswith("/auth/")
    )


# ==========================================
# CABECERAS DE SEGURIDAD
# ==========================================

def aplicar_cabeceras_seguridad(
    respuesta,
    ruta: str,
):

    respuesta.headers[
        "X-Content-Type-Options"
    ] = "nosniff"

    respuesta.headers[
        "X-Frame-Options"
    ] = "DENY"

    respuesta.headers[
        "Referrer-Policy"
    ] = "no-referrer"

    if es_ruta_sensible(ruta):

        respuesta.headers[
            "Cache-Control"
        ] = "no-store"

        respuesta.headers[
            "Pragma"
        ] = "no-cache"

    return respuesta


# ==========================================
# INSTALAR PROTECCION HTTP
# ==========================================

def instalar_seguridad_http(app: FastAPI):

    @app.middleware("http")
    async def proteger_respuestas(
        request: Request,
        call_next,
    ):

        respuesta = await call_next(request)

        return aplicar_cabeceras_seguridad(
            respuesta,
            request.url.path,
        )

    @app.exception_handler(RequestValidationError)
    async def proteger_errores_validacion(
        request: Request,
        excepcion: RequestValidationError,
    ):

        if es_ruta_sensible(request.url.path):

            respuesta = JSONResponse(
                status_code=422,
                content={
                    "detail": (
                        "Los datos proporcionados "
                        "no son validos."
                    ),
                },
            )

            return aplicar_cabeceras_seguridad(
                respuesta,
                request.url.path,
            )

        return await request_validation_exception_handler(
            request,
            excepcion,
        )