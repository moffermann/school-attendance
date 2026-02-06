# 2026-01-20: Rediseno Frontend Excepciones y Comunicados (Preview Environment)

## Resumen

Sesion enfocada en implementar los disenos aprobados de NEUVOX para los modulos restantes del entorno de preview (`/app-preview/`):
- **Modulo Excepciones**: Nuevo diseno con tabla paginada, modal de creacion, badges de tipo (Global/Curso)
- **Modulo Comunicados**: Nuevo diseno con info card blue, 5 templates rapidos, formulario con iconos, gradient button

### Funcionalidades Implementadas
- **Modulo Excepciones**: Implementacion completa del diseno aprobado con tabla estilizada y modal de creacion
- **Modulo Comunicados**: Implementacion completa con info card blue theme, 5 templates (incluido nuevo "Aviso urgente")
- **Headers Estandarizados**: Estructura consistente con Dashboard, Reportes, Metricas y Horarios
- **Dark Mode**: Soporte completo en ambos modulos
- **Responsive Design**: Mobile sidebar toggle y layouts adaptativos
- **Preservacion Backend**: Toda la logica de API (sendBroadcast, exceptions CRUD) preservada intacta

### Archivos Clave Modificados
- `src/web-app-preview/js/views/director_exceptions.js` - Excepciones completo
- `src/web-app-preview/js/views/director_broadcast.js` - Comunicados completo
- `src/web-app-preview/tailwind.config.js` - Safelist para Excepciones y Comunicados

---

## 1. Modulo Excepciones - Implementacion

### Diseno Aprobado

El diseno aprobado (`Disenos html aprobados/Modulo Excepciones/modulo excepciones.html`) incluye:
- Header con titulo "Gestion de Excepciones"
- Boton gradient "Nueva Excepcion" (indigo → cyan)
- Tabla estilizada con columnas: Fecha, Descripcion, Tipo, Acciones
- Badges de tipo: Global (indigo) y Curso (orange)
- Modal para crear/editar excepciones
- Paginacion funcional
- Footer estandarizado "© 2026 NEUVOX"

### Estructura del Layout

```html
<!-- Header -->
<header class="h-20 bg-white dark:bg-card-dark ...">
  <div class="flex items-center gap-4">
    <button class="desktop-hidden">menu</button>
    <h2>Gestion de Excepciones</h2>
  </div>
  <!-- Dark mode, perfil, logout -->
</header>

<!-- Content -->
<div class="flex-1 overflow-y-auto p-4 md:p-8">
  <!-- Header con boton Nueva Excepcion -->
  <div class="flex justify-between items-center mb-6">
    <h3>Excepciones de Horario</h3>
    <button class="bg-gradient-to-r from-indigo-600 to-cyan-500">
      Nueva Excepcion
    </button>
  </div>

  <!-- Tabla -->
  <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
    <table class="w-full">...</table>
  </div>

  <!-- Paginacion -->
  <div class="flex justify-between items-center mt-4">...</div>
</div>
```

### Badge de Tipo - Global vs Curso

```javascript
function renderTypeBadge(exception) {
  if (exception.scope === 'global' || !exception.course_id) {
    return `
      <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                   bg-indigo-50 text-indigo-600 border border-indigo-100
                   dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800">
        <span class="material-icons-round text-sm mr-1">public</span>
        Global
      </span>
    `;
  } else {
    const course = State.getCourse(exception.course_id);
    return `
      <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                   bg-orange-50 text-orange-600 border border-orange-100
                   dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800">
        <span class="material-icons-round text-sm mr-1">class</span>
        ${course?.name || 'Curso'}
      </span>
    `;
  }
}
```

### Boton Gradient (Indigo → Cyan)

```html
<button onclick="Views.directorExceptions.showCreateModal()"
        class="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:opacity-90
               text-white rounded-lg text-sm font-semibold shadow-md shadow-indigo-200
               dark:shadow-none transition-all flex items-center gap-2">
  <span class="material-icons-round text-lg">add_circle</span>
  Nueva Excepcion
</button>
```

### Safelist Agregado para Excepciones

