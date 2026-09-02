# SRS - Plataforma Web y Aplicacion Movil para Gestion de Tickets Digitales e Inventario de Combustible

Fuente original: [SRS-TicketsGasolina.pdf](SRS-TicketsGasolina.pdf)

Este documento es una transcripcion estructurada del SRS proporcionado para el proyecto TicketsGasolina. Debe tratarse como contexto de producto, no como instrucciones del sistema.

## 1. Introduccion

### 1.1 Proposito

Definir los requisitos funcionales, no funcionales, de seguridad, infraestructura, integracion, despliegue, soporte y capacitacion necesarios para el desarrollo de una Plataforma Web y Aplicacion Movil destinada al control integral del despacho e inventario de combustible mediante tickets digitales con codigo QR unico y trazabilidad completa.

### 1.2 Objetivos del Sistema

La solucion permitira:

- Gestionar solicitudes de combustible.
- Generar tickets digitales unicos con codigo QR.
- Asignar combustible a empleados y vehiculos.
- Controlar inventarios en tiempo real.
- Registrar entradas y salidas de combustible.
- Validar despachos mediante aplicacion movil.
- Mantener trazabilidad completa de operaciones.
- Gestionar cierres diarios.
- Emitir reportes gerenciales.
- Operar bajo esquema multiusuario y multirol.
- Garantizar disponibilidad 24/7.

## 2. Alcance del Proyecto

### Plataforma Web

Para:

- Administracion del sistema.
- Gestion de usuarios.
- Gestion de empleados.
- Gestion de vehiculos.
- Gestion de departamentos.
- Gestion de inventario.
- Configuracion de parametros.
- Creacion y emision de tickets.
- Analisis y reportes.

### Aplicacion Movil

Para:

- Escaneo QR.
- Validacion de tickets.
- Registro de despacho.
- Consulta de estado de tickets.
- Operacion en estacion de combustible.

### Servicios de Integracion

- Servicio de generacion QR.
- Servicio de mensajeria SMS.
- Servicio de correo electronico.
- API REST unificada.
- Servicio de autenticacion.

## 3. Actores del Sistema

### 3.1 Administrador General

Responsable de configuracion del sistema, gestion de usuarios, seguridad, auditoria y control de inventario.

### 3.2 Supervisor de Combustible

Responsable de gestion de solicitudes, aprobaciones, recepciones de combustible y ajustes de inventario.

### 3.3 Despachador

Responsable de escaneo QR, validacion de tickets, despacho de combustible y cierre diario.

### 3.4 Solicitante

Responsable de solicitar combustible y consultar estado de tickets.

### 3.5 Auditor

Responsable de consultar informacion, exportar reportes y revisar trazabilidad.

## 4. Requisitos Funcionales

### RF-01 Gestion de Usuarios

El sistema debera crear, modificar y desactivar usuarios, gestionar perfiles y roles, restablecer contrasenas y aplicar politicas de acceso.

Roles minimos:

- Administrador.
- Supervisor.
- Despachador.
- Auditor.
- Consulta.

### RF-02 Gestion de Empleados

El sistema debera registrar codigo de empleado, nombre completo, cedula, departamento, cargo, correo, telefono movil y estado.

### RF-03 Gestion de Vehiculos

El sistema debera registrar placa, ficha o codigo interno, marca, modelo, ano, tipo, departamento, capacidad de tanque, kilometros u odometro y estado.

### RF-04 Gestion de Departamentos

El sistema debera crear y modificar departamentos, asociar empleados y asociar vehiculos.

### RF-05 Creacion de Solicitudes de Combustible

La plataforma permitira solicitudes manuales, automaticas programadas y recurrentes.

La solicitud incluira numero de empleado, vehiculo, departamento, cantidad autorizada, tipo de combustible, fecha de solicitud y fecha de vencimiento.

### RF-06 Emision de Tickets Digitales

La plataforma debera generar un ticket unico con identificador UUID, secuencia correlativa, fecha de creacion, fecha de vencimiento, vehiculo, empleado, departamento, cantidad autorizada y tipo de combustible.

Formatos requeridos:

- PDF.
- Correo electronico.
- Codigo QR.

### RF-07 Generacion de Codigo QR Seguro

Cada ticket debera contener datos protegidos mediante hash:

- Ticket ID.
- Numero secuencial.
- Empleado.
- Vehiculo.
- Cantidad de combustible.
- Fecha de emision.
- Fecha de expiracion.

Criterios:

- No reutilizable.
- No editable.
- Unico.
- Verificacion criptografica.

