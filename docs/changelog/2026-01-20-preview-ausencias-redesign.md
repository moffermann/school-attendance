# Changelog: Rediseno Modulo Ausencias

**Fecha:** 2026-01-20
**Modulo:** Director Absences (Solicitudes de Ausencia)
**Tipo:** Rediseno UI completo

## Resumen

Implementacion fiel del diseno HTML/Tailwind aprobado para el modulo de Ausencias, siguiendo el patron establecido en los redisenos anteriores (Dashboard, Reportes, Metricas, Horarios, Excepciones, Comunicados, Dispositivos, Alumnos, Apoderados, Profesores). Se preservo toda la funcionalidad CRUD, tabs por estado, filtros, aprobar/rechazar, exportacion CSV y descarga de adjuntos autenticada.

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/web-app-preview/js/views/director_absences.js` | Reescrito completo con layout Tailwind |
| `src/web-app-preview/tailwind.config.js` | Agregadas clases al safelist |

## Cambios Visuales Implementados

### Layout General
- **Sidebar NEUVOX**: Fondo `bg-[#1e1b4b]` con border activo `border-l-4 border-indigo-400`
- **Header estandarizado**: Altura `h-20` con titulo "Solicitudes de Ausencia"
- **Mobile sidebar**: Boton hamburguesa con clase `desktop-hidden` + overlay para responsive
- **Dark mode**: Toggle funcional con variantes `dark:`
- **Footer**: "(c) 2026 NEUVOX. Todos los derechos reservados."

### Header (Estandarizado con Dashboard)
| Elemento | Clase/Estilo |
|----------|--------------|
| Boton menu movil | `desktop-hidden` (oculto en desktop) |
| Separador vertical | `mobile-hidden` (oculto en movil) |
| Nombre usuario | `mobile-hidden` en div a la derecha del avatar |
| Avatar | `w-9 h-9 bg-indigo-600 text-white` con inicial |
| Boton Salir | `<a>` con icono `logout` + texto `mobile-hidden` |

### Seccion Titulo + Boton
| Elemento | Estilo |
|----------|--------|
| Layout | `flex flex-col md:flex-row justify-between items-start md:items-center gap-4` |
| Titulo | "Solicitudes de Ausencia" bold |
| Subtitulo | "Gestione las solicitudes de ausencia de los alumnos" |
| Boton | Gradient `bg-primary-gradient` con icono `add` |

### KPI Cards (3 cards con border-left)
| Card | Color Border | Color Texto |
|------|--------------|-------------|
| Pendientes | `border-l-4 border-indigo-500` | `text-indigo-600 dark:text-indigo-400` |
| Aprobadas | `border-l-4 border-emerald-500` | `text-emerald-600 dark:text-emerald-400` |
| Rechazadas | `border-l-4 border-rose-400` | `text-rose-500 dark:text-rose-400` |

### Card de Filtros (Grid 6 columnas)
| Elemento | Col-span | Estilo |
|----------|----------|--------|
| Buscar | `md:col-span-2` | Input con icono search |
| Tipo | - | Dropdown todos/vacaciones/familiar/medico/otro |
| Desde | - | Input date |
| Hasta | - | Input date |
| Botones | - | Limpiar + Exportar |

### Tabs con Estilo Gradient
| Tab | Estilo Activo | Estilo Inactivo |
|-----|---------------|-----------------|
| Pendientes | `tab-active` (gradient) | `text-gray-500 hover:bg-gray-100` |
| Aprobadas | `tab-active` (gradient) | `text-gray-500 hover:bg-gray-100` |
| Rechazadas | `tab-active` (gradient) | `text-gray-500 hover:bg-gray-100` |

### Tabla de Solicitudes
- **Header Card**: `bg-white dark:bg-card-dark rounded-custom`
- **Header Tabla**: `text-xs font-bold uppercase tracking-wider`
- **Filas**: `hover:bg-gray-50/50 dark:hover:bg-slate-800/30`

### Columnas de la Tabla (8)

| Columna | Contenido | Estilo |
|---------|-----------|--------|
| Alumno | Avatar 8x8 + nombre | Iniciales con colores rotativos |
| Curso | Texto | `text-sm text-gray-600` |
| Tipo | Badge pill | Colores segun tipo |
| Fechas | Rango DD-MM-YYYY | `text-sm text-gray-600` |
| Dias | Numero + "dias" | Con subtext `text-[10px]` |
| Adjunto | Icono attachment | Clickeable o "-" |
| Fecha Solicitud | Fecha | `text-sm text-gray-600` |
| Acciones | 4 botones | Solo en tab Pendientes |

### Avatar con Iniciales (8x8)
```javascript
// Colores rotativos para avatares
const avatarColors = [
  { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400' },
  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400' },
];
```

### Badges de Tipo de Ausencia
| Tipo | Background | Texto |
|------|------------|-------|
| Vacaciones | `bg-emerald-100` | `text-emerald-700` |
| Familiar | `bg-blue-100` | `text-blue-700` |
| Medico | `bg-amber-100` | `text-amber-700` |
| Otro | `bg-gray-100` | `text-gray-600` |

### Botones de Accion (4 por fila - solo en Pendientes)

| Boton | Icono | Hover | Accion |
|-------|-------|-------|--------|
| Ver | `visibility` | `hover:bg-indigo-50` | showDetail() |
| Aprobar | `check_circle` | `hover:bg-emerald-50` | approve() |
| Rechazar | `cancel` | `hover:bg-orange-50` | showRejectModal() |
| Eliminar | `delete` | `hover:bg-rose-50` | confirmDelete() |

### Footer de Tabla (Paginacion Simple)
- Texto "Mostrando X de Y solicitudes"
- Boton "Cargar mas" si hay mas registros
- Estilo `text-indigo-600 border-indigo-200`

## Funcionalidad Backend Preservada

### API Calls (NO MODIFICADAS)
```javascript
API.getAbsencesPaginated(filters, offset, limit)
API.getAbsenceStats()
API.submitAbsence(data)
API.approveAbsence(absenceId)
API.rejectAbsence(absenceId, reason)
API.deleteAbsence(absenceId)
API.searchAbsences(term, limit)
API.exportAbsencesCSV(filters)
```

### Todas las Funciones Preservadas

| Funcion | Descripcion |
|---------|-------------|
| `Views.directorAbsences()` | Entry point principal (async) |
| `loadAbsences(append)` | Cargar solicitudes con paginacion |
| `loadStats()` | Cargar contadores |
| `renderLayout()` | Render layout principal |
| `renderAbsences()` | Re-render contenido |
| `renderAbsencesList()` | Genera tabla |
| `renderAbsenceRow(absence, index)` | Genera fila de tabla |
| `renderCreateForm()` | Formulario nueva solicitud |
| `renderStudentOptions(courseId)` | Helper alumnos por curso |
| `switchTab(tab)` | Cambiar PENDING/APPROVED/REJECTED |
| `search(term)` | Busqueda con debounce |
| `filterByType(type)` | Filtro por tipo |
| `filterByStartDate(date)` | Filtro fecha inicio |
| `filterByEndDate(date)` | Filtro fecha fin |
| `clearFilters()` | Reset filtros |
| `toggleCreateForm()` | Toggle formulario creacion |
| `filterStudentsByCourse(courseId)` | Actualizar select alumnos |
| `submitNewAbsence()` | Crear nueva solicitud |
| `loadMore()` | Cargar mas (paginacion) |
| `approve(id)` | Aprobar solicitud |
| `showRejectModal(id)` | Modal rechazar |
| `reject(id)` | Rechazar solicitud |
| `confirmDelete(id)` | Modal confirmar eliminar |
| `delete(id)` | Eliminar solicitud |
| `exportCSV()` | Exportar a CSV |
| `showDetail(id)` | Modal detalle completo |
| `downloadAttachment(ref, filename)` | Descargar adjunto autenticado |
| `refresh()` | Refrescar datos |
| `toggleSidebar()` | Toggle mobile sidebar |
| `toggleDarkMode()` | Toggle dark mode |

## Safelist Agregado (tailwind.config.js)

```javascript
// ===== AUSENCIAS MODULE =====
// KPI Cards border-left
'border-l-indigo-500', 'border-l-emerald-500', 'border-l-rose-400',

// KPI text colors (rose)
'text-rose-500', 'dark:text-rose-400',

// Tabs gradient active
'tab-active',

// Action buttons (emerald for approve)
'text-emerald-500', 'hover:bg-emerald-50', 'dark:hover:bg-emerald-900/30',

// Action buttons (orange for reject)
'hover:bg-orange-50', 'dark:hover:bg-orange-900/30',

// Action buttons (rose for delete)
'hover:bg-rose-50', 'dark:hover:bg-rose-900/30',

// Filter grid (6 columns)
'md:col-span-2', 'lg:grid-cols-6',

// Rounded custom
'rounded-custom',
```

## Diferencias con Diseno Anterior

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| Layout | Components.createLayout (CSS vars) | Tailwind moderno con sidebar/header |
| Info card | Components.createStatCard | 3 KPI cards con border-left |
| Filtros | Flex wrap basico | Grid 6 columnas |
| Tabs | btn-primary/secondary con border | Gradient activo `tab-active` |
| Tabla | Basica sin estilos | rounded-custom con shadow |
| Avatar | Ninguno | 8x8 con iniciales y colores rotativos |
| Type badge | Components.createChip | Pill rounded-full uppercase |
| Dias | Sin subtext | Con subtext "dias" |
| Adjunto | Emoji 📎 | Icon `attachment` Material |
| Acciones | Emojis (👁✓✕🗑) | 4 iconos Material con hover colors |
| Footer | Boton "Cargar mas" basico | Footer con contador + boton styled |

## Consistencia con Otros Modulos

| Elemento | Dashboard | Dispositivos | Alumnos | Profesores | Ausencias |
|----------|-----------|--------------|---------|------------|-----------|
| Header h-20 | Si | Si | Si | Si | Si |
| Sidebar border-l-4 | Si | Si | Si | Si | Si |
| Footer NEUVOX | Si | Si | Si | Si | Si |
| Mobile sidebar | Si | Si | Si | Si | Si |
| Dark mode | Si | Si | Si | Si | Si |
| Gradient button | - | indigo-purple | indigo | indigo-purple | primary-gradient |
| Avatar | - | - | 9x9 | 10x10 | 8x8 |
| Tabs | - | - | - | - | gradient |

## Verificacion

### Build
```bash
npm run build
# Output: 123.15 kB CSS (gzip: 20.02 kB)
# Status: SUCCESS
```

### Checklist Visual
- [x] Titulo "Solicitudes de Ausencia" con subtitulo
- [x] Boton gradient "Nueva Solicitud"
- [x] 3 KPI cards con border-left (Pendientes/Aprobadas/Rechazadas)
- [x] Grid de filtros 6 columnas con icono search
- [x] Tabs con gradient activo
- [x] Tabla con header gray uppercase
- [x] Avatares 8x8 con iniciales y colores rotativos
- [x] Badges de tipo pill uppercase (emerald/blue/amber/gray)
- [x] Columna dias con subtext "dias"
- [x] Icono attachment para adjuntos
- [x] 4 action buttons con colores (solo en Pendientes)
- [x] Footer con contador de registros
- [x] Footer NEUVOX

### Checklist Funcional
- [x] CRUD completo (crear, aprobar, rechazar, eliminar)
- [x] Tabs reactivos (Pendientes/Aprobadas/Rechazadas)
- [x] Filtros (busqueda, tipo, fechas)
- [x] Limpiar filtros
- [x] Paginacion funcional (Cargar mas)
- [x] Ver detalle completo en modal
- [x] Aprobar solicitud con toast
- [x] Rechazar solicitud con razon opcional
- [x] Eliminar solicitud con confirmacion
- [x] Descargar adjunto autenticado
- [x] Export CSV
- [x] Dark mode toggle
- [x] Mobile sidebar toggle
- [x] Toast notifications
- [x] Formulario inline para nueva solicitud

## Correcciones Post-Implementacion

### Fix 1: Agregar Biometria al Sidebar
- Se agrego el item `{ icon: 'fingerprint', label: 'Biometria', route: '/director/biometric' }` al array menuItems
- Ahora el sidebar tiene todos los 14 links consistentes con los demas modulos

### Fix 2: Boton "Nueva Solicitud"
- **Problema**: La clase `bg-primary-gradient` no estaba definida en el CSS
- **Solucion**: Reemplazar con clases inline `bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700`
- Se agrego clase `.submit-btn` al boton del formulario para el querySelector
- El boton ahora tiene color gradient indigo-purple visible

---

## Notas Adicionales

- El grid de filtros usa 6 columnas para distribucion optima en desktop
- Los botones de accion solo aparecen en el tab "Pendientes"
- Las fechas se muestran en formato DD-MM-YYYY en la tabla
- La columna "Dias" incluye subtext "dias" con `text-[10px]`
- Los avatares tienen colores rotativos (indigo, blue, purple, teal) basados en el indice
- El formulario de nueva solicitud es inline (colapsable) con borde indigo
- Los modales de aprobar/rechazar/eliminar usan el sistema Components.showModal existente
- La descarga de adjuntos usa autenticacion con Bearer token
- El tab activo usa la clase `tab-active` con gradiente definido en CSS
