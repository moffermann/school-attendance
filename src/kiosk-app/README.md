# Kiosk App - Totem de Acceso Escolar

Aplicacion de kiosco tactil para registro de ingreso/salida escolar con soporte para NFC, QR y biometria.

## Estado Actual

| Componente | Estado | Descripcion |
|------------|--------|-------------|
| **Camara QR** | Funcional | Escaneo real con jsQR library |
| **NFC** | Funcional | Web NFC API (requiere gesto de usuario) |
| **Biometria** | Funcional | WebAuthn/FIDO2 completo con API backend |
| **Sincronizacion** | Funcional | Cola offline + sync con backend |
| **Multi-tenant** | Funcional | Header X-Tenant-ID para deployments |
| **Multi-dispositivo** | Funcional | Multiples kioscos por tenant con CRUD |
| **Device API Keys** | Funcional | Validacion per-tenant con fallback global |

## Caracteristicas Implementadas

### Core
- **SPA** con hash routing y Service Worker (cache v20+)
- **Offline-first** con cola de sincronizacion persistente
- **Camara QR real** usando jsQR (no simulacion)
- **NFC real** via Web NFC API (activacion por boton)
- **UI tactil** optimizada para tablets (botones >= 56px)
- **Persistencia** en `localStorage` bajo key `kioskData`
- **Sin dependencias** externas (HTML/CSS/JS vanilla)
- **Multi-idioma** (Espanol/Ingles) con 60+ claves de traduccion

### Backend Integration (desde 2025-12-22)
- Sincronizacion real con API backend
- Header `X-Device-Key` para autenticacion de dispositivos
- Header `X-Tenant-ID` para soporte multi-tenant
- Timeout de 10 segundos en bootstrap sync
- Heartbeat automatico cada 2 minutos
- **Multi-dispositivo**: Multiples kioscos por tenant soportados
- Gestion de dispositivos via panel director (CRUD completo)

### Politica Multi-Tag (desde 2025-12-23)
- Un estudiante puede tener multiples credenciales activas
- QR, NFC y Biometrico pueden coexistir simultaneamente
- Enrollar un nuevo tag NO revoca los existentes

---

## Estructura del Proyecto

```
kiosk-app/
├── index.html              # Entry point + service worker registration
├── service-worker.js       # Cache-first para estaticos, stale-while-revalidate para API
├── qr-generator.html       # Utilidad para generar codigos QR
├── README.md               # Este archivo
│
├── css/
│   └── styles.css          # Estilos tactiles + alto contraste
│
├── js/
│   ├── router.js           # Hash routing con 11 rutas
│   ├── state.js            # Estado global + localStorage
│   ├── sync.js             # Cola de eventos + API real/simulada
│   ├── ui.js               # Componentes (toast, header, chips)
│   ├── i18n.js             # Internacionalizacion ES/EN
│   ├── webauthn.js         # WebAuthn/FIDO2 biometrico
│   └── views/              # 11 pantallas
│       ├── home.js             # Scanner QR/NFC
│       ├── scan.js             # Entrada manual de token
│       ├── scan_result.js      # Confirmacion con foto/audio
│       ├── manual_entry.js     # Busqueda por nombre
│       ├── queue.js            # Cola offline (4 tabs)
│       ├── device_status.js    # Estado del dispositivo
│       ├── settings.js         # Configuracion
│       ├── help.js             # Ayuda y tokens de prueba
│       ├── admin_panel.js      # Menu profesor (5 min timeout)
│       ├── biometric_auth.js   # Autenticacion biometrica
│       └── biometric_enroll.js # Enrolamiento biometrico
│
├── data/                   # Datos de configuracion (JSON)
│   ├── config.json         # API URL, school name, settings
│   ├── device.json         # Device ID, Gate ID, status
│   ├── students.json       # Estudiantes mock
│   ├── teachers.json       # Profesores mock
│   ├── tags.json           # Mapeo token -> estudiante/profesor
│   └── queue.json          # Cola pre-populada (opcional)
│
├── assets/                 # Recursos estaticos
│   ├── logo.svg
│   ├── placeholder_photo.jpg
│   ├── qr_placeholder.svg
│   ├── nfc_placeholder.svg
│   ├── success.svg
│   ├── error.svg
│   └── camera-shutter-sound.mp3
│
└── tests/
    ├── e2e/                # 6 tests Playwright
    └── service-worker-consistency.test.js
```

---

## Pantallas (11 Vistas)

