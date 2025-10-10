# Kiosk App - Totem de Acceso

Maqueta navegable de **kiosco táctil** para registro de ingreso/salida escolar.

## Características

- **SPA** con hash routing y Service Worker
- **Offline-first** con cola de sincronización
- **Simulación** de lectura NFC/QR y captura de foto
- **UI táctil** optimizada para tablets (botones grandes ≥56px)
- **Persistencia** en `localStorage`
- **Sin dependencias** (HTML/CSS/JS vanilla)

## Cómo usar

### Opción 1: Servidor local

```bash
npx serve . -p 5174
```

Luego abrir: `http://localhost:5174`

### Opción 2: Abrir directamente

Doble clic en `index.html` (funciona en navegadores modernos).

## Flujo de uso

1. **Configuración inicial**: La primera vez que abras la app, te pedirá configurar:
   - **Gate ID** (Ej: GATE-1)
   - **Device ID** (Ej: DEV-01, o generar automáticamente)
   - **Captura de foto**: ON/OFF
   - **Alto contraste**: ON/OFF

2. **Pantalla principal**: Dos botones grandes para:
   - **Acerca tu tarjeta NFC**
   - **Escanear código QR**

3. **Simular lectura**: Ingresa un token de prueba o genera uno válido automáticamente

4. **Confirmar registro**: Verifica el alumno, selecciona Ingreso/Salida y confirma

5. **Cola offline**: Los eventos se almacenan localmente y se sincronizan cuando hay conexión

## Rutas disponibles

| Ruta | Descripción |
|------|-------------|
| `#/home` | Pantalla principal (escaneo NFC/QR) |
| `#/scan` | Simulación de lectura |
| `#/scan-result` | Confirmación de registro |
| `#/manual` | Entrada manual (búsqueda por nombre) |
| `#/queue` | Cola offline (pendientes/sincronizados/errores) |
| `#/device` | Estado del dispositivo |
| `#/settings` | Configuración |
| `#/help` | Ayuda |

## Datos mock

### Tokens de prueba válidos
- NFC: `nfc_001`, `nfc_002`, `nfc_007`, `nfc_008`, `nfc_016`, `nfc_017`, `nfc_018`
- QR: `qr_011`, `qr_012`, `qr_014`, `qr_015`, `qr_019`, `qr_020`

### Tokens revocados
- `nfc_006`, `qr_013`

### Tokens inválidos
- `invalid_token_123`

## Simulación de Online/Offline

1. Ve a **Estado de Dispositivo**
2. Usa el botón **"Cambiar"** junto a "Conectividad" para alternar entre Online/Offline
3. Cuando está **Offline**, la sincronización no avanza
4. Cuando está **Online**, los eventos pendientes se sincronizan automáticamente cada 30 segundos

## Sincronización

- **Automática**: Cada 30 segundos si el dispositivo está Online
- **Manual**: Botón "Sincronizar Ahora" en la vista de Cola
- **Simulación**: 15% de probabilidad de fallos aleatorios
- **Idempotencia**: Los eventos tienen `(device_id, local_seq)` único

## Cola de eventos

Estados posibles:
- **pending**: Esperando sincronización
- **in_progress**: Sincronizando
- **synced**: Sincronizado exitosamente
- **error**: Falló la sincronización (puede reintentarse)

## Persistencia

Todos los datos se guardan en `localStorage`:
```javascript
localStorage.getItem('kioskData')
```

Para resetear:
```javascript
localStorage.clear();
location.reload();
```

## Service Worker

El Service Worker cachea todos los archivos estáticos para funcionamiento offline. Se registra automáticamente al cargar la app.

## Alto Contraste

Activa el modo alto contraste desde **Configuración** para:
- Mayor contraste de colores
- Tipografía ligeramente más grande
- Mejor visibilidad en exteriores

## Estructura del código

```
kiosk-app/
├── index.html
├── service-worker.js
├── css/
│   └── styles.css         # Estilos táctiles
├── js/
│   ├── router.js          # Navegación hash
│   ├── state.js           # Estado + localStorage
│   ├── sync.js            # Cola y sincronización
│   ├── ui.js              # Componentes UI
│   └── views/             # 8 vistas
│       ├── home.js
│       ├── scan.js
│       ├── scan_result.js
│       ├── manual_entry.js
│       ├── queue.js
│       ├── device_status.js
│       ├── settings.js
│       └── help.js
├── data/                  # Datos mock
└── assets/                # SVGs e imágenes
```

## Limitaciones

- **Sin hardware real**: NFC/QR/cámara son simulados con inputs
- **Sin backend**: Todo es local
- **Sin notificaciones push**
- **Sincronización simulada** con fallos aleatorios

## Próximos pasos (fuera del alcance)

- Integración con hardware NFC real
- Cámara QR con WebRTC
- Backend con API REST
- Notificaciones push
- Métricas y logs remotos
