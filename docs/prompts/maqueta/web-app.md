# PROMPT 1/3 — Maqueta navegable (solo vistas) Web Dirección/Padres

**Rol:** Eres un ingeniero front-end senior.
**Tarea:** Construir una **maqueta navegable** (solo **HTML/CSS/JS estático**, sin backend) para el proyecto de **control de ingreso/salida escolar**. Debe incluir **todas las vistas clave** para **Dirección/Inspectoría** y **Padres**, con navegación, estados y datos de ejemplo. Nada de lógica real de negocio, solo UI funcional con **datos mock** persistidos en `localStorage`.
**Objetivo:** Prototipar flujos, pantallas y contenidos para validación con usuarios.

## Alcance y restricciones

* Solo **front-end estático**: **HTML**, **CSS** y **JavaScript** vanilla (sin frameworks).
* **Navegación SPA** con **hash routing** (`#/ruta`), **sin** servidor ni build step.
* **Datos mock** en `/data/*.json` cargados al inicio y **persistencia en `localStorage`** para simular cambios.
* Idioma: **español (Chile)**.
* **Accesible** (roles, labels, focus states), **responsive** (móvil → escritorio).
* **Sin dependencias externas** (si usas íconos, incrústalos como SVG inline).
* **No implementar** WhatsApp/SES, NFC, cámara o backend. Solo *placeholders* y flujos de UI.

## Estructura del proyecto (crear exactamente estos archivos/carpetas)

```
web-app/
  index.html
  /css/
    styles.css
  /js/
    router.js
    state.js
    components.js
    views/
      auth.js
      director_dashboard.js
      director_reports.js
      director_schedules.js
      director_exceptions.js
      director_broadcast.js
      director_devices.js
      director_students.js
      director_absences.js
      parent_home.js
      parent_history.js
      parent_prefs.js
      parent_absences.js
  /data/
    students.json
    guardians.json
    courses.json
    schedules.json
    schedule_exceptions.json
    attendance_events.json
    devices.json
    absences.json
    notifications.json
  /assets/
    logo.svg
    placeholder_photo.jpg
  README.md
```

## Router & Estado

* `router.js`: router hash-based con rutas y guardas simples por **rol**.
* `state.js`:

  * Carga JSON de `/data` en memoria al iniciar.
  * Si hay datos en `localStorage`, los usa en vez del JSON (para persistir cambios).
  * Expone métodos `get/set` por colección (students, courses, etc.) y utilitarios (filtros por fecha/curso).
* `components.js`:

  * **Layout**: header con logo, **selector de rol** (Padre/Dirección), breadcrumbs, menú lateral (si rol Dirección), toasts, modal genérico.
  * **UI elements**: tablas reutilizables, paginación, filtros, chips de estado, formularios y validación básica.

## Vistas requeridas (contenido mínimo)

### Comunes

* `auth.js` (Pantalla de inicio):

  * “Ingresar como”: **Dirección/Inspectoría** o **Padre**.
  * Si **Padre**: simula selección de apoderado y alumnos vinculados (desde `guardians.json`).
  * Si **Dirección**: selección de rol (`Director` o `Inspector`) sin autenticación real.
  * Al elegir, setea `state.currentRole` y navega a la vista inicial del rol.

### Dirección / Inspectoría

1. `director_dashboard.js` — **Tablero en vivo**

   * Cards: “Ingresos hoy”, “Salidas hoy”, “Atrasos”, “Sin registro de ingreso”.
   * **Tabla** de eventos de hoy (`attendance_events.json`): alumno, curso, tipo (IN/OUT), puerta, hora, ícono de foto (si existe `photo_ref`).
   * Filtros: curso, tipo, rango horario; buscador por nombre.
   * Botones ficticios: “Exportar CSV”, “Ver fotos muestreadas” (abre modal con `assets/placeholder_photo.jpg`).

2. `director_reports.js` — **Reportes**

   * **Resumen** por curso en rango de fechas: asistencia %, atrasos, ausencias.
   * Muestra **gráficas simples** con `<canvas>` dibujadas por JS vanilla (barras y líneas).
   * Selector de fechas y curso; tabla de agregados con totales.

3. `director_schedules.js` — **Horarios base por curso**

   * Tabla CRUD ficticia: curso, `in_time`, `out_time` por día (lun–vie).
   * Editor inline o modal para modificar. Guardar → persiste en `localStorage`.

4. `director_exceptions.js` — **Excepciones de calendario**

   * Lista de excepciones (globales y por curso) con: fecha, alcance, `in_time/out_time` opcionales, **motivo**.
   * **Crear excepción**: formulario con **alcance** {Global|Curso}, curso (si aplica), fecha, nuevas ventanas (`in_time/out_time`), motivo (textarea), **checkbox “notificar a padres”**.
   * Botón “Vista previa de destinatarios” → abre modal con conteo y muestra 10 ejemplos de apoderados.

5. `director_broadcast.js` — **Broadcast masivo (cambios de horario)**

   * Form: motivo del mensaje, fecha/curso afectados, canal simulado (WhatsApp/Email), **preview** del mensaje con variables (`{{curso}}`, `{{fecha}}`, `{{motivo}}`).
   * Botón “Simular envío” → genera lista de “entregados/pending/fallidos” (falso) con toasts y tabla de resultados.

6. `director_devices.js` — **Puertas y dispositivos**

   * Cards: dispositivos activos, en cola, con batería baja.
   * Tabla: `devices.json` con `gate_id`, `device_id`, versión, `last_sync`, `pending_count`, batería (simulada), estado.
   * Acciones ficticias: “Ping”, “Ver logs” (modal con texto fijo).

