
import os
import re
import smtplib
import ssl

from pathlib import Path
from email.message import EmailMessage
from html import escape

from dotenv import load_dotenv


# ==========================================
# CONFIGURACION DE POZASYNC
# ==========================================

BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH)


# ==========================================
# VALIDAR CONFIGURACION SMTP
# ==========================================

def obtener_configuracion_smtp():
    smtp_host = os.getenv(
        "SMTP_HOST", ""
    ).strip()

    puerto_texto = os.getenv(
        "SMTP_PORT", "465"
    ).strip()

    smtp_user = os.getenv(
        "SMTP_USER", ""
    ).strip()

    smtp_password = os.getenv(
        "SMTP_PASSWORD", ""
    ).replace(" ", "").strip()

    smtp_from = os.getenv(
        "SMTP_FROM", smtp_user
    ).strip()

    faltantes = []

    if not smtp_host:
        faltantes.append("SMTP_HOST")

    if not smtp_user:
        faltantes.append("SMTP_USER")

    if not smtp_password:
        faltantes.append("SMTP_PASSWORD")

    if not smtp_from:
        faltantes.append("SMTP_FROM")

    if faltantes:
        raise RuntimeError(
            "Faltan variables SMTP en .env: "
            + ", ".join(faltantes)
        )

    try:
        smtp_port = int(puerto_texto)
    except ValueError as error:
        raise RuntimeError(
            "SMTP_PORT debe ser un número válido."
        ) from error

    if smtp_port not in (465, 587):
        raise RuntimeError(
            "Puerto SMTP no compatible. "
            "Utiliza 465 o 587."
        )

    return (
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_password,
        smtp_from,
    )


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
# ENVIAR CODIGO POR GMAIL SMTP
# ==========================================

def enviar_codigo_verificacion(
    destinatario: str,
    codigo: str,
) -> None:

    (
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_password,
        smtp_from,
    ) = obtener_configuracion_smtp()

    mensaje = crear_mensaje_verificacion(
        destinatario=destinatario,
        codigo=codigo,
        remitente=smtp_from,
    )

    contexto = ssl.create_default_context()

    try:

        # ==================================
        # CONEXION SEGURA SSL - PUERTO 465
        # ==================================

        if smtp_port == 465:

            with smtplib.SMTP_SSL(
                host=smtp_host,
                port=smtp_port,
                context=contexto,
                timeout=20,
            ) as servidor:

                servidor.login(
                    smtp_user,
                    smtp_password,
                )

                servidor.send_message(mensaje)

        # ==================================
        # CONEXION STARTTLS - PUERTO 587
        # ==================================

        elif smtp_port == 587:

            with smtplib.SMTP(
                host=smtp_host,
                port=smtp_port,
                timeout=20,
            ) as servidor:

                servidor.ehlo()

                servidor.starttls(
                    context=contexto
                )

                servidor.ehlo()

                servidor.login(
                    smtp_user,
                    smtp_password,
                )

                servidor.send_message(mensaje)

    except smtplib.SMTPAuthenticationError as error:

        raise RuntimeError(
            "Gmail rechazó el acceso. "
            "Revisa la contraseña de aplicación."
        ) from error

    except smtplib.SMTPRecipientsRefused as error:

        raise RuntimeError(
            "Gmail rechazó la dirección "
            "del destinatario."
        ) from error

    except smtplib.SMTPException as error:

        raise RuntimeError(
            "No fue posible enviar el correo "
            "mediante Gmail SMTP."
        ) from error

    except (OSError, TimeoutError) as error:

        raise RuntimeError(
            "No fue posible conectar con "
            "el servidor de correo."
        ) from error
