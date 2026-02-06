# 2026-01-22/23: Rediseno Portal de Apoderados (Parent Portal)

## Resumen

Sesion de dos dias enfocada en el rediseno visual completo del portal de apoderados, implementando los disenos HTML aprobados (carpeta `Disenos html aprobados/App Apoderados/`). El rediseno incluye layout con sidebar desktop + bottom nav mobile, calendario visual con timeline lateral, header con nombre del apoderado y toggle dark mode, y tarjetas de estado con Material Symbols.

### Layout General (Components.js)
- **Sidebar desktop**: 256px, logo NEUVOX, navegacion con item activo resaltado
- **Bottom nav mobile**: Fija en parte inferior, 72px, con iconos y labels
- **Header**: Titulo "Portal de Apoderados", nombre del apoderado logueado, toggle dark mode, boton salir
- **Background**: `#f8fafc` con cards blancas redondeadas (`rounded-xl shadow-sm border`)
- **Dark mode**: Toggle con `localStorage` persistencia, inicializacion automatica

### Vista Home (parent_home.js)
- **Student cards**: Avatar con inicial y color por indice (inline hex), status bar inferior
- **Status bars**: `bg-green/red/yellow/blue-50` con iconos Material (`check_circle`, `help`, `schedule`)
- **Botones**: Gradient "Solicitar Ausencia" + outlined "Preferencias de Notificacion"
- **Colores dinamicos**: Inline `style="background-color: ${hex}"` para evitar conflicto Tailwind JIT

### Vista Historial (parent_history.js)
- **Calendario visual**: Grid 7 columnas, dots de color por dia (green/yellow/red)
- **Timeline lateral**: Layout `grid lg:grid-cols-3` con calendario 2/3 y timeline 1/3
- **Stats cards**: 3 tarjetas (Presente/Atrasos/Ausencias) con icono top-right y porcentajes
- **Navegacion mensual**: Chevrons prev/next con mes/ano centrado

### CSS Base (styles.css)
- **Nuevas clases**: `parent-sidebar`, `parent-nav-item`, `parent-bottom-nav`, `calendar-day`, `btn-gradient`, `evidence-option-btn`
- **Dark mode**: Todas las clases con variante `.dark`
- **Conflicto CSS resuelto**: Seccion `@layer utilities` en `styles.css` con `.hidden !important` comentada para evitar override de clases Tailwind responsive

### Tailwind Config (tailwind.config.js)
- **Safelist ampliado**: ~80 clases nuevas para parent module (backgrounds, textos, bordes, gradient, toggle, spacing)

---

## 1. Conflicto CSS - Diagnostico y Solucion

### Problema

El archivo `styles.css` contenia una seccion de utilities con reglas que usaban `!important`, sobreescribiendo las clases responsive de Tailwind:

```css
/* styles.css - ANTES (causaba conflicto) */
.hidden {
  display: none !important;
}
```

Esto rompia cualquier uso de `hidden md:flex` o `md:hidden` de Tailwind, ya que el `!important` de styles.css siempre ganaba en la cascada CSS.

### Solucion

Se comento la seccion completa de utilities en styles.css (lineas ~1160-1192) y se usa en su lugar las clases custom definidas en `tailwind.css`:

| Clase Tailwind rota | Clase custom funcional | Comportamiento |
|---------------------|----------------------|----------------|
| `hidden md:flex` | `parent-sidebar` (CSS custom) | Oculto mobile, flex en 768px+ |
| `md:hidden` (bottom nav) | `parent-bottom-nav` (CSS custom) | Visible mobile, oculto 768px+ |
| `hidden sm:inline` | Funciona tras fix | Oculto mobile, inline en 640px+ |

---

## 2. Layout Principal - Components.js

### 2.1 createLayout() - Branch Parent

Se modifico el branch `if (role === 'parent')` existente en `Components.createLayout()` para implementar el layout del diseno aprobado:

