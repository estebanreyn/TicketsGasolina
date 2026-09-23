# PRD - TicketsGasolina

Estado: borrador vivo
Fuente base: [srs-ticketsgasolina.md](srs-ticketsgasolina.md)

## 1. Executive Summary

TicketsGasolina sera una plataforma web y aplicacion movil/PWA para gestionar solicitudes, aprobaciones, emision, validacion y consumo de tickets digitales de combustible, con codigo QR unico, control de inventario en tiempo real, trazabilidad operativa y reportes gerenciales.

El producto busca reemplazar o mejorar el proceso actual de control de combustible mediante una solucion centralizada, segura y auditable que conecte la asignacion autorizada de combustible con el despacho fisico y el impacto automatico en inventario.

## 2. Problem Statement

Pendiente de discovery.

Se debe documentar como opera hoy el proceso de combustible, cuales son los dolores principales, que riesgos existen en el control actual, donde se pierde visibilidad y que costo operativo o financiero tiene no resolverlo.

## 3. Goals

- Gestionar solicitudes de combustible.
- Emitir tickets digitales unicos con codigo QR.
- Validar despachos mediante aplicacion movil/PWA.
- Actualizar inventario en tiempo real.
- Mantener trazabilidad completa de solicitudes, tickets, despachos, ajustes y cierres.
- Producir reportes filtrables y exportables.
- Operar con multiples usuarios, roles y permisos.

## 4. Non-Goals

Pendiente de discovery.

Se debe definir que queda fuera de la primera version, por ejemplo integraciones avanzadas, automatizaciones basadas en consumo historico, operacion offline, multiples estaciones, contabilidad, ERP, pagos o mantenimiento vehicular.

## 5. Stakeholders

Pendiente de discovery.

Actores identificados por el SRS:

- Administrador General.
- Supervisor de Combustible.
- Despachador.
- Solicitante.
- Auditor.
- Usuario de consulta.

## 6. Users and Roles

Roles base segun SRS:

- Administrador: configuracion, usuarios, seguridad, auditoria y control general.
- Supervisor: solicitudes, aprobaciones, recepciones y ajustes.
- Despachador: validacion QR, despacho y cierre diario.
- Solicitante: solicitud de combustible y consulta de estado.
- Auditor/Consulta: consulta, exportacion y revision de trazabilidad.

Pendiente: matriz detallada de permisos por rol.

## 7. Current Process and Pain Points

Pendiente de discovery.

## 8. Product Scope

### Incluido en la base del SRS

- Plataforma web administrativa.
- Gestion de usuarios, empleados, vehiculos y departamentos.
- Solicitudes manuales, programadas y recurrentes.
- Emision de tickets digitales.
- Numeracion consecutiva configurable.
- QR seguro y no reutilizable.
- Envio por correo y SMS.
- Consulta de estado de tickets.
- App movil/PWA para despacho.
- Inventario en tiempo real.
- Recepcion de combustible.
- Movimientos de inventario.
- Cierre diario.
- Reportes y exportacion.
- Dashboard ejecutivo.
- Notificaciones.
- API REST.
- Seguridad con autenticacion, autorizacion, cifrado, QR firmado y auditoria.

### Pendiente de priorizacion

- Alcance de MVP.
- Modulos indispensables para primera entrega.
- Funcionalidades que pueden diferirse.
- Dependencias externas obligatorias.

## 9. Core Workflows

Flujos base identificados:

1. Solicitud de combustible.
2. Aprobacion o asignacion de combustible.
3. Emision de ticket digital.
4. Envio del ticket por email/SMS.
5. Validacion QR en punto de despacho.
6. Registro del despacho.
7. Descuento automatico de inventario.
8. Cierre diario.
9. Auditoria y reportes.

Pendiente: detalle paso a paso, estados, excepciones y responsables.

## 10. Functional Requirements

Pendiente de convertir RF-01 a RF-24 en requisitos de producto priorizados, con criterios de aceptacion por modulo.

## 11. Business Rules

Pendiente de discovery.

Areas criticas:

- Quien puede solicitar combustible.
- Quien puede aprobar.
- Limites por empleado, vehiculo, departamento o periodo.
- Vencimiento de tickets.
- Anulaciones.
- Despachos parciales.
- Reglas de inventario bajo.
- Cierres diarios y diferencias.
- Reglas de numeracion.
- Reglas de reasignacion de vehiculos.

