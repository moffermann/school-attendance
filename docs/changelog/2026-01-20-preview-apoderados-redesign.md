# Changelog: Rediseno Modulo Apoderados

**Fecha:** 2026-01-20
**Modulo:** Director Guardians (Gestion de Apoderados)
**Tipo:** Rediseno UI completo

## Resumen

Implementacion fiel del diseno HTML/Tailwind aprobado para el modulo de Apoderados, siguiendo el patron establecido en los redisenos anteriores (Dashboard, Reportes, Metricas, Horarios, Excepciones, Comunicados, Dispositivos, Alumnos). Se preservo toda la funcionalidad CRUD, asociacion de alumnos, filtros y exportacion CSV existente.

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/web-app-preview/js/views/director_guardians.js` | Reescrito completo con layout Tailwind |
| `src/web-app-preview/tailwind.config.js` | Agregadas clases al safelist |

## Cambios Visuales Implementados

### Layout General
- **Sidebar NEUVOX**: Fondo `bg-[#1e1b4b]` con border activo `border-l-4 border-indigo-400`
- **Header estandarizado**: Altura `h-20` con titulo "Gestion de Apoderados"
- **Mobile sidebar**: Boton hamburguesa + overlay para responsive
- **Dark mode**: Toggle funcional con variantes `dark:`
- **Footer**: "(c) 2026 NEUVOX. Todos los derechos reservados."

### Info Card (Nuevo)
| Elemento | Estilo |
|----------|--------|
| Background | `bg-indigo-50 dark:bg-indigo-900/20` |
| Icono | `family_restroom` en contenedor indigo |
| Titulo | "Gestion de Apoderados" bold |
| Descripcion | Texto explicativo del modulo |

### Seccion Titulo + Boton
| Elemento | Estilo |
|----------|--------|
| Titulo | "Apoderados del Establecimiento (N)" con contador |
| Subtitulo | "N apoderado(s) registrado(s)" |
| Boton | Gradient `from-indigo-600 to-blue-600` con icono `add` |

### Seccion de Filtros (Card - Grid 12 columnas)
| Elemento | Col-span | Estilo |
|----------|----------|--------|
| Buscar apoderado | `lg:col-span-4` | Input con placeholder |
| Alumno | `lg:col-span-3` | Dropdown todos los alumnos |
| Estado | `lg:col-span-2` | Dropdown Todos/Activo/Eliminados |
| Botones | `lg:col-span-3` | Limpiar + Exportar |

### Tabla de Apoderados
- **Header Card**: `bg-white dark:bg-card-dark` con "Lista de Apoderados (N)"
- **Header Tabla**: `text-[11px] font-bold uppercase tracking-wider`
- **Filas**: `hover:bg-slate-50 dark:hover:bg-slate-800/30`

### Columnas de la Tabla

| Columna | Contenido | Estilo |
|---------|-----------|--------|
| Nombre | Texto bold | `font-bold text-slate-900 dark:text-white` |
| Email | Texto | `text-slate-500 dark:text-slate-400` |
| Telefono | Texto | `text-slate-500 dark:text-slate-400` |
| Alumnos Asociados | Badge(s) indigo | `bg-indigo-50 text-indigo-700 border-indigo-100` |
| Estado | Badge pill | Activo (green), Eliminado (red) |
| Acciones | 4 botones icono | Ver, Editar, Gestionar, Eliminar |

### Botones de Accion (4 por fila)

| Boton | Icono | Hover | Accion |
|-------|-------|-------|--------|
| Ver Perfil | `person` | `hover:bg-indigo-50` | viewProfile() |
| Editar | `edit` | `hover:bg-blue-50` | showEditForm() |
| Gestionar Alumnos | `group` | `hover:bg-purple-50` | manageStudents() |
| Eliminar | `delete` | `hover:bg-red-50` | confirmDelete() |

### Paginacion
- Footer con `border-t border-slate-100`
- Botones "Anterior" y "Siguiente"
- Texto "Mostrando X a Y de Z resultados"
- Texto "Pagina X de Y"
- PAGE_SIZE = 15 apoderados por pagina

### Estado Eliminado
- Fila con `opacity-70`
- Solo muestra boton "Restaurar" (verde con icono `restore`)

## Funcionalidad Backend Preservada

### API Calls (NO MODIFICADAS)
```javascript
State.refreshGuardians({ status: status || undefined })
State.getGuardians()
State.getGuardian(guardianId)
State.addGuardian(guardianData)
State.updateGuardian(guardianId, guardianData)
State.deleteGuardian(guardianId)
State.restoreGuardian(guardianId)
State.setGuardianStudents(guardianId, studentIds)
State.exportGuardiansCSV({ status: status || undefined })
```

### Todas las Funciones Preservadas

| Funcion | Descripcion |
|---------|-------------|
| `Views.directorGuardians()` | Entry point principal (async) |
| `renderGuardians()` | Re-render completo |
| `updateTableContent()` | Update incremental de tabla |
| `getFilteredGuardians()` | Logica de filtros |
| `renderTableRows(filtered)` | Genera filas de tabla |
| `renderPagination(filtered)` | Genera paginacion |
| `search(term)` | Busqueda por nombre/email/telefono |
| `filterByStudent(studentId)` | Filtro por alumno asociado |
| `filterByStatus(status)` | Filtro ACTIVE/DELETED |
| `clearFilters()` | Reset filtros |
| `changePage(page)` | Cambio de pagina |
| `showCreateForm()` | Modal crear apoderado |
| `showEditForm(id)` | Modal editar apoderado |
| `saveGuardian(id?)` | Create/Update |
| `viewProfile(id)` | Modal perfil read-only |
| `manageStudents(id)` | Modal gestionar alumnos asociados |
| `saveStudentAssociations(id)` | Guardar asociaciones de alumnos |
| `confirmDelete(id)` | Modal confirmacion eliminar |
| `confirmRestore(id)` | Modal confirmacion restaurar |
| `exportCSV()` | Exportar a CSV |

### Logica de Asociacion de Alumnos (PRESERVADA)
```javascript
// Helper to get students associated with a guardian
function getGuardianStudents(guardianId) {
  const guardian = guardians.find(g => g.id === guardianId);
  if (!guardian || !guardian.student_ids) return [];
  return guardian.student_ids.map(id => students.find(s => s.id === id)).filter(Boolean);
}
```

## Safelist Agregado (tailwind.config.js)

```javascript
// ===== APODERADOS MODULE =====
// Info card (indigo theme)
'bg-indigo-50', 'dark:bg-indigo-900/20',
'bg-indigo-100', 'dark:bg-indigo-800',
'text-indigo-900', 'dark:text-indigo-200',
'text-indigo-700/80', 'dark:text-indigo-300/80',

// Filter grid
'lg:col-span-4', 'lg:col-span-3', 'lg:col-span-2',

// Student badge in table
'text-indigo-700', 'dark:text-indigo-300',

// Action buttons (purple for manage students)
'hover:text-purple-600', 'hover:bg-purple-50',
'dark:hover:text-purple-400', 'dark:hover:bg-purple-900/30',

// Restore button
'text-green-600', 'dark:text-green-400',
'bg-green-50', 'dark:bg-green-900/30',
'hover:bg-green-100', 'dark:hover:bg-green-900/50',
'border-green-200', 'dark:border-green-800',

// Gradient button (indigo -> blue)
'to-blue-600', 'hover:to-blue-700',

// Icon size
'text-[18px]',

// Pagination text
'disabled:cursor-not-allowed',
```

## Diferencias con Diseno Anterior

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| Layout | CSS variables antiguo | Tailwind moderno |
| Info card | Blue con emoji info | Indigo con icono family_restroom |
| Filtros | Flex wrap basico | Grid 12 columnas |
| Tabla | Basica sin estilos | rounded-xl con shadow |
| Student badge | Chip info | Indigo con border |
| Acciones | Emojis | 4 iconos Material |
| Paginacion | Simple | Con "Pagina X de Y" |

## Consistencia con Otros Modulos

| Elemento | Dashboard | Reportes | Metricas | Dispositivos | Alumnos | Apoderados |
|----------|-----------|----------|----------|--------------|---------|------------|
| Header h-20 | Si | Si | Si | Si | Si | Si |
| Sidebar border-l-4 | Si | Si | Si | Si | Si | Si |
| Footer NEUVOX | Si | Si | Si | Si | Si | Si |
| Mobile sidebar | Si | Si | Si | Si | Si | Si |
| Dark mode | Si | Si | Si | Si | Si | Si |
| Gradient button | - | indigo-purple | indigo-cyan | indigo-purple | indigo | indigo-blue |
| Paginacion | - | - | - | Si | Si | Si |

## Verificacion

### Build
```bash
npm run build
# Output: 118.46 kB CSS (gzip: 19.42 kB)
# Status: SUCCESS
```

### Checklist Visual
- [x] Info card indigo con icono family_restroom
- [x] Titulo "Apoderados del Establecimiento (N)"
- [x] Subtitulo con conteo
- [x] Boton gradient "Nuevo Apoderado"
- [x] Grid de filtros 12 columnas
- [x] Tabla con header slate uppercase
- [x] Badges de alumnos indigo con border
- [x] Badges de estado (green/red)
- [x] 4 action buttons con hover colors
- [x] Paginacion con "Pagina X de Y"
- [x] Footer NEUVOX

### Checklist Funcional
- [x] CRUD completo (crear, editar, eliminar, restaurar)
- [x] Filtros reactivos (busqueda, alumno, estado)
- [x] Limpiar filtros
- [x] Paginacion funcional (15 por pagina)
- [x] Ver perfil completo
- [x] Gestionar alumnos asociados
- [x] Guardar asociaciones de alumnos
- [x] Export CSV
- [x] Dark mode toggle
- [x] Mobile sidebar toggle
- [x] Toast notifications

## Notas Adicionales

- El grid de filtros usa 12 columnas para distribucion optima en desktop
- Los apoderados eliminados muestran solo el boton "Restaurar" con estilo verde
- La paginacion reinicia a pagina 1 cuando cambian los filtros
- Los iconos Material Icons Round reemplazan los emojis anteriores
- Los modales de CRUD usan estilos CSS variables existentes (no Tailwind)
- El boton "Gestionar Alumnos" usa color purple para diferenciarse de otras acciones
- La info card explica el proposito del modulo al usuario