```javascript
// components.js:203 - createLayout acepta options
createLayout(role, options) {
  // ...
  if (role === 'parent') {
    // Initialize dark mode from saved preference
    if (localStorage.getItem('darkMode') === 'true') {
      document.documentElement.classList.add('dark');
    }

    const activeView = (options && options.activeView) || '';
    const navItems = [
      { id: 'home', href: '#/parent/home', icon: 'home', label: 'Inicio' },
      { id: 'history', href: '#/parent/history', icon: 'history', label: 'Historial' },
      { id: 'absences', href: '#/parent/absences', icon: 'event_busy', label: 'Ausencias' },
      { id: 'prefs', href: '#/parent/prefs', icon: 'settings', label: 'Ajustes' }
    ];
    // ...
  }
}
```

### 2.2 Estructura del Layout

```
+------------------+--------------------------------------------------+
| Sidebar 256px    | Header: titulo + nombre apoderado + dark/logout  |
| (desktop only)   |--------------------------------------------------|
|                  |                                                    |
| Logo NEUVOX      | #view-content (scroll, padding, pb-24 mobile)    |
| Nav items (4)    |                                                    |
|                  |                                                    |
+------------------+--------------------------------------------------+
                   | Bottom Nav (mobile only, 72px, fixed)             |
                   +---------------------------------------------------+
```

### 2.3 Header con Nombre del Apoderado y Dark Mode Toggle

```javascript
// components.js:223-265
const guardian = State.getGuardian(State.currentGuardianId);
const guardianName = guardian ? guardian.full_name : 'Apoderado';
const isDark = document.documentElement.classList.contains('dark');

// Header muestra:
// 1. Nombre del apoderado con icono "person" (visible solo en desktop)
// 2. Boton dark mode toggle (dark_mode / light_mode)
// 3. Boton logout
```

### 2.4 toggleParentDarkMode()

```javascript
// components.js:177-185
toggleParentDarkMode() {
  document.documentElement.classList.toggle('dark');
  const isDark = document.documentElement.classList.contains('dark');
  localStorage.setItem('darkMode', isDark ? 'true' : 'false');
  const icon = document.getElementById('parent-dark-mode-icon');
  if (icon) {
    icon.textContent = isDark ? 'light_mode' : 'dark_mode';
  }
},
```

### 2.5 Sidebar con Logo

```html
<!-- Solo imagen del logo, centrada, h-14 -->
<div class="h-20 flex items-center justify-center px-4 border-b border-gray-100 dark:border-slate-800">
  <img src="assets/LOGO Neuvox 1000X1000.png" class="h-14" alt="NEUVOX">
</div>
```

---

## 3. Vista Home - parent_home.js

### 3.1 Colores de Avatar (Inline Hex)

Uso de inline `style` para evitar problemas con Tailwind JIT que no genera clases dinamicas:

```javascript
// parent_home.js:18
const avatarColors = ['#6366f1', '#a855f7', '#3b82f6', '#ec4899', '#f97316'];

// parent_home.js:84 - Avatar con color inline
<div class="w-12 h-12 rounded-lg text-white flex items-center justify-center text-xl font-bold"
     style="background-color: ${avatarColor};">
  ${initial}
</div>
```

### 3.2 Status Bar del Estudiante

Funcion `renderStatusBar(events)` que retorna la barra de estado inferior de cada card:

| Estado | Background | Icono | Texto |
|--------|-----------|-------|-------|
| Salida registrada | `bg-blue-50` | `check_circle` (blue) | "Salida Registrada: HH:MM" |
| Ingreso tardio | `bg-yellow-50` | `schedule` (yellow) | "Ingreso Tardio: HH:MM" |
| Ingreso normal | `bg-green-50` | `check_circle` (green) | "Ingreso Registrado: HH:MM" |
| Sin registro | `bg-red-50` | `help` (red) | "Aun no registra ingreso" |

### 3.3 Botones de Accion

```html
<!-- Gradient button - Solicitar Ausencia -->
<a href="#/parent/absences" class="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl
   shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5">
  <span class="material-symbols-outlined text-white">calendar_today</span>
  <span class="font-bold text-white">Solicitar Ausencia</span>
</a>

<!-- Outlined button - Preferencias -->
<a href="#/parent/prefs" class="border border-gray-200 rounded-xl hover:shadow-md">
  <span class="material-symbols-outlined text-gray-500">settings</span>
  <span class="font-medium text-gray-700">Preferencias de Notificacion</span>
</a>
```

