
import os
import re
import json
import base64

from pathlib import Path
from email.message import EmailMessage
from html import escape

from dotenv import load_dotenv

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


# ==========================================
# CONFIGURACION DE POZASYNC
# ==========================================

BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH)

GMAIL_SCOPE = (
    "https://www.googleapis.com/auth/gmail.send"
)


# ==========================================
# CONFIGURACION DE GMAIL API
# ==========================================

def obtener_configuracion_gmail():

    remitente = os.getenv(
        "GMAIL_FROM", ""
    ).strip()

    token_base64 = os.getenv(
        "GMAIL_TOKEN_BASE64", ""
    ).strip()

    if not remitente:
        raise RuntimeError(
            "Falta la variable GMAIL_FROM."
        )

    if not token_base64:
        raise RuntimeError(
            "Falta la variable GMAIL_TOKEN_BASE64."
        )

    return remitente, token_base64


# ==========================================
# AUTENTICACION CON GOOGLE
# ==========================================

def obtener_credenciales_gmail():

    _, token_base64 = obtener_configuracion_gmail()

    try:
        contenido = base64.b64decode(
            token_base64,
            validate=True,
        ).decode("utf-8")

        datos = json.loads(contenido)

        credenciales = (
            Credentials.from_authorized_user_info(
                datos,
                scopes=[GMAIL_SCOPE],
            )
        )

        if not credenciales.refresh_token:
            raise RuntimeError(
                "La autorización de Gmail "
                "no contiene refresh_token."
            )

        # Renovar el token de acceso mediante HTTPS.
        # El refresh_token se conserva en Render.
        credenciales.refresh(Request())

        return credenciales

    except RuntimeError:
        raise

    except Exception as error:
        raise RuntimeError(
            "No fue posible autenticar Gmail API. "
            "Revisa la autorización OAuth y "
            "las variables de Render."
        ) from error


# ==========================================
# CREAR MENSAJE DE VERIFICACION
# ==========================================

def crear_mensaje_verificacion(
    destinatario: str,
    codigo: str,
    remitente: str,
) -> EmailMessage:

    if not isinstance(destinatario, str):
        raise ValueError(
            "El destinatario debe ser un correo válido."
        )

    destinatario = destinatario.strip()

    if (
        not destinatario
        or "\n" in destinatario
        or "\r" in destinatario
        or "@" not in destinatario
    ):
        raise ValueError(
            "El destinatario no es válido."
        )

    if not isinstance(codigo, str):
        raise ValueError(
            "El código debe contener 6 números."
        )

    if not re.fullmatch(r"[0-9]{6}", codigo):
        raise ValueError(
            "El código de verificación debe "
            "contener exactamente 6 números."
        )

    mensaje = EmailMessage()

    mensaje["Subject"] = (
        "Código de verificación - PozaSync"
    )

    mensaje["From"] = remitente
    mensaje["To"] = destinatario

    # ======================================
    # VERSION DE TEXTO
    # ======================================

    mensaje.set_content(
        "¡Bienvenido a PozaSync!\n\n"
        "Para verificar tu correo electrónico, "
        "introduce el siguiente código:\n\n"
        f"{codigo}\n\n"
        "Este código vence en 10 minutos.\n\n"
        "Si no solicitaste esta cuenta, "
        "puedes ignorar este mensaje.\n\n"
        "Equipo PozaSync"
    )

    # ======================================
    # VERSION HTML
    # ======================================

    codigo_html = escape(codigo)

    mensaje.add_alternative(
        f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >
    <title>Verifica tu correo - PozaSync</title>
</head>

<body style="
    margin:0;
    padding:30px 15px;
    background:#f4f7fc;
    font-family:Arial,Helvetica,sans-serif;
">

    <div style="
        max-width:500px;
        margin:0 auto;
        padding:35px 25px;
        background:#ffffff;
        border-radius:15px;
        text-align:center;
        box-sizing:border-box;
    ">

        <h1 style="
            color:#2451d5;
            margin:0 0 25px;
            font-size:30px;
        ">
            PozaSync
        </h1>

        <h2 style="
            color:#26364d;
            margin:0 0 15px;
            font-size:23px;
        ">
            Verifica tu correo
        </h2>

        <p style="
            color:#64748b;
            font-size:15px;
            line-height:24px;
        ">
            ¡Bienvenido a PozaSync!
            <br>
            Introduce este código en la aplicación
            para activar tu cuenta.
        </p>

        <div style="
            background:#eef4ff;
            color:#2451d5;
            padding:22px 10px;
            margin:25px 0;
            border-radius:12px;
            font-size:36px;
            font-weight:bold;
            letter-spacing:8px;
            text-align:center;
        ">
            {codigo_html}
        </div>

        <p style="
            color:#64748b;
            font-size:14px;
            line-height:22px;
        ">
            Este código es válido durante
            <strong>10 minutos</strong>.
        </p>

        <p style="
            color:#94a3b8;
            font-size:12px;
            line-height:19px;
            margin-top:25px;
        ">
            Si no solicitaste este registro,
            puedes ignorar este mensaje.
        </p>

        <p style="
            color:#2451d5;
            font-size:14px;
            font-weight:bold;
            margin-top:30px;
        ">
            Equipo PozaSync
        </p>

    </div>

</body>
</html>
        """,
        subtype="html",
    )

    return mensaje


# ==========================================
# ENVIAR CODIGO MEDIANTE GMAIL API
# ==========================================

def enviar_codigo_verificacion(
    destinatario: str,
    codigo: str,
) -> None:

    remitente, _ = obtener_configuracion_gmail()

    mensaje = crear_mensaje_verificacion(
        destinatario=destinatario,
        codigo=codigo,
        remitente=remitente,
    )

    credenciales = obtener_credenciales_gmail()

    mensaje_codificado = (
        base64.urlsafe_b64encode(
            mensaje.as_bytes()
        ).decode("utf-8")
    )

    try:
        servicio = build(
            "gmail",
            "v1",
            credentials=credenciales,
            cache_discovery=False,
        )

        resultado = (
            servicio.users()
            .messages()
            .send(
                userId="me",
                body={
                    "raw": mensaje_codificado,
                },
            )
            .execute()
        )

        if not resultado.get("id"):
            raise RuntimeError(
                "Gmail API no confirmó el envío."
            )

    except HttpError as error:
        raise RuntimeError(
            "Gmail API rechazó el envío "
            "del correo de verificación."
        ) from error

    except (OSError, TimeoutError) as error:
        raise RuntimeError(
            "No fue posible conectar "
            "con Gmail API."
        ) from error