| Ruta | Vista | Estado | Descripcion |
|------|-------|--------|-------------|
| `#/home` | home.js | **Funcional** | Scanner QR con camara real + NFC con boton activacion |
| `#/scan` | scan.js | **Funcional** | Entrada manual de token (fallback) |
| `#/scan-result` | scan_result.js | **Funcional** | Confirmacion con foto y audio |
| `#/manual` | manual_entry.js | **Funcional** | Busqueda de estudiante por nombre |
| `#/queue` | queue.js | **Funcional** | Cola offline con 4 tabs |
| `#/device` | device_status.js | **Funcional** | Dashboard de estado del dispositivo |
| `#/settings` | settings.js | **Funcional** | Configuracion (Gate ID, idioma, foto) |
| `#/help` | help.js | **Funcional** | Guia de usuario y tokens de prueba |
| `#/admin` | admin_panel.js | **Funcional** | Menu profesor con timeout 5 min |
| `#/biometric-auth` | biometric_auth.js | **Funcional** | Autenticacion biometrica (Passkeys) |
| `#/biometric-enroll` | biometric_enroll.js | **Funcional** | Enrolamiento biometrico por profesor |

---

## Como Usar

### Opcion 1: Servidor local (recomendado)

```bash
cd src/kiosk-app
npx serve . -p 5174
```

Abrir: `http://localhost:5174`

### Opcion 2: Con backend real

1. Configurar `data/config.json`:
```json
{
  "deviceApiKey": "tu-device-key",
  "apiBaseUrl": "https://tu-api.com/api/v1",
  "tenantId": "1"
}
```

2. Iniciar servidor:
```bash
npx serve . -p 5174
```

### Opcion 3: Abrir directamente

Doble clic en `index.html` (funciona en navegadores modernos con limitaciones CORS).

---

## Flujo de Uso

### 1. Configuracion Inicial

Primera vez que abres la app:
- **Gate ID**: Identificador de la puerta (ej: GATE-1)
- **Device ID**: Identificador del dispositivo (ej: DEV-01)
- **Captura de foto**: ON/OFF
- **Alto contraste**: ON/OFF

### 2. Escaneo

**Camara QR (predeterminado)**:
- La camara se activa automaticamente
- Apunta un codigo QR al visor
- Debounce de 500ms previene duplicados

**NFC (requiere gesto)**:
- Toca el boton "Toca para activar NFC"
- El navegador pide permisos
- Acerca la tarjeta NFC

### 3. Confirmacion

- Muestra datos del estudiante
- Opcion de capturar foto (si habilitado)
- Opcion de grabar audio (max 10 seg)
- Seleccionar Ingreso/Salida
- Auto-resume a home despues de 8 segundos

### 4. Sincronizacion

- Automatica cada 30 segundos (si online)
- Manual desde vista Cola
- 5 eventos procesados por lote
- 15% probabilidad de fallo en modo simulacion

---

## Configuracion (config.json)

```json
{
  "deviceApiKey": "local-dev-device-key",
  "schoolName": "Colegio Demo",
  "photoEnabled": true,
  "autoResumeDelay": 8000,
  "apiBaseUrl": "https://tu-api.com/api/v1",
  "tenantId": "1",
  "highContrast": false
}
```

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `deviceApiKey` | string | API key del dispositivo para backend |
| `schoolName` | string | Nombre mostrado en header |
| `photoEnabled` | boolean | Habilitar captura de foto |
| `autoResumeDelay` | number | ms antes de volver a home (default 8000) |
| `apiBaseUrl` | string | URL base de la API |
| `tenantId` | string | ID del tenant para multi-tenant |
| `highContrast` | boolean | Modo alto contraste |

---

## Tokens de Prueba

### Validos (tags.json)
- **NFC**: `nfc_001`, `nfc_002`, `nfc_007`, `nfc_008`, `nfc_016`, `nfc_017`, `nfc_018`
- **QR**: `qr_011`, `qr_012`, `qr_014`, `qr_015`, `qr_019`, `qr_020`

### Revocados
- `nfc_006`, `qr_013`

### Profesores
- `teacher_token_001`

---

## Cola de Eventos

### Estados

| Estado | Descripcion |
|--------|-------------|
| `pending` | Esperando sincronizacion |
| `in_progress` | Sincronizando ahora |
| `synced` | Sincronizado exitosamente |
| `error` | Fallo (puede reintentarse, max 3 intentos) |

### Persistencia

```javascript
// Ver datos
localStorage.getItem('kioskData')

// Resetear todo
localStorage.clear();
location.reload();
```

---

## Sincronizacion

### Modo Real (API)

- Usa `X-Device-Key` header para autenticacion
- Usa `X-Tenant-ID` header para multi-tenant
- Procesa 5 eventos a la vez (rate-limited)
- Heartbeat cada 2 minutos con bateria
- Cache de imagenes con LRU (max 30)

### Modo Simulacion

- 15% probabilidad de fallos aleatorios
- Datos locales de `tags.json`, `students.json`
- Util para desarrollo sin backend

---

## Service Worker

- **Cache version**: v20+
- **Estrategia estaticos**: Cache-first
- **Estrategia API**: Stale-while-revalidate
- **Registro**: Automatico en `index.html`

---

## Biometria (WebAuthn/FIDO2)

### Estado Actual: Funcional

Implementacion completa de WebAuthn en `webauthn.js` con integracion API:

**Enrolamiento (registro de credenciales):**
- Flujo 3 pasos: `start` → `create credential` → `complete`
- Solo profesores autenticados pueden enrollar estudiantes
- Verificacion de permisos via `/biometrics/can-enroll`
- Credenciales almacenadas en PostgreSQL