---

## 4. Vista Historial - parent_history.js

### 4.1 Layout Grid (Calendario + Timeline)

```html
<!-- Grid 3 columnas en desktop: calendario 2/3, timeline 1/3 -->
<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <!-- Calendar (2/3) -->
  <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border p-4 md:p-6">
    <!-- Month navigation + Calendar grid + Legend -->
  </div>
  <!-- Timeline (1/3) -->
  <div class="lg:col-span-1 bg-white rounded-xl shadow-sm border p-4 md:p-6">
    <!-- Day detail with timeline events -->
  </div>
</div>
```

### 4.2 Funcion generateCalendar(year, month, events)

Genera calendario visual del mes:

```javascript
// parent_history.js:46-96
function generateCalendar(year, month, events) {
  // Grid 7 columnas con nombres de dia (Dom, Lun, Mar, etc.)
  // Celdas vacias antes del primer dia del mes
  // Cada dia: clase .calendar-day con dot de color
  // Dot color: getDotColor(events) -> green/yellow/red/null
  // Click: Views.parentHistory.selectDate(dateStr)
  // Hoy: texto indigo si no esta seleccionado
  // Weekend: opacity reducida
}
```

### 4.3 Funcion getDotColor(events)

```javascript
// parent_history.js:36-43
function getDotColor(events) {
  if (!events.length) return null;
  const hasIn = events.some(e => e.type === 'IN');
  if (!hasIn) return '#ef4444';  // red-500 (ausente)
  const lateIn = events.find(e => e.type === 'IN' && e.ts.split('T')[1] > '08:30:00');
  if (lateIn) return '#eab308';  // yellow-500 (atrasado)
  return '#22c55e';  // green-500 (presente)
}
```

### 4.4 Funcion eventsToTimeline(events)

Timeline vertical con linea conectora:

```javascript
// parent_history.js:99-146
// Linea vertical: absolute left-4 top-2 bottom-6 w-0.5 bg-gray-100
// Cada evento: relative z-10 flex gap-4 pb-5
// Icono: w-8 h-8 rounded-full con border-2 border-white
// Colores: green (ingreso), orange (ingreso tardio), blue (salida)
// Labels: "Ingreso Correcto", "Ingreso con Atraso", "Salida Registrada"
// Muestra icono de camara si tiene foto evidencia
```

### 4.5 Stats Cards con Icono Top-Right

```html
<div class="flex justify-between items-start mb-2">
  <p class="text-sm font-medium text-gray-500">Dias Presente</p>
  <span class="material-symbols-outlined text-green-500 p-1.5 rounded-lg text-lg"
        style="background: #dcfce7;">check_circle</span>
</div>
<h3 class="text-2xl font-bold">${stats.present}</h3>
<p class="text-xs mt-1 font-medium" style="color: #16a34a;">
  ${Math.round(stats.present / totalDays * 100)}% asistencia
</p>
```

| Stat Card | Icono | Color Fondo | Color Texto |
|-----------|-------|-------------|-------------|
| Presente | `check_circle` | `#dcfce7` (green-100) | `#16a34a` (green-600) |
| Atrasos | `schedule` | `#fff7ed` (orange-50) | `#ea580c` (orange-600) |
| Ausencias | `cancel` | `#fef2f2` (red-50) | `#dc2626` (red-600) |

### 4.6 Funcion calculateMonthStats(events, year, month)

```javascript
// parent_history.js:148-178
// Itera dias del mes (excluyendo weekends y dias futuros)
// Cuenta: present (ingreso antes de 08:30), late (despues), absent (sin IN)
// Retorna: { present, late, absent }
```

### 4.7 Navegacion del Calendario

```javascript
// Funciones expuestas globalmente:
Views.parentHistory.prevMonth = function() { /* month-- y re-render */ };
Views.parentHistory.nextMonth = function() { /* month++ y re-render */ };
Views.parentHistory.selectDate = function(date) { /* update timeline */ };
Views.parentHistory.changeStudent = function(id) { /* cambiar alumno */ };
```

