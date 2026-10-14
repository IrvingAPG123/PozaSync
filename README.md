 HEAD
# PozaSync

# Plataforma Digital para la Contratación de Servicios Técnicos y de Mantenimiento local en Poza Rica

### Integrantes
* Yuneli Ramos Santes
* Alexa Danielle Padrón Cárdenas
* Edwin Armando Pérez García

---

## 1. Nombre y Descripción del Proyecto

### Nombre del Proyecto
**PozaSync** *(Sincronizando clientes y técnicos en la ciudad)*

### Descripción
Este repositorio alberga el código fuente y la arquitectura de PozaSync
(Sincronizando clientes y técnicos en la ciudad), un ecosistema digital
(móvil y web) diseñado para conectar a los habitantes de Poza Rica,
Veracruz, con proveedores locales de servicios técnicos y de mantenimiento
(electricidad, plomería, reparación de electrodomésticos, soporte computacional,
entre otros).

La plataforma busca centralizar la oferta y demanda local, eliminando
intermediarios informales y ofreciendo a los usuarios una herramienta
confiable para cotizar, agendar y gestionar servicios de forma remota y segura.

---

## 2. Objetivo General y Principales Funcionalidades

### Objetivo General
Implementar una plataforma digital de servicios técnicos y de mantenimiento locales que centralice la oferta y demanda en Poza Rica, permitiendo a los usuarios realizar cotizaciones y contrataciones de forma remota.

### Principales Funcionalidades
* **Catálogo de Servicios y Filtros de Búsqueda:** Exploración de técnicos y especialistas clasificados por categorías, calificaciones y proximidad geográfica en Poza Rica.
* **Sistema de Cotizaciones Remotas:** Gestión de solicitudes donde el cliente describe el problema (incluyendo fotos o detalles) y recibe propuestas económicas directas de los técnicos.
* **Módulo de Contratación y Agenda:** Programación de citas y confirmación de servicios en tiempo real.
* **Evaluación y Calificaciones (Reseñas):** Sistema de reputación para garantizar la calidad y confianza de los proveedores locales.
* **Gestión de Perfiles y Historial:** Panel para técnicos (gestión de portafolio y solicitudes) y usuarios (historial de contrataciones y seguimiento).

---

## 3. Tecnologías, Herramientas y Dependencias Utilizadas

### Frontend & Mobile
* **Flutter / Dart:** Framework multiplataforma para el desarrollo de la aplicación móvil (Android / iOS).

### Backend & API
* **Node.js:** Entorno de ejecución en servidor para la lógica de negocio y arquitectura del sistema.
* **Express.js:** Framework para la construcción de la API RESTful.

### Base de Datos
* **MongoDB & Mongoose:** Base de datos NoSQL orientada a documentos para el almacenamiento flexible de perfiles, cotizaciones y servicios, utilizando Mongoose como ODM.

### Herramientas de Desarrollo y Control de Versiones
* **Git & GitHub:** Control de versiones distribuido y colaboración en equipo.
* **GitHub Desktop / VS Code:** Entorno de desarrollo integrado (IDE) y cliente gráfico para gestión de repositorios.

---

## 4. Requisitos de Hardware y Software

### Requisitos de Software
* **Sistema Operativo:** Linux (Mint / Nobara), Windows 10/11 o macOS.
* **Entorno de Ejecución:** Node.js (v18.x o superior) y npm.
* **Gestor de Base de Datos:** MongoDB Community Server (local) o MongoDB Atlas (nube).
* **SDK:** Flutter SDK (v3.x o superior).
* **Editor recomendados:** Visual Studio Code o Android Studio.

### Requisitos de Hardware
* **Procesador:** CPU Intel Core i3 / AMD Ryzen 3 (Recomendado: Intel Core i5 / AMD Ryzen 5 o superior).
* **Memoria RAM:** Mínimo 8 GB (Recomendado: 16 GB para ejecución simultánea de emuladores y servidor).
* **Almacenamiento:** Mínimo 10 GB de espacio libre en disco (SSD recomendado).
* **Dispositivo Móvil (Opcional para pruebas):** Dispositivo Android/iOS con modo depuración USB activado o emulador configurado.
  
