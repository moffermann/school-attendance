# Changelog: Rediseno Modulo Dispositivos

**Fecha:** 2026-01-20
**Modulo:** Director Devices (Puertas y Dispositivos)
**Tipo:** Rediseno UI completo

## Resumen

Implementacion fiel del diseno HTML/Tailwind aprobado para el modulo de Dispositivos, siguiendo el patron establecido en los redisenos anteriores (Dashboard, Reportes, Metricas, Horarios, Excepciones, Comunicados). Se preservo toda la funcionalidad CRUD y API existente.

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/web-app-preview/js/views/director_devices.js` | Reescrito completo con layout Tailwind |
| `src/web-app-preview/tailwind.config.js` | Agregadas clases al safelist |

## Cambios Visuales Implementados

### Layout General
- **Sidebar NEUVOX**: Fondo `bg-[#1e1b4b]` con border activo `border-l-4 border-indigo-400`
- **Header estandarizado**: Altura `h-20` con titulo "Puertas y Dispositivos"
- **Mobile sidebar**: Boton hamburguesa + overlay para responsive
- **Dark mode**: Toggle funcional con variantes `dark:`
- **Footer**: "(c) 2026 NEUVOX. Todos los derechos reservados."

### KPI Cards (3 tarjetas, SIN iconos)
| Card | Border Color | Valor |
|------|--------------|-------|
| En Linea | `border-l-green-500` | Contador dinamico |
| Desconectados | `border-l-orange-400` | Contador dinamico |
| Bateria Baja | `border-l-red-500` | Contador dinamico (<50%) |

- Layout vertical `flex-col` con numero grande (`text-4xl`) y label uppercase
- **SIN iconos circulares** (diferencia con otros modulos)

### Tabla de Dispositivos
- **Header**: `bg-slate-50 dark:bg-slate-800/50`, `text-[11px]`, uppercase, `tracking-wider`
- **Filas**: `hover:bg-slate-50 dark:hover:bg-slate-800/30`
- **Device ID**: `<span>` con `bg-slate-100`, `border border-slate-200` (no `<code>`)
- **Pendientes**: Badge circular (`w-8 h-8 rounded-full`)
- **Bateria**: Badge pill (`rounded-full`) con colores green/orange segun valor
- **Estado**: Badge pill **SIN dot indicator** (green=En Linea, orange=Desconectado)

### Acciones por Fila (3 botones)
| Boton | Icono | Accion | Hover |
|-------|-------|--------|-------|
| Settings | `settings` | Ping dispositivo | `hover:text-indigo-600 hover:bg-indigo-50` |
| Edit | `edit` | Abrir modal edicion | `hover:text-blue-600 hover:bg-blue-50` |
| Delete | `delete` | Confirmar eliminacion | `hover:text-red-600 hover:bg-red-50` |

### Paginacion
- Footer con `bg-slate-50/50 dark:bg-slate-800/30`
- Botones con iconos `chevron_left` y `chevron_right`
- Texto "Mostrando X a Y de Z dispositivos"

### Boton "Nuevo Dispositivo"
- Gradient: `from-indigo-600 to-purple-600`
- Shadow: `shadow-indigo-200 dark:shadow-none`
- Icono `add` + texto

## Funcionalidad Backend Preservada

### API Calls
```javascript
API.getDevices()           // GET /devices
API.createDevice(payload)  // POST /devices
API.updateDevice(id, data) // PUT /devices/:id
API.deleteDevice(id)       // DELETE /devices/:id
API.pingDevice(id)         // POST /devices/:id/ping
API.getDeviceLogs(id)      // GET /devices/:id/logs
```

### Proteccion Double-Click
- `isSaving` flag para create/update
- `isDeleting` flag para delete

### Operaciones CRUD
- `showCreateForm()` - Modal crear dispositivo
- `saveDevice(id?)` - Guardar (create o update)
- `showEditForm(id)` - Modal editar dispositivo
- `confirmDelete(id)` - Modal confirmacion eliminacion
- `ping(id)` - Enviar ping al dispositivo
- `showLogs(id)` - Ver logs en modal

## Safelist Agregado (tailwind.config.js)

```javascript
// ===== DISPOSITIVOS MODULE =====
// KPI Cards border-left
'border-l-green-500', 'border-l-orange-400', 'border-l-red-500',

// KPI labels
'text-4xl', 'tracking-wider',

// Table headers (slate)
'bg-slate-50', 'dark:bg-slate-800/50',
'text-[11px]',

// Table body
'divide-slate-100', 'dark:divide-slate-800',
'hover:bg-slate-50', 'dark:hover:bg-slate-800/30',
'text-slate-700', 'dark:text-slate-200',

// Device ID badge
'border-slate-200', 'dark:border-slate-700',

// Pendientes badge (circular)
'w-8', 'h-8',

// Battery/Status badges (orange)
'bg-orange-100', 'text-orange-700',
'dark:bg-orange-900/30', 'dark:text-orange-400',

// Action buttons hover
'hover:text-indigo-600', 'hover:bg-indigo-50', 'dark:hover:bg-indigo-900/30',
'hover:text-blue-600', 'hover:bg-blue-50', 'dark:hover:bg-blue-900/30',
'hover:text-red-600', 'hover:bg-red-50', 'dark:hover:bg-red-900/30',

// Gradient button (indigo - purple)
'to-purple-600', 'hover:to-purple-700',

// Pagination footer
'bg-slate-50/50', 'dark:bg-slate-800/30',
```

## Diferencias con Diseno Anterior

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| Layout | CSS variables antiguo | Tailwind moderno |
| KPI Cards | stat-card con iconos | border-l-4, SIN iconos |
| Boton Nuevo | btn-primary simple | Gradient indigo-purple |
| Device ID | `<code>` con bg | `<span>` con border |
| Pendientes | Chip componente | Badge circular |
| Bateria | Chip 3 colores | Badge pill 2 colores |
| Estado | Chip con colores | Badge pill SIN dot |
| Acciones | 4 botones emoji | 3 botones iconos Material |
| Paginacion | No existia | Iconos chevron |

## Consistencia con Otros Modulos

| Elemento | Dashboard | Reportes | Metricas | Dispositivos |
|----------|-----------|----------|----------|--------------|
| Header h-20 | Si | Si | Si | Si |
| Sidebar border-l-4 | Si | Si | Si | Si |
| Footer NEUVOX | Si | Si | Si | Si |
| Mobile sidebar | Si | Si | Si | Si |
| Dark mode | Si | Si | Si | Si |
| KPI Cards | 4 (iconos) | No | 4 (iconos) | 3 (SIN iconos) |
| Gradient button | - | indigo-purple | indigo-cyan | indigo-purple |

## Verificacion

### Build
```bash
npm run build
# Output: 115.33 kB CSS (gzip: 19.09 kB)
# Status: SUCCESS
```

### Checklist Visual
- [x] 3 KPI cards con border-left (SIN iconos)
- [x] Tabla con headers slate uppercase
- [x] Device ID con span y border
- [x] Badges circulares para pendientes
- [x] Badges pill para bateria y estado
- [x] 3 action buttons con hover states
- [x] Gradient button "Nuevo Dispositivo"
- [x] Paginacion con iconos chevron
- [x] Footer NEUVOX

### Checklist Funcional
- [x] CRUD completo (crear, editar, eliminar)
- [x] Ping dispositivo (boton settings)
- [x] Proteccion double-click
- [x] Toast notifications
- [x] Dark mode toggle
- [x] Mobile sidebar toggle
- [x] Navegacion desde sidebar

## Notas Adicionales

- La funcion `showLogs()` se preservo pero no esta expuesta en la UI principal (solo 3 botones de accion segun diseno aprobado)
- El boton "settings" ejecuta ping() siguiendo el mapeo definido en el plan
- Los modales de CRUD usan estilos Tailwind consistentes con otros modulos