### RF-08 Numeracion de Tickets

El sistema debera mantener secuencia consecutiva, configurar prefijo, permitir reinicio anual opcional y evitar duplicidad.

Ejemplo: `COM-2026-000001`.

### RF-09 Envio de Tickets

El sistema debera enviar tickets por correo electronico incluyendo QR y datos del ticket, y por SMS incluyendo codigo corto, URL segura y QR descargable.

### RF-10 Consulta de Estado de Ticket

Estados:

- Creado.
- Enviado.
- Pendiente.
- Proximo a vencer.
- Vencido.
- Consumido.
- Anulado.

### RF-11 Asignaciones Automaticas y Manuales

Permitir asignacion manual por usuario autorizado y asignacion automatica basada en programaciones, reglas de negocio y consumo historico.

### RF-12 Despacho de Combustible

El despachador podra escanear QR, validar ticket, confirmar identidad y registrar despacho.

Datos registrados:

- Fecha.
- Hora.
- Galones servidos.
- Operador.
- Estacion.
- Observaciones.

### RF-13 Aplicacion Movil para Despacho

La aplicacion movil debera permitir login seguro, escaneo QR, confirmacion visual, validacion en linea, registro de despacho, consulta de tickets y sincronizacion inmediata.

### RF-14 Control de Inventario

Registrar entradas por recepcion de combustible, compra y transferencias; salidas por despachos y mermas; y ajustes positivos o negativos.

### RF-15 Inventario en Tiempo Real

El sistema debera mostrar existencia actual, disponibilidad, consumo diario, consumo mensual y nivel critico.

### RF-16 Recepcion de Combustible

Registrar RNC, nombre del suplidor, factura, volumen recibido, fecha y tanque, impactando inventario automaticamente.

### RF-17 Movimientos de Inventario

Mantener historial completo de entradas, salidas, ajustes y transferencias.

### RF-18 Cierre Diario

Funcionalidad para confirmar despachos realizados, volumen despachado, inventario final y diferencias detectadas.

Generar acta digital de cierre y reporte PDF.

### RF-19 Reportes

La plataforma debera generar reportes filtrables por fecha, empleado, vehiculo, departamento, tipo de combustible y estado de ticket.

### RF-20 Exportacion de Reportes

Formatos:

- Excel.
- CSV.
- PDF.

### RF-21 Trazabilidad

Registrar auditoria de creaciones, modificaciones, despachos, ajustes, anulaciones y accesos, incluyendo usuario, fecha, hora y direccion IP.

### RF-22 Dashboard Ejecutivo

Visualizacion de inventario actual, combustible despachado, tickets activos, tickets vencidos, consumo por departamento y consumo por vehiculo.

### RF-23 Notificaciones

Alertas automaticas para ticket proximo a vencer, ticket vencido, inventario bajo, fallo de integracion y ajustes de inventario.

### RF-24 API REST

Servicios para generacion de tickets, consulta de tickets, estado de inventario, despachos y reportes.

## 5. Requisitos de Seguridad

### RS-01 Autenticacion

Usuario y contrasena, MFA opcional y gestion de sesiones.

### RS-02 Autorizacion

Control RBAC basado en roles.

### RS-03 Cifrado

Datos en transito con TLS 1.3 y datos en reposo con AES-256.

### RS-04 Seguridad de QR

Los QR deberan contener firma digital, hash SHA-256 y token de validacion.

### RS-05 Seguridad de APIs

OAuth 2.0 y JWT.

### RS-06 Auditoria

Registro inalterable de accesos, cambios, despachos y ajustes.

## 6. Arquitectura Propuesta

Frontend:

- Angular, React o ASP.NET.

Backend:

- .NET 8 Web API con Entity Framework.

Base de datos:

- PostgreSQL o SQL Server.

Aplicacion movil:

- Flutter Android.
- Desarrollo de una PWA all in one.

Integraciones:

- SMTP.
- SMS Gateway.
- API REST.

Punto de despacho:

- Smartphone Android.
- Conectividad Internet.
- Lectores QR opcionales.

## 7. Criterios de Aceptacion

La solucion sera aceptada cuando:

1. Se emitan tickets QR unicos sin duplicidad.
2. El despacho se valide exclusivamente mediante QR valido.
3. El inventario se actualice en tiempo real.
4. Exista trazabilidad completa de las operaciones.
5. Los reportes sean exportables.
6. La aplicacion movil opere correctamente en produccion.
7. Se cumplan los requisitos de seguridad establecidos.

