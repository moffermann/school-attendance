# Teacher PWA - Asistencia de Emergencia

PWA offline-first para profesores.

## Características

- PWA instalable con manifest y Service Worker
- IndexedDB para almacenamiento offline
- Cola de sincronización con reintentos
- Escaneo QR simulado
- Marcado en lote
- Mobile-first responsive

## Cómo usar

```bash
npx serve . -p 5175
```

Abrir: `http://localhost:5175`

## Flujo

1. **Seleccionar profesor** (María González, Pedro Ramírez, Carmen Silva)
2. **Seleccionar curso** (1ºA, 1ºB, 2ºA)
3. **Tomar asistencia**: Nómina individual, escaneo QR o marcado en lote
4. **Cola**: Ver eventos pendientes y sincronizar

## Tokens QR de prueba

qr_st_001, qr_st_002, qr_st_011, qr_st_021, qr_st_031, etc.

## Offline

Cambiar entre Online/Offline desde Configuración para probar sincronización.

## Instalación PWA

1. Abrir en Chrome/Edge/Safari
2. Menu → "Instalar aplicación" o "Add to Home Screen"

## Resetear datos

Configuración → Resetear Datos

## Estructura

```
teacher-pwa/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── css/styles.css
├── js/
│   ├── idb.js
│   ├── state.js
│   ├── sync.js
│   ├── components.js
│   ├── router.js
│   └── views/ (9 vistas)
└── data/ (JSON mock)
```
