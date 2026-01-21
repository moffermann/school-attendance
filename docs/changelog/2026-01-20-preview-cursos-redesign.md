# Changelog: Rediseno Modulo Cursos

**Fecha:** 2026-01-20
**Modulo:** Director Courses (Gestion de Cursos)
**Tipo:** Rediseno UI completo

## Resumen

Implementacion fiel del diseno HTML/Tailwind aprobado para el modulo de Cursos, siguiendo el patron establecido en los redisenos anteriores (Dashboard, Reportes, Metricas, Horarios, Excepciones, Comunicados, Dispositivos, Alumnos, Apoderados, Profesores, Ausencias). Se preservo toda la funcionalidad CRUD, filtros y exportacion CSV.

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/web-app-preview/js/views/director_courses.js` | Reescrito completo con layout Tailwind |
| `src/web-app-preview/tailwind.config.js` | Agregada clase `md:col-span-5` al safelist |

## Cambios Visuales Implementados

### Layout General
- **Sidebar NEUVOX**: Fondo `bg-[#1e1b4b]` con border activo `border-l-4 border-indigo-400`
- **Header estandarizado**: Altura `h-20` con titulo "Gestion de Cursos"
- **Mobile sidebar**: Boton hamburguesa con clase `desktop-hidden` + overlay para responsive
- **Dark mode**: Toggle funcional con variantes `dark:`
- **Footer**: "(c) 2026 NEUVOX. Todos los derechos reservados."

### Header (Estandarizado con Dashboard)
| Elemento | Clase/Estilo |
|----------|--------------|
| Boton menu movil | `desktop-hidden` (oculto en desktop) |
| Separador vertical | `h-8 w-px bg-gray-200 mobile-hidden` |
| Nombre usuario | `mobile-hidden` en div a la derecha del avatar |
| Avatar | `w-9 h-9 bg-indigo-600 text-white rounded-full` con inicial |
| Boton Dark Mode | Toggle `dark_mode`/`light_mode` icon |
| Boton Salir | `<a>` con icono `logout` + texto `mobile-hidden` |

### Seccion Titulo + Boton
| Elemento | Estilo |
|----------|--------|
| Layout | `flex items-center justify-between flex-wrap gap-4` |
| Titulo | "Gestion de Cursos" bold con contador `(N)` |
| Subtitulo | "Administracion de niveles academicos y secciones" |
| Boton | Gradient `bg-gradient-to-r from-indigo-600 to-purple-600` con icono `add` |

### Card de Filtros (Grid 12 columnas)
| Elemento | Col-span | Estilo |
|----------|----------|--------|
| Buscar curso | `md:col-span-4` | Input con icono search |
| Grado | `md:col-span-3` | Dropdown con opciones dinamicas |
| Botones | `md:col-span-5` | Filtrar + Exportar con iconos Material |

### Card de Tabla con Header
```html
<div class="bg-white dark:bg-card-dark rounded-custom shadow-sm border...">
  <div class="px-6 py-4 border-b">Lista de Cursos (N)</div>
  <table>...</table>
  <div class="footer paginacion">...</div>
</div>
```

### Columnas de la Tabla (6)

| Columna | Contenido | Estilo |
|---------|-----------|--------|
| Nombre | Texto bold | `font-bold text-gray-800 dark:text-white` |
| Grado | Texto | `text-sm text-gray-600 dark:text-gray-400` |
| Alumnos | Contador | `text-sm text-gray-600` |
| Horarios | Contador | `text-sm text-gray-600` |
| Estado | Badge pill con dot | Colores segun estado |
| Acciones | 3 botones | Ver, Editar, Eliminar |

### Status Badge con Dot Indicator
| Estado | Background | Texto | Dot Color |
|--------|------------|-------|-----------|
| Activo | `bg-emerald-100 dark:bg-emerald-900/30` | `text-emerald-700 dark:text-emerald-400` | `bg-emerald-500` |
| Archivado | `bg-amber-100 dark:bg-amber-900/30` | `text-amber-700 dark:text-amber-400` | `bg-amber-500` |
| Eliminado | `bg-red-100 dark:bg-red-900/30` | `text-red-700 dark:text-red-400` | `bg-red-500` |

### Botones de Accion (3 por fila)

| Boton | Icono | Hover | Accion |
|-------|-------|-------|--------|
| Ver | `visibility` | `hover:bg-indigo-50 dark:hover:bg-indigo-900/30` | Router.navigate() |
| Editar | `edit` | `hover:bg-indigo-50 dark:hover:bg-indigo-900/30` | showEditForm() |
| Eliminar | `delete` | `hover:bg-red-50 dark:hover:bg-red-900/30` | confirmDelete() |

### Footer de Tabla (Paginacion)
- Texto "Mostrando 1 a X de Y registros"
- Botones chevron_left/chevron_right (decorativos)
- Estilo `border-gray-200 dark:border-slate-600`

## Funcionalidad Backend Preservada

### State Calls (NO MODIFICADAS)
```javascript
State.getCourses()
State.getCourse(courseId)
State.getStudents()
State.getSchedules()
State.getTeachers()
State.createCourse({ name, grade, teacher_ids })
State.updateCourse(courseId, { name, grade, teacher_ids })
State.deleteCourse(courseId)
State.exportCoursesCSV({ grade })
State.isDemoMode()
```

### Todas las Funciones Preservadas

| Funcion | Descripcion |
|---------|-------------|
| `Views.directorCourses()` | Entry point principal |
| `getUniqueGrades()` | Obtener grados unicos para filtro |
| `setLoading(loading)` | Gestion estado de carga |
| `renderLayout()` | Render layout principal |
| `renderContent()` | Render contenido (filtros + tabla) |
| `renderCourseRow(course, index)` | Genera fila de tabla |
| `applyFilters()` | Aplicar filtros de busqueda y grado |
| `showCreateForm()` | Modal para nuevo curso |
| `saveCourse(courseId)` | Crear/actualizar curso |
| `showEditForm(courseId)` | Modal para editar curso |
| `confirmDelete(courseId)` | Modal confirmar eliminacion |
| `deleteCourse(courseId)` | Eliminar curso |
| `viewDetails(courseId)` | Navegar a detalle |
| `exportCSV()` | Exportar a CSV |
| `toggleSidebar()` | Toggle mobile sidebar |
| `toggleDarkMode()` | Toggle dark mode |

## Safelist Agregado (tailwind.config.js)

```javascript
// Grid 12 columns - col-span-5 para botones
'md:col-span-5',
```

## Correcciones Dark Mode Aplicadas

El HTML aprobado tenia inconsistencias con dark mode que fueron corregidas durante la implementacion:

| Elemento | Problema | Correccion |
|----------|----------|------------|
| Table Header | Faltaba `dark:bg-slate-800/50` | Agregado |
| Tbody | Faltaba `dark:divide-slate-700` | Agregado |
| Table Rows | Faltaba `dark:hover:bg-slate-800/30` | Agregado |
| Input Search | Faltaba border y dark mode | Agregadas clases completas |
| Select | Faltaba dark mode styles | Agregadas clases completas |
| Status Badge | Faltaba dark mode | Agregadas variantes `dark:` |
| Button Gradient | Usaba `bg-primary-gradient` (no existe) | Clases inline + `dark:shadow-none` |

## Diferencias con Diseno Anterior

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| Layout | Components.createLayout (CSS vars) | Tailwind moderno con sidebar/header |
| Filtros | Flex wrap basico | Grid 12 columnas (4+3+5) |
| Titulo | Sin contador | Con contador "(N)" |
| Boton nuevo | btn-primary con "+" | Gradient + icon Material |
| Tabla | Basica sin estilos | rounded-custom con shadow |
| Status badge | Components.createChip | Pill con dot indicator |
| Acciones | Emojis (ojo, lapiz, basura) | 3 iconos Material con hover colors |
| Footer tabla | Sin paginacion | Footer con paginacion decorativa |
| Footer pagina | Ninguno | (c) 2026 NEUVOX |

## Consistencia con Otros Modulos

| Elemento | Dashboard | Dispositivos | Alumnos | Profesores | Ausencias | Cursos |
|----------|-----------|--------------|---------|------------|-----------|--------|
| Header h-20 | Si | Si | Si | Si | Si | Si |
| Sidebar border-l-4 | Si | Si | Si | Si | Si | Si |
| Footer NEUVOX | Si | Si | Si | Si | Si | Si |
| Mobile sidebar | Si | Si | Si | Si | Si | Si |
| Dark mode | Si | Si | Si | Si | Si | Si |
| Gradient button | - | indigo-purple | indigo | indigo-purple | indigo-purple | indigo-purple |
| Status badge dot | - | - | - | Si | - | Si |

## Verificacion

### Build
```bash
npm run build
# Output: 123.45 kB CSS (gzip: 20.06 kB)
# Status: SUCCESS
```

### Checklist Visual
- [x] Titulo "Gestion de Cursos" con contador y subtitulo
- [x] Boton gradient "Nuevo Curso" alineado a la derecha
- [x] Grid de filtros 12 columnas (4+3+5)
- [x] Input busqueda con icono search
- [x] Select grado con opciones dinamicas
- [x] Botones Filtrar y Exportar con iconos Material
- [x] Card de tabla con header "Lista de Cursos"
- [x] Tabla con header gray uppercase
- [x] Status badge pill con dot (emerald/amber/red)
- [x] 3 action buttons con hover colors
- [x] Footer paginacion con chevrons
- [x] Footer (c) 2026 NEUVOX

### Checklist Funcional
- [x] Buscar por nombre de curso
- [x] Filtrar por grado
- [x] Crear nuevo curso con profesores
- [x] Editar curso existente
- [x] Eliminar curso (validacion de dependencias)
- [x] Ver detalle navega a ruta /director/courses/:id
- [x] Exportar CSV descarga archivo
- [x] Dark mode toggle
- [x] Mobile sidebar toggle
- [x] Toast notifications

---

## Notas Adicionales

- El grid de filtros usa 12 columnas para distribucion optima (4+3+5)
- Los botones de accion tienen hover colors diferenciados (indigo para ver/editar, red para eliminar)
- La paginacion es decorativa (el codigo actual no pagina realmente)
- Los status badges usan dot indicator (w-1.5 h-1.5) como en Profesores
- El formulario de crear/editar curso usa Components.showModal existente
- La navegacion a detalle usa Router.navigate('/director/courses/${id}')
- Todas las correcciones de dark mode fueron aplicadas durante la implementacion
