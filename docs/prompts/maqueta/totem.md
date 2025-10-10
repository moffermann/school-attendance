# PROMPT 2/3 — Maqueta navegable (solo vistas) Totem/Kiosco de entrada

**Rol:** Eres un ingeniero front-end senior especializado en interfaces táctiles para kioscos.
**Tarea:** Construir una **maqueta navegable** (solo **HTML/CSS/JS vanilla**, sin backend) del **Kiosco de acceso** para un sistema de control de ingreso/salida escolar. Debe funcionar como **SPA** con **hash routing** y **datos mock** persistidos en `localStorage`, simulando flujos de: **lectura NFC/QR**, **captura de foto (placeholder)**, **cola local offline**, **sincronización**, y **estado de dispositivo**.
**Objetivo:** Probar UX en tablet (Android/iPad) en modo kiosco.

## Alcance y restricciones

* Solo **front-end estático**: **HTML**, **CSS**, **JavaScript** vanilla (sin frameworks).
* **SPA** con **hash routing** (`#/ruta`) y **service worker** simple para **offline cache**.
* **Datos mock** (`/data/*.json`) + **persistencia en `localStorage`** (simular eventos en cola y sincronización).
* **UI táctil**: botones grandes, targets 44–56 px, layouts para **tablet** (portrait/landscape).
* **Sin acceso a hardware real**: NFC/QR/cámara se **simulan** con formularios/modals (inputs) y un **placeholder** de imagen.
* Idioma: **español (Chile)**.
* **Accesible** y **responsive**; sin dependencias externas (íconos SVG inline).

## Estructura del proyecto (crear exactamente estos archivos/carpetas)

```
kiosk-app/
  index.html
  service-worker.js
  /css/
    styles.css
  /js/
    router.js
    state.js
    sync.js
    ui.js
    views/
      home.js
      scan.js
      scan_result.js
      manual_entry.js
      queue.js
      device_status.js
      settings.js
      help.js
  /data/
    students.json
    tags.json
    device.json
    queue.json
    config.json
  /assets/
    logo.svg
    placeholder_photo.jpg
    qr_placeholder.svg
    nfc_placeholder.svg
    success.svg
    error.svg
  README.md
```

## Router & Estado

* `router.js`: hash router con rutas y **guard** de “config inicial” (si no hay `gate_id` configurado, redirige a `#/settings`).
* `state.js`:

  * Carga JSON de `/data` en memoria al iniciar; si hay datos en `localStorage`, priorízalos.
  * Exponer `state.device`, `state.config`, `state.students`, `state.tags`, `state.queue` (cola offline de eventos).
  * Helpers: `resolveStudentByToken(token)`, `nextEventTypeFor(studentId)`, `enqueueEvent(event)`, `markSynced(id)`; idempotencia simulada por `(device_id, local_seq)`.
* `sync.js`:

  * Funciones para simular **sincronización**: procesa `state.queue` con delays y aleatoriedad (éxito/fallo) y marca estado (`pending|synced|error`).
  * **Toggle de conectividad** (online/offline) emulado desde la UI; cuando está “offline”, la sincronización no avanza.
* `ui.js`:

  * Componentes reutilizables: **Teclado numérico** (para manual), **Modal** genérico, **Toast**, **Loader**, **Tag** de estado, **Badge** de batería/señal.

## Rutas (hash)

* `#/home` — Pantalla principal (listo para escanear)
* `#/scan` — Simulación de lectura (NFC/QR)
* `#/scan-result` — Resultado del scan (confirmación IN/OUT, foto opcional)
* `#/manual` — Búsqueda/entrada manual (fall-back)
* `#/queue` — Cola offline (pendientes / en progreso / sincronizados / errores)
* `#/device` — Estado de dispositivo (batería, versión, gate, conectividad, cola)
* `#/settings` — Configuración inicial (gate_id, device_id, captura de foto ON/OFF)
* `#/help` — Ayuda rápida (gestos, soporte)

## Vistas y comportamiento

### 1) `home.js` — Pantalla principal

* Header con **logo**, hora actual grande, **gate_id**.
* **Panel central** con dos “áreas de scan”:

  * **NFC**: botón grande “Acerca tu tarjeta (NFC)” con ícono `nfc_placeholder.svg`.
  * **QR**: botón grande “Escanear código QR” con `qr_placeholder.svg`.
* Botones secundarios: **Entrada manual**, **Cola**, **Estado dispositivo**.
* Indicadores superiores/derecha: **Conectividad** (Online/Offline), **Batería** (simulada), **Pendientes** (número en cola).

### 2) `scan.js` — Simulación de lectura NFC/QR

* Tabs o botones: **NFC** | **QR**.
* **NFC**: input de texto para “token NFC” + botón **Simular lectura** (o atajo “generar token válido”).
* **QR**: input para “token QR” + botón **Simular lectura**.
* Al confirmar, usa `state.resolveStudentByToken(token)`:

  * **Encontrado** → navegar a `#/scan-result?student_id=...&type=auto|IN|OUT`.

    * `type` por defecto se calcula con `state.nextEventTypeFor(student_id)` (si el último evento fue OUT, ahora IN; etc.).
  * **No encontrado** → mostrar error “Credencial no válida o revocada” con opción a **Entrada manual**.

### 3) `scan_result.js` — Confirmación + foto opcional

* Mostrar **tarjeta del alumno** (nombre, curso, foto placeholder).
* Mostrar **tipo de evento** (IN/OUT) deducido, con opción de **cambiar** (dos botones grandes).
* Si `config.photoEnabled === true` → secciones:

  * **Foto de evidencia**: recuadro con `placeholder_photo.jpg` y botón “Capturar (simulado)” que **cambia** la imagen por otra variante o pone un overlay tipo “capturada”.