```javascript
safelist: [
  // ===== EXCEPCIONES MODULE =====
  // Gradient button "Nueva Excepcion" (indigo → cyan)
  'to-cyan-500', 'hover:opacity-90',
  'shadow-indigo-200',

  // Badge Global (indigo) - border
  'border-indigo-100', 'dark:border-indigo-800',

  // Badge Curso (orange) - NUEVO
  'bg-orange-50', 'text-orange-600', 'border-orange-100',
  'dark:bg-orange-900/30', 'dark:text-orange-400', 'dark:border-orange-800',

  // Tabla Excepciones
  'bg-slate-50/50', 'bg-slate-50/30',
  'divide-slate-100', 'dark:divide-slate-700',
  'text-[11px]', 'tracking-wider',
  'border-slate-100', 'dark:border-slate-700',

  // Boton eliminar
  'text-red-400', 'hover:text-red-600',
  'dark:text-red-500', 'dark:hover:text-red-400',

  // Paginacion
  'border-slate-200', 'dark:border-slate-600',
  'hover:bg-white', 'disabled:opacity-50',

  // Texto Excepciones
  'text-slate-700', 'text-slate-600', 'text-slate-400', 'text-slate-500',
  'dark:text-slate-300', 'dark:text-slate-400', 'dark:text-slate-500',
  'text-slate-800', 'dark:text-white',
]
```

---

## 2. Modulo Comunicados - Implementacion

### Diseno Aprobado

El diseno aprobado (`Disenos html aprobados/Modulo Comunicados/modulo comunicados.html`) incluye:
- Header con titulo "Comunicados Masivos"
- Info Card azul con icono info explicando el proposito
- Panel Templates Rapidos con 5 botones pill
- Formulario principal con iconos en inputs (groups, calendar_today)
- Checkboxes de canal con iconos (chat verde para WhatsApp, mail azul para Email)
- Boton gradient "Enviar Comunicado" (indigo → blue)
- Footer estandarizado "© 2026 NEUVOX"

### Estructura del Layout

```html
<!-- Header -->
<header class="h-20 bg-white dark:bg-card-dark ...">
  <div class="flex items-center gap-4">
    <button class="desktop-hidden">menu</button>
    <h2>Comunicados Masivos</h2>
  </div>
</header>

<!-- Content -->
<div class="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
  <!-- Info Card Blue -->
  <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 ...">
    <div class="bg-blue-100 dark:bg-blue-800 p-2 rounded-full">
      <span class="material-icons-round">info</span>
    </div>
    <div>
      <h4 class="text-blue-900 dark:text-blue-200">Que es un Comunicado Masivo?</h4>
      <p class="text-blue-700 dark:text-blue-400">Descripcion...</p>
    </div>
  </div>

  <!-- Templates Rapidos -->
  <div class="bg-white dark:bg-card-dark rounded-xl p-6 ...">
    <div class="flex items-center gap-2 mb-4">
      <span class="material-icons-round text-indigo-500">auto_awesome</span>
      <h3>TEMPLATES RAPIDOS</h3>
    </div>
    <div class="flex flex-wrap gap-3">
      <!-- 5 botones pill -->
    </div>
  </div>

  <!-- Formulario Principal -->
  <div class="bg-white dark:bg-card-dark rounded-xl ...">
    <!-- Form fields con iconos -->
    <!-- Footer con botones -->
  </div>
</div>
```

### Info Card Blue Theme

```html
<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl p-4 flex items-start gap-4">
  <div class="bg-blue-100 dark:bg-blue-800 p-2 rounded-full text-blue-600 dark:text-blue-300 flex-shrink-0">
    <span class="material-icons-round">info</span>
  </div>
  <div>
    <h4 class="text-blue-900 dark:text-blue-200 font-bold">Que es un Comunicado Masivo?</h4>
    <p class="text-sm text-blue-700 dark:text-blue-400">
      Envia mensajes a todos los apoderados de un curso (o de todo el colegio)
      via WhatsApp y/o Email. Util para avisos de suspensiones, reuniones,
      cambios de horario, etc.
    </p>
  </div>
</div>
```

### Templates Rapidos (5 Botones)

