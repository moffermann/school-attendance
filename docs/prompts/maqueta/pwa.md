# PROMPT 3/3 — Maqueta navegable (solo vistas) PWA de emergencia para Profesores

**Rol:** Eres un ingeniero front-end senior con foco en PWAs offline-first.
**Tarea:** Construir una **maqueta navegable** (solo **HTML/CSS/JS vanilla**) de la **PWA de emergencia para profesores** del sistema de control de ingreso/salida escolar. Debe funcionar como **SPA** con **hash routing**, **Service Worker** para modo **offline**, almacenamiento local (**IndexedDB** y `localStorage`), **escaneo QR simulado**, **registro en lote** y **cola de sincronización**. Sin acceso a hardware real, sin backend: todo simulado con datos mock y persistencia local.

## Alcance y restricciones

* Solo **front-end estático**: **HTML**, **CSS**, **JavaScript** vanilla (sin frameworks ni bundlers).
* **SPA** con **hash routing** (`#/ruta`).
* **PWA**: `manifest` + **Service Worker** con **precaching** y **estrategia cache-first** + fallback offline.
* **Datos mock** en `/data/*.json`; persistencia en **IndexedDB** (colecciones principales) y `localStorage` (banderas/config).
* Idioma: **español (Chile)**.
* **Accesible** (labels, roles, focus) y **responsive** (móvil primero; usable en teléfonos de profesores).
* **Sin** NFC real; **QR simulado** con input/overlay (no usar cámara real).
* **Sin** notificaciones push, sin WhatsApp/SES.

## Estructura del proyecto (crear exactamente estos archivos/carpetas)

```
teacher-pwa/
  index.html
  manifest.webmanifest
  service-worker.js
  /css/
    styles.css
  /js/
    router.js
    idb.js           // wrapper mínimo IndexedDB
    state.js         // estado en memoria + bridges a IndexedDB/localStorage
    sync.js          // cola y simulación de sincronización
    components.js    // UI reutilizable (toasts, modals, tablas, date/time pickers simples)
    views/
      auth.js
      classes.js
      roster.js
      scan_qr.js
      take_attendance.js
      queue.js
      history.js
      settings.js
      help.js
  /data/
    teachers.json
    courses.json
    rosters.json
    students.json
    attendance_local.json
    queue.json
    config.json
  /assets/
    logo.svg
    qr_placeholder.svg
    success.svg
    error.svg
    offline.svg
  README.md
```

## Router & Estado

* `router.js`: implementa rutas con hash y **guards**:

  * Si no hay **profesor seleccionado** → redirige a `#/auth`.
  * Si no hay **curso activo** en vistas que lo requieran → redirige a `#/classes`.
* `idb.js`: funciones utilitarias (`openDB`, `get`, `set`, `getAll`, `put`, `delete`, `tx`).
* `state.js`:

  * Carga inicial: si es primera vez, importar `/data/*.json` a IndexedDB (stores: `teachers`, `courses`, `rosters`, `students`, `attendance_local`, `queue`, `config`).
  * `localStorage` guarda banderas: `currentTeacherId`, `currentCourseId`, `online=true|false`, `deviceId`, `schoolYear`.
  * Expone métodos:

    * `getRoster(courseId)`, `getStudent(studentId)`, `listCoursesForTeacher(teacherId)`
    * `enqueueEvent(event)`, `listQueue()`, `updateQueueItem(id, patch)`
    * `saveAttendanceSnapshot(courseId, date, records[])` (para marcado en lote)
    * `nextLocalSeq()` (idempotencia por `(deviceId, localSeq)`)
    * `toggleOnline(bool)`

## Rutas (hash)

* `#/auth` — Selección de profesor (mock)
* `#/classes` — Lista de cursos del profesor
* `#/roster` — Nómina del curso activo (estado del día)
* `#/scan-qr` — Simulación de lectura QR
* `#/take-attendance` — Marcado en lote (presentes/tarde/ausentes)
* `#/queue` — Cola offline y sincronización
* `#/history` — Historial local de asistencias del curso
* `#/settings` — Configuración (deviceId, umbrales, horario del curso)
* `#/help` — Ayuda (flujos y atajos)