* Botones:

  * **Confirmar registro** → encola un objeto `event`:

    ```
    {
      id: uuid,
      student_id,
      type: "IN"|"OUT",
      gate_id,
      device_id,
      local_seq: incremental,
      ts: now,
      source: "NFC"|"QR"|"MANUAL",
      photo_ref?: "simulado"
    }
    ```

    Muestra **toast éxito** y regresa a `#/home`.
  * **Cancelar** → descarta y vuelve a `#/home`.

### 4) `manual_entry.js` — Búsqueda/entrada manual

* Buscador por nombre y lista de resultados (alumnos de `students.json`).
* Al seleccionar alumno → flujo idéntico a `scan_result` con `source:"MANUAL"`.

### 5) `queue.js` — Cola offline y sincronización

* Tabs: **Pendientes**, **En progreso**, **Sincronizados**, **Errores**.
* Cada ítem: alumno, tipo, hora, `local_seq`, estado, reintentos.
* Acciones:

  * **Sincronizar ahora** (procesa secuencialmente → si “offline” no hace nada).
  * **Reintentar** solo para errores.
  * **Eliminar** un pendiente (confirmación modal).
* **Badge** de conectividad: botón **Online/Offline** que cambia el estado global para simular caída de internet.
* Muestra métricas: cantidad en cola, latencia promedio simulada de envío.

### 6) `device_status.js` — Estado de dispositivo

* Cards grandes:

  * **Conectividad**: Online/Offline (toggle).
  * **Batería**: porcentaje simulado + estado (Normal/Baja).
  * **Versión** de app, **Device ID**, **Gate ID**.
  * **Cola**: pendientes / en progreso / errores.
* Botones:

  * **Ping de prueba** (si online → toast éxito; si offline → toast error).
  * **Enviar heartbeat** (simulado: añade registro en un log local).

### 7) `settings.js` — Configuración inicial

* Formulario:

  * **Gate ID** (texto)
  * **Device ID** (texto o generado)
  * **Captura de foto**: ON/OFF (toggle)
  * **Modo alto contraste**: ON/OFF (afecta CSS)
  * **Botón “Guardar y aplicar”** → persiste en `localStorage`, redirige a `#/home`.
* Sección “Datos de prueba”:

  * **Cargar datos de ejemplo** (resetea `localStorage` y carga `/data`).
  * **Vaciar cola**.
  * **Simular batería baja**.

### 8) `help.js` — Ayuda

* Atajos: cómo simular NFC/QR, cómo marcar manualmente, cómo ver cola, cómo forzar sincronización.
* Recomendaciones de uso en kiosco (montaje, orientación, brillo).

## Datos mock (en `/data/*.json`)

* `students.json`: lista de alumnos `{ id, full_name, course_id, photo_url? }`
* `tags.json`: mapeo **token → student_id**, e incluye algunos tokens inválidos y **revocados**:

  ```
  [
    { "token": "nfc_valid_01", "student_id": 1, "status": "ACTIVE" },
    { "token": "nfc_revoked_02", "student_id": 2, "status": "REVOKED" }
  ]
  ```
* `device.json`: `{ gate_id: "GATE-1", device_id: "DEV-01", version: "0.1.0", battery_pct: 82, online: true }`
* `queue.json`: lista vacía inicial `[]`
* `config.json`: `{ "photoEnabled": true, "highContrast": false }`

Incluye suficientes alumnos (30–60) de 3 cursos (1ºA, 1ºB, 2ºA), y unos 15–25 tokens NFC/QR ficticios (mezcla de activos/revocados).

## Interacciones y estados a simular

* **Idempotencia**: genera `local_seq` incremental por dispositivo; si se intenta encolar un **duplicado** (mismo `local_seq`), mostrar mensaje y no duplicar.
* **Errores**: tokens inválidos/revocados → error UI; sincronización con **fallos aleatorios** (por ejemplo 10–20%) para probar reintentos.
* **Toasts** en acciones: registro confirmado, sincronización exitosa, error de red.
* **Loader** durante “lectura” NFC/QR (simulada 300–800 ms).
* **Modo offline**: en `queue` y `device` se refleja que no avanza la sync.

## Estilo y accesibilidad

* UI diseñada para **tablet** (min 768 px); grids y tarjetas grandes.
* **Focus visible**, roles y labels correctos.
* **Tema alto contraste** (toggle) que incremente contraste y tamaño de tipografía.

## Service Worker

* `service-worker.js`:

  * Precaching de `index.html`, `css`, `js`, `data`, `assets`.
  * Estrategia cache-first con fallback a cache offline.

## README.md

* Cómo abrir el prototipo (doble click a `index.html` o con `npx serve`).
* Cómo **simular NFC/QR**, cómo **agregar eventos a la cola**, cómo **cambiar online/offline**, cómo **forzar sincronización**.
* Limitaciones (no hay cámara ni NFC reales, solo placeholders; sin backend).

## Criterios de aceptación

* Todas las rutas definidas **existen y navegan** desde UI.
* Se puede **simular scan** (NFC/QR), confirmar IN/OUT y **encolar** eventos.
* **Cola** muestra estados y permite **reintentar**/eliminar; **sincronización** cambia estado cuando hay “Online”.
* **Settings** persiste y afecta UI (foto ON/OFF, alto contraste).
* **Device** refleja conectividad, batería y cola.
* **Responsive** y usable en tablet.

> Entrega un **zip virtual** o estructura de archivos con **todo el código** listo para ejecutar localmente. No omitir archivos.
