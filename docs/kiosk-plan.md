# Plan de Trabajo Kiosk-App

**Fecha:** 2025-11-26
**Rama actual:** feature/nfc-reading

---

## Estado Actual

El rediseño v2.0 del kiosk está casi completo. **Fase 1 completada** - todos los bugs críticos han sido resueltos con cobertura de tests E2E.

---

## BUGS Y PROBLEMAS IDENTIFICADOS

### Críticos (Fase 1)

| # | Bug | Archivo | Descripción |
|---|-----|---------|-------------|
| 1 | Service Worker desactualizado | `service-worker.js` | No incluye `admin_panel.js`, `teachers.json` |
| 2 | Flujo duplicado scan.js | `scan.js` | Usa `resolveStudentByToken()` obsoleto, no detecta profesores |
| 3 | Generación aleatoria incluye profesores | `scan.js:71-74` | Debería filtrar solo student_id |
| 4 | schoolName hardcodeado | `scan_result.js` | No usa `State.config.schoolName` |
| 5 | Ayuda desactualizada | `help.js` | No menciona tokens de profesores ni panel admin |

### Mejoras Necesarias (Fase 2-3)

| # | Mejora | Archivo | Descripción |
|---|--------|---------|-------------|
| 6 | Sin debounce | `home.js` | Scans duplicados si QR/NFC se lee múltiples veces |
| 7 | Sin timeout admin | `admin_panel.js` | Panel admin queda accesible indefinidamente |
| 8 | Sin feedback sonoro | `home.js` | Falta beep al escanear exitosamente |
| 9 | Sin vibración | `home.js` | Falta vibración en móviles |
| 10 | Manejo errores NFC | `home.js` | Solo muestra toast, sin reintentos |

---

## PLAN DE ACCIÓN

### FASE 1: Estabilización (Bugs Críticos)
**Estado:** ✅ COMPLETADA

- [x] 1.1 Actualizar `service-worker.js` para incluir archivos nuevos (commit: f437b9e)
- [x] 1.2 Unificar `scan.js` para usar `resolveByToken()` y detectar profesores (commit: b47c91c)
- [x] 1.3 Filtrar solo `student_id` en generación aleatoria de `scan.js` (commit: b47c91c)
- [x] 1.4 Usar `State.config.schoolName` en `scan_result.js` (commit: 8c9b275)
- [x] 1.5 Actualizar `help.js` con información de profesores y panel admin (commit: c405ef8)

**Tests agregados:**
- `service-worker-consistency.test.js` - valida consistencia de cache SW
- `service-worker.spec.js` - 5 tests E2E de funcionamiento offline
- `scan-view.spec.js` - 6 tests E2E de detección tokens
- `scan-result.spec.js` - 7 tests E2E de vista de resultado
- `help-view.spec.js` - 6 tests E2E de documentación

### FASE 2: Completar Feature NFC
**Estado:** ✅ COMPLETADA

- [x] 2.1 Agregar debounce anti-duplicados (500ms entre scans) (commit: f19d2ba)
- [x] 2.2 Agregar feedback sonoro (beep 880Hz) al escanear (commit: f19d2ba)
- [x] 2.3 Agregar vibración en dispositivos móviles (100ms) (commit: f19d2ba)
- [x] 2.4 Implementar timeout de sesión para panel admin (5 min) (commit: f19d2ba)

**Tests agregados:**
- `admin-timeout.spec.js` - 3 tests E2E de timeout
- `home-ux.spec.js` - 1 test E2E de UX

### FASE 3: Mejoras de UX
**Estado:** Pendiente

- [ ] 3.1 Indicador visual de "leyendo NFC..." más prominente
- [ ] 3.2 Mejorar manejo de errores NFC con reintentos automáticos
- [ ] 3.3 Auto-resume del escaneo después de mostrar resultado (configurable)

### FASE 4: Integración con Backend Real
**Estado:** Pendiente

- [ ] 4.1 Reemplazar `Sync.simulateSync()` con llamadas reales a API
- [ ] 4.2 Conectar con `POST /api/v1/attendance/events`
- [ ] 4.3 Implementar captura de foto real
- [ ] 4.4 Subida de fotos con `/events/{id}/photo`

---

## INCONSISTENCIAS DE DATOS

| Archivo | Problema | Acción sugerida |
|---------|----------|-----------------|
| `students.json` | 60 estudiantes, solo 20 tienen tags | Agregar más tags o documentar |
| `tags.json` | 24 tags total | OK |
| `help.js` | Menciona tokens incorrectos | Corregir en Fase 1 |

---

## HISTORIAL DE COMMITS

### 2025-11-26 - Soporte NFC en home.js
- Implementación de Web NFC API
- Status bar mostrando estado NFC/QR
- Source tracking (NFC vs QR) en eventos
- Estilos para indicadores de estado

---

## NOTAS TÉCNICAS

### Web NFC API
- Solo funciona en Chrome Android (HTTPS requerido)
- `NDEFReader` no tiene método `stop()`, se libera con `null`
- Soporta lectura de registros NDEF tipo texto y URL

### Compatibilidad NFC
- Chrome Android 89+: ✅
- Chrome Desktop: ❌
- Firefox: ❌
- Safari: ❌

### Fallback
- Si NFC no está disponible, la UI muestra "NFC No disponible"
- QR scanning funciona como fallback principal
- Input manual disponible si la cámara falla

---

_Última actualización: 2025-11-26 - Fase 1 y 2 completadas_