## 12. Permissions and Access Model

Pendiente de discovery.

Se requiere matriz de permisos por rol y modulo.

## 13. Data and Reporting Needs

Entidades base identificadas:

- Usuario.
- Rol.
- Empleado.
- Vehiculo.
- Departamento.
- Solicitud de combustible.
- Ticket.
- Codigo QR.
- Despacho.
- Inventario.
- Tanque.
- Recepcion de combustible.
- Movimiento de inventario.
- Cierre diario.
- Notificacion.
- Auditoria.

Reportes base:

- Tickets por fecha, empleado, vehiculo, departamento, combustible y estado.
- Inventario actual.
- Consumo diario y mensual.
- Consumo por departamento.
- Consumo por vehiculo.
- Tickets activos y vencidos.
- Cierres diarios.

## 14. Integrations

Integraciones identificadas:

- Email/SMTP.
- SMS Gateway.
- Servicio de generacion QR.
- API REST.
- Servicio de autenticacion.

Pendiente: proveedor, obligatoriedad, costos, fallback y manejo de fallos.

## 15. Notifications

Alertas base:

- Ticket proximo a vencer.
- Ticket vencido.
- Inventario bajo.
- Fallo de integracion.
- Ajustes de inventario.

Pendiente: canal, destinatarios, frecuencia y reglas de escalamiento.

## 16. UX Expectations

Pendiente de discovery.

Pantallas base esperadas:

- Login.
- Dashboard.
- Gestion de usuarios.
- Gestion de empleados.
- Gestion de vehiculos.
- Gestion de departamentos.
- Solicitudes.
- Tickets.
- Inventario.
- Recepcion de combustible.
- Movimientos.
- Cierre diario.
- Reportes.
- Escaneo QR/despacho movil.

## 17. Security and Audit Requirements

Base SRS:

- Usuario y contrasena.
- MFA opcional.
- Gestion de sesiones.
- RBAC.
- TLS 1.3.
- Cifrado en reposo AES-256.
- QR con firma digital, hash SHA-256 y token de validacion.
- OAuth 2.0 y JWT para APIs.
- Auditoria inalterable de accesos, cambios, despachos y ajustes.

Pendiente: nivel real de exigencia, politicas de password, expiracion de sesiones, retencion de logs, revisiones de auditoria y datos sensibles.

## 18. Non-Functional Requirements

Base SRS:

- Disponibilidad 24/7.
- Inventario en tiempo real.
- Sincronizacion inmediata en despacho movil.

Pendiente:

- Cantidad esperada de usuarios.
- Volumen diario de tickets.
- Numero de estaciones/puntos de despacho.
- Tiempo maximo aceptable de validacion QR.
- Requerimientos offline.
- SLA real.
- Soporte y monitoreo.

## 19. Acceptance Criteria

Base SRS:

1. Se emiten tickets QR unicos sin duplicidad.
2. El despacho se valida exclusivamente mediante QR valido.
3. El inventario se actualiza en tiempo real.
4. Existe trazabilidad completa de las operaciones.
5. Los reportes son exportables.
6. La aplicacion movil opera correctamente en produccion.
7. Se cumplen los requisitos de seguridad establecidos.

Pendiente: criterios por modulo y MVP.

## 20. Assumptions

- El sistema sera usado para control institucional de combustible.
- El punto de despacho contara con smartphone Android o navegador compatible.
- El QR debe validarse contra backend, no solo leerse localmente.
- El inventario del sistema debe considerarse fuente operativa de verdad despues de cada despacho confirmado.

## 21. Open Questions

Las preguntas de discovery se realizaran en conversacion. Solo las respuestas confirmadas, decisiones, supuestos y riesgos relevantes se incorporaran a este PRD.

## 22. Risks and Decisions Needed

- Riesgo de inventario inconsistente si los despachos fisicos no coinciden con registros digitales.
- Riesgo de fraude si QR, permisos o anulaciones no estan bien definidos.
- Riesgo operativo si la estacion pierde conectividad y no hay flujo offline/fallback.
- Riesgo de alcance si MVP, version completa e integraciones no se separan claramente.
- Riesgo de auditoria si los cambios no quedan inmutables o suficientemente trazables.
