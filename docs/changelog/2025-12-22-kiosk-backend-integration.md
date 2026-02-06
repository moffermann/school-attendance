# 2025-12-22: Integración Kiosko-Backend y Corrección de Brechas Críticas

## Resumen

Sesión enfocada en cerrar las brechas críticas identificadas en el plan de corrección:
- **Brecha #1**: Kiosko desconectado del backend (ahora sincroniza correctamente)
- **Brecha #2**: Enrolamiento NFC/QR no guardaba tokens en DB (ahora conectado al backend)

Se realizó testing E2E exitoso con kiosko móvil conectando a servidor local via túneles (ngrok + cloudflare).

## Cambios Realizados

### Backend

#### `app/core/tenant_middleware.py`
- **CRÍTICO**: Agregado método `_has_valid_device_key()` para validar X-Device-Key
- Modificado `_resolve_tenant()` para aceptar header X-Tenant-ID cuando:
  - Request tiene token super_admin, O
  - Request tiene X-Device-Key válido (para kioscos)
- Esto permite a kioscos especificar tenant en deployments multi-tenant

#### `app/main.py`
- Agregado `X-Tenant-ID` a lista de headers CORS permitidos
- Solucionó error "Failed to fetch" en móvil por preflight CORS bloqueado

#### `app/api/v1/tags.py`
- Mejoras en endpoints de provisión de tags

#### `app/db/repositories/tags.py`
- Agregado `find_pending_by_student()` para buscar tags pendientes
- Soporte para flujo de confirmación de tags

#### `app/services/tag_provision_service.py`
- Mejoras en lógica de provisión y confirmación de tags

### Frontend Kiosko

#### `src/kiosk-app/js/sync.js`
- Agregado método `getHeaders()` con soporte para X-Tenant-ID
- Refactorizado `syncBootstrap()` para usar headers comunes
- Limpiados mensajes de debug (toasts temporales removidos)

#### `src/kiosk-app/js/state.js`
- Mejorado `resolveByToken()` para manejar formatos de token del backend
- Agregado `updateTags()` para sincronización incremental

#### `src/kiosk-app/js/views/home.js`
- Limpiados mensajes de debug del escaneo QR
- Restaurado mensaje de error estándar para tokens inválidos

#### `src/kiosk-app/data/config.json`
- Configurado `apiBaseUrl` para túnel cloudflare
- Configurado `tenantId: "1"` para multi-tenant
- Aumentado `autoResumeDelay` de 5000 a 8000ms (pantalla de resultado visible 8 segundos)

#### `src/kiosk-app/service-worker.js`
- Actualizado cache a v10 para reflejar cambios
- Agregados archivos de biometric auth al cache

#### `src/kiosk-app/index.html`
- Agregados scripts de vistas biométricas

### Frontend Web-App

#### `src/web-app/js/api.js`
- Agregados métodos `provisionTag()`, `confirmTag()`, `revokeTag()`
- Conecta enrolamiento NFC/QR con backend real

#### `src/web-app/js/nfc-enrollment.js`
- Refactorizado para usar API de backend en lugar de generación local
- Agregado `provisionToken()` que llama a `/tags/provision`
- Modificado `_startWriteProcess()` para confirmar tag después de escribir
- Implementado sistema de reintentos con `pendingTagConfirmations` en localStorage
- Agregado `retryPendingConfirmations()` para recuperación automática

#### `src/web-app/js/qr-enrollment.js`
- Refactorizado para usar API de backend
- Flujo similar a NFC: provision → generate QR → confirm

### Configuración

#### `.env`
- Agregado `DEFAULT_TENANT_SLUG=demo_local` como fallback para desarrollo

## Testing E2E Realizado

### Configuración de Túneles
- **ngrok** (puerto 8044): Kiosko accesible desde móvil
- **cloudflared** (puerto 8083): API accesible desde móvil

### Flujo Probado
1. ✅ Kiosko en móvil sincroniza 68 tags desde backend
2. ✅ Escaneo de QR identifica estudiante correctamente
3. ✅ Evento de asistencia se registra en base de datos
4. ✅ Pantalla de resultado muestra datos del estudiante

### Verificación en Base de Datos
```sql
-- Evento registrado correctamente
SELECT id, student_id, type, device_id, occurred_at
FROM tenant_demo_local.attendance_events
ORDER BY id DESC LIMIT 1;

-- Resultado:
-- 6674 | 23 | IN | DEV-01 | 2025-12-22 19:11:38
```

## Corrección de NFC - Activación por Usuario

### Problema
El kiosko intentaba iniciar NFC automáticamente al cargar la página, mostrando "Reintentando NFC..." 3 veces y luego "NFC no disponible".

### Causa
Web NFC API requiere "transient user activation" (gesto del usuario) antes de poder llamar a `NDEFReader.scan()`. La activación automática viola esta restricción de seguridad del navegador.

### Solución Implementada

#### `src/kiosk-app/js/views/home.js`
- Cambiado NFC de auto-activación a **activación por botón**
- Agregado botón visible "📱 Toca para activar NFC" sobre el visor de cámara
- El botón usa `addEventListener('click', activateNFC)` en lugar de inline onclick
- Flujo: Usuario toca botón → Navegador pide permisos → NFC activado → "Esperando tarjeta..."

#### `src/kiosk-app/css/styles.css`
- Agregados estilos para estado `.nfc-tap-to-activate`:
  - Fondo azul con borde punteado
  - Animación de pulse ring
  - Estados hover/focus/active para feedback visual
- **CRÍTICO**: Agregado `pointer-events: auto` al botón NFC
  - El `.qr-overlay` tiene `pointer-events: none` para que clicks pasen al video
  - Sin este fix, el botón no recibía clicks

#### `src/kiosk-app/service-worker.js`
- Cache actualizado a v13

### Testing
- ✅ Botón NFC visible y clickeable en móvil
- ✅ Al tocar, navegador pide permisos de NFC
- ✅ Después de autorizar, NFC queda en modo lectura
- ✅ QR sigue funcionando en paralelo

## Problemas Resueltos

| Problema | Causa | Solución |
|----------|-------|----------|
| Kiosko mostraba 24 tags en vez de 68 | TenantMiddleware rechazaba X-Tenant-ID sin super_admin | Agregado `_has_valid_device_key()` |
| "Failed to fetch" en móvil | CORS bloqueaba header X-Tenant-ID | Agregado a `allowed_headers` |
| Pantalla de resultado muy rápida | `autoResumeDelay` era 5 segundos | Aumentado a 8 segundos |
| NFC mostraba "Reintentando" 3 veces | Web NFC requiere user gesture | Cambiado a botón de activación |
| Botón NFC no respondía a clicks | `pointer-events: none` en overlay padre | Agregado `pointer-events: auto` al botón |

## Archivos Modificados

```
14 files changed, 605 insertions(+), 92 deletions(-)
```

## Próximos Pasos Pendientes

1. Implementar registro de dispositivos con keys únicas (mejora de seguridad)
2. Limpieza automática de tags PENDING expirados (backend)
3. Testing de enrolamiento NFC completo (provision → write → confirm)
4. Configurar config.json para producción (URL real, sin tenantId hardcodeado)