## Vistas y comportamiento

### 1) `auth.js` — Inicio de sesión simulado

* Logo + título “PWA de emergencia”.
* Selector de **Profesor** desde `teachers.json` (lista o buscador).
* Botón “Continuar” → guarda `currentTeacherId` en `localStorage` y navega a `#/classes`.

### 2) `classes.js` — Cursos del profesor

* Lista de cursos (de `courses.json` filtrando por el profesor).
* Cada card muestra: nombre (p. ej., “1ºA”), cantidad de alumnos, horario base (mock).
* Botones:

  * **Abrir nómina** → `#/roster`
  * **Tomar asistencia (lote)** → `#/take-attendance`
  * **Escaneo QR** → `#/scan-qr`
* Filtros: por jornada (mañana/tarde) si aplica (mock).
* Guarda `currentCourseId` al seleccionar.

### 3) `roster.js` — Nómina y estado del día

* Encabezado: curso, fecha de hoy (selector de fecha para navegar días).
* Tabla/lista de alumnos con:

  * Nombre, estado del día: **Presente-IN a HH:MM**, **Tarde**, **Ausente**, **Salió a HH:MM** (si existe OUT).
  * Botones de acción por alumno: **Marcar IN**, **Marcar OUT**, **Tarde**, **Ausente**, **Nota** (textarea modal).
* Acciones masivas:

  * **Marcar todos presentes (IN ahora)** → crea eventos en cola.
  * **Limpiar marcado** (solo local).
* Guardar snapshot del día en `attendance_local` (para reabrir después).
* Si `online=false`, mostrar **badge OFFLINE** y que todo irá a **cola**.

### 4) `scan_qr.js` — Escaneo QR simulado

* Input de texto “Pegar/ingresar token QR” + botón **Simular lectura**.
* Resolve del token: buscar alumno (`students.json`) a través de mapeo mock (puede usarse `students.json` con `qr_token` opcional o resolver por `state`).
* Determinar **tipo sugerido**: si no hay IN hoy → sugerir **IN**; si ya hay IN y no OUT → sugerir **OUT**.
* Mostrar tarjeta del alumno + botones grandes **Registrar IN** / **Registrar OUT**.
* Al confirmar → `enqueueEvent` con objeto:

  ```
  {
    id: uuid,
    student_id,
    type: "IN"|"OUT",
    course_id,
    source: "QR",
    device_id,
    local_seq,
    ts: now
  }
  ```
* Toast de éxito y link rápido “Volver a escanear”.

### 5) `take_attendance.js` — Marcado en lote

* Lista de alumnos con **chips** seleccionables por estado: **Presente**, **Tarde**, **Ausente** (mutuamente excluyentes).
* Botones: **Marcar IN para todos “Presente/Tarde”**, **Guardar snapshot local**, **Enviar a cola**.
* Al “Enviar a cola”: por cada alumno **Presente/Tarde** → encolar evento IN (si ya existe IN hoy, no duplicar; mostrar alerta de conflicto).

### 6) `queue.js` — Cola offline y sincronización

* Tabs: **Pendientes**, **En progreso**, **Sincronizados**, **Errores**.
* Cada item: alumno, tipo (IN/OUT), hora, `local_seq`, estado, reintentos, último error (si existe).
* **Conectividad**: toggle Online/Offline global. Si Offline → la sync no avanza.
* Botones:

  * **Sincronizar ahora** (procesa la cola con **fallos aleatorios** 10–20% para simular errores).
  * **Reintentar** en errores.
  * **Eliminar** pendientes específicos.
* **Idempotencia**: si se detecta `(deviceId, localSeq)` repetido, mostrar conflicto y no duplicar.

