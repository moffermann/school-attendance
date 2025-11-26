# School Attendance – Roadmap (Actualizado 2025-11-26)

## Estado actual

### Backend FastAPI
- Portal SPA montado sobre FastAPI con autenticación por sesión (`/api/v1/auth/session`)
- Bootstrap real (`/api/v1/web-app/bootstrap`) y vistas conectadas
- Métricas operativas: dashboard, reportes por curso/tendencia, alertas de no ingreso
- Validación de secrets en producción (`config.py:55-63`)
- Protección contra SQL injection en búsquedas (`dashboard_service.py:262-274`)
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
- ✅ API client con refresh token automático
- ✅ IndexedDB para almacenamiento offline
- ⚠️ Sync aún en modo simulado (no conecta backend real)

### Web App (Director Dashboard)
- SPA con vistas: dashboard, reportes, dispositivos, alertas, horarios, ausencias
- Export CSV en reportes y alertas
- ⚠️ Falta función `escapeHtml()` en componentes

---

## Bugs conocidos

### Críticos (Prioridad Alta)
| # | Componente | Archivo | Descripción |
|---|------------|---------|-------------|
| B1 | Backend | `app/api/v1/attendance.py:42-56` | Upload de fotos sin validación MIME/size/extension |
| B2 | Web App | `src/web-app/js/components.js` | XSS potencial - falta `escapeHtml()` |
| B3 | Teacher PWA | `src/teacher-pwa/js/sync.js` | Sync simulado, no conecta con backend real |
| B4 | Kiosk | `src/kiosk-app/tests/e2e/*.spec.js` | Tests E2E desactualizados para nueva UI |

### Medios
| # | Componente | Archivo | Descripción |
|---|------------|---------|-------------|
| B5 | Kiosk | `src/kiosk-app/js/views/home.js:505-513` | Memory leak - event listener no removido |
| B6 | Teacher PWA | `src/teacher-pwa/js/views/alerts.js:52-53` | Hora 8:00 AM hardcodeada |
| B7 | Teacher PWA | `src/teacher-pwa/js/views/history.js:24` | Inconsistencia campo `ts` vs `occurred_at` |

---

## Fase 1: Estabilización (Prioridad Alta)

### 1.1 Seguridad Backend
- [ ] B1: Validar uploads (MIME types permitidos, max 10MB, extensiones whitelist)
- [ ] Agregar rate limiting efectivo (slowapi o similar)
- [ ] CORS restrictivo en producción

### 1.2 Seguridad Frontend
- [ ] B2: Crear y usar `escapeHtml()` en `web-app/components.js`
- [ ] Validar tokens contra backend en cada navegación (no solo localStorage)

### 1.3 Bugs de Código
- [ ] B5: Corregir memory leak en kiosk home.js
- [ ] B6: Hacer configurable hora de inicio de clases
- [ ] B7: Unificar campo de timestamp en teacher-pwa

---

## Fase 2: Integración PWA Profesores (Prioridad Alta)

### 2.1 Backend - Endpoints Docentes
- [ ] Verificar/completar `GET /api/v1/teachers/me`
- [ ] Verificar/completar `GET /api/v1/teachers/courses/{id}/students`
- [ ] Implementar `POST /api/v1/teachers/attendance/bulk` para sync masivo

### 2.2 Teacher PWA - Conexión Real
- [ ] B3: Reemplazar sync simulado con llamadas a API real
- [ ] Implementar autenticación JWT completa
- [ ] Manejo offline/online con reconciliación de conflictos
- [ ] Indicador de estado de conexión visible

---

## Fase 3: Test Coverage (Prioridad Media)

### 3.1 Backend
- [ ] Tests unitarios para repositories (12 archivos, 0% actual)
- [ ] Tests de integración para API endpoints faltantes
- [ ] Meta: 70%+ coverage

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
| Bugs críticos | 4 | 0 | 0 |
| Test coverage backend | ~40% | 70% | 85% |
| Test coverage frontend | ~15% | 50% | 70% |
| Vulnerabilidades conocidas | 2 | 0 | 0 |

---

## Dependencias entre fases

```
Fase 1 (Estabilización) ───► Fase 3 (Tests) ───► Fase 4 (Features)
         │                         │
         └────► Fase 2 (PWA) ──────┘
```

**Nota:** Fase 1 y 2 pueden ejecutarse en paralelo. Fase 3 requiere que bugs críticos estén resueltos.

---

_Última actualización: 2025-11-26_
_Próxima revisión: Al completar Fase 1_