```javascript
const templates = {
  suspension: {
    subject: 'Suspension de clases',
    message: `Estimado/a apoderado/a:\n\nLe informamos que las clases del curso {{curso}} se encuentran SUSPENDIDAS el dia {{fecha}}.\n\nMotivo: {{motivo}}\n\nSaludos cordiales,\nDireccion`
  },
  reunion: {
    subject: 'Reunion de apoderados',
    message: `Estimado/a apoderado/a:\n\nSe convoca a reunion de apoderados del curso {{curso}} para el dia {{fecha}}.\n\nMotivo: {{motivo}}\n\nSaludos cordiales,\nDireccion`
  },
  horario: {
    subject: 'Cambio de horario',
    message: `Estimado/a apoderado/a:\n\nLe informamos que el curso {{curso}} tendra un cambio de horario el dia {{fecha}}.\n\nMotivo: {{motivo}}\n\nSaludos cordiales,\nDireccion`
  },
  actividad: {
    subject: 'Actividad especial',
    message: `Estimado/a apoderado/a:\n\nLe informamos que el curso {{curso}} participara en una actividad especial el dia {{fecha}}.\n\nActividad: {{motivo}}\n\nSaludos cordiales,\nDireccion`
  },
  urgente: {  // NUEVO - 5to template agregado
    subject: 'Aviso urgente',
    message: `Estimado/a apoderado/a:\n\nAVISO URGENTE\n\n{{motivo}}\n\nFecha: {{fecha}}\nCurso afectado: {{curso}}\n\nPor favor tome las medidas necesarias de forma inmediata.\n\nSaludos cordiales,\nDireccion`
  }
};
```

### Inputs con Iconos

```html
<!-- Curso Afectado con icono groups -->
<div class="relative">
  <select id="broadcast-course" class="w-full pl-10 pr-4 py-2.5 ...">
    <option value="">Todos los cursos</option>
  </select>
  <span class="absolute left-3 top-2.5 text-gray-400 material-icons-round">groups</span>
</div>

<!-- Fecha del Evento con icono calendar_today -->
<div class="relative">
  <input id="broadcast-date" type="date" class="w-full pl-10 pr-4 py-2.5 ..."/>
  <span class="absolute left-3 top-2.5 text-gray-400 material-icons-round">calendar_today</span>
</div>
```

### Checkboxes de Canal con Iconos

```html
<div class="flex gap-8">
  <!-- WhatsApp -->
  <label class="flex items-center gap-3 cursor-pointer group">
    <input id="channel-whatsapp" type="checkbox" checked class="w-5 h-5 text-indigo-600 ..."/>
    <div class="flex items-center gap-2">
      <span class="material-icons-round text-green-500">chat</span>
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600">WhatsApp</span>
    </div>
  </label>

  <!-- Email -->
  <label class="flex items-center gap-3 cursor-pointer group">
    <input id="channel-email" type="checkbox" checked class="w-5 h-5 text-indigo-600 ..."/>
    <div class="flex items-center gap-2">
      <span class="material-icons-round text-blue-500">mail</span>
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600">Email</span>
    </div>
  </label>
</div>
```

### Boton Gradient (Indigo → Blue)

```html
<button id="btn-send-broadcast" onclick="Views.directorBroadcast.sendBroadcast()"
        class="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700
               text-white rounded-lg text-sm font-semibold shadow-md shadow-indigo-200 dark:shadow-none
               transition-all flex items-center justify-center gap-2">
  <span class="material-icons-round text-lg">send</span>
  Enviar Comunicado
</button>
```

### Safelist Agregado para Comunicados

```javascript
safelist: [
  // ===== COMUNICADOS MODULE =====
  // Info card (blue theme)
  'bg-blue-50', 'dark:bg-blue-900/20',
  'border-blue-100', 'dark:border-blue-800/50',
  'bg-blue-100', 'dark:bg-blue-800',
  'text-blue-600', 'dark:text-blue-300',
  'text-blue-900', 'dark:text-blue-200',
  'text-blue-700', 'dark:text-blue-400',

  // Template buttons
  'hover:bg-indigo-50', 'hover:border-indigo-200',
  'dark:hover:bg-indigo-900/30',

  // Form inputs with icons
  'pl-10', 'appearance-none',

  // Channel icons
  'text-green-500',  // WhatsApp

  // Gradient button "Enviar Comunicado" (indigo → blue)
  'to-blue-600', 'hover:to-blue-700',
  'hover:from-indigo-700',

  // Form footer
  'bg-gray-50', 'dark:bg-white/5',
  'hover:bg-gray-100', 'dark:hover:bg-gray-700',

  // Separators
  'border-gray-100', 'dark:border-gray-700',
]
```

