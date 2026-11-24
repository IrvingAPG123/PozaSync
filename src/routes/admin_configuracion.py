from fastapi import (
    APIRouter,
    Depends,
    Response,
    Request,
    Query,
)

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from src.models.configuracion import (
    ActualizarConfiguracion,
    ConfiguracionRespuesta,
    ActualizarCuentaAdministrativa,
    CambiarContrasenaAdministrativa,
    RevocarSesionesAdministrativas,
)

from src.services.admin_service import (
    obtener_administrador,
)

from src.services.configuracion_service import (
    obtener_configuracion_general,
    actualizar_configuracion_general,
)

from src.services.cuenta_admin_service import (
    obtener_cuenta_administrativa,
    actualizar_cuenta_administrativa,
)

from src.services.seguridad_admin_service import (
    cambiar_contrasena_administrativa,
    revocar_sesiones_administrativas,
)

from src.services.sistema_admin_service import (
    obtener_estado_sistema,
)

from src.services.auditoria_admin_service import (
    obtener_auditoria_administrativa,
)


CABECERAS_SEGURIDAD = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
}


class RutaSeguridadAdministrativa(APIRoute):

    def get_route_handler(self):

        manejador_original = (
            super().get_route_handler()
        )

        async def manejador_seguro(
            request: Request,
        ):

            try:

                respuesta = await manejador_original(
                    request
                )

                for clave, valor in (
                    CABECERAS_SEGURIDAD.items()
                ):

                    respuesta.headers[clave] = valor

                return respuesta

            except RequestValidationError:

                return JSONResponse(
                    status_code=422,
                    content={
                        "detail": (
                            "Los datos de seguridad "
                            "no cumplen los requisitos."
                        ),
                    },
                    headers=CABECERAS_SEGURIDAD,
                )

        return manejador_seguro


router = APIRouter(
    prefix="/admin/configuracion",
    tags=["Configuración administrativa"],
)


router_seguridad = APIRouter(
    route_class=RutaSeguridadAdministrativa,
)


def proteger_respuesta(response: Response):

    for clave, valor in (
        CABECERAS_SEGURIDAD.items()
    ):

        response.headers[clave] = valor


# =====================================================
# CONFIGURACION GENERAL
# =====================================================


@router.get(
    "/general",
    response_model=ConfiguracionRespuesta,
)
def consultar_configuracion(
    response: Response,
    administrador=Depends(
        obtener_administrador
    ),
):

    proteger_respuesta(response)

    return obtener_configuracion_general()


@router.put(
    "/general",
    response_model=ConfiguracionRespuesta,
)
def modificar_configuracion(
    solicitud: ActualizarConfiguracion,
    response: Response,
    administrador=Depends(
        obtener_administrador
    ),
):

    proteger_respuesta(response)

    return actualizar_configuracion_general(
        solicitud=solicitud,
        administrador=administrador,
    )


# =====================================================
# CUENTA ADMINISTRATIVA
# =====================================================


@router.get("/cuenta")
def consultar_cuenta(
    response: Response,
    administrador=Depends(
        obtener_administrador
    ),
):

    proteger_respuesta(response)

    return obtener_cuenta_administrativa(
        administrador=administrador,
    )


@router.patch("/cuenta")
def modificar_cuenta(
    solicitud: ActualizarCuentaAdministrativa,
    response: Response,
    administrador=Depends(
        obtener_administrador
    ),
):

    proteger_respuesta(response)

    return actualizar_cuenta_administrativa(
        solicitud=solicitud,
        administrador=administrador,
    )


# =====================================================
# SEGURIDAD ADMINISTRATIVA
# =====================================================


@router_seguridad.post("/cuenta/contrasena")
def modificar_contrasena(
    solicitud: CambiarContrasenaAdministrativa,
    response: Response,
    administrador=Depends(
        obtener_administrador
    ),
):

    proteger_respuesta(response)

    return cambiar_contrasena_administrativa(
        solicitud=solicitud,
        administrador=administrador,
    )


@router_seguridad.post(
    "/seguridad/revocar-sesiones"
)
def cerrar_sesiones(
    solicitud: RevocarSesionesAdministrativas,
    response: Response,
    administrador=Depends(
        obtener_administrador
    ),
):

    proteger_respuesta(response)

    return revocar_sesiones_administrativas(
        solicitud=solicitud,
        administrador=administrador,
    )


# =====================================================
# ESTADO DEL SISTEMA
# =====================================================


@router.get("/sistema")
def consultar_sistema(
    request: Request,
    response: Response,
    administrador=Depends(
        obtener_administrador
    ),
):

    proteger_respuesta(response)

    return obtener_estado_sistema(
        version_api=request.app.version,
    )


# =====================================================
# AUDITORIA ADMINISTRATIVA
# =====================================================


@router.get("/auditoria")
def consultar_auditoria(
    response: Response,
    pagina: int = Query(1, ge=1, le=10000),
    limite: int = Query(20, ge=1, le=100),
    origen: str = Query(
        "todos",
        max_length=50,
    ),
    accion: str | None = Query(
        None,
        max_length=100,
    ),
    administrador=Depends(
        obtener_administrador
    ),
):

    proteger_respuesta(response)

    return obtener_auditoria_administrativa(
        pagina=pagina,
        limite=limite,
        origen=origen,
        accion=accion,
    )


router.include_router(router_seguridad)