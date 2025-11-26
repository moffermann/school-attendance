# School Attendance – Roadmap (Actualizado 2025-11-26)

## Estado actual

### Backend FastAPI
- Portal SPA montado sobre FastAPI con autenticación por sesión (`/api/v1/auth/session`)
- Bootstrap real (`/api/v1/web-app/bootstrap`) y vistas conectadas
- Métricas operativas: dashboard, reportes por curso/tendencia, alertas de no ingreso
- Validación de secrets en producción (`config.py:55-63`)
- Protección contra SQL injection en búsquedas (`dashboard_service.py:262-274`)
- ✅ Validación de uploads (MIME, size, extension) en `attendance_service.py:103-136`
- Jobs RQ y scheduler documentados (`docs/scheduler.md`)
- CI en GitHub Actions ejecuta lint + tests

### Kiosk App (Tótem)
- ✅ Integración real con backend (`/api/v1/attendance/events`)
- ✅ Escaneo QR real con cámara (jsQR)
- ✅ Soporte Web NFC con reintentos
- ✅ Multi-idioma implementado (ES, EN, PT)
- ✅ Panel de administración con timeout de sesión
- ✅ Provisioning via `scripts/provision_kiosk.py`
- ✅ Tests E2E básicos con Playwright

### Teacher PWA (Profesores)
- ✅ Vista de historial con filtros por fecha/tipo
- ✅ Vista de alertas de no ingreso con acciones rápidas
- ✅ API client con refresh token automático (`api.js`)
- ✅ IndexedDB para almacenamiento offline
- ✅ Sync real con backend (`sync.js` → `/api/v1/teachers/attendance/bulk`)
- ✅ Autenticación JWT completa (`auth.js`)
- ✅ Hora de inicio configurable (`config.json`)

### Web App (Director Dashboard)
- SPA con vistas: dashboard, reportes, dispositivos, alertas, horarios, ausencias
- Export CSV en reportes y alertas
- ✅ Función `escapeHtml()` implementada en `components.js`

---

## Fases Completadas

### ✅ Fase 1: Estabilización (Completada 2025-11-26)
- [x] B1: Validación de uploads (tests en `test_photo_upload.py`)
- [x] B2: `escapeHtml()` ya existe en web-app y teacher-pwa
- [x] B5: Memory leak ya corregido (listener se remueve en línea 512)
- [x] B6: Hora de inicio configurable via `config.json`
- [x] B7: Soporte dual `ts`/`occurred_at` en history.js

### ✅ Fase 2: Integración PWA Profesores (Ya implementada)
- [x] `GET /api/v1/teachers/me` - Perfil del profesor
- [x] `GET /api/v1/teachers/courses/{id}/students` - Estudiantes del curso
- [x] `POST /api/v1/teachers/attendance/bulk` - Sync masivo
- [x] `sync.js` conecta con API real
- [x] Autenticación JWT en `auth.js`
- [x] Tests en `test_teachers.py`

---

### ✅ Fase 3: Test Coverage Backend (Completada 2025-11-26)
- [x] Tests para TeacherRepository (95% coverage)
- [x] Tests para NotificationRepository (89% coverage)
- [x] Tests para GuardianRepository (76% coverage)
- [x] Tests para AuthService (100% coverage)
- [x] Tests para NoShowAlertRepository (91% coverage)
- [x] Tests para ScheduleService (100% coverage)
- [x] Tests para AbsenceService (97% coverage)
- [x] Tests para DeviceService (100% coverage)
- [x] Tests para web/router.py (57% coverage)
- [x] Tests para security.py (100% coverage)
- [x] Tests para API endpoints: parents, tags, alerts, broadcast
- [x] Meta alcanzada: **80% coverage** (271 tests)

### ✅ Fase 3.2: Test Coverage Frontend (Completada 2025-11-26)

#### Frontend E2E - Kiosk App ✅ (28 tests)
- [x] `admin-timeout.spec.js` - 3 tests (panel admin, timeout, navegación)
- [x] `help-view.spec.js` - 6 tests (documentación, tokens, navegación)
- [x] `home-ux.spec.js` - 1 test (procesamiento de token)
- [x] `scan-result.spec.js` - 7 tests (datos estudiante, curso, guardian)
- [x] `scan-view.spec.js` - 6 tests (detección teacher/student, tokens)
- [x] `service-worker.spec.js` - 5 tests (cache, offline, PWA)

#### Frontend E2E - Teacher PWA ✅ (9 tests)
- [x] `auth.spec.js` - 3 tests (login form, redirect protección, rutas protegidas)
- [x] `navigation.spec.js` - 6 tests (redirects sin auth, PWA meta tags)