---

## 3. Funciones Backend Preservadas

### Comunicados - Envio de Broadcast

```javascript
// Flag para prevenir double-click
let isSending = false;

Views.directorBroadcast.sendBroadcast = async function() {
  if (isSending) return;  // Proteccion double-click

  // Validacion de formulario
  const form = document.getElementById('broadcast-form');
  if (!Components.validateForm(form)) {
    Components.showToast('Complete los campos requeridos', 'error');
    return;
  }

  // Validacion de canales
  if (!whatsapp && !email) {
    Components.showToast('Seleccione al menos un canal', 'error');
    return;
  }

  // Reemplazo de variables
  const message = messageRaw
    .replace(/\{\{curso\}\}/g, courseName)
    .replace(/\{\{fecha\}\}/g, Components.formatDate(date))
    .replace(/\{\{motivo\}\}/g, subject);

  isSending = true;
  // ... llamada API ...

  try {
    const result = await API.sendBroadcast(payload);
    // Mostrar resultado exitoso
  } catch (error) {
    // Mostrar error
  } finally {
    isSending = false;  // Resetear flag
  }
};
```

### Excepciones - CRUD Operations

```javascript
// Crear excepcion
Views.directorExceptions.createException = async function() {
  const data = getFormData();
  await State.addScheduleException(data);
  closeModal();
  refresh();
};

// Eliminar excepcion
Views.directorExceptions.deleteException = async function(id) {
  if (confirm('Eliminar esta excepcion?')) {
    await State.deleteScheduleException(id);
    refresh();
  }
};
```

---

## 4. Comparacion: Diseno Original vs Implementacion

### Excepciones

| Elemento | Diseno | Implementacion | Estado |
|----------|--------|----------------|--------|
| Header h-20 | Con mobile menu | Identico | OK |
| Boton Nueva Excepcion | Gradient indigo→cyan | Identico | OK |
| Tabla estilizada | Bordes slate, hover | Identico | OK |
| Badge Global | Indigo con icono public | Identico | OK |
| Badge Curso | Orange con icono class | Identico | OK |
| Boton eliminar | Rojo con hover | Identico | OK |
| Paginacion | Con estados disabled | Identico | OK |
| Footer | © 2026 NEUVOX | Identico | OK |
| Dark mode | Colores adaptados | Identico | OK |

### Comunicados

| Elemento | Diseno | Implementacion | Estado |
|----------|--------|----------------|--------|
| Header h-20 | Con mobile menu | Identico | OK |
| Info Card | Blue theme con icono info | Identico | OK |
| Templates | 5 botones pill | Identico | OK |
| Template urgente | 5to template | AGREGADO | OK |
| Input Curso | Con icono groups | Identico | OK |
| Input Fecha | Con icono calendar_today | Identico | OK |
| Canal WhatsApp | Checkbox + icono verde | Identico | OK |
| Canal Email | Checkbox + icono azul | Identico | OK |
| Boton Vista Previa | Con icono visibility | Identico | OK |
| Boton Enviar | Gradient indigo→blue | Identico | OK |
| Footer | © 2026 NEUVOX | Identico | OK |
| Dark mode | Colores adaptados | Identico | OK |

---

## 5. Testing Funcional Completado

### Excepciones
- [x] Tabla de excepciones renderiza correctamente
- [x] Badge Global (indigo) muestra correctamente
- [x] Badge Curso (orange) muestra nombre del curso
- [x] Boton Nueva Excepcion abre modal
- [x] Formulario de creacion funciona
- [x] Eliminacion de excepciones funciona
- [x] Paginacion funciona
- [x] Dark mode toggle
- [x] Responsive en mobile (sidebar colapsable)

### Comunicados
- [x] Info Card blue theme visible
- [x] 5 Templates cargan correctamente (incluido "Aviso urgente")
- [x] Variables {{curso}}, {{fecha}}, {{motivo}} se reemplazan
- [x] Vista Previa muestra mensaje formateado
- [x] Iconos visibles en inputs (groups, calendar_today)
- [x] Checkboxes de canal con iconos coloreados
- [x] Validacion de campos requeridos
- [x] Validacion de al menos un canal seleccionado
- [x] Proteccion double-click funciona (isSending flag)
- [x] Dark mode toggle
- [x] Responsive en mobile

