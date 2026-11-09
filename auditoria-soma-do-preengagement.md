# Auditoría de Seguridad — soma.do
## Documento de Pre-Engagement (borrador de arranque)

> Estado: **PENDIENTE DE AUTORIZACIÓN FIRMADA.** Ninguna prueba activa
> (escaneo, enumeración, explotación) debe ejecutarse hasta que el
> apartado 2 esté firmado por un representante autorizado del cliente.

---

## 1. Resumen del encargo

| Campo | Valor |
|---|---|
| Objetivo | soma.do (web + app + API + infra expuesta) |
| Modalidad | Caja negra (sin credenciales) |
| Perspectiva | Externa (desde Internet) |
| Relación con el objetivo | El cliente declara ser **dueño directo** del dominio |
| Auditor | _(tu nombre / empresa)_ |
| Fecha propuesta de inicio | _(por definir)_ |

---

## 2. Autorización y Reglas de Enfrentamiento (Rules of Engagement)

**Debe completarse y firmarse ANTES de cualquier prueba activa.**

### 2.1 Autorización
- [ ] El firmante declara tener autoridad para autorizar pruebas de seguridad
      sobre los activos listados.
- [ ] Nombre y cargo del firmante: ________________________
- [ ] Empresa / entidad dueña de soma.do: ________________________
- [ ] Fecha y firma: ________________________

### 2.2 Alcance — activos autorizados (in-scope)
Listar explícitamente. Un dominio NO autoriza automáticamente todo lo que
cuelga de él.

| Activo | ¿Propiedad del cliente? | ¿Autorizado? |
|---|---|---|
| soma.do (dominio raíz) | | |
| www.soma.do | | |
| Subdominios (app., api., etc.) — listar | | |
| Rango(s) de IP / servidores propios | | |
| API endpoints (documentar base URL) | | |
| App móvil (si aplica — iOS/Android) | | |

### 2.3 Fuera de alcance (out-of-scope) — confirmar
- Infraestructura de **terceros** que soma.do use pero no sea del cliente
  (hosting/CDN/DNS/correo gestionado). Requiere autorización del proveedor
  por separado, o se excluye.
- Servicios de terceros enlazados (pasarelas de pago, OAuth externos, etc.).
- Ingeniería social / phishing a empleados — ¿incluido? **Por defecto NO.**
- Ataques de denegación de servicio (DoS/DDoS, stress) — **excluidos.**

### 2.4 Reglas
- Ventana de pruebas autorizada (fechas/horas): ________________________
- ¿Pruebas sobre producción o entorno de staging? ________________________
- Límite de intensidad (rate limiting, nº de hilos): ________________________
- Manejo de datos sensibles encontrados: no exfiltrar, no divulgar,
  documentar como evidencia mínima necesaria.
- Contacto de emergencia (24/7) del cliente: ________________________
- Palabra/señal de "alto inmediato": ________________________

---

## 3. Metodología

Marco de referencia: **OWASP Web Security Testing Guide (WSTG)**,
**OWASP Top 10**, **OWASP API Security Top 10**, y **OWASP MASVS** (si hay app móvil).

### Fase 0 — Preparación (sin tocar el objetivo)
- Confirmar scope y autorización (sección 2).
- Definir criterios de severidad (CVSS 3.1 / 4.0).

### Fase 1 — Reconocimiento
- **Pasivo** (sin enviar tráfico de ataque): OSINT, registros públicos
  (WHOIS/DNS públicos, certificados CT logs), huella tecnológica visible,
  subdominios por fuentes públicas.
- **Activo** (requiere autorización): enumeración de subdominios, puertos,
  servicios, descubrimiento de contenido.

### Fase 2 — Mapeo de la aplicación
- Spidering/crawling de la web y la superficie de la app.
- Identificación de endpoints de API, parámetros, flujos de autenticación.

### Fase 3 — Análisis de vulnerabilidades (por categoría WSTG)
- Gestión de configuración e implementación (headers, TLS, métodos HTTP,
  archivos expuestos).
- Gestión de identidad y autenticación.
- Gestión de sesiones.
- Autorización (IDOR, escalada, control de acceso roto).
- Validación de entrada (inyección SQL, XSS, SSRF, inyección de comandos,
  deserialización).
- Lógica de negocio.
- Criptografía en tránsito.
- API: BOLA/BFLA, exceso de exposición de datos, rate limiting.

### Fase 4 — Explotación controlada
- Solo prueba de concepto mínima para confirmar el hallazgo.
- Sin pivoting destructivo, sin impacto en disponibilidad, sin datos reales.

### Fase 5 — Post-explotación / impacto
- Evaluar alcance real del hallazgo (sin extraer datos sensibles).

### Fase 6 — Reporte y remediación
- Ver sección 5.

---

## 4. Checklist de ejecución (marcar al tener luz verde)

### Reconocimiento pasivo
- [ ] WHOIS / titularidad del dominio (público)
- [ ] Registros DNS públicos
- [ ] Certificados en CT logs (subdominios)
- [ ] Tecnologías visibles en el frontend
- [ ] Buscadores / documentos indexados expuestos

### Configuración / superficie
- [ ] Cabeceras de seguridad HTTP (HSTS, CSP, X-Frame-Options, etc.)
- [ ] Configuración TLS (versiones, cifrados, certificado)
- [ ] Métodos HTTP permitidos
- [ ] Archivos/directorios sensibles expuestos (robots, .git, backups, .env)
- [ ] Mensajes de error / fugas de información

### Autenticación y sesión
- [ ] Política de contraseñas / registro
- [ ] Recuperación de contraseña
- [ ] Gestión de cookies/tokens (flags, expiración, rotación)
- [ ] MFA (si existe)
- [ ] Rate limiting / anti-automatización en login

### Autorización
- [ ] IDOR / referencias directas a objetos
- [ ] Control de acceso por rol / vertical / horizontal

### Entrada / inyección
- [ ] SQLi
- [ ] XSS (reflejado/almacenado/DOM)
- [ ] SSRF
- [ ] Inyección de comandos / plantillas
- [ ] Carga de archivos

### API
- [ ] BOLA (autorización a nivel de objeto)
- [ ] BFLA (autorización a nivel de función)
- [ ] Exposición excesiva de datos
- [ ] Rate limiting

### Lógica de negocio
- [ ] Flujos abusables (pagos, cupones, cantidades, etc.)

---

## 5. Formato de reporte

Por cada hallazgo:

| Campo | Contenido |
|---|---|
| ID | H-001 |
| Título | Descripción corta |
| Severidad | Crítica / Alta / Media / Baja / Informativa (+ CVSS) |
| Activo afectado | URL / endpoint / servicio |
| Descripción | Qué es y por qué importa |
| Evidencia | Pasos de reproducción + captura mínima necesaria |
| Impacto | Qué puede lograr un atacante |
| Remediación | Cómo corregirlo |
| Referencias | CWE / OWASP / CVE |

Estructura del informe final:
1. Resumen ejecutivo (para dirección, sin tecnicismos)
2. Alcance y metodología
3. Resumen de hallazgos (tabla + gráfico de severidad)
4. Hallazgos detallados
5. Recomendaciones priorizadas
6. Anexos (herramientas, evidencias)

---

## 6. Qué falta para arrancar la parte activa
1. Sección 2 firmada por el cliente.
2. Lista explícita de subdominios/IPs in-scope confirmada.
3. Confirmación de qué infra es del cliente vs. de terceros.
4. Ventana de pruebas y contacto de emergencia.
