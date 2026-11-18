
import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError

# Ruta principal del proyecto
BASE_DIR = Path(__file__).resolve().parent.parent

# Cargar las variables del archivo .env
load_dotenv(BASE_DIR / ".env")

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB_NAME", "pozasync_db")

if not MONGODB_URI:
    raise ValueError(
        "No se encontro MONGODB_URI en el archivo .env"
    )

# Crear cliente MongoDB
client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000
)

# Seleccionar la base de datos
db = client[DB_NAME]

# Colecciones de PozaSync
usuarios = db["usuarios"]
perfiles_tecnicos = db["perfiles_tecnicos"]
solicitudes = db["solicitudes"]
cotizaciones = db["cotizaciones"]
servicios = db["servicios"]
conversaciones = db["conversaciones"]
mensajes = db["mensajes"]
resenas = db["resenas"]


def probar_conexion():
    try:
        # Verificar conexion al servidor
        client.admin.command("ping")

        print("Conexion exitosa con MongoDB Atlas")
        print("Base de datos:", DB_NAME)

        # Mostrar las colecciones
        colecciones = db.list_collection_names()

        print("\nColecciones disponibles:")

        for coleccion in colecciones:
            print("-", coleccion)

        # Contar usuarios registrados
        total_usuarios = usuarios.count_documents({})

        print("\nUsuarios registrados:", total_usuarios)

        return True

    except PyMongoError as error:
        print("Error al conectar con MongoDB Atlas")
        print("Tipo de error:", type(error).__name__)
        return False


if __name__ == "__main__":
    probar_conexion()