### 7) `history.js` — Historial local del curso

* Selector de fechas y resumen por día: conteo de **IN/OUT**, **tarde**, **ausente** (derivado de snapshots).
* Tabla por día con detalle de alumnos y estados (desde `attendance_local` + eventos encolados/sincronizados).

### 8) `settings.js` — Configuración

* **Device ID** (texto, con botón “generar”).
* **Horario del curso** (solo lectura o editable mock): `in_time`/`out_time` (impacta sugerencias y reportes locales).
* **Umbral “tarde”** (minutos; afecta chip “Tarde” en lote).
* **Online/Offline** toggle.
* **Reset de datos**: limpiar IndexedDB y `localStorage` (confirmación modal).

### 9) `help.js` — Ayuda

* Pasos rápidos: seleccionar profesor → curso → nómina → marcar/QR → cola → sincronizar.
* Tips de uso offline, resolución de conflictos y buenas prácticas de aula.

## Datos mock (en `/data/*.json`)

* `teachers.json`: `{ id, full_name }` (3–5 profesores).
* `courses.json`: `{ id, name, grade, teacher_ids:[...] }` (3 cursos: 1ºA, 1ºB, 2ºA).
* `rosters.json`: `{ course_id, student_ids:[...] }`.
* `students.json`: `{ id, full_name, course_id, qr_token? }` (30–60 alumnos).
* `attendance_local.json`: snapshots vacíos al inicio `[]`.
* `queue.json`: `[]`.
* `config.json`: `{ online: true, schoolYear: 2025 }`.

## Lógica simulada y utilitarios

* **Detección de duplicados**: si ya existe **IN** hoy para un alumno, al intentar encolar otro **IN**:

  * Mostrar modal de **conflicto** con opciones: **Omitir**, **Crear OUT**, **Duplicar** (deshabilitado por defecto).
* **Sugerencia de estado**: basado en los eventos locales del día (IN/OUT).
* **Toasts** de éxito/error, **loaders** al simular lectura y sincronización.
* **Filtros** por estado (Presente/Tarde/Ausente) en nómina y lote.
* **Accesibilidad**: navegación por teclado, focus visible, roles ARIA.

## Service Worker (PWA)

* `service-worker.js`:

  * Precaching de `index.html`, `css`, `js`, `data`, `assets`.
  * Estrategia **cache-first** para assets y **network-first con fallback a cache** para `data/*.json`.
  * Manejar **offline fallback** a una página simple si falla la app shell.
* `manifest.webmanifest`:

  * Nombre, short_name, `display: "standalone"`, íconos, `theme_color`, `background_color`.

## Estilo

* **CSS** limpio, mobile-first.
* Componentes: header compacto con curso/fecha/estado online; bottom nav opcional con accesos rápidos (Nómina / QR / Cola / Historial).
* Soporte **alto contraste** (clase CSS global).

## README.md

* Cómo abrir la PWA (con `npx serve` o similar), instalarla (Add to Home Screen).
* Cómo **simular escaneo** QR, **marcado en lote**, **ver cola** y **forzar sincronización**.
* Dónde viven los datos (IndexedDB) y cómo **resetear**.
* Limitaciones (no hay cámara/QR real, no hay backend, sin autenticación real).

## Criterios de aceptación

* Todas las rutas existen y navegan desde la UI.
* Se puede **seleccionar profesor**, **curso**, ver **nómina** y **marcar** estados del día.
* **Escaneo QR simulado** crea eventos en **cola** con `local_seq` incremental.
* **Marcado en lote** encola IN masivos y guarda **snapshot** del día.
* **Modo Offline** detiene la sincronización; **Online** la permite y cambia estados (pendiente → sincronizado/err).
* Detección de **duplicados** e interfaz de **conflictos** funcional.
* PWA instalable y con **cache offline**.

> Entrega un **zip virtual** o estructura de archivos con **todo el código** listo para ejecutar localmente. No omitir archivos.