7. `director_students.js` — **Alumnos y cursos**

   * Buscador y filtros por curso.
   * Tabla de alumnos (nombre, curso, estado, credenciales: NFC/QR asignado sí/no).
   * Acción: “Ver perfil” (modal): info básica, apoderados vinculados, **preferencia de foto** (solo lectura).

8. `director_absences.js` — **Solicitudes de ausencia**

   * Bandeja: **Pendientes**, **Aprobadas**, **Rechazadas**.
   * Cada solicitud: alumno, curso, rango de fechas, tipo (Enfermedad/Personal), comentario, adjunto (placeholder), botones “Aprobar” / “Rechazar” (simulan cambio de estado).

### Padres

1. `parent_home.js` — **Estado de hoy**

   * Si el apoderado tiene 1+ alumnos, cards por hijo:

     * **Estado**: “Ingresó a las HH:MM por Puerta X” / “Aún no registra ingreso” / “Salió a las HH:MM”.
     * **Botón** “Ver historial” (navega a `parent_history`).

2. `parent_history.js` — **Historial de asistencia**

   * Selector de fechas e hijo.
   * Lista o tabla de eventos con IN/OUT, hora, puerta, indicador de foto (si existe).

3. `parent_prefs.js` — **Preferencias de notificación**

   * **Canales por tipo de evento**: toggles para WhatsApp y Email en:

     * Ingreso registrado
     * Salida registrada
     * No registró ingreso antes de X
     * Cambios de horario
   * **Captura de foto**: checkbox **Opt-in** por alumno (info: “La foto solo se usa como evidencia, retención 60 días”).
   * **Guardar** → persistir en `localStorage`.

4. `parent_absences.js` — **Solicitar ausencia**

   * Formulario: elegir alumno, tipo (Enfermedad/Personal), rango de fechas, comentario, **adjunto** (input file **sin** subida real, solo filename).
   * Enviar → agrega a `absences.json` en memoria y `localStorage`.
   * **Historial** abajo con estados simulados.

## Datos mock (en `/data/*.json`) — ejemplos mínimos

* `students.json`: `{ id, full_name, course_id, photo_pref_opt_in }`
* `guardians.json`: `{ id, full_name, contacts: [{type:"whatsapp"|"email", value, verified}], student_ids: [] }`
* `courses.json`: `{ id, name, grade }`
* `schedules.json`: `{ id, course_id, weekday:0-6, in_time:"08:00", out_time:"16:00" }`
* `schedule_exceptions.json`: `{ id, scope:"GLOBAL"|"COURSE", course_id?, date:"YYYY-MM-DD", in_time?, out_time?, reason }`
* `attendance_events.json`: `{ id, student_id, type:"IN"|"OUT", gate_id, ts, device_id, photo_ref? }`
* `devices.json`: `{ id, gate_id, device_id, version, last_sync, pending_count, battery_pct, status }`
* `absences.json`: `{ id, student_id, type:"SICK"|"PERSONAL", start:"YYYY-MM-DD", end:"YYYY-MM-DD", comment, attachment_name?, status:"PENDING"|"APPROVED"|"REJECTED" }`
* `notifications.json`: para simular previews de broadcast si hace falta.

Incluye al menos:

* 3 cursos (1ºA, 1ºB, 2ºA), 30–60 alumnos distribuidos.
* 2–3 apoderados con 1–2 hijos cada uno.
* Eventos del día con mezcla de IN/OUT, algunos atrasos y algunos sin ingreso.

## Interacciones y estados a simular

* **Toasts** (éxito/error) al “Guardar”, “Simular envío”, “Aprobar/Rechazar”.
* **Empty states** (sin datos), **loading skeletons** al cambiar de ruta, **error state** si falla carga de JSON (simulado).
* **Validaciones simples** (campos requeridos, formato hora/fecha).
* **Paginar** tablas largas (client-side).
* **Filtros** deben actualizar la tabla sin recargar página.

## Estilo y accesibilidad

* **CSS** limpio: tipografía del sistema, layout fluido, contraste AA, focus visible.
* **Componentes** coherentes: botones, inputs, tablas, tags de estado (colores neutros).
* Íconos SVG inline para IN/OUT, reloj, calendario, broadcast, ajustes, foto.

## README.md

* Cómo abrir el prototipo (doble click a `index.html` o con `npx serve`).
* Descripción de rutas y cómo cambiar de rol.
* Dónde están los datos mock y cómo se persisten en `localStorage`.
* Limitaciones (no hay backend, no hay seguridad real).

## Rutas (hash)

* `#/auth`
* `#/director/dashboard`
* `#/director/reports`
* `#/director/schedules`
* `#/director/exceptions`
* `#/director/broadcast`
* `#/director/devices`
* `#/director/students`
* `#/director/absences`
* `#/parent/home`
* `#/parent/history`
* `#/parent/prefs`
* `#/parent/absences`

## Criterios de aceptación

* Todas las rutas anteriores **existen y navegan** desde el menú/links.
* Las tablas muestran datos mock y **filtran** en client-side.
* Formularios **guardan cambios** en `localStorage`.
* Vista de **excepciones** permite crear/editar/eliminar UI y previsualizar “destinatarios”.
* Vista de **broadcast** genera un “reporte de envío” simulado.
* **Responsive**: usable en móvil y desktop.

> Entrega un **zip virtual** o estructura de archivos con **todo el código** listo para ejecutar localmente. No omitir archivos.
