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

## Fase 3: Test Coverage (Prioridad Alta)

### 3.1 Backend
- [ ] Tests unitarios para repositories (algunos ya existen en `test_repositories.py`)
- [ ] Tests de integración para API endpoints faltantes
- [ ] Meta: 70%+ coverage (actual: ~40%)

### 3.2 Frontend
- [ ] B4: Actualizar tests E2E de kiosk para nueva UI
- [ ] Crear tests E2E para teacher-pwa (Playwright)
- [ ] Crear tests E2E para web-app (Playwright)
- [ ] Meta: 50%+ coverage

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
| Test coverage backend | ~45% | 70% | 85% |
| Test coverage frontend | ~15% | 50% | 70% |
| Vulnerabilidades conocidas | 0 | 0 | 0 |

---

## Dependencias entre fases

```
Fase 1 (Estabilización) ──✅──► Fase 3 (Tests) ───► Fase 4 (Features)
         │                           │
         └──✅── Fase 2 (PWA) ───────┘
```

**Estado:** Fases 1 y 2 completadas. Próximo paso: Fase 3 (Tests).

---

_Última actualización: 2025-11-26_
_Próxima revisión: Al completar Fase 3_
