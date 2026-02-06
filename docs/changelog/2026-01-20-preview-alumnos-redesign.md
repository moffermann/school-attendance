# Changelog: Rediseno Modulo Alumnos

**Fecha:** 2026-01-20
**Modulo:** Director Students (Gestion de Alumnos)
**Tipo:** Rediseno UI completo

## Resumen

Implementacion fiel del diseno HTML/Tailwind aprobado para el modulo de Alumnos, siguiendo el patron establecido en los redisenos anteriores (Dashboard, Reportes, Metricas, Horarios, Excepciones, Comunicados, Dispositivos). Se preservo toda la funcionalidad CRUD, filtros, foto management, QR/NFC enrollment y asistencia existente.

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/web-app-preview/js/views/director_students.js` | Reescrito completo con layout Tailwind |
| `src/web-app-preview/tailwind.config.js` | Agregadas clases al safelist |

## Cambios Visuales Implementados

### Layout General
- **Sidebar NEUVOX**: Fondo `bg-[#1e1b4b]` con border activo `border-l-4 border-indigo-400`
- **Header estandarizado**: Altura `h-20` con titulo "Gestion de Alumnos (N)"
- **Mobile sidebar**: Boton hamburguesa + overlay para responsive
- **Dark mode**: Toggle funcional con variantes `dark:`
- **Footer**: "(c) 2026 NEUVOX. Todos los derechos reservados."

### Seccion de Filtros (Card)
| Elemento | Estilo |
|----------|--------|
| Buscar alumno | Input con icono search, `flex-1 min-w-[240px]` |
| Curso | Dropdown `w-48` |
| Estado | Dropdown `w-48` (Activos, Inactivos, Eliminados, Todos) |
| Limpiar Filtros | Boton outline |
| Nuevo Alumno | Gradient `from-indigo-500 to-indigo-600` con icono `person_add` |

### Tabla de Alumnos
- **Header Card**: `bg-slate-50/50 dark:bg-slate-800/30` con "Lista de Alumnos"
- **Header Tabla**: `text-xs font-bold uppercase tracking-wider`
- **Filas**: `hover:bg-slate-50 dark:hover:bg-slate-800/30`, `group` para hover effects

### Columnas de la Tabla

| Columna | Contenido | Estilo |
|---------|-----------|--------|
| Nombre | Avatar 9x9 + nombre bold | Avatar `bg-indigo-50 border-indigo-100` |
| Curso | Nombre curso | `text-slate-500 text-sm` |
| Estado | Badge pill | Activo (green), Inactivo (slate), Eliminado (red) |
| Asistencia | Porcentaje + progress bar | Colores: emerald (>=70%), amber (40-69%), red (<40%) |
| Aut. Foto | Badge SI/NO | `text-[10px]` green o slate |
| Acciones | 5 botones icono | Ver, QR, Asistencia, Editar, Eliminar |

### Botones de Accion (5 por fila)

| Boton | Icono | Hover | Accion |
|-------|-------|-------|--------|
| Ver Perfil | `visibility` | `hover:bg-indigo-50` | viewProfile() |
| QR/NFC | `qr_code_2` | `hover:bg-blue-50` | showEnrollMenu() |
| Asistencia | `calendar_today` | `hover:bg-indigo-50` | viewAttendance() |
| Editar | `edit` | `hover:bg-slate-100` | showEditForm() |
| Eliminar | `delete` | `hover:bg-red-50` | confirmDelete() |

### Paginacion
- Footer con `bg-slate-50/50 dark:bg-slate-800/30`
- Botones "Anterior" y "Siguiente"
- Texto "Mostrando X a Y de Z alumnos"
- PAGE_SIZE = 10 alumnos por pagina

### Estado Eliminado
- Fila con `opacity-70`
- Solo muestra boton "Restaurar" (verde con icono `restore`)

## Funcionalidad Backend Preservada

### API Calls (NO MODIFICADAS)
```javascript
API.getStudent(studentId)
API.createStudent(studentData)
API.updateStudent(studentId, studentData)
API.deleteStudent(studentId)
API.uploadStudentPhoto(studentId, file)
API.deleteStudentPhoto(studentId)
API.loadAuthenticatedImage(url)  // Con cache LRU
API.request('/attendance/events', options)  // Asistencia manual
```

### Proteccion Race Conditions
```javascript
let photoLoadCounter = 0;  // PRESERVADO - evita overwrites de fotos
```

### Todas las Funciones Preservadas

| Funcion | Descripcion |
|---------|-------------|
| `Views.directorStudents()` | Entry point principal |
| `renderStudents()` | Re-render completo |
| `updateTableContent()` | Update incremental de tabla |
| `applyCurrentFilters()` | Logica centralizada de filtros (async) |
| `search(term)` | Busqueda por nombre |
| `filterByCourse(course)` | Filtro por curso |
| `filterByStatus(status)` | Filtro ACTIVE/INACTIVE/DELETED/ALL |
| `clearFilters()` | Reset filtros |
| `showCreateForm()` | Modal crear alumno |
| `saveStudent(id?)` | Create/Update con foto |
| `showEditForm(id)` | Modal editar alumno |
| `confirmDelete(id)` | Modal confirmacion eliminar |
| `restoreStudent(id)` | Modal restaurar eliminado |
| `previewPhoto(input)` | Preview foto antes de guardar |
| `removePhotoPreview(id)` | Eliminar foto via API |
| `viewProfile(id)` | Modal perfil read-only |
| `viewAttendance(id)` | Modal historial asistencia |
| `registerAttendance(id, type)` | POST manual IN/OUT |
| `showEnrollMenu(id)` | Modal seleccion QR/NFC |
| `enrollQR(id)` | Delega a QREnrollment |
| `enrollNFC(id)` | Delega a NFCEnrollment |
| `goToCreateGuardian()` | Navegacion a modulo apoderados |
| `prevPage()` | Pagina anterior |
| `nextPage()` | Pagina siguiente |

### Guardian Linking Logic (PRESERVADA)
```javascript
// En saveStudent() - actualizar student_ids del guardian
const currentGuardian = guardians.find(g => g.student_ids?.includes(studentId));
if (currentGuardian && currentGuardian.id !== guardianId) {
  State.updateGuardian(currentGuardian.id, {
    student_ids: currentGuardian.student_ids.filter(id => id !== studentId)
  });
}
```

### Auto-open Profile Feature (PRESERVADA)
```javascript
// Abre perfil si URL contiene ?viewProfile=ID
const queryMatch = hash.match(/\?viewProfile=(\d+)/);
if (queryMatch) {
  Views.directorStudents.viewProfile(parseInt(queryMatch[1]));
}
```

## Safelist Agregado (tailwind.config.js)

```javascript
// ===== ALUMNOS MODULE =====
// Filter section
'min-w-[240px]', 'w-48',

// Table divider
'divide-slate-50',

// Avatar
'w-9', 'h-9',
'border-indigo-100', 'dark:border-indigo-800',

// Progress bar colors
'bg-emerald-500', 'bg-amber-500',

// Photo auth badge
'text-[10px]',
'text-green-600',

// Action buttons
'text-indigo-600', 'dark:text-indigo-400',
'text-indigo-700',
'text-blue-600', 'dark:text-blue-400',
'text-slate-600', 'dark:text-slate-400',
'text-red-400', 'hover:text-red-600',
'dark:hover:text-red-300',

// Icon size
'text-[20px]',

// Opacity transition
'opacity-80', 'group-hover:opacity-100',

// Gradient button (indigo)
'from-indigo-500', 'to-indigo-600',
'hover:from-indigo-600', 'hover:to-indigo-700',
'shadow-indigo-200',

// Status badge (slate for inactive)
'bg-slate-100', 'text-slate-500',
'dark:bg-slate-700',
```

## Diferencias con Diseno Anterior

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| Layout | CSS variables antiguo | Tailwind moderno |
| Filtros | Inline basico | Card con flex-wrap |
| Tabla | Basica sin estilos | rounded-xl con shadow |
| Avatar | Variable | 9x9 con border indigo |
| Asistencia | Chip porcentaje | Progress bar con colores semaforo |
| Aut. Foto | Chip emoji | Badge text-[10px] SI/NO |
| Acciones | Emojis | 5 iconos Material |
| Paginacion | No existia | Anterior/Siguiente con PAGE_SIZE=10 |

## Consistencia con Otros Modulos

| Elemento | Dashboard | Reportes | Metricas | Dispositivos | Alumnos |
|----------|-----------|----------|----------|--------------|---------|
| Header h-20 | Si | Si | Si | Si | Si |
| Sidebar border-l-4 | Si | Si | Si | Si | Si |
| Footer NEUVOX | Si | Si | Si | Si | Si |
| Mobile sidebar | Si | Si | Si | Si | Si |
| Dark mode | Si | Si | Si | Si | Si |
| Gradient button | - | indigo-purple | indigo-cyan | indigo-purple | indigo |
| Paginacion | - | - | - | Si | Si |

## Verificacion

### Build
```bash
npm run build
# Output: 116.96 kB CSS (gzip: 19.25 kB)
# Status: SUCCESS
```

### Checklist Visual
- [x] Header con "Gestion de Alumnos (N)"
- [x] Card de filtros con 5 elementos en flex-wrap
- [x] Tabla con header slate uppercase
- [x] Avatares 9x9 con border indigo
- [x] Badges de estado (green/slate/red)
- [x] Progress bars con colores semaforo
- [x] Badges Aut. Foto (SI verde / NO slate)
- [x] 5 action buttons con hover colors
- [x] Paginacion Anterior/Siguiente
- [x] Footer NEUVOX

### Correcciones Post-Implementación
- [x] Agregados links faltantes en sidebar: Ausencias, Notificaciones, Biometría
- [x] Header actualizado para mostrar "Director Demo" junto al avatar (consistente con Dispositivos)
- [x] Avatar usa inicial del usuario en lugar de icono genérico

### Checklist Funcional
- [x] CRUD completo (crear, editar, eliminar, restaurar)
- [x] Filtros reactivos (busqueda, curso, estado)
- [x] Limpiar filtros
- [x] Paginacion funcional
- [x] Photo management con race condition protection
- [x] QR/NFC enrollment menu
- [x] Ver perfil con foto
- [x] Ver asistencia con historial
- [x] Registro asistencia manual
- [x] Guardian linking
- [x] Auto-open profile desde URL
- [x] Dark mode toggle
- [x] Mobile sidebar toggle
- [x] Toast notifications

## Notas Adicionales

- El progress bar usa colores semaforo: emerald (>=70%), amber (40-69%), red (<40%)
- Los estudiantes eliminados muestran solo el boton "Restaurar" con estilo verde
- La paginacion reinicia a pagina 1 cuando cambian los filtros
- Los iconos Material Icons Round reemplazan los emojis anteriores
- Los modales de CRUD usan estilos CSS variables existentes (no Tailwind)
