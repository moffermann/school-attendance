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

## Fase 4: Features Nuevos (Backlog)

### Portal Web
- [ ] Métricas extendidas de ausencias (bandeja con filtros, KPIs)
- [ ] Métricas de notificaciones por canal/plantilla
- [ ] Bitácora de broadcast con export CSV
- [ ] Reportes PDF semanales
- [ ] Estados vacíos/errores coherentes en todas las vistas

### Kiosk
- [ ] Captura de foto real (actualmente placeholder)
- [ ] Integración con hardware NFC (vs Web NFC)
- [ ] Soporte offline mejorado (Service Worker)

### PWA Profesores
- [ ] Escaneo QR para toma rápida de asistencia
- [ ] Notificaciones push para alertas
- [ ] Modo oscuro

---

## Seguridad y despliegue

- [ ] Agregar rate limiting efectivo (slowapi)
- [ ] CORS restrictivo en producción
- [ ] Fortalecer refresh tokens (rotación, revocación)
- [ ] Device keys individuales por kiosco con rotación
- [ ] MFA para staff (opcional)
- [ ] Documentar despliegue producción (env vars, S3, Redis/RQ, scheduler)
- [ ] Configurar staging environment
- [ ] Monitoring/Alerting básico

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
| Test coverage backend | **80%** ✅ | 70% | 85% |
| Test coverage frontend | **~60%** ✅ | 50% | 70% |
| Vulnerabilidades conocidas | 0 | 0 | 0 |
| Tests totales | **343** (271 backend + 72 E2E) | 300+ ✅ | 350+ |

---

## Dependencias entre fases

```
Fase 1 (Estabilización) ──✅──► Fase 3 Backend (Tests) ──✅──► Fase 3.2 Frontend ─(parcial)─► Fase 4 (Features)
         │                              │                         │
         └──✅── Fase 2 (PWA) ──────────┘                         ├─ Kiosk ✅ (28 tests)
                                                                  ├─ Teacher-PWA ⏳
                                                                  └─ Web-App ⏳
```

**Estado:** Fases 1, 2 y 3-Backend completadas. Fase 3.2-Kiosk completada (28 tests E2E).
Próximo paso: Completar Fase 3.2 (E2E para teacher-pwa/web-app) o iniciar Fase 4 (Features).

---

_Última actualización: 2025-11-26_
_Próxima revisión: Al completar Fase 3.2 (Frontend E2E)_
