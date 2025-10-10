Eres un ingeniero senior. Genera un **repositorio de proyecto** completo (estructura de carpetas, código base, contratos de API y README) para un sistema de **control de ingreso/salida escolar** con notificaciones en tiempo real. El objetivo es construir un **MVP robusto en Python** con FastAPI y PostgreSQL que soporte **NFC/QR** en un kiosco Android, notificar a **padres** por **WhatsApp (Meta Cloud API)** y **Email (Amazon SES)**, y permitir a **Dirección** gestionar **excepciones de horario** y **difusiones masivas**. No incluir reconocimiento facial; **huella** y **PWA de profesores** se dejan para fases futuras (stubs y documentación, no implementación completa). Mantén el código **modular, testeable**, con **tipado** y **linter**.

## 0) Alcance del MVP

* Registro **IN/OUT** de alumnos en puertas del colegio mediante:

  * **NFC** (stickers NTAG213 autoadhesivos) pegados en tarjetas → se lee un **NDEF** con `tag_token` aleatorio (128 bits), **solo-lectura**.
  * **QR** de respaldo (en tarjeta/credencial o pantalla del móvil del alumno/padre).
* **Notificaciones** a padres:

  * **WhatsApp** (Meta WhatsApp Cloud API, plantillas aprobadas) y **Email** (Amazon SES).
  * Tipos: `INGRESO_OK`, `SALIDA_OK`, `NO_INGRESO_UMBRAL`, `CAMBIO_HORARIO`.
* **Preferencias por padre/familia**:

  * Selección de canales (WhatsApp/Email) por tipo de evento.
  * **Opt-in/Opt-out** de **captura de foto** (si está activo en el kiosco; en MVP la foto es evidencia, no biometría).
* **Dirección/Inspectoría**:

  * Tablero en vivo de ingresos/salidas.
  * **Excepciones de calendario** (cambios de horarios por día → global o por curso), con **broadcast opcional** a padres (WhatsApp/Email) y **auditoría/dry-run**.
* **Kiosco Android**: app nativa a futuro; por ahora define **contrato de API** y ejemplos de integración (Kotlin stubs) para:

  * Lectura NFC (NDEF con `tag_token`), lectura QR, captura de foto (opcional), **offline-first** con cola local y sincronización.
* **Emergencia**: más adelante una **PWA para profesores** (solo QR y registro en lote). **NO implementarla** ahora; dejar *stubs + README*.

## 1) Pila tecnológica

* **Backend**: Python 3.11+, **FastAPI**, **Uvicorn**, **SQLAlchemy** + **Alembic**, **Pydantic**.
* **DB**: **PostgreSQL**.
* **Cola de trabajos**: **Redis + RQ** (o Celery si lo prefieres, pero usa RQ por simplicidad).
* **Notificaciones**:

  * **WhatsApp Cloud API (Meta)** vía Graph API.
  * **Amazon SES** para email.
* **Almacenamiento de fotos**: S3-compatible (MinIO en dev) con cifrado y **retención** automática (job nocturno).
* **Frontend web mínimo** (Dirección/Inspectoría/Padres): **FastAPI + Jinja** o un micro-front simple (no NextJS en MVP). Endpoints HTML básicos para:

  * Tablero en vivo (Dirección).
  * Preferencias de notificación (Padres).
  * Gestión de excepciones de calendario + broadcast (Dirección).
* **Seguridad**: JWT corta duración, 2FA para staff (stub), CORS, rate limiting básico.
* **Calidad**: `ruff`/`flake8`, `black`, `mypy`, `pytest`, `pre-commit`.

## 2) Estructura de carpetas (ejemplo)