**Autenticacion (verificacion):**
- Flujo 3 pasos: `start` → `get credential` → `verify`
- Soporte para platform authenticators (huella, Face ID)
- Registro de asistencia automatico al verificar

**Caracteristicas:**
- Deteccion de platform authenticator disponible
- Encoding/decoding Base64URL para WebAuthn
- Manejo de errores especificos (NotAllowedError, InvalidStateError)
- Integracion con sistema de eventos de asistencia

### Endpoints API Integrados

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/biometrics/can-enroll` | GET | Verificar permisos de profesor |
| `/biometrics/check/{student_id}` | GET | Verificar si estudiante tiene credencial |
| `/biometrics/register/start` | POST | Iniciar registro |
| `/biometrics/register/complete` | POST | Completar registro |
| `/biometrics/authenticate/start` | POST | Iniciar autenticacion |
| `/biometrics/authenticate/verify` | POST | Verificar autenticacion |

---

## Historial de Cambios Relevantes

### 2026-01-21: Device API Keys per-Tenant + Biometria WebAuthn
- **Device API Keys per-Tenant**: Validacion de keys especificas por tenant implementada
- **Fallback Global**: Compatibilidad hacia atras con key global durante migracion
- **WebAuthn/FIDO2**: Implementacion completa con Passkeys
- **Enrolamiento**: Profesores pueden registrar huellas de estudiantes
- **Autenticacion**: Estudiantes pueden marcar asistencia con biometria
- **Integracion API**: Todos los endpoints de backend conectados
- **Persistencia**: Credenciales almacenadas en PostgreSQL

### 2025-12-23: Multi-Tag y Fixes Criticos
- **Multi-tag**: QR, NFC y Biometrico pueden coexistir
- **Fix**: Pantalla blanca despues de scan (animation-fill-mode)
- **Fix**: autoResumeDelay siempre 5000ms (leer en runtime)
- **Fix**: Kiosco en "Cargando..." infinito (timeout 10s)

### 2025-12-22: Integracion Backend
- Sincronizacion real con API backend
- NFC cambiado a activacion por boton (Web NFC requiere user gesture)
- Headers X-Device-Key y X-Tenant-ID
- CORS fix para X-Tenant-ID

---

## Limitaciones Conocidas

| Limitacion | Causa | Workaround |
|------------|-------|------------|
| NFC requiere tap | Web NFC API security | Boton "Activar NFC" |
| Biometria requiere HTTPS | WebAuthn security | Usar servidor con SSL |
| CORS en file:// | Restriccion navegador | Usar servidor local |

---

## Debugging

### Console Overlay

El `index.html` tiene un debug console overlay:
- Tap el bug rojo en esquina superior derecha
- Muestra logs timestamped
- Usa `window.debugLog()` para agregar logs

### Verificar Estado

```javascript
// Estado completo
console.log(State.data);

// Config
console.log(State.config);

// Cola de eventos
console.log(State.queue);

// Estudiantes
console.log(State.students);
```

---

## Testing

### E2E (Playwright)

```bash
cd tests/e2e
npx playwright test
```

### Service Worker

```bash
npx jest service-worker-consistency.test.js
```

---

## Proximos Pasos

1. **Hardware NFC**: Testing con mas dispositivos NFC fisicos
2. **Notificaciones push**: Alertas de sincronizacion
3. **Metricas remotas**: Logging centralizado
4. **Firma digital**: Evidencia legal de asistencia

---

## Nota: Sistema de Device API Keys

### Estado Actual: IMPLEMENTADO

El sistema tiene **validacion per-tenant completa** con fallback a key global para compatibilidad:

| Componente | Estado | Ubicacion |
|------------|--------|-----------|
| Campo en DB | Implementado | `TenantConfig.device_api_key_encrypted` |
| Endpoint generar key | Implementado | `POST /tenants/{id}/config/generate-device-key` |
| UI Super Admin | Implementado | Panel de tenant detail |
| Validacion kiosk | **PER-TENANT** | `deps.verify_device_key()` → TenantConfig + fallback |
| Validacion middleware | **PER-TENANT** | `tenant_middleware._has_valid_device_key()` → TenantConfig + fallback |

### Flujo de Validacion

```
Kiosk → X-Device-Key + X-Tenant-ID → verify_device_key()
        │
        ├─→ 1. Buscar TenantConfig.device_api_key_encrypted
        │      Si existe y coincide → AUTORIZADO
        │
        └─→ 2. Fallback a settings.device_api_key (global)
               Si coincide → AUTORIZADO (compatibilidad migracion)
```

### Estrategia de Migracion

1. **Fase actual**: Fallback activo - kioskos existentes siguen funcionando con key global
2. **Siguiente**: Generar keys especificas por tenant desde panel Super Admin
3. **Opcional**: Remover fallback global una vez todos los tenants tengan su key

---

*Ultima actualizacion: 21 de Enero de 2026*
