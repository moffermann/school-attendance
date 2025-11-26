# Plan de Actualización del Roadmap - School Attendance

## Resumen del Análisis

Después de revisar completamente el proyecto, he identificado los siguientes hallazgos:

---

## Estado Actual vs Roadmap Existente

### Ya Completados (marcar como ✅ en roadmap)

1. **Kiosk App - Integración Real**
   - ✅ `sync.js` ya integra con backend FastAPI real
   - ✅ Soporte para `X-Device-Key` authentication
   - ✅ Upload de fotos implementado
   - ✅ Mode fallback simulado cuando no hay deviceKey
   - ✅ i18n multi-idioma implementado

2. **Backend - Seguridad Mejorada**
   - ✅ `config.py:17-53` - Ya tiene validación de secrets en producción
   - ✅ `dashboard_service.py:262-274` - SQL injection ya corregido con `_sanitize_search_query()`
   - ✅ Rate limiting config preparado (`rate_limit_default` en config)

3. **Teacher PWA - Features Implementadas**
   - ✅ Vista `history.js` - Historial con filtros por fecha/tipo
   - ✅ Vista `alerts.js` - Alertas de no ingreso con acciones
   - ✅ API client completo con refresh token

4. **Tests Backend**
   - ✅ 750+ líneas en `test_services.py`
   - ✅ Tests de servicios principales
   - ✅ Tests de auth/session

---

## Bugs y Mejoras Pendientes

### Bugs Críticos (ALTA PRIORIDAD)

| # | Componente | Archivo | Bug | Estado |
|---|------------|---------|-----|--------|
| B1 | Backend | `app/api/v1/attendance.py:42-56` | Upload sin validación MIME/size | PENDIENTE |
| B2 | Web App | `src/web-app/js/components.js` | XSS en `showToast()` y `showModal()` | PARCIAL (teacher-pwa tiene escapeHtml) |
| B3 | Teacher PWA | `src/teacher-pwa/js/sync.js` | Sync simulado, no usa API real | PENDIENTE |
| B4 | Kiosk | `src/kiosk-app/tests/e2e/home-ux.spec.js` | Test desactualizado - busca selectores viejos | PENDIENTE |

### Bugs Medios

| # | Componente | Archivo | Bug |
|---|------------|---------|-----|
| B5 | Kiosk | `home.js:505-513` | Memory leak - event listener no se remueve si no hay hashchange |
| B6 | Teacher PWA | `alerts.js:52-53` | Hora fija de 8:00 AM hardcodeada |
| B7 | Teacher PWA | `history.js:24` | Usa `e.ts` pero events usan `occurred_at` |

### Mejoras Técnicas

| # | Área | Descripción | Prioridad |
|---|------|-------------|-----------|
| M1 | Tests | Kiosk E2E tests desactualizados para nueva UI | ALTA |
| M2 | Tests | Teacher PWA sin tests E2E | ALTA |
| M3 | Tests | Web App sin tests | MEDIA |
| M4 | Backend | Repositories sin tests unitarios | MEDIA |
| M5 | DevOps | Sin staging environment | BAJA |

---

## Actualización Propuesta del Roadmap

### Fase Actual: Estabilización (En Progreso)

**Completar:**
1. [ ] Validación de uploads en `attendance.py` (MIME, size)
2. [ ] Implementar `escapeHtml()` en web-app/components.js
3. [ ] Conectar teacher-pwa sync.js con backend real
4. [ ] Actualizar tests E2E de kiosk para nueva UI

### Próxima Fase: Integración Completa

**Teacher PWA → Backend:**
1. [ ] Reemplazar sync simulado con API real
2. [ ] Implementar endpoints de profesor:
   - `/api/v1/teachers/me` (ya existe)
   - `/api/v1/teachers/courses/{id}/students` (ya existe)
   - `/api/v1/teachers/attendance/bulk` (falta implementar)
3. [ ] Manejo offline/online con reconciliación real

**Web App:**
1. [ ] Validar sesión contra backend (no solo localStorage)
2. [ ] Completar role-based access control

### Fase de Testing

1. [ ] Tests E2E para teacher-pwa (Playwright)
2. [ ] Tests E2E para web-app (Playwright)
3. [ ] Tests unitarios para repositories
4. [ ] Aumentar coverage a 70%+

### Features Nuevos (Backlog)

1. [ ] Reportes PDF semanales
2. [ ] Métricas extendidas de notificaciones
3. [ ] Biometric integration (futuro)
4. [ ] NFC real con hardware

---

## Resumen de Cambios para roadmap.md

1. **Actualizar "Estado actual"** - Reflejar integraciones completadas
2. **Mover items completados** - Kiosk provisioning, alertas, historial PWA
3. **Agregar "Bugs conocidos"** - Sección nueva con los bugs identificados
4. **Reorganizar fases** - Priorizar estabilización sobre features nuevos
5. **Actualizar "Próximas entregas"** - Enfocarse en integración real de PWAs

---

## Archivos a Modificar

- `docs/roadmap.md` - Actualización completa del roadmap
- Considerar deprecar `docs/roadmap-2025-11.md` o fusionarlo

