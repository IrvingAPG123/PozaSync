
from datetime import datetime

class PozaSync:
    def __init__(self):
        self.nombre = "PozaSync"
        self.integrantes = [
            "Edwin",
            "Yuneli",
            "Alexa"
        ]

    def mostrar_bienvenida(self):
        print("=" * 40)
        print(f"Bienvenido a {self.nombre}")
        print("=" * 40)
        print("Plataforma de colaboración y desarrollo")
        print(f"Fecha: {datetime.now().strftime('%d/%m/%Y')}")
        print("\nIntegrantes del proyecto:")

        for integrante in self.integrantes:
            print(f"- {integrante}")

    def iniciar(self):
        self.mostrar_bienvenida()

        while True:
            print("\n¿Qué deseas hacer?")
            print("1. Mostrar integrantes")
            print("2. Mostrar información del proyecto")
            print("3. Salir")

            opcion = input("\nSelecciona una opción: ")

            if opcion == "1":
                print("\nIntegrantes:")
                for persona in self.integrantes:
                    print(f"- {persona}")

            elif opcion == "2":
                print("\nProyecto: PozaSync")
                print("Estado: En desarrollo")

            elif opcion == "3":
                print("Cerrando PozaSync...")
                break

            else:
                print("Opción no válida.")


if __name__ == "__main__":
    aplicacion = PozaSync()
    aplicacion.iniciar()