#### Frontend E2E - Web App ✅ (35 tests)
- [x] `auth.spec.js` - 4 tests (auth page, roles, demo login)
- [x] `director-dashboard.spec.js` - 5 tests (stats, sidebar, filtros)
- [x] `director-views.spec.js` - 11 tests (reports, devices, schedules, absences, broadcast, students)
- [x] `parent-views.spec.js` - 8 tests (home, history, preferences, absences)
- [x] `navigation.spec.js` - 7 tests (routing, access control)

**Total E2E tests: 72 (28 kiosk + 9 teacher-pwa + 35 web-app)**

---

## ✅ Fase 4: Features Nuevos (Completada 2025-11-26)

### Portal Web ✅
- [x] Métricas extendidas de ausencias (`director_metrics.js`)
  - Dashboard con KPIs: tasa asistencia, tardanzas promedio, estudiantes en riesgo
  - Top 10 estudiantes con más tardanzas
  - Distribución por hora y tendencias 30 días
  - Export PDF y CSV de métricas
- [x] Métricas de notificaciones por canal (`director_notifications.js`, `state.js:323-326`)
  - Filtrado por canal (WhatsApp, Email)
  - Contadores por canal en `getNotificationStats()`
- [x] Reportes PDF semanales (`director_reports.js:137-202`)
  - Generación PDF con filtros fecha/curso
  - Resumen por curso, gráfico asistencia, tendencia semanal
- [x] Estados vacíos coherentes en 11 de 14 vistas (`components.js:234-240`)
  - Implementado en: dashboard, absences, devices, exceptions, metrics, notifications, students, parent views
- [x] Broadcast con formulario completo (`director_broadcast.js`)
  - Selección curso, canal, preview, resultados simulados

### Kiosk ✅
- [x] Captura de foto real (`scan_result.js:123-174`)
  - getUserMedia API + canvas capture
  - Activado cuando `photoEnabled = true`
  - Sonido de cámara y overlay de confirmación
- [x] Web NFC integrado (`home.js:149-242`)
  - NDEFReader API completa
  - Lectura de registros NDEF (text/URL)
  - Auto-retry con máximo 3 intentos
  - Fallback a input manual
- [x] Service Worker offline (`service-worker.js`, `sync.js`)
  - Cache-first strategy
  - Cola de sync con estados (pending/synced/error)
  - Persistencia en localStorage

### PWA Profesores (Parcial)
- [x] Escaneo QR simulado (`scan_qr.js`)
  - Input manual con tokens de prueba
  - Determina IN/OUT automáticamente
  - Cola local de eventos
- [ ] Notificaciones push - NO IMPLEMENTADO (solo toasts locales)
- [ ] Modo oscuro - NO IMPLEMENTADO

---

## ✅ Seguridad y despliegue (Completado 2025-11-26)

### Rate Limiting ✅ IMPLEMENTADO
- [x] slowapi instalado y configurado (`core/rate_limiter.py`)
- [x] `RATE_LIMIT_DEFAULT=100/minute` configurable via env
- [x] Decoradores aplicados en endpoints críticos:
  - `POST /auth/login` - 5/minute
  - `POST /auth/token` - 5/minute
  - `POST /auth/refresh` - 10/minute
  - `POST /auth/logout` - 10/minute

### CORS ✅ IMPLEMENTADO
- [x] CORSMiddleware configurado (`main.py:49-65`)
- [x] `CORS_ORIGINS` configurable via env
- [x] Methods restringidos: GET, POST, PUT, DELETE, PATCH, OPTIONS
- [x] Headers restringidos: Authorization, Content-Type, X-Device-Key, etc.
- [x] En desarrollo permite "*", en producción solo orígenes explícitos

### Refresh Tokens ✅ IMPLEMENTADO
- [x] Tokens con expiración configurable (7 días default)
- [x] Rotación implementada en `auth_service.py:32-43`
- [x] Blacklist con Redis backend + fallback memoria (`core/token_blacklist.py`)
- [x] Endpoint `POST /auth/logout` para revocar tokens
- [x] Tests para blacklist (10 tests en `test_token_blacklist.py`)

### Device Keys ⚠️ PARCIAL
- [x] Autenticación via `X-Device-Key` header (`deps.py:100-103`)
- [x] Validación en producción de key no-default
- [ ] Keys individuales por kiosco (actualmente compartida)
- [ ] Rotación automática de keys

### MFA ❌ NO IMPLEMENTADO (Opcional)
- [ ] TOTP/Authenticator para staff
- [ ] Códigos de verificación email/SMS

### Documentación Despliegue ✅ IMPLEMENTADO
- [x] Dockerfile multi-stage con healthcheck
- [x] `scripts/build_and_push.sh` para registry
- [x] `scripts/provision_kiosk.sh` para dispositivos
- [x] `.env.example` completo con todas las variables
- [x] `docs/deployment.md` - Guía completa de producción
- [x] docker-compose.yml con worker + scheduler

### Monolith Deployment ✅ IMPLEMENTADO
- [x] FastAPI sirve los 3 frontends como estáticos:
  - `/kiosk/` → Kiosk App
  - `/teacher/` → Teacher PWA
  - `/app/` → Web App (Director/Parent)
