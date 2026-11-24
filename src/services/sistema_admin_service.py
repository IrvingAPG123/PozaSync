from datetime import datetime, timezone
from time import perf_counter

from pymongo.errors import PyMongoError

from src.database import db


INICIO_SERVICIO = datetime.now(timezone.utc)

COLECCIONES_OPERATIVAS = (
    "usuarios",
    "perfiles_tecnicos",
    "solicitudes",
    "servicios",
    "cotizaciones",
    "conversaciones",
    "mensajes",
    "resenas",
)


def obtener_estado_sistema(version_api: str):

    inicio = perf_counter()

    ahora = datetime.now(timezone.utc)

    base_disponible = False
    latencia = None
    registros = {}
    conteos_disponibles = False

    try:

        db.command("ping")

        latencia = round(
            (perf_counter() - inicio) * 1000,
            2,
        )

        base_disponible = True

        for nombre in COLECCIONES_OPERATIVAS:

            registros[nombre] = (
                db[nombre].estimated_document_count()
            )

        conteos_disponibles = True

    except PyMongoError:

        registros = {}

    segundos_activo = int(
        (ahora - INICIO_SERVICIO).total_seconds()
    )

    return {
        "estado_general": (
            "operativo"
            if base_disponible and conteos_disponibles
            else "degradado"
        ),
        "plataforma": "PozaSync",
        "fecha_consulta": ahora,
        "api": {
            "estado": "operativa",
            "version": version_api,
            "tecnologia": "FastAPI",
            "inicio": INICIO_SERVICIO,
            "segundos_activo": segundos_activo,
        },
        "base_datos": {
            "estado": (
                "conectada"
                if base_disponible
                else "no_disponible"
            ),
            "tecnologia": "MongoDB Atlas",
            "latencia_ms": latencia,
        },
        "almacenamiento": {
            "disponible": conteos_disponibles,
            "colecciones_monitoreadas": len(
                COLECCIONES_OPERATIVAS
            ),
            "total_registros": (
                sum(registros.values())
                if conteos_disponibles
                else None
            ),
            "registros": registros,
            "conteos_estimados": True,
        },
    }