---

## 5. CSS Clases Nuevas - styles.css

### 5.1 Parent Layout

```css
/* styles.css:3903 */
.parent-sidebar {
  width: 256px;
  background: white;
  border-right: 1px solid #e5e7eb;
  flex-shrink: 0;
  display: none;      /* Oculto en mobile */
  flex-direction: column;
}
@media (min-width: 768px) {
  .parent-sidebar { display: flex; }  /* Visible en desktop */
}

/* styles.css:3944 */
.parent-bottom-nav {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 72px;
  display: flex;           /* Visible en mobile */
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 40;
}
@media (min-width: 768px) {
  .parent-bottom-nav { display: none; }  /* Oculto en desktop */
}
```

### 5.2 Navegacion

```css
/* styles.css:3920 */
.parent-nav-item {
  display: flex;
  align-items: center;
  padding: 0.625rem 0.75rem;
  border-radius: 0.5rem;
  color: #4b5563;
  font-size: 0.875rem;
  font-weight: 500;
}
.parent-nav-item.active {
  background: #eef2ff;
  color: #4338ca;
}
.dark .parent-nav-item.active {
  background: rgba(99,102,241,0.2);
  color: #818cf8;
}
```

### 5.3 Calendario

```css
/* styles.css:3972 */
.calendar-day {
  height: 3.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 0.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
  background: #f8fafc;
}
.calendar-day.selected {
  background: #6366f1;
  color: white;
}
.calendar-day.weekend {
  background: transparent;
  opacity: 0.5;
}
```

### 5.4 Botones y Utilidades

```css
/* styles.css:4033 - Gradient button */
.btn-gradient {
  background: linear-gradient(to right, #6366f1, #9333ea);
  color: white;
  border-radius: 0.75rem;
  box-shadow: 0 10px 15px -3px rgba(99,102,241,0.3);
}

/* styles.css:4055 - Evidence option buttons */
.evidence-option-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
}
.evidence-option-btn.active {
  border-width: 2px;
  border-color: #6366f1;
  background: #eef2ff;
  color: #4338ca;
}
```

---

## 6. Tailwind Config - Safelist

Se agrego la seccion `// ===== PARENT MODULE REDESIGN 2026 =====` al safelist (linea 508 del archivo `tailwind.config.js`) con ~80 clases:

| Categoria | Clases |
|-----------|--------|
| **Backgrounds** | `bg-[#f8fafc]`, `bg-indigo-50/100/600`, `bg-purple-100/500`, `bg-green-50/100/500`, `bg-red-50/100/500`, `bg-yellow-50/100/500`, `bg-blue-50/100/500` |
| **Dark backgrounds** | `dark:bg-slate-900/800`, `dark:bg-{color}-900/{10,30}`, `dark:bg-{color}-800/30` |
| **Text** | `text-{color}-{400,600,700,900}`, `dark:text-{color}-400` |
| **Borders** | `border-{color}-100`, `dark:border-{color}-900/20`, `border-gray-100/200`, `dark:border-slate-700/800` |
| **Gradient** | `bg-gradient-to-r`, `from-indigo-500`, `to-purple-600`, `shadow-indigo-200/500/30` |
| **Toggle switch** | `peer`, `sr-only`, `peer-checked:bg-indigo-600`, `peer-checked:after:translate-x-full`, `after:*` utilities |
| **Responsive** | `md:flex-row`, `md:h-20`, `md:items-center`, `md:px-8`, `md:p-8`, `md:hidden`, `sm:inline` |

---

## Archivos Modificados

| Archivo | Lineas Clave | Cambios |
|---------|-------------|---------|
| `css/styles.css` | 3898-4085 | Clases parent-sidebar, parent-nav-item, parent-bottom-nav, calendar-day, btn-gradient, evidence-option-btn |
| `css/styles.css` | ~1160-1192 | Seccion utilities con `.hidden !important` COMENTADA para resolver conflicto CSS cascade |
| `tailwind.config.js` | 508-584 | Safelist: backgrounds, texts, borders, gradient, toggle, responsive classes |
| `js/components.js` | 177-185 | Nueva funcion `toggleParentDarkMode()` |
| `js/components.js` | 203-281 | Branch `parent` en `createLayout()`: sidebar + header + bottom nav |
| `js/views/parent_home.js` | 1-114 | Rediseno completo: avatars con inline colors, status bars, gradient buttons |
| `js/views/parent_history.js` | 1-260+ | Rediseno completo: calendario visual, timeline lateral, stats cards, month navigation |

