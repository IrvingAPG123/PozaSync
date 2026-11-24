from datetime import datetime, timezone

from fastapi import HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError

from src.database import db

from src.models.configuracion import (
    ConfiguracionGeneral,
    ConfiguracionRespuesta,
    ActualizarConfiguracion,
)


coleccion_configuracion = db["configuracion_general"]

ID_CONFIGURACION = "general"

CAMPOS_CONFIGURACION = tuple(
    ConfiguracionGeneral.model_fields.keys()
)


def configuracion_inicial():

    return ConfiguracionRespuesta()


def serializar_configuracion(documento):

    datos = {
        campo: documento[campo]
        for campo in CAMPOS_CONFIGURACION
        if campo in documento
    }

    return ConfiguracionRespuesta(
        **datos,
        version=documento.get("version", 0),
        fecha_creacion=documento.get("fecha_creacion"),
        fecha_actualizacion=documento.get(
            "fecha_actualizacion"
        ),
    )


def obtener_configuracion_general():

    try:

        documento = coleccion_configuracion.find_one(
            {"_id": ID_CONFIGURACION}
        )

        if documento is None:

            return configuracion_inicial()

        return serializar_configuracion(documento)

    except PyMongoError as error:

        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible consultar "
                "la configuración general."
            ),
        ) from error


def actualizar_configuracion_general(
    solicitud: ActualizarConfiguracion,
    administrador,
):

    campos_recibidos = solicitud.model_fields_set

    faltantes = (
        set(CAMPOS_CONFIGURACION)
        - campos_recibidos
    )

    if faltantes:

        raise HTTPException(
            status_code=422,
            detail=(
                "Debes enviar todos los campos "
                "de la configuración general."
            ),
        )

    nuevos_datos = solicitud.model_dump(
        mode="json",
        include=set(CAMPOS_CONFIGURACION),
    )

    ahora = datetime.now(timezone.utc)

    try:

        documento = coleccion_configuracion.find_one(
            {"_id": ID_CONFIGURACION}
        )

        if documento is None:

            anterior = configuracion_inicial()

        else:

            anterior = serializar_configuracion(
                documento
            )

        if solicitud.version != anterior.version:

            raise HTTPException(
                status_code=409,
                detail=(
                    "La configuración fue modificada. "
                    "Actualiza los datos e intenta nuevamente."
                ),
            )

        datos_anteriores = anterior.model_dump(
            mode="json",
            include=set(CAMPOS_CONFIGURACION),
        )

        cambios = {
            campo: {
                "anterior": datos_anteriores[campo],
                "nuevo": nuevos_datos[campo],
            }
            for campo in CAMPOS_CONFIGURACION
            if datos_anteriores[campo]
            != nuevos_datos[campo]
        }

        if not cambios:

            return anterior

        evento = {
            "accion": "actualizacion_configuracion",
            "administrador_id": str(
                administrador["_id"]
            ),
            "motivo": solicitud.motivo,
            "fecha": ahora,
            "version_anterior": anterior.version,
            "version_nueva": anterior.version + 1,
            "cambios": cambios,
        }

        if documento is None:

            nuevo_documento = {
                "_id": ID_CONFIGURACION,
                **nuevos_datos,
                "version": 1,
                "fecha_creacion": ahora,
                "fecha_actualizacion": ahora,
                "historial_administrativo": [
                    evento
                ],
            }

            coleccion_configuracion.insert_one(
                nuevo_documento
            )

            return serializar_configuracion(
                nuevo_documento
            )

        actualizado = (
            coleccion_configuracion.find_one_and_update(
                {
                    "_id": ID_CONFIGURACION,
                    "version": solicitud.version,
                },
                {
                    "$set": {
                        **nuevos_datos,
                        "fecha_actualizacion": ahora,
                    },
                    "$inc": {
                        "version": 1,
                    },
                    "$push": {
                        "historial_administrativo": evento,
                    },
                },
                return_document=ReturnDocument.AFTER,
            )
        )

        if actualizado is None:

            raise HTTPException(
                status_code=409,
                detail=(
                    "Otro administrador modificó "
                    "la configuración. "
                    "Actualiza los datos."
                ),
            )

        return serializar_configuracion(
            actualizado
        )

    except DuplicateKeyError as error:

        raise HTTPException(
            status_code=409,
            detail=(
                "La configuración ya fue creada. "
                "Actualiza los datos."
            ),
        ) from error

    except PyMongoError as error:

        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible confirmar "
                "la actualización de la configuración. "
                "Consulta su estado antes de reintentar."
            ),
        ) from error