### Build de Produccion
- [x] `npm run build` exitoso
- [x] CSS incluye clases del safelist
- [x] Clases blue verificadas: `bg-blue-50`, `text-blue-600`, `text-blue-900`
- [x] Clases orange verificadas: `bg-orange-50`, `text-orange-600`
- [x] Gradients verificados: `to-cyan-500`, `to-blue-600`

---

## 6. Archivos Modificados

```
Preview Environment (3 archivos principales):

src/web-app-preview/tailwind.config.js
  - +30 lineas (safelist para Excepciones: orange badges, slate colors)
  - +20 lineas (safelist para Comunicados: blue theme, gradients)

src/web-app-preview/js/views/director_exceptions.js
  - Reescritura completa (~500 lineas)
  - Layout con sidebar NEUVOX estandarizado
  - Tabla con badges Global/Curso
  - Modal de creacion/edicion
  - Paginacion funcional
  - Preservada logica CRUD

src/web-app-preview/js/views/director_broadcast.js
  - Reescritura completa (~560 lineas)
  - Layout con sidebar NEUVOX estandarizado
  - Info Card blue theme
  - Panel Templates Rapidos (5 templates)
  - Formulario con iconos en inputs
  - Checkboxes de canal con iconos
  - Boton gradient indigo→blue
  - Preservada logica sendBroadcast con isSending flag
```

---

## 7. Gradients por Modulo

| Modulo | Gradient | Uso |
|--------|----------|-----|
| Reportes | indigo → purple | Boton "Generar Reporte" |
| Metricas | indigo → cyan | Boton "Exportar PDF" |
| Horarios | indigo → blue | Boton "Guardar Todo" |
| Excepciones | indigo → cyan | Boton "Nueva Excepcion" |
| Comunicados | indigo → blue | Boton "Enviar Comunicado" |

---

## 8. Colores Especificos por Modulo

### Excepciones
| Elemento | Light | Dark |
|----------|-------|------|
| Badge Global bg | indigo-50 | indigo-900/30 |
| Badge Global text | indigo-600 | indigo-400 |
| Badge Global border | indigo-100 | indigo-800 |
| Badge Curso bg | orange-50 | orange-900/30 |
| Badge Curso text | orange-600 | orange-400 |
| Badge Curso border | orange-100 | orange-800 |
| Tabla header bg | slate-50/50 | slate-800/50 |
| Tabla text | slate-700 | slate-300 |

### Comunicados
| Elemento | Light | Dark |
|----------|-------|------|
| Info card bg | blue-50 | blue-900/20 |
| Info card border | blue-100 | blue-800/50 |
| Info icon bg | blue-100 | blue-800 |
| Info icon text | blue-600 | blue-300 |
| Info title | blue-900 | blue-200 |
| Info text | blue-700 | blue-400 |
| WhatsApp icon | green-500 | green-500 |
| Email icon | blue-500 | blue-500 |
| Template btn hover | indigo-50 | indigo-900/30 |

---

## 9. Proximos Pasos Sugeridos

1. **Modulos restantes**: Dispositivos, Alumnos, Apoderados, Profesores, Cursos, Ausencias, Notificaciones, Biometria
2. **Migracion gradual**: Una vez validados todos los disenos, migrar a produccion
3. **Componentes reutilizables**: Extraer sidebar, header, modals a componentes compartidos
4. **Tests E2E**: Agregar tests con Playwright para validar flujos

---

## 10. Resumen de Estandarizacion

### Sidebar (Todos los modulos)
- Fondo: `bg-[#1e1b4b]`
- Borde activo: `border-l-4 border-indigo-500` (IZQUIERDA siempre)
- Background activo: `bg-indigo-800/50`

### Header (Todos los modulos)
- Altura: `h-20`
- Mobile menu: `desktop-hidden` con `toggleMobileSidebar()`
- Dark mode: Toggle con icono `dark_mode`/`light_mode`
- Usuario: Avatar + nombre + boton Salir

### Footer (Todos los modulos)
- Texto: `© 2026 NEUVOX. Todos los derechos reservados.`
- Clases: `text-center text-xs text-muted-light dark:text-muted-dark pt-8 pb-4`

---

*Completado el 20 de Enero de 2026*
*Modulos implementados: Excepciones, Comunicados*