---

## Testing Checklist

### Layout General
- [x] Desktop: Sidebar visible a 768px+
- [x] Mobile: Bottom nav fija a <768px
- [x] Header muestra nombre del apoderado (solo desktop)
- [x] Dark mode toggle funciona y persiste en localStorage
- [x] Background #f8fafc con cards blancas en light mode
- [x] Sidebar highlights vista activa correctamente
- [x] Logo NEUVOX renderiza como imagen centrada

### Home - Estado de Hoy
- [x] Student cards con avatar y color por indice
- [x] Status bar inferior correcta (green/red/yellow/blue segun estado)
- [x] Material icons (check_circle, help, schedule)
- [x] Gradient button "Solicitar Ausencia" con hover effect
- [x] Boton outlined "Preferencias de Notificacion"
- [x] Responsive: cards stack en mobile

### Historial - Calendario
- [x] Calendario genera dias correctamente para cada mes
- [x] Dias vacios antes del primer dia del mes
- [x] Dots aparecen solo en dias con eventos
- [x] Color de dot correcto: green=presente, yellow=atrasado, red=ausente
- [x] Dia actual resaltado (texto indigo)
- [x] Dia seleccionado con background indigo
- [x] Weekends con opacity reducida
- [x] Click en dia actualiza timeline
- [x] Month navigation con chevrons funciona
- [x] Stats cards con icono top-right y porcentajes
- [x] Timeline lateral (1/3 width en desktop)
- [x] Timeline con linea vertical conectora
- [x] Timeline muestra horario y evidencia si existe
- [x] Student selector dropdown funcional
- [x] Leyenda de colores debajo del calendario

### Funcional
- [x] Navegacion entre vistas funciona (sidebar + bottom nav)
- [x] Dark mode toggle actualiza icono (dark_mode <-> light_mode)
- [x] Dark mode persiste tras recarga
- [x] State.getGuardianStudents() retorna estudiantes correctos
- [x] State.getAttendanceEvents() filtra por estudiante y fecha
- [x] calculateMonthStats() excluye weekends y dias futuros
- [x] Student IDs validados contra allowedStudentIds (seguridad)

---

## Funcionalidad Preservada (NO modificada)

```javascript
// Logica intacta en parent_home.js:
State.getGuardianStudents(State.currentGuardianId)
State.getAttendanceEvents({ studentId, date })
State.getCourse(student.course_id)
Components.formatTime(timestamp)

// Logica intacta en parent_history.js:
State.getAttendanceEvents({ studentId })  // filtro por rango de fecha en JS
Components.formatTime(event.ts)
// Security: allowedStudentIds Set validation
```

---

## Notas de Implementacion

1. **Colores Inline vs Tailwind**: Se usan valores hex inline (`style="background-color: ..."`) para avatares dinamicos porque Tailwind JIT no puede generar clases con valores de template literals en tiempo de compilacion.

2. **Stats con inline styles**: Los fondos de iconos en stats cards usan inline styles (`style="background: #dcfce7"`) para el mismo motivo. En dark mode estos fondos no cambian, lo cual es aceptable visualmente.

3. **Calendar dot colors**: Los dots usan inline `style="background: ${dotColor}"` porque el color se calcula dinamicamente por evento.

4. **Conflicto .hidden**: La solucion de comentar la seccion utilities en styles.css es temporal. La solucion definitiva seria eliminar esas reglas legacy y migrar todos los modulos a usar clases Tailwind/custom.

5. **Logo sidebar**: Se usa solo la imagen (`<img class="h-14">`) sin texto "NEUVOX" al lado, diferente del diseno aprobado que tenia un div con "N" + texto. La decision fue por simplicidad y uso del asset existente.
