# School Attendance – Arquitectura del MVP

## Supuestos clave
- MVP enfocado en control de ingreso/salida mediante kiosco Android y portal web interno; funcionalidades futuras (PWA profesores, biometría, huella) se documentan pero quedan como stubs.
- Despliegue objetivo on-premise o cloud privado del colegio con contenedores Docker y orquestación futura (Docker Compose en dev).
- Autenticación inicial basada en JWT cortos y refresh tokens para staff; padres acceden vía magic link enviado por correo/WhatsApp.
- Cola de trabajos con Redis + RQ, ejecutando workers separados para notificaciones y mantenimiento.
- Almacenamiento de fotos en bucket S3-compatible (MinIO en dev); ninguna imagen se persiste localmente fuera del almacenamiento seguro.
- Horarios escolares por curso (weekday/in/out) y excepciones parametrizadas por fecha; cálculo de “no ingreso” se dispara a los 15 minutos del horario efectivo (valor configurable).
- Meta WhatsApp Cloud API y Amazon SES utilizan sandbox/dev accounts; envío real controlado por feature flag en configuración.
- Kiosco Android opera offline y sincroniza mediante endpoints REST en lotes; se incluye SDK stub en Kotlin y documentación de flujo.
- Seguridad: TLS terminado en proxy inverso, rate-limiting simple con Redis, logging estructurado JSON para análisis posterior.
- Autenticación: JWT de corta duración para llamadas API y sesión firmada para vistas web; roles `ADMIN`, `DIRECTOR`, `INSPECTOR`, `PARENT`.
- Cada alumno se vincula con uno o más apoderados mediante la tabla puente `student_guardians`.
- Se registra una tabla `no_show_alerts` para alertas de “no ingreso” con estado, bitácora y métricas.

## Componentes
1. **API Backend (FastAPI)**
   - Endpoints REST `/api/v1/…` para kiosco, portal y servicios internos.
   - Capa de servicios para reglas de negocio (asistencia, horarios, notificaciones, consentimientos, broadcast).
   - Integraciones externas: WhatsApp Cloud API, Amazon SES, S3 (MinIO en dev).
   - Gestión de autenticación, autorización por roles, dependencias comunes, configuración.

2. **Workers (Redis RQ)**
   - Jobs de envío de WhatsApp/Email.
   - Job nocturno de limpieza de fotos vencidas.
   - Job de ejecución de difusiones masivas.

3. **Frontend Web (Jinja + HTMX)**
   - Tablero en vivo para Dirección/Inspectoría.
   - Gestión de horarios y excepciones.
   - Preferencias de notificación para padres.
   - Basado en plantillas Jinja renderizadas por FastAPI.

4. **Kiosco Android (Stub)**
   - Módulo `kiosk-sdk` con clases Kotlin que muestran el contrato de sincronización.
   - Documentación del flujo NFC/QR y colas offline.

5. **Infraestructura**
   - Docker Compose con servicios: `api`, `worker`, `scheduler`, `postgres`, `redis`, `minio`, `rq-dashboard`.
   - Scripts de semilla y make targets para desarrollo.

6. **Jobs programados**
   - Detección de “no ingreso” que genera notificaciones automáticas.
   - Limpieza de fotos vencidas según política de retención.

## Roadmap de desarrollo (resumen)
1. Scaffold FastAPI + configuración base.
2. Definir modelos SQLAlchemy, esquemas Pydantic y repositorios.
3. Implementar servicios de negocio y workers.
4. Construir API REST y vistas web mínimas.
5. Integraciones externas (stubs/mocks para dev).
6. Tooling: tests, linters, pre-commit, CI stub.
7. Documentación adicional: guías de kiosco, despliegue e integración.
