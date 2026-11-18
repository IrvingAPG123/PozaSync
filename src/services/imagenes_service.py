
import os
from io import BytesIO

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from fastapi import HTTPException, UploadFile

load_dotenv(dotenv_path=".env")

MAX_IMAGENES = 5
MAX_BYTES = 5 * 1024 * 1024

TIPOS_PERMITIDOS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def configurar_cloudinary():
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")

    if not all((cloud_name, api_key, api_secret)):
        raise HTTPException(
            status_code=503,
            detail="Cloudinary no está configurado.",
        )

    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )


def validar_tipo_imagen(contenido: bytes, tipo: str):
    es_jpeg = contenido.startswith(b"\xff\xd8\xff")
    es_png = contenido.startswith(b"\x89PNG\r\n\x1a\n")
    es_webp = (
        len(contenido) >= 12
        and contenido[:4] == b"RIFF"
        and contenido[8:12] == b"WEBP"
    )

    firmas = {
        "image/jpeg": es_jpeg,
        "image/png": es_png,
        "image/webp": es_webp,
    }

    if not firmas.get(tipo, False):
        raise HTTPException(
            status_code=422,
            detail="El archivo no corresponde al formato indicado.",
        )


async def subir_imagen(
    archivo: UploadFile,
    solicitud_id: str,
    tipo_destino: str = "solicitudes",
):
    """
    Sube una imagen a Cloudinary.

    Por defecto conserva el comportamiento original:
        pozasync/solicitudes/{solicitud_id}

    Para fotografías del chat:
        pozasync/conversaciones/{conversacion_id}
    """

    if tipo_destino not in ("solicitudes", "conversaciones"):
        raise HTTPException(
            status_code=422,
            detail="Destino de imagen no permitido.",
        )

    if archivo.content_type not in TIPOS_PERMITIDOS:
        raise HTTPException(
            status_code=422,
            detail="Solo se permiten imágenes JPG, PNG o WebP.",
        )

    try:
        contenido = await archivo.read(MAX_BYTES + 1)

        if not contenido:
            raise HTTPException(
                status_code=422,
                detail="La imagen está vacía.",
            )

        if len(contenido) > MAX_BYTES:
            raise HTTPException(
                status_code=413,
                detail="Cada fotografía debe pesar máximo 5 MB.",
            )

        validar_tipo_imagen(
            contenido,
            archivo.content_type,
        )

        configurar_cloudinary()

        try:
            resultado = cloudinary.uploader.upload(
                BytesIO(contenido),
                folder=f"pozasync/{tipo_destino}/{solicitud_id}",
                resource_type="image",
                overwrite=False,
            )
        except Exception:
            raise HTTPException(
                status_code=502,
                detail="No se pudo subir la imagen a Cloudinary.",
            )

        return {
            "public_id": resultado["public_id"],
            "url": resultado["secure_url"],
        }

    finally:
        await archivo.close()


def eliminar_imagen_cloudinary(public_id: str):
    configurar_cloudinary()

    try:
        resultado = cloudinary.uploader.destroy(
            public_id,
            resource_type="image",
        )

        return resultado.get("result") in (
            "ok",
            "not found",
        )

    except Exception:
        return False
