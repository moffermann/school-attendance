# Changelog: Rediseno Modulo Profesores

**Fecha:** 2026-01-20
**Modulo:** Director Teachers (Gestion de Profesores)
**Tipo:** Rediseno UI completo

## Resumen

Implementacion fiel del diseno HTML/Tailwind aprobado para el modulo de Profesores, siguiendo el patron establecido en los redisenos anteriores (Dashboard, Reportes, Metricas, Horarios, Excepciones, Comunicados, Dispositivos, Alumnos, Apoderados). Se preservo toda la funcionalidad CRUD, asignacion de cursos, filtros, exportacion CSV y QR/NFC enrollment existente.

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/web-app-preview/js/views/director_teachers.js` | Reescrito completo con layout Tailwind |
| `src/web-app-preview/tailwind.config.js` | Agregadas clases al safelist |

## Cambios Visuales Implementados

### Layout General
- **Sidebar NEUVOX**: Fondo `bg-[#1e1b4b]` con border activo `border-l-4 border-indigo-400`
- **Header estandarizado**: Altura `h-20` con titulo "Gestion de Profesores"
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

### Info Card (Blue Theme)
| Elemento | Estilo |
|----------|--------|
| Background | `bg-blue-50 dark:bg-blue-900/20` |
| Border | `border-blue-100 dark:border-blue-800` |
| Icono | `badge` en contenedor blanco/blue |
| Titulo | "Gestion de Profesores" bold |
| Descripcion | Texto explicativo del modulo |

### Seccion Titulo + Boton
| Elemento | Estilo |
|----------|--------|
| Layout | `flex justify-between items-end` |
| Titulo | "Profesores del Establecimiento (N)" con contador |
| Subtitulo | "N profesor(es) registrado(s)" |
| Boton | Gradient `from-indigo-600 to-purple-600` con icono `add` |

### Seccion de Filtros (Card - Grid 12 columnas)
| Elemento | Col-span | Estilo |
|----------|----------|--------|
| Buscar profesor | `md:col-span-4` | Input con icono search |
| Curso | `md:col-span-3` | Dropdown todos los cursos |
| Estado | `md:col-span-2` | Dropdown Todos/Activo/Inactivo/Con licencia/Eliminados |
| Botones | `md:col-span-3` | Limpiar + Exportar |

### Tabla de Profesores
- **Header Card**: `bg-white dark:bg-card-dark` con "Lista de Profesores (N)"
- **Header Tabla**: `text-xs font-bold uppercase tracking-wider`
- **Filas**: `hover:bg-gray-50/50 dark:hover:bg-slate-800/30`

### Columnas de la Tabla

| Columna | Contenido | Estilo |
|---------|-----------|--------|
| Nombre | Avatar 10x10 + nombre bold | Avatar con iniciales y colores rotativos |
| Email | Texto | `text-sm text-slate-600 dark:text-slate-400` |
| Cursos Asignados | Badge(s) indigo | `bg-indigo-50 text-indigo-700 rounded-full` |
| Estado | Badge pill con dot | Activo (emerald), Inactivo (slate), Con licencia (amber), Eliminado (red) |
| Acciones | 4 botones icono | Ver, Editar, Cursos, Eliminar |

### Avatar con Iniciales (NUEVO)
```javascript
// Array de colores para avatares (rotar por indice)
const avatarColors = [
  { bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400' },
  { bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
  { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
  { bg: 'bg-teal-50 dark:bg-teal-900/30', text: 'text-teal-600 dark:text-teal-400' },
];
```

### Status Badge con Dot (NUEVO)
| Estado | Color Background | Color Dot | Color Text |
|--------|------------------|-----------|------------|
| Activo | `bg-emerald-100` | `bg-emerald-500` | `text-emerald-700` |
| Inactivo | `bg-slate-100` | `bg-slate-400` | `text-slate-600` |
| Con licencia | `bg-amber-100` | `bg-amber-500` | `text-amber-700` |
| Eliminado | `bg-red-100` | `bg-red-500` | `text-red-600` |

### Botones de Accion (4 por fila)

| Boton | Icono | Hover | Accion |
|-------|-------|-------|--------|
| Ver Perfil | `visibility` | `hover:bg-indigo-50` | viewProfile() |
| Editar | `edit` | `hover:bg-indigo-50` | showEditForm() |
| Gestionar Cursos | `book` | `hover:bg-indigo-50` | assignCourses() |
| Eliminar | `delete` | `hover:bg-red-50` | confirmDelete() |

### Paginacion (Chevron Icons)
- Footer con `border-t border-slate-50`
- Botones chevron `chevron_left` y `chevron_right`
- Texto "Mostrando X a Y de Z registros"
- PAGE_SIZE = 15 profesores por pagina

### Estado Eliminado
- Fila con `opacity-70`
- Solo muestra boton "Restaurar" (verde con icono `restore`)

## Funcionalidad Backend Preservada

### API Calls (NO MODIFICADAS)
```javascript
State.refreshTeachers({ status: status || undefined })
State.getTeachers()
State.getTeacher(teacherId)
State.addTeacher(teacherData)
State.updateTeacher(teacherId, teacherData)
State.deleteTeacher(teacherId)
State.restoreTeacher(teacherId)
State.assignCourseToTeacher(teacherId, courseId)
State.unassignCourseFromTeacher(teacherId, courseId)
State.exportTeachersCSV({ status: status || undefined })
```

### Todas las Funciones Preservadas

| Funcion | Descripcion |
|---------|-------------|
| `Views.directorTeachers()` | Entry point principal (async) |
| `renderTeachers()` | Re-render completo |
| `updateTableContent()` | Update incremental de tabla |
| `getFilteredTeachers()` | Logica de filtros |
| `getTeacherCourses(teacherId)` | Helper para cursos asignados |
| `renderTableRows(filtered)` | Genera filas de tabla |
| `renderPagination(filtered)` | Genera paginacion |
| `search(term)` | Busqueda por nombre/email |
| `filterByCourse(courseId)` | Filtro por curso asignado |
| `filterByStatus(status)` | Filtro ACTIVE/INACTIVE/ON_LEAVE/DELETED |
| `clearFilters()` | Reset filtros |
| `changePage(page)` | Cambio de pagina |
| `showCreateForm()` | Modal crear profesor |
| `showEditForm(id)` | Modal editar profesor |
| `saveTeacher(id?)` | Create/Update |
| `viewProfile(id)` | Modal perfil con QR/NFC enrollment |
| `assignCourses(id)` | Modal gestionar cursos |
| `saveCourseAssignments(id)` | Guardar asignaciones |
| `confirmDelete(id)` | Modal confirmacion eliminar |
| `confirmRestore(id)` | Modal confirmacion restaurar |
| `exportCSV()` | Exportar a CSV |
| `toggleSidebar()` | Toggle mobile sidebar |
| `toggleDarkMode()` | Toggle dark mode |

## Safelist Agregado (tailwind.config.js)

```javascript
// ===== PROFESORES MODULE =====
// Info card (blue theme - uses same classes as COMUNICADOS)

// Avatar colors (rotating)
'bg-purple-50', 'text-purple-600',
'dark:bg-purple-900/30', 'dark:text-purple-600',
'bg-teal-50', 'text-teal-600',
'dark:bg-teal-900/30', 'dark:text-teal-600', 'dark:text-teal-400',

// Status badge with dot
'w-1.5', 'h-1.5', 'mr-1.5',

// Avatar size
'w-10', 'h-10',

// Table row hover (gray version)
'hover:bg-gray-50/50',

// Filter grid (md:col-span variants)
'md:col-span-4', 'md:col-span-3', 'md:col-span-2',
'md:grid-cols-12',

// Pagination chevron buttons
'p-1',
```

## Diferencias con Diseno Anterior

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| Layout | CSS variables antiguo | Tailwind moderno |
| Info card | Blue con emoji | Blue con icono `badge` |
| Avatar | Ninguno | 10x10 con iniciales y colores rotativos |
| Filtros | Flex wrap basico | Grid 12 columnas |
| Tabla | Basica sin estilos | rounded-xl con shadow |
| Course badge | Components.createChip | Indigo rounded-full |
| Status badge | Chip sin dot | Badge con dot indicator |
| Acciones | Emojis | 4 iconos Material |
| Paginacion | Botones texto | Chevron icons |

## Consistencia con Otros Modulos

| Elemento | Dashboard | Reportes | Metricas | Dispositivos | Alumnos | Apoderados | Profesores |
|----------|-----------|----------|----------|--------------|---------|------------|------------|
| Header h-20 | Si | Si | Si | Si | Si | Si | Si |
| Sidebar border-l-4 | Si | Si | Si | Si | Si | Si | Si |
| Footer NEUVOX | Si | Si | Si | Si | Si | Si | Si |
| Mobile sidebar | Si | Si | Si | Si | Si | Si | Si |
| Dark mode | Si | Si | Si | Si | Si | Si | Si |
| Gradient button | - | indigo-purple | indigo-cyan | indigo-purple | indigo | indigo-blue | indigo-purple |
| Paginacion | - | - | - | Si | Si | Si | Si |
| Avatar | - | - | - | - | 9x9 | - | 10x10 con colores |

## Verificacion

### Build
```bash
npm run build
# Output: 120.38 kB CSS (gzip: 19.73 kB)
# Status: SUCCESS
```

### Checklist Visual
- [x] Info card blue con icono badge
- [x] Titulo "Profesores del Establecimiento (N)"
- [x] Subtitulo con conteo
- [x] Boton gradient "Nuevo Profesor" a la derecha (flex justify-between items-end)
- [x] Grid de filtros 12 columnas con icono search
- [x] Tabla con header slate uppercase
- [x] Avatares 10x10 con iniciales y colores rotativos
- [x] Badges de cursos indigo rounded-full
- [x] Badges de estado con dot (emerald/slate/amber/red)
- [x] 4 action buttons con hover colors
- [x] Paginacion con chevron icons
- [x] Footer NEUVOX

### Checklist Funcional
- [x] CRUD completo (crear, editar, eliminar, restaurar)
- [x] Filtros reactivos (busqueda, curso, estado)
- [x] Limpiar filtros
- [x] Paginacion funcional (15 por pagina)
- [x] Ver perfil completo con QR/NFC enrollment
- [x] Gestionar cursos asignados
- [x] Guardar asignaciones de cursos
- [x] Export CSV
- [x] Dark mode toggle
- [x] Mobile sidebar toggle
- [x] Toast notifications

## Notas Adicionales

- El grid de filtros usa 12 columnas para distribucion optima en desktop
- Los profesores eliminados muestran solo el boton "Restaurar" con estilo verde
- La paginacion reinicia a pagina 1 cuando cambian los filtros
- Los iconos Material Icons Round reemplazan los emojis anteriores
- Los modales de CRUD usan estilos CSS variables existentes (no Tailwind)
- Los avatares tienen colores rotativos (indigo, purple, blue, teal) basados en el indice
- El status badge incluye un dot indicator de color para mejor visibilidad
- El layout del titulo + boton usa `flex justify-between items-end` (patron corregido de Dispositivos)
