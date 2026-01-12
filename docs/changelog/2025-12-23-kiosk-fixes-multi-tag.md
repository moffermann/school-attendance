# 2025-12-23: Correcciones Kiosco y Soporte Multi-Tag

## Resumen

Sesión enfocada en resolver bugs críticos del kiosco y cambio de política de tags:
- **Bug crítico**: Pantalla blanca después de escaneo NFC/QR (corregido)
- **Bug**: Kiosco se quedaba en "Cargando..." indefinidamente (corregido)
- **Bug**: `autoResumeDelay` no se leía correctamente de config (corregido)
- **Cambio de política**: Múltiples tags activos por estudiante (QR, NFC, Biométrico coexisten)

## Cambios Realizados

### Backend

#### `app/services/tag_provision_service.py`
- **[BREAKING CHANGE]** Removida auto-revocación de tags al enrollar uno nuevo
- Anteriormente: Enrollar NFC revocaba automáticamente el QR existente
- Ahora: QR, NFC y Biométrico pueden estar activos simultáneamente
- Validado con PM: Comportamiento esperado es que todos los métodos coexistan

```python
# Antes (líneas 34-37):
revoked_count = await self.repository.revoke_active_for_student(payload.student_id)
if revoked_count > 0:
    logger.info(f"Auto-revoked {revoked_count} active tag(s)...")

# Después:
# Note: Multiple active tags allowed per student (QR, NFC, Biometric can coexist)
```

### Frontend Kiosco

#### `src/kiosk-app/css/styles.css`
- **FIX CRÍTICO**: Animación `.capture-flash` no se ocultaba en móviles
- Causa: Sin `animation-fill-mode: forwards`, el elemento volvía a `opacity: 1` después de la animación
- Solución: Agregado `forwards` y `opacity: 0` por defecto

```css
/* Antes */
.capture-flash {
  animation: flash 0.3s ease-out;
}

/* Después */
.capture-flash {
  animation: flash 0.3s ease-out forwards;
  opacity: 0;
}
```

#### `src/kiosk-app/js/views/home.js`
- **FIX**: `AUTO_RESUME_MS` se leía antes de que `State.config` estuviera cargado
- Causa: Constante definida a nivel de módulo, ejecutada antes de `State.init()`
- Solución: Leer valor en tiempo de ejecución dentro de `renderResult()`

```javascript
// Antes (línea 25):
const AUTO_RESUME_MS = State.config.autoResumeDelay || 5000; // Siempre 5000

// Después (dentro de renderResult):
const AUTO_RESUME_VALUE = State.config.autoResumeDelay || 5000; // Lee valor real
```

- Removido código de debug temporal (MutationObserver, debugLog calls)

#### `src/kiosk-app/index.html`
- **FIX**: Kiosco se quedaba en "Cargando..." indefinidamente
- Causa: `syncBootstrap()` esperaba respuesta del servidor sin límite de tiempo
- Solución: Agregado timeout de 10 segundos con `Promise.race()`

```javascript
const syncPromise = Sync.syncBootstrap();
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Sync timeout')), 10000)
);
await Promise.race([syncPromise, timeoutPromise]);
```

- Removido debug overlay temporal (botón DBG y panel verde)

#### `src/kiosk-app/service-worker.js`
- Cache actualizado de v18 a v20

## Debugging Mobile

### Problema
No era posible ver la consola del navegador en Chrome móvil para diagnosticar el bug de pantalla blanca.

### Solución Temporal
Agregado debug overlay visual:
- Botón "DBG" en esquina inferior derecha
- Panel verde con logs timestamped
- `window.debugLog()` para capturar mensajes

### Hallazgos del Debug
```
[9:54:22] renderResult: Agustín Bustos, delay=8000ms
[9:54:22] startCountdown: 8000ms
[9:54:22] DOM CLEARED! removed 3 nodes  ← Sospechoso
[9:54:23] tick: 7000ms left
[9:54:23] DOM CLEARED! removed 1 nodes  ← CSS capture-flash
...
[9:54:30] timeout fired -> resumeScan
```

El countdown funcionaba correctamente (8 segundos), pero el usuario veía pantalla blanca. El elemento `.capture-flash` no se ocultaba después de la animación.

### Cleanup
Debug overlay y logs removidos después de resolver el issue.

## Problemas Resueltos

| Problema | Causa | Solución |
|----------|-------|----------|
| Pantalla blanca después de scan | `.capture-flash` sin `animation-fill-mode: forwards` | Agregado `forwards` y `opacity: 0` |
| `autoResumeDelay` siempre 5000ms | Constante leída antes de `State.init()` | Leer en runtime dentro de `renderResult()` |
| Kiosco en "Cargando..." infinito | `syncBootstrap()` sin timeout | Agregado timeout 10s con `Promise.race()` |
| QR revocado al enrollar NFC | Auto-revocación en `provision()` | Removida lógica de auto-revocación |

## Documentación

### `docs/manual_usuario.md`
- Agregada nueva sección **7.3 Política de Múltiples Credenciales**
  - Explica que QR, NFC y Biométrico pueden coexistir
  - Tabla de escenarios y soluciones
  - Recomendación de enrollar al menos 2 métodos
  - Nota para administradores sobre revocación individual
- Actualizada FAQ sobre tarjetas perdidas para mencionar multi-tag

## Archivos Modificados

```
5 files changed
- app/services/tag_provision_service.py
- src/kiosk-app/css/styles.css
- src/kiosk-app/js/views/home.js
- src/kiosk-app/index.html
- src/kiosk-app/service-worker.js (cache version)
- docs/manual_usuario.md
```

## Testing Realizado

### Kiosco - Flujo de Escaneo
- ✅ Escaneo NFC muestra pantalla de bienvenida durante 8 segundos completos
- ✅ Sin pantalla blanca intermedia
- ✅ Countdown visual funciona correctamente
- ✅ Auto-resume regresa a cámara después del delay

### Multi-Tag
- ✅ Enrollar NFC no revoca QR existente
- ✅ Estudiante puede tener QR y NFC activos simultáneamente
- ✅ Ambos métodos funcionan en el kiosco

### Inicialización
- ✅ Kiosco no se queda en "Cargando..." aunque el servidor no responda
- ✅ Timeout de 10s permite continuar con datos locales

## Próximos Pasos

1. Re-enrollar QR de Agustín Bustos (fue revocado antes del fix)
2. Testing E2E con múltiples estudiantes usando QR y NFC
3. ~~Documentar política de multi-tag en manual de usuario~~ ✅ Completado