- [x] Una sola imagen Docker para todo
- [x] Worker y Scheduler como servicios separados (misma imagen)

### Staging Environment ❌ NO IMPLEMENTADO
- [ ] `.env.staging` y compose separado
- [ ] CI/CD workflow para staging

### Monitoring/Alerting ⚠️ PARCIAL
- [x] Health endpoints: `/health`, `/healthz`
- [x] Logging con loguru + structlog (`core/logging.py`)
- [x] RQ Dashboard (profile dev/debug)
- [ ] Sentry para error tracking
- [ ] Prometheus metrics

---

## Deuda técnica

| Item | Impacto | Prioridad |
|------|---------|-----------|
| Frontends sin framework (Vanilla JS) | Alto - difícil mantener | Baja (migración costosa) |
| Sin TypeScript en frontend | Medio - errores en runtime | Baja |
| Mock data duplicada en 3 carpetas | Bajo | Baja |
| API docs (OpenAPI) incompletos | Medio | Media |
| Sin ADRs (Architecture Decision Records) | Bajo | Baja |

---

## Métricas de éxito

| Métrica | Actual | Meta Fase 3 | Meta Final |
|---------|--------|-------------|------------|
| Bugs críticos | 0 | 0 | 0 |
| Test coverage backend | **81%** ✅ | 70% | 85% |
| Test coverage frontend | **~60%** ✅ | 50% | 70% |
| Vulnerabilidades conocidas | 0 | 0 | 0 |
| Tests totales | **353** (281 backend + 72 E2E) | 300+ ✅ | 350+ ✅ |

---

## Dependencias entre fases

```
Fase 1 ──✅──► Fase 2 ──✅──► Fase 3 ──✅──► Fase 3.2 ──✅──► Fase 4 ──✅──► Seguridad ──✅
                                                                              │
                                                                              ├─ Rate Limiting ✅
                                                                              ├─ CORS ✅
                                                                              ├─ Token Blacklist ✅
                                                                              ├─ Monolith Deploy ✅
                                                                              └─ Docs ✅
```

**Estado:** Todas las fases principales completadas. Listo para producción.

---

## Backlog (Mejoras Opcionales)

| # | Feature | Prioridad | Complejidad | Descripción |
|---|---------|-----------|-------------|-------------|
| 1 | **Sentry** | Media | Baja | Error tracking en producción, alertas automáticas |
| 2 | **Staging environment** | Media | Baja | `.env.staging`, compose separado, CI/CD workflow |
| 3 | **Modo oscuro (Teacher PWA)** | Baja | Baja | CSS variables + toggle + `prefers-color-scheme` |
| 4 | **Device keys individuales** | Media | Media | Cada kiosco con su propia API key + rotación |
| 5 | **Prometheus metrics** | Baja | Media | Métricas de latencia, requests, errores |
| 6 | **MFA para staff** | Baja | Alta | TOTP/Authenticator para directores |
| 7 | **Push notifications (Teacher PWA)** | Baja | Alta | Web Push API para alertas de no-ingreso |

### Descripción detallada

#### 1. Sentry (Error Tracking)
- Integrar `sentry-sdk` en FastAPI
- Captura automática de excepciones
- Alertas por email/Slack en errores críticos
- Dashboard de issues en producción

#### 2. Staging Environment
- Archivo `.env.staging` con configuración intermedia
- `docker-compose.staging.yml` separado
- GitHub Actions workflow para deploy a staging
- Base de datos separada para QA

#### 3. Modo Oscuro (Teacher PWA)
- Variables CSS para colores (`:root` y `[data-theme="dark"]`)
- Toggle en settings con persistencia en localStorage
- Soporte `prefers-color-scheme` para auto-detección
- ~50 líneas de CSS adicionales

#### 4. Device Keys Individuales
- Tabla `device_keys` en DB (device_id, api_key, created_at, revoked_at)
- Endpoint `POST /api/v1/devices/provision` para generar keys
- Validación por device_id en lugar de key global
- Endpoint para revocar keys específicas

#### 5. Prometheus Metrics
- Endpoint `/metrics` con métricas Prometheus
- Métricas: request_count, request_latency, error_count
- Histogramas por endpoint
- Integración con Grafana (opcional)

#### 6. MFA para Staff
- Librería `pyotp` para TOTP
- Tabla `user_mfa` (user_id, secret, enabled)
- Flujo de activación con QR code
- Verificación en login para roles director/inspector

#### 7. Push Notifications (Teacher PWA)
- Service Worker con push event listener
- Endpoint `POST /api/v1/push/subscribe`
- Integración con Web Push API (VAPID keys)
- Notificaciones automáticas en alertas de no-ingreso

---

_Última actualización: 2025-11-26_
_Próxima revisión: Según necesidades de producción_