```
school-attendance/
  README.md
  .env.example
  pyproject.toml
  requirements.txt
  scripts/
    dev_seed.py
  infra/
    docker-compose.yml  # postgres, redis, minio
  app/
    main.py
    core/
      config.py
      security.py
      logging.py
      auth.py
      deps.py
    db/
      base.py
      session.py
      migrations/  # alembic
      models/
        student.py
        guardian.py
        course.py
        enrollment.py
        attendance_event.py
        device.py
        consent.py
        notification.py
        absence_request.py
        schedule.py
        schedule_exception.py
        audit_log.py
        tag.py
      repositories/
        students.py
        guardians.py
        attendance.py
        schedules.py
        tags.py
    schemas/
      common.py
      students.py
      guardians.py
      attendance.py
      notifications.py
      schedules.py
      absences.py
      devices.py
      tags.py
    services/
      notifications/
        whatsapp.py
        ses_email.py
        templating.py
        dispatcher.py
      attendance_service.py
      photo_service.py
      schedule_service.py
      broadcast_service.py
      consent_service.py
      tag_provision_service.py
    workers/
      rq_worker.py
      jobs/
        send_whatsapp.py
        send_email.py
        cleanup_photos.py
        process_broadcast.py
    api/
      deps.py
      v1/
        attendance.py
        notifications.py
        schedules.py
        broadcast.py
        parents.py
        tags.py
        devices.py
        health.py
    web/
      templates/
        base.html
        dashboard.html
        schedules.html
        broadcast_preview.html
        parents_prefs.html
      static/
        css/
        js/
  tests/
    test_attendance.py
    test_schedules.py
    test_notifications.py
```

## 3) Modelo de datos (SQLAlchemy)

Tablas mínimas:

* **Student**(id, full_name, course_id, status, qr_code_hash, photo_pref_opt_in:bool)
* **Guardian**(id, full_name, contacts: JSON[{type: "whatsapp"|"email", value, verified}], notification_prefs: JSON)
* **Course**(id, name, grade)
* **Enrollment**(id, student_id, course_id, school_year)
* **Device**(id, gate_id, version, last_sync, pending_count)
* **Tag**(id, tag_token_hash, student_id, status, created_at, revoked_at)  ← mapea sticker NFC
* **AttendanceEvent**(id, student_id, type:Enum, gate_id, ts, device_id, local_seq, photo_ref?)
* **AbsenceRequest**(id, student_id, type:Enum, dates:daterange, attachment_ref?, status, approver_id, ts_submitted, ts_resolved)
* **Notification**(id, event_id?, guardian_id, channel, template, payload:JSON, status, ts_sent, retries)
* **Consent**(id, student_id, guardian_id, scopes:JSON, ts_signed, ts_expires)
* **Schedule**(id, course_id, weekday:int, in_time:time, out_time:time)  ← horario base por curso
* **ScheduleException**(id, scope:Enum, course_id?, date:date, in_time:time?, out_time:time?, reason:text, created_by)
* **AuditLog**(id, actor_id, role, action, entity, entity_id, ts, ip)

Notas:

* **Fotos**: almacenar `photo_ref` (S3 key), no la imagen en DB. Retención configurable (p. ej. 60 días).
* **tag_token**: guardar **hash** (HMAC-SHA256 con `TAG_SECRET`) del token leído para no exponerlo en claro.
* **QR**: mismo enfoque que NFC: un token firmado/efímero → resolver alumno en backend.

## 4) Seguridad y privacidad

* **HTTPS** obligatorio. TLS terminado en el proxy.
* **Cifrado en reposo** para fotos en S3 (SSE-S3 o SSE-KMS).
* **Tokens**: JWT de corta duración + refresh para staff; **magic link** (JWT one-shot) para padres.
* **RBAC**: roles `PARENT`, `TEACHER` (futuro), `INSPECTOR`, `DIRECTOR`, `ADMIN`.
* **Auditoría**: loguear accesos a fotos/datos sensibles.
* **Retención de fotos**: job nocturno que borra S3 y limpia referencias vencidas.

## 5) NDEF (sticker NFC) y provisión

* **Sticker**: NTAG213 (Tipo 2), autoadhesivo, modo **solo lectura** tras escritura.
* **Payload NDEF (URI)**: `https://<DOMAIN>/t/<tag_token>`

  * `tag_token`: 128 bits aleatorios, **generado en servidor**, Base32 o Base64URL (sin `=`).
  * Opcional: `sig=<HMAC>` como querystring (HMAC-SHA256(tag_token, TAG_SIGNING_KEY)).
* **Flujo de provisión (app Android de staff; por ahora generar endpoints y documentación):**

  1. Staff abre pantalla “Asignar sticker”.
  2. Backend crea `tag_token` y devuelve `ndef_uri` + checksum.
  3. App escribe **NDEF** con esa URI y bloquea el tag **read-only**.
  4. App envía confirmación → backend crea `Tag(tag_token_hash, student_id)`.
  5. Si reemplazo: marca tag anterior como `revoked`.
* **Endpoint provisión**:

  * `POST /tags/provision` → `{student_id}` → retorna `{ndef_uri, tag_token_preview, checksum}`
  * `POST /tags/confirm` → `{student_id, tag_token_preview, tag_uid?}` → persiste `Tag` y asocia.
  * `POST /tags/revoke` → `{tag_id}`.

## 6) Endpoints (FastAPI, `/api/v1`)

Implementa **esquemas Pydantic**, validaciones y **OpenAPI**.

**Salud/Infra**

* `GET /health` → ok, versiones, latencias.

**Asistencia**

* `POST /attendance/scan`
  Body:

  ```
  {
    "source": "NFC"|"QR",
    "token": "tag_or_qr_token",
    "type": "IN"|"OUT",
    "gate_id": "GATE-1",
    "device_id": "DEV-1",
    "local_seq": 123,
    "photo_expected": true|false
  }
  ```

  Responde `202 Accepted` e **idempotencia** por `(device_id, local_seq)`. Encola notificaciones según reglas.
* `PUT /attendance/photo/{event_id}` → URL firmada S3 (pre-signed PUT) + verificación de tamaño/mime.
* `GET /attendance/events?student_id=...&from=...&to=...`
* **Reglas**: el worker evalúa si `NO_INGRESO_UMBRAL` aplica según `effective_schedule(date, course)`.

**Notificaciones**

* `POST /notifications/dispatch` (internal/worker)
* `GET /notifications/{id}` estado
* Plantillas (`services/notifications/templating.py`) con parámetros.

**Calendario y excepciones**

* `GET /schedules/effective?course_id=...&date=YYYY-MM-DD` → resuelve ventanas (considera excepciones).
* `POST /schedules/exceptions` → crea excepción (`scope`, `course_id?`, `date`, `in_time?`, `out_time?`, `reason`, `notify:boolean`).
* `GET /schedules/exceptions?from=...&to=...`
* Si `notify=true`: crea trabajo de **broadcast** con vista previa y auditoría.

**Broadcast masivo (cambio de horario)**

* `POST /broadcast/preview` → retorna lista de destinatarios (conteo + sample).
* `POST /broadcast/send` → dispara WhatsApp/Email en lote (chunking, reintentos, idempotencia por `broadcast_id`).
* **Auditoría**: quién, cuándo, alcance, motivo.

**Padres**

* `GET /parents/me/preferences`
* `PUT /parents/me/preferences` → canales por tipo (`INGRESO_OK`, `SALIDA_OK`, `NO_INGRESO_UMBRAL`, `CAMBIO_HORARIO`) y **opt-in foto**.

**Tags (NFC)**

* `POST /tags/provision` / `POST /tags/confirm` / `POST /tags/revoke` como arriba.
* `POST /qr/issue` → genera QR token efímero (firma + expiración).

**Dispositivos**

* `POST /devices/heartbeat` → `{device_id, gate_id, battery?, queue_len?, version}` → salud en tablero.

## 7) Lógica de horarios

* **Horario base por curso** (`Schedule`): `weekday` 0–6, `in_time`, `out_time`.
* **Excepciones** (`ScheduleException`):

  * `scope=GLOBAL` aplica a todos; `scope=COURSE` solo a un curso.
  * `date` obligatoria; `in_time` y/o `out_time` opcionales (si no se define, hereda del base).
* **Resolver horario efectivo**: función `effective_schedule(course_id, date)` que combina base + excepción (precedencia: excepción > base).
* **Notificación de “no ingresó”**: worker corre al llegar `in_time + gracia` y detecta alumnos sin `IN` → dispara a padres según preferencias.

## 8) Servicios de notificación

* **WhatsApp (Meta Cloud API)**:

  * Config en `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`.
  * Función `send_whatsapp_template(to, template_name, lang, params)` con **reintentos exponenciales** y manejo de errores (limitar tasa, `429`).
* **SES (Email)**:

  * Config en `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_SENDER`.
  * `send_email(to, subject, html_body, text_body)` con reintentos.
* **Dispatcher**: decide canal por preferencia del padre y fallback (si falla WhatsApp, intenta Email).

## 9) Fotos: evidencia opcional

* **Preferencia por alumno** (`photo_pref_opt_in`).
* Si el kiosco marca `photo_expected=true` y la familia habilitó foto:

  * Backend genera **pre-signed URL** S3.
  * Kiosco sube JPG/PNG. `photo_ref` se guarda en el `AttendanceEvent`.
* **Retención**: parámetro `PHOTO_RETENTION_DAYS` (p. ej., 60). Job `cleanup_photos.py` borra S3 y limpia DB.

## 10) Android kiosco (stubs + guía)

* Proveer en `/app/web/templates/dashboard.html` un **panel de salud** que muestre dispositivos y colas.
* En `README.md`, incluir **pseudocódigo Kotlin**:

  * **NFC**: leer NDEF → extraer `tag_token`.
  * **QR**: usar cámara (MLKit/Zxing).
  * **Offline-first**: cola SQLite con `(device_id, local_seq)` y reintentos.
  * **Foto**: tomar, subir a pre-signed URL.
  * **Lock Task Mode** para modo kiosco.
* Incluir `examples/android/KioskIntegration.md` con fragmentos de código.

## 11) Variables de entorno (.env.example)

```
DATABASE_URL=postgresql+psycopg://user:pass@db:5432/attendance
REDIS_URL=redis://redis:6379/0
SECRET_KEY=...
TAG_SECRET=...
TAG_SIGNING_KEY=...
PHOTO_RETENTION_DAYS=60
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_ID=...
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
SES_SENDER=no-reply@colegio.cl
DOMAIN=https://app.colegio.cl
```

## 12) Reglas de negocio clave

* **No FR (reconocimiento facial)** en MVP. **Huella** se deja a futuro (documentar integración con lectores USB-OTG, sin implementar).
* **Silencios configurables**: **no** en MVP.
* **PWA profesores**: futura; documentar interfaz esperada (`/api/v1/attendance/scan` igual al kiosco).
* **Idempotencia**: por `(device_id, local_seq)` en `attendance/scan` y por `broadcast_id` en envíos masivos.
* **Latencia objetivo**: notificación < **60 s** median.
* **Escalabilidad**: colas RQ, chunking para broadcast, límites de tasa por canal.

## 13) Calidad, tests y CI

* **Tests** para:

  * `effective_schedule` y excepciones.
  * Disparo de `NO_INGRESO_UMBRAL`.
  * `tags` provisión + revocación.
  * WhatsApp/SES: **mock** de clientes.
* Incluir **Makefile** con targets: `run`, `format`, `lint`, `test`, `migrate`, `seed`.
* **Docker Compose** con Postgres/Redis/MinIO.

## 14) README

* Instrucciones de **setup** dev (Docker), migraciones Alembic, seeding básico.
* Flujos de **provisión de stickers**, **registro de asistencia**, **cambio de horario** y **broadcast** (con capturas de endpoints).
* Roadmap: PWA profesores y huella (lectores compatibles) en fase 2.

> Entregables esperados:
>
> * Código Python ejecutable del backend con FastAPI, modelos, migraciones, endpoints mencionados, workers RQ y clientes WhatsApp/SES stub/functionales.
> * HTML mínimo para tablero, preferencias y gestión de excepciones + broadcast (Jinja).
> * Tests unitarios clave.
> * Documentación (README, variables de entorno, guía de kiosco Android).
> * OpenAPI generado accesible en `/docs`.


