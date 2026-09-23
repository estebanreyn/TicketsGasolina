# TicketsGasolina

Plataforma web y PWA para administrar solicitudes, tickets digitales con QR, despachos e inventario de combustible. La implementación cubre los requisitos RF-01 a RF-24 del SRS con una experiencia adaptable a escritorio y teléfono.

## Ejecutar localmente

Requisitos: Node.js 20 o superior.

```powershell
npm install
Copy-Item .env.example .env
npm start
```

Abrir `http://localhost:3000`.

Para desarrollo con recarga automática:

```powershell
npm run dev
```

## Usuarios iniciales

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | `admin@intec.edu.do` | `Admin123!` |
| Supervisor | `supervisor@intec.edu.do` | `Supervisor123!` |
| Despachador | `despachador@intec.edu.do` | `Despachador123!` |

Cambiar estas contraseñas antes de usar datos reales. Definir también un `APP_SECRET` largo y aleatorio en `.env`.

## Módulos incluidos

- Autenticación, sesiones firmadas y permisos por rol.
- Usuarios, empleados, vehículos, departamentos y tanques.
- Solicitudes manuales, aprobación, rechazo y emisión de tickets.
- Numeración anual correlativa y QR firmado con HMAC SHA-256.
- Ticket PDF y bandeja local de mensajes para correo/SMS.
- Validación y despacho único o parcial desde teléfono o escritorio.
- Recepciones, ajustes, transferencias y movimientos de inventario.
- Alertas de inventario, notificaciones y dashboard ejecutivo.
- Cierre diario con conciliación y diferencias.
- Reportes filtrables en CSV, XLSX y PDF.
- Auditoría append-only de accesos y operaciones críticas.
- API REST bajo `/api` y PWA instalable.

## Almacenamiento

Los datos se guardan en `data/app.json` mediante escrituras atómicas y una cola transaccional dentro del proceso. El archivo se crea con datos de demostración en el primer inicio y no se versiona.

Esta persistencia permite entregar y demostrar el sistema sin infraestructura adicional. Para producción debe reemplazarse por PostgreSQL o SQL Server, manteniendo los contratos REST y agregando transacciones de base de datos, respaldos y alta disponibilidad.

## Seguridad aplicada

- Contraseñas derivadas con `scrypt` y salt individual.
- Tokens de sesión y QR firmados con HMAC SHA-256.
- Comparaciones criptográficas resistentes a ataques de temporización.
- Validación del estado, vencimiento, monto restante e inventario en backend.
- QR asociado por hash al ticket para detectar alteraciones.
- Control de acceso por rol en cada ruta.
- Bitácora de auditoría sin rutas de edición o eliminación.

TLS 1.3 y cifrado AES-256 en reposo dependen de la infraestructura de producción. El servidor local usa HTTP y almacenamiento de desarrollo.

## Verificación

```powershell
npm run check
npm test
npm audit
```

## Estructura

```text
public/             PWA, estilos e interfaz de usuario
src/server.js       API REST y reglas de negocio
src/security.js     Contraseñas, firmas y tokens
src/store.js        Persistencia y auditoría
test/               Pruebas automatizadas
docs/               SRS y PRD del producto
```

## Variables de entorno

- `PORT`: puerto HTTP; valor predeterminado `3000`.
- `APP_SECRET`: secreto para firmar sesiones y QR.
- `APP_BASE_URL`: URL pública usada por el servidor.
- `DATA_FILE`: ruta opcional del archivo de datos.

## Integraciones pendientes de credenciales

Los envíos se registran en la bandeja `outbox`; no se transmiten a terceros hasta configurar proveedores SMTP y SMS. La aplicación deja este límite explícito para evitar aparentar entregas que no ocurrieron.
