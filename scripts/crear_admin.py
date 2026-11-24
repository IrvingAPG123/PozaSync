from datetime import datetime, timezone
from getpass import getpass

from pymongo.errors import DuplicateKeyError

from src.database import usuarios
from src.services.auth_service import proteger_contrasena


# ==========================================
# CREACION DEL ADMINISTRADOR PRINCIPAL
# ==========================================

def crear_administrador():
    print("=" * 50)
    print("POZASYNC - CREAR ADMINISTRADOR")
    print("=" * 50)

    correo = "eciap.perez.s4712.4@gmail.com"

    existente = usuarios.find_one(
        {"correo": correo},
        {"rol": 1},
    )

    if existente:
        print("El correo ya se encuentra registrado.")
        print("Rol actual:", existente.get("rol"))
        print("No se realizaron modificaciones.")
        return

    print("Correo:", correo)

    contrasena = getpass(
        "Introduce la contraseña administrativa: "
    )

    confirmar = getpass(
        "Confirma la contraseña: "
    )

    if contrasena != confirmar:
        print("Las contraseñas no coinciden.")
        return

    if (
        len(contrasena) < 12
        or not any(c.isupper() for c in contrasena)
        or not any(c.islower() for c in contrasena)
        or not any(c.isdigit() for c in contrasena)
    ):
        print(
            "Utiliza al menos 12 caracteres, "
            "mayúsculas, minúsculas y números."
        )
        return

    nuevo_administrador = {
        "nombre": "Administrador PozaSync",
        "correo": correo,
        "contrasena_hash": proteger_contrasena(
            contrasena
        ),
        "rol": "administrador",
        "colonia": "",
        "ciudad": "Poza Rica",
        "foto_perfil": None,
        "activo": True,
        "correo_verificado": True,
        "fecha_registro": datetime.now(timezone.utc),
    }

    try:
        resultado = usuarios.insert_one(
            nuevo_administrador
        )

    except DuplicateKeyError:
        print("El correo ya está registrado.")
        return

    print()
    print("Administrador creado correctamente.")
    print("ID:", resultado.inserted_id)
    print("Correo:", correo)
    print("Rol: administrador")
    print("Estado: activo")


if __name__ == "__main__":
    crear_administrador()