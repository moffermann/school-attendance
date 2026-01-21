# 2026-01-21: Rediseno Modulos Biometria y Notificaciones + Device API Keys per-Tenant

## Resumen

Sesion enfocada en corregir modulos del director y completar validacion de Device API Keys per-tenant:

### Device API Keys per-Tenant (GAP Corregido)
- **Validacion per-tenant**: `verify_device_key()` ahora valida contra key especifica del tenant
- **Middleware actualizado**: `_has_valid_device_key()` convertido a async con validacion per-tenant
- **Fallback global**: Mantiene compatibilidad hacia atras durante migracion
- **README actualizado**: Documentacion del kiosk refleja estado IMPLEMENTADO

### Modulo Biometria
- **Sidebar no visible**: Corregido conflicto CSS con `.hidden !important`
- **Header incompleto**: Agregado avatar, nombre de usuario y boton "Salir"
- **Navegacion rota**: Cambiado de onclick a href para routing
- **Sidebar compacto**: Corregido padding de px-4 a px-6

### Modulo Notificaciones
- **Rediseno completo**: Implementacion del diseno aprobado con Tailwind
- **Stats cards**: 4 tarjetas con borde superior de color
- **Tabla de notificaciones**: Con badges de canal, estado y acciones
- **Filtros**: Por estado, canal, tipo y rango de fechas
- **Paginacion**: Funcional con 15 items por pagina

---

## 1. Problema Principal - Conflicto CSS

El archivo `styles.css` tiene una regla que rompe clases Tailwind responsive:

```css
/* styles.css linea 1174-1176 */
.hidden {
  display: none !important;
}
```

### Solucion

Usar clases custom del proyecto definidas en `tailwind.css`:

| Clase Tailwind | Clase Custom | Comportamiento |
|----------------|--------------|----------------|
| `hidden md:flex` | `mobile-hidden` | Oculto en mobile, flex en 768px+ |
| `md:hidden` | `desktop-hidden` | Visible en mobile, oculto en 768px+ |

---

## 2. Modulo Biometria - Cambios

### 2.1 Variables de Usuario

```javascript
// Get user info
const user = State.getCurrentUser();
const userName = user?.full_name || user?.email?.split('@')[0] || 'Director';
const userInitial = userName.charAt(0).toUpperCase();
const isDark = document.documentElement.classList.contains('dark');
```

### 2.2 Navegacion con path

```javascript
const currentPath = '/director/biometric';

const navItems = [
  { path: '/director/dashboard', icon: 'dashboard', label: 'Tablero' },
  { path: '/director/reports', icon: 'analytics', label: 'Reportes' },
  // ... todos los items
  { path: '/director/biometric', icon: 'fingerprint', label: 'Biometria' }
];
```

### 2.3 Helpers de Navegacion

```javascript
const isActive = (path) => currentPath === path;

const navItemClass = (path) => isActive(path)
  ? 'flex items-center px-6 py-3 bg-indigo-800/50 text-white border-l-4 border-indigo-500 group transition-colors'
  : 'flex items-center px-6 py-3 hover:bg-white/5 hover:text-white group transition-colors border-l-4 border-transparent';

const iconClass = (path) => isActive(path)
  ? 'material-icons-round mr-3'
  : 'material-icons-round mr-3 text-gray-400 group-hover:text-white transition-colors';
```

### 2.4 toggleSidebar Corregido

```javascript
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) {
    sidebar.classList.toggle('mobile-hidden');
  }
  if (backdrop) {
    backdrop.classList.toggle('hidden');
  }
}
```

### 2.5 Sidebar HTML

```html
<aside id="sidebar" class="w-64 bg-sidebar-dark text-gray-300 flex-shrink-0 flex-col transition-all duration-300 mobile-hidden border-r border-indigo-900/50 shadow-2xl z-50">
```

### 2.6 Header Completo

```html
<div class="flex items-center gap-2 md:gap-3">
  <div class="w-9 h-9 rounded-full border border-gray-200 bg-indigo-600 flex items-center justify-center text-white font-semibold">
    ${userInitial}
  </div>
  <div class="text-right mobile-hidden">
    <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">${Components.escapeHtml(userName)}</p>
  </div>
  <a class="ml-1 md:ml-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 border px-2 md:px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 dark:border-gray-600"
     href="#" onclick="event.preventDefault(); State.logout();">
    <span class="material-icons-round text-lg">logout</span>
    <span class="mobile-hidden">Salir</span>
  </a>
</div>
```

---

## 3. Modulo Notificaciones - Rediseno

### 3.1 Estructura General

El modulo sigue el diseno aprobado en `Disenos html aprobados/Modulo Notificaciones/modulo notificaciones.html`:

```
┌─────────────────────────────────────────────────────────────┐
│ Sidebar │ Header: "Bitacora de Notificaciones"              │
│         │─────────────────────────────────────────────────────│
│         │ Stats Cards (4): Total | Entregadas | Fallidas | WhatsApp │
│         │─────────────────────────────────────────────────────│
│         │ Filtros: Estado | Canal | Tipo | Fecha desde/hasta │
│         │─────────────────────────────────────────────────────│
│         │ Tabla de Notificaciones con paginacion             │
│         │─────────────────────────────────────────────────────│
│         │ Footer: © 2026 NEUVOX                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Stats Cards

4 tarjetas con borde superior de color:

```javascript
<div class="bg-white dark:bg-card-dark p-6 rounded-custom shadow-sm border-t-4 border-purple-500">
  <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">TOTAL ENVIADAS</p>
  <p class="text-4xl font-bold text-purple-600 dark:text-purple-400">${stats.total}</p>
</div>
```

| Tarjeta | Color Borde | Color Texto |
|---------|-------------|-------------|
| Total Enviadas | `border-purple-500` | `text-purple-600` |
| Entregadas | `border-emerald-500` | `text-emerald-600` |
| Fallidas | `border-rose-500` | `text-rose-600` |
| WhatsApp | `border-emerald-500` | `text-emerald-600` |

### 3.3 Badges de Canal

```javascript
function getChannelBadge(channel) {
  const ch = (channel || '').toLowerCase();
  if (ch === 'whatsapp') {
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-100 dark:border-emerald-800">
      <span class="material-icons-round text-xs">chat</span> WHATSAPP
    </span>`;
  }
  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold border border-blue-100 dark:border-blue-800">
    <span class="material-icons-round text-xs">mail</span> EMAIL
  </span>`;
}
```

### 3.4 Badges de Estado

```javascript
function getStatusBadge(status) {
  const st = (status || '').toLowerCase();
  if (st === 'delivered') {
    return `<span class="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase">Entregada</span>`;
  }
  if (st === 'failed') {
    return `<span class="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] font-bold uppercase">Fallida</span>`;
  }
  return `<span class="px-2 py-0.5 rounded bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] font-bold uppercase">Pendiente</span>`;
}
```

| Estado | Background | Texto |
|--------|------------|-------|
| Delivered | `bg-emerald-50` | `text-emerald-600` |
| Failed | `bg-rose-50` | `text-rose-600` |
| Pending | `bg-orange-50` | `text-orange-600` |

### 3.5 Filtros

```html
<div class="flex flex-wrap gap-4">
  <select id="filter-status">
    <option value="">Todos los estados</option>
    <option value="delivered">Entregadas</option>
    <option value="failed">Fallidas</option>
    <option value="pending">Pendientes</option>
  </select>
  <select id="filter-channel">
    <option value="">Todos los canales</option>
    <option value="whatsapp">WhatsApp</option>
    <option value="email">Email</option>
  </select>
  <!-- Mas filtros... -->
</div>
```

### 3.6 Paginacion

```javascript
const ITEMS_PER_PAGE = 15;
let currentPage = 1;

const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
const paginatedNotifications = allNotifications.slice(startIndex, endIndex);
```

### 3.7 Accion Reintentar

Para notificaciones fallidas:

```javascript
Views.directorNotifications.retry = function(id) {
  if (State.retryNotification(id)) {
    render(); // Re-render the view
  }
};
```

### 3.8 State.js - Metodos Agregados

```javascript
getNotifications(filters = {}) {
  let notifications = this.data.notifications || [];

  if (filters.status) {
    notifications = notifications.filter(n => n.status?.toLowerCase() === filters.status.toLowerCase());
  }
  if (filters.channel) {
    notifications = notifications.filter(n => n.channel?.toLowerCase() === filters.channel.toLowerCase());
  }
  // Mas filtros...

  return notifications.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
},

getNotificationStats() {
  const notifications = this.data.notifications || [];
  return {
    total: notifications.length,
    delivered: notifications.filter(n => n.status?.toLowerCase() === 'delivered').length,
    failed: notifications.filter(n => n.status?.toLowerCase() === 'failed').length,
    pending: notifications.filter(n => n.status?.toLowerCase() === 'pending').length,
    byChannel: {
      whatsapp: notifications.filter(n => n.channel?.toLowerCase() === 'whatsapp').length,
      email: notifications.filter(n => n.channel?.toLowerCase() === 'email').length
    }
  };
},

retryNotification(id) {
  const index = this.data.notifications.findIndex(n => n.id === id);
  if (index !== -1 && this.data.notifications[index].status?.toLowerCase() === 'failed') {
    this.data.notifications[index].status = 'pending';
    this.data.notifications[index].retry_at = new Date().toISOString();
    this.persist();
    return true;
  }
  return false;
}
```

---

## 4. Estandar de Sidebar Aplicado

Ambos modulos ahora siguen el mismo estandar:

| Elemento | Valor | Biometria | Notificaciones |
|----------|-------|-----------|----------------|
| Clase fondo | `bg-sidebar-dark` | OK | OK |
| navItems | Propiedad `path` | OK | OK |
| Helper `isActive` | `(path) => currentPath === path` | OK | OK |
| Helper `navItemClass` | Con `px-6 py-3` | OK | OK |
| Helper `iconClass` | Con `material-icons-round mr-3` | OK | OK |
| Estado activo | `bg-indigo-800/50 border-l-4 border-indigo-500` | OK | OK |
| Sidebar unico | Con backdrop | OK | OK |
| z-index | `z-50` | OK | OK |
| Nav padding | `py-6` | OK | OK |
| Link padding | `py-3` | OK | OK |

---

## 5. Tailwind Config - Safelist Agregado

```javascript
// ===== NOTIFICATIONS MODULE =====
// Stats cards
'border-t-4',
'border-purple-500', 'text-purple-600', 'dark:text-purple-400',

// Status badges (rose)
'bg-rose-50', 'dark:bg-rose-900/30',
'text-rose-600', 'dark:text-rose-400',
'border-rose-200', 'dark:border-rose-800',
'hover:bg-rose-50', 'dark:hover:bg-rose-900/30',

// Message truncate
'max-w-[120px]',

// ===== BIOMETRIA MODULE =====
// Info banner (indigo)
'text-indigo-900', 'dark:text-indigo-300',

// Status card registered (emerald)
'dark:bg-emerald-900/20',
'text-emerald-900', 'dark:text-emerald-300',
'text-emerald-700', 'dark:text-emerald-400',

// Status card pending (orange)
'dark:bg-orange-900/20',
'text-orange-900', 'dark:text-orange-300',
'text-orange-700', 'dark:text-orange-400',
'bg-orange-500',

// Delete button (red)
'border-red-100', 'dark:border-red-800',
'hover:bg-red-100', 'dark:hover:bg-red-900/30',

// Grid layout
'col-span-12', 'lg:col-span-8',

// Student list height
'h-[400px]',

// Fingerprint sensor gradients
'from-indigo-100', 'to-indigo-200',
'dark:from-indigo-900/50', 'dark:to-indigo-800/50',
// ... mas gradientes para estados del sensor
```

---

## 6. Device API Keys per-Tenant - Implementacion

### 6.1 Problema Identificado (GAP)

El sistema tenia infraestructura completa para keys por tenant pero la validacion usaba key global:

| Componente | Estado Anterior |
|------------|-----------------|
| `TenantConfig.device_api_key_encrypted` | En DB pero no usado |
| `POST /tenants/{id}/config/generate-device-key` | Funcionando |
| `deps.verify_device_key()` | Usaba `settings.device_api_key` (global) |
| `tenant_middleware._has_valid_device_key()` | Usaba `settings.device_api_key` (global) |

### 6.2 Solucion Implementada

#### deps.py - verify_device_key()

```python
async def verify_device_key(
    request: Request,
    x_device_key: str | None = Header(default=None),
    session: AsyncSession = Depends(get_public_db),
) -> bool:
    """
    Verify device API key against tenant-specific key or global fallback.
    """
    import secrets as secrets_module
    from app.db.repositories.tenant_configs import TenantConfigRepository

    if not x_device_key:
        return False

    # Try to get tenant_id from header or request state
    tenant_id = None
    tenant_id_header = request.headers.get("X-Tenant-ID")
    if tenant_id_header:
        try:
            tenant_id = int(tenant_id_header)
        except ValueError:
            pass

    # If no header, try from request state (set by middleware)
    if not tenant_id:
        tenant = getattr(request.state, "tenant", None)
        if tenant:
            tenant_id = tenant.id

    # If we have a tenant_id, try tenant-specific key first
    if tenant_id:
        config_repo = TenantConfigRepository(session)
        decrypted_config = await config_repo.get_decrypted(tenant_id)
        if decrypted_config and decrypted_config.device_api_key:
            if secrets_module.compare_digest(x_device_key, decrypted_config.device_api_key):
                return True

    # Fallback to global key (for backwards compatibility)
    if secrets_module.compare_digest(x_device_key, settings.device_api_key):
        return True

    return False
```

#### tenant_middleware.py - _has_valid_device_key()

Cambio de `def` a `async def` con validacion per-tenant:

```python
async def _has_valid_device_key(self, request: Request) -> bool:
    """
    Check if the request has a valid device API key.
    Validates against tenant-specific key if X-Tenant-ID is provided,
    with fallback to global key for backwards compatibility.
    """
    import secrets as secrets_module
    from app.db.repositories.tenant_configs import TenantConfigRepository
    from app.db.session import async_session

    device_key = request.headers.get("X-Device-Key", "")
    if not device_key:
        return False

    # Try tenant-specific key if X-Tenant-ID header is present
    tenant_id_header = request.headers.get("X-Tenant-ID")
    if tenant_id_header:
        try:
            tenant_id = int(tenant_id_header)
            async with async_session() as session:
                config_repo = TenantConfigRepository(session)
                decrypted_config = await config_repo.get_decrypted(tenant_id)
                if decrypted_config and decrypted_config.device_api_key:
                    if secrets_module.compare_digest(device_key, decrypted_config.device_api_key):
                        return True
        except (ValueError, Exception):
            pass  # Continue to fallback

    # Fallback to global key
    return secrets_module.compare_digest(device_key, settings.device_api_key)
```

### 6.3 Flujo de Validacion

```
Kiosk → X-Device-Key + X-Tenant-ID → verify_device_key()
        │
        ├─→ 1. TenantConfig.device_api_key_encrypted
        │      Si existe y coincide → AUTORIZADO
        │
        └─→ 2. settings.device_api_key (global)
               Si coincide → AUTORIZADO (fallback)
```

### 6.4 Tests Ejecutados

| Suite | Resultado |
|-------|-----------|
| test_api_security.py (device) | 4/4 passed |
| test_bug_fixes_round17.py | 21/21 passed |
| test_bug_fixes_round16.py | 20/20 passed |
| test_bug_fixes_tdd.py | 7/7 passed |
| test_tdd_tenant_isolation.py | 11/11 passed |
| test_multi_tenant.py | 18+ passed |

### 6.5 Documentacion Actualizada

Archivo `src/kiosk-app/README.md`:
- Agregada fila "Device API Keys | Funcional" en tabla de estado
- Actualizada seccion "Nota: Sistema de Device API Keys" como IMPLEMENTADO
- Eliminado de "Proximos Pasos" (ya completado)
- Agregado al "Historial de Cambios Relevantes"

---

## 7. Archivos Modificados

```
# Device API Keys per-Tenant
app/core/deps.py
  - Lineas 217-265: verify_device_key() con validacion per-tenant
  - Agregados: Request, AsyncSession como parametros
  - Nuevo: TenantConfigRepository para buscar key del tenant

app/core/tenant_middleware.py
  - Linea 228: Llamada con await a _has_valid_device_key()
  - Lineas 328-361: _has_valid_device_key() convertido a async
  - Nuevo: Validacion contra TenantConfig.device_api_key_encrypted

src/kiosk-app/README.md
  - Linea 15: Nueva fila "Device API Keys | Funcional"
  - Lineas 319-321: Historial actualizado
  - Lineas 396-401: Eliminado de Proximos Pasos
  - Lineas 405-435: Seccion "Device API Keys" actualizada a IMPLEMENTADO

# Preview Web App
src/web-app-preview/js/views/director_biometric.js
  - Lineas 13-17: Variables de usuario
  - Lineas 19-50: navItems, helpers de navegacion
  - Lineas 51-60: toggleSidebar corregido
  - Lineas 72-128: Sidebar y Header con estandar

src/web-app-preview/js/views/director_notifications.js
  - Rediseno completo (~450 lineas)
  - Stats cards con border-t-4
  - Badges de canal y estado
  - Filtros funcionales
  - Paginacion
  - Accion Reintentar

src/web-app-preview/js/state.js
  - getNotifications(filters): Filtrado de notificaciones
  - getNotificationStats(): Estadisticas agregadas
  - retryNotification(id): Reintentar envio

src/web-app-preview/tailwind.config.js
  - Safelist para Notificaciones: border-t-4, rose, purple
  - Safelist para Biometria: gradientes, orange, emerald
```

---

## 8. Testing Funcional

### Biometria
- [x] Sidebar visible en desktop
- [x] Avatar con inicial visible
- [x] Nombre de usuario visible
- [x] Boton "Salir" funcional
- [x] Navegacion con un solo clic
- [x] Sidebar mismo ancho que otros modulos
- [x] Dark mode funciona
- [x] WebAuthn preservado

### Notificaciones
- [x] Stats cards muestran conteos correctos
- [x] Filtro por estado funciona
- [x] Filtro por canal funciona
- [x] Badges de canal correctos (WhatsApp verde, Email azul)
- [x] Badges de estado correctos (Entregada/Fallida/Pendiente)
- [x] Paginacion funcional
- [x] Boton Reintentar cambia estado
- [x] Dark mode funciona
- [x] Sidebar con estandar aplicado

### Build
- [x] `npm run build` exitoso
- [x] Clases en safelist incluidas en CSS final

---

## 9. Comparacion: Diseno Aprobado vs Implementacion

### Notificaciones

| Elemento | Diseno | Implementacion | Estado |
|----------|--------|----------------|--------|
| Header | "Bitacora de Notificaciones" | Identico | OK |
| Stats cards | 4 con border-t-4 | Identico | OK |
| Colores stats | purple/emerald/rose/emerald | Identico | OK |
| Filtros | 5 filtros + boton limpiar | Identico | OK |
| Tabla | 7 columnas con badges | Identico | OK |
| Badge WhatsApp | Verde con icono chat | Identico | OK |
| Badge Email | Azul con icono mail | Identico | OK |
| Badge Entregada | Verde | Identico | OK |
| Badge Fallida | Rosa | Identico | OK |
| Badge Pendiente | Naranja | Identico | OK |
| Paginacion | Anterior/Siguiente | Identico | OK |
| Dark mode | Colores adaptados | Identico | OK |
| Sidebar | Estandar con border-l-4 | Identico | OK |

### Biometria

| Elemento | Diseno | Implementacion | Estado |
|----------|--------|----------------|--------|
| Sidebar | Visible con estandar | Identico | OK |
| Header | Avatar + nombre + logout | Identico | OK |
| Info banner | Indigo con icono | Identico | OK |
| Lista alumnos | Con filtros y scroll | Identico | OK |
| Card registro | Estado biometrico | Identico | OK |
| Botones accion | Agregar/Ver/Eliminar | Identico | OK |
| WebAuthn | Modal funcional | Preservado | OK |
| Dark mode | Colores adaptados | Identico | OK |

---

## 10. Fixes de Notificaciones - Worker y UI (Sesion Tarde)

### 10.1 Problema: Worker Connection Pool

Los workers RQ corren en procesos separados con sus propios event loops. El engine async principal está atado al event loop de FastAPI y no funciona correctamente cuando se llama desde `asyncio.run()` en workers.

**Error observado:**
```
AttributeError: 'NoneType' object has no attribute 'send'
```

**Solucion - Worker Session Factory:**

```python
# app/db/session.py

def create_worker_engine():
    """Create a fresh async engine for worker jobs."""
    return create_async_engine(
        settings.database_url,
        echo=False,
        future=True,
        pool_size=5,           # Smaller pool for workers
        max_overflow=5,
        pool_pre_ping=True,
        pool_recycle=300,      # Shorter recycle for workers
    )

@asynccontextmanager
async def get_worker_session(schema_name: str | None = None):
    """Get a database session for worker jobs."""
    worker_engine = create_worker_engine()
    WorkerSession = async_sessionmaker(worker_engine, expire_on_commit=False, class_=AsyncSession)

    async with WorkerSession() as session:
        try:
            if schema_name:
                validate_schema_name(schema_name)
                await session.execute(text(f"SET search_path TO {schema_name}, public"))
            yield session
        finally:
            await worker_engine.dispose()
```

**Jobs actualizados:**
- `app/workers/jobs/send_email.py` - Usa `get_worker_session()`
- `app/workers/jobs/send_whatsapp.py` - Usa `get_worker_session()`

### 10.2 Problema: UI Mostraba Estado Incorrecto

El backend usa `status: 'sent'` pero la UI esperaba `status: 'delivered'`.

**Solucion - Reconocer multiples estados:**

```javascript
// src/web-app/js/views/director_notifications.js
const statusChip = (n.status === 'delivered' || n.status === 'sent')
  ? Components.createChip('Entregada', 'success')
  : n.status === 'failed'
    ? Components.createChip('Fallida', 'error')
    : n.status === 'queued'
      ? Components.createChip('En Cola', 'info')
      : Components.createChip('Pendiente', 'warning');
```

### 10.3 Problema: Mensaje Vacio en UI

La tabla `notifications` tiene `payload` (JSON) pero no tiene campo `message`. La UI buscaba `n.message` que no existe.

**Solucion 1 - Frontend: buildMessagePreview()**

```javascript
// src/web-app/js/views/director_notifications.js

function parsePayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch (e) {
      return {};
    }
  }
  return payload;
}

function buildMessagePreview(payload, template) {
  const data = parsePayload(payload);
  const studentName = data.student_name || '';
  const time = data.time || '';

  if (template === 'INGRESO_OK') {
    return `${studentName} ingreso a las ${time}`;
  } else if (template === 'SALIDA_OK') {
    return `${studentName} salio a las ${time}`;
  } else if (template === 'NO_INGRESO_UMBRAL') {
    return `${studentName} no registro ingreso`;
  } else if (template === 'BROADCAST' && data.subject) {
    return data.subject.substring(0, 40);
  }
  if (studentName && time) return `${studentName} - ${time}`;
  return studentName || '-';
}
```

**Solucion 2 - Backend: Agregar campos al schema**

El schema `NotificationSummary` usado en el bootstrap no incluia `payload` ni `template`.

```python
# app/schemas/webapp.py
class NotificationSummary(BaseModel):
    id: int
    guardian_id: int
    student_id: int | None = None
    type: str
    channel: str
    sent_at: str | None = None
    status: str
    template: str | None = None  # NUEVO: e.g., INGRESO_OK, SALIDA_OK
    payload: dict | None = None  # NUEVO: student_name, time, date, etc.
```

```python
# app/services/web_app_service.py
def _map_notification(self, notification: Notification) -> NotificationSummary:
    return NotificationSummary(
        id=notification.id,
        guardian_id=notification.guardian_id,
        student_id=student_id,
        type=notification.template,
        channel=notification.channel,
        sent_at=self._format_time(sent_at),
        status=notification.status,
        template=notification.template,  # NUEVO
        payload=notification.payload,    # NUEVO
    )
```

### 10.4 Archivos Modificados (Sesion Tarde)

```
# Worker Session Factory
app/db/session.py
  - Lineas 180-223: create_worker_engine() y get_worker_session()

# Worker Jobs
app/workers/jobs/send_email.py
  - Lineas 21-29: _get_session() usa get_worker_session()

app/workers/jobs/send_whatsapp.py
  - Similar a send_email.py

# UI Fixes - web-app
src/web-app/js/views/director_notifications.js
  - Lineas 98-109: parsePayload()
  - Lineas 111-135: buildMessagePreview()
  - Lineas 152-158: statusChip reconoce 'sent' y 'queued'
  - Linea 262: showDetails usa buildMessagePreview()

# UI Fixes - web-app-preview
src/web-app-preview/js/views/director_notifications.js
  - Lineas 160-192: parsePayload() y buildMessagePreview()
  - Lineas 195-204: getStatusBadge() reconoce 'sent' y 'queued'
  - Linea 575: showDetails usa buildMessagePreview()

# Backend Schema
app/schemas/webapp.py
  - Lineas 109-110: Agregados template y payload a NotificationSummary

app/services/web_app_service.py
  - Lineas 325-326: _map_notification() incluye template y payload
```

### 10.5 Resultado Final

| Problema | Estado |
|----------|--------|
| Worker connection pool error | ✅ Resuelto |
| Email no se enviaba | ✅ Resuelto |
| UI mostraba "PENDIENTE" para enviados | ✅ Resuelto |
| Mensaje vacio en detalle | ✅ Resuelto |
| Foto no visible en email | ⚠️ Pendiente (URL privada) |

**Nota sobre foto en emails:**
La foto no aparece en los emails porque la URL es una IP privada (`http://192.168.1.59:9043/...`) que los servidores de Gmail no pueden acceder. Para solucionar esto se necesitaria:
1. Usar una URL publica (dominio accesible desde internet)
2. O incrustar la imagen en base64 dentro del email

---

## 11. Kiosk Confirmation Screen - Layout y Course Name Fix

### 11.1 Problema: Layout Overlap

Los elementos del header (logo NEUVOX, nombre de empresa, boton dark mode) se movieron hacia abajo y se superponian con el nombre del estudiante en la pantalla de confirmacion.

**Causa:** Los elementos usaban `position: absolute` que se posicionaba relativo al contenedor con `position: relative`, pero el contenedor principal usaba `flex` con `items-center justify-center` que centraba el contenido sin reservar espacio para el header.

**Solucion:**

```javascript
// ANTES - position absolute
<div class="absolute top-4 left-4 ...">  // Logo
<button class="absolute top-4 right-4 ...">  // Dark mode

// DESPUES - position fixed + padding en contenedor
<div class="fixed top-4 left-4 sm:top-6 sm:left-6 md:top-8 md:left-8 ... z-20">  // Logo
<button class="fixed top-4 right-4 sm:top-6 sm:right-6 md:top-8 md:right-8 ... z-20">  // Dark mode

// Contenedor principal con padding superior
<div class="kiosk-confirmation min-h-screen flex flex-col items-center justify-center
            pt-20 sm:pt-24 md:pt-28 pb-4 ...">
```

### 11.2 Problema: Course Name Incorrecto

El estudiante "Luna Torres Prada" mostraba "11° Básico" cuando debia mostrar "2° Básico B".

**Causa:** El codigo concatenaba el `course_id` (entero) con "° Básico":

```javascript
// ANTES - incorrecto
${student.course_id ? student.course_id + '° Básico' : ''}
// Resultado: course_id=11 → "11° Básico"
```

**Solucion - 3 partes:**

1. **Schema Pydantic** - Agregar campo denormalizado:

```python
# app/schemas/webapp.py
class StudentSummary(BaseModel):
    id: int
    full_name: str
    course_id: int
    course_name: str | None = None  # NUEVO: Denormalized for kiosk display
    photo_pref_opt_in: bool = False
```

2. **Service Layer** - Poblar course_name con lookup:

```python
# app/services/web_app_service.py

# En build_bootstrap_payload():
course_lookup = {course.id: course.name for course in courses}
students=[self._map_student(student, course_lookup) for student in students],

# En _map_student():
@staticmethod
def _map_student(student: Student, course_lookup: dict[int, str] | None = None) -> StudentSummary:
    course_name = None
    if course_lookup and student.course_id in course_lookup:
        course_name = course_lookup[student.course_id]
    return StudentSummary(
        id=student.id,
        full_name=student.full_name,
        course_id=student.course_id,
        course_name=course_name,  # NUEVO
        photo_pref_opt_in=bool(student.photo_pref_opt_in),
    )
```

3. **JavaScript Kiosk** - Usar course_name:

```javascript
// DESPUES - correcto
${UI.escapeHtml(student.course_name || '')}
// Resultado: course_name="2° Básico B" → "2° Básico B"
```

### 11.3 Archivos Modificados

```
# Backend Schema
app/schemas/webapp.py
  - Linea 16: Agregado course_name: str | None = None

# Backend Service
app/services/web_app_service.py
  - Linea 84: course_lookup = {course.id: course.name for course in courses}
  - Linea 95: _map_student(student, course_lookup)
  - Lineas 225-235: _map_student() actualizado con course_lookup parameter

# Kiosk Preview
src/kiosk-app-preview/js/views/scan_result.js
  - Lineas 178-192: Header con position fixed y z-20
  - Linea 182: Contenedor con pt-20 sm:pt-24 md:pt-28
  - Linea 229: Curso usa student.course_name

# Kiosk Original
src/kiosk-app/js/views/scan_result.js
  - Linea 72: student.course_name en lugar de concatenacion

# Mock Data (ambos)
src/kiosk-app-preview/data/students.json
src/kiosk-app/data/students.json
  - Agregado course_name a todos los 60 estudiantes
```

### 11.4 Testing

| Aspecto | Estado |
|---------|--------|
| Header no superpone nombre estudiante | ✅ |
| Logo NEUVOX visible en esquina superior izquierda | ✅ |
| Boton dark mode visible en esquina superior derecha | ✅ |
| Espaciado responsive (pt-20/24/28) | ✅ |
| Luna Torres muestra "2° Básico B" | ✅ |
| Todos los cursos muestran nombre correcto | ✅ |
| course_name llega desde backend | ✅ |

---

## 12. Fix: Foto de Perfil de Estudiante no Cargaba en Modal (CORS)

### 12.1 Problema

Al abrir el modal de perfil de un estudiante en la app del director, la foto no cargaba. Los logs del servidor mostraban:

```
"GET /api/v1/students/23 HTTP/1.1" 200
"OPTIONS /api/v1/photos/students/23/profile_bffbecb1.jpg HTTP/1.1" 200
```

El preflight OPTIONS retornaba 200 pero el GET subsecuente nunca ocurria (bloqueado por el navegador).

### 12.2 Causa Raiz

La funcion `_build_photo_proxy_url()` construia URLs absolutas usando `settings.public_base_url`:

```python
# Antes (students.py linea 45-46)
base_url = str(settings.public_base_url).rstrip("/")
return f"{base_url}/api/v1/photos/{photo_key}"
```

Si `public_base_url` era `http://localhost:8000` pero el usuario accedia desde una IP externa (ej: `http://201.178.58.191:8000`), esto creaba una situacion cross-origin:

- **Origen de la pagina:** `http://201.178.58.191:8000`
- **URL de la foto:** `http://localhost:8000/api/v1/photos/...`

El navegador trataba estos como origenes diferentes y bloqueaba la peticion despues del preflight.

### 12.3 Solucion

Cambiar a URLs relativas que automaticamente usan el mismo origen:

```python
# Despues (students.py linea 49-50)
# Use relative URL - works regardless of how user accesses the server
return f"/api/v1/photos/{photo_key}"
```

### 12.4 Archivos Modificados

```
app/api/v1/students.py
  - Linea 12: Eliminado import de settings (ya no usado)
  - Lineas 41-50: _build_photo_proxy_url() ahora retorna URL relativa
```

### 12.5 Testing

| Aspecto | Estado |
|---------|--------|
| Foto carga desde localhost | ✅ |
| Foto carga desde IP externa | ✅ |
| Sin errores CORS en consola | ✅ |
| Preflight no necesario (mismo origen) | ✅ |

---

## 13. Kiosk Mobile - Fixes de Foto, Curso y Boton Unico

### 13.1 Problema: Foto del Estudiante No Cargaba en Mobile

La pantalla de confirmacion del kiosk mobile mostraba un placeholder en lugar de la foto del estudiante. Los logs mostraban:

```
[Photo Debug] Sync not available, using direct URL
```

**Causa:** El modulo `Sync` estaba definido con `const Sync = {}` pero no se exponia globalmente con `window.Sync`. La verificacion `typeof Sync !== 'undefined'` fallaba porque la variable no estaba en el scope global desde `scan_result.js`.

**Solucion - Exponer modulos globalmente:**

```javascript
// sync.js - al final del archivo
window.Sync = Sync;

// state.js - al final del archivo
window.State = State;
```

**Mejora en deteccion:**

```javascript
// scan_result.js - loadAuthenticatedPhoto()
const syncAvailable = typeof Sync !== 'undefined' && typeof Sync.loadImageWithDeviceKey === 'function';
console.log('[Photo Debug] Sync module check:', {
  syncDefined: typeof Sync !== 'undefined',
  windowSyncDefined: typeof window.Sync !== 'undefined',
  hasLoadImageFn: syncAvailable
});
```

### 13.2 Problema: Curso del Estudiante No Aparecia

La pantalla de confirmacion mobile no mostraba el curso del estudiante (ej: "2° Básico B").

**Causa:** El metodo `State.updateStudents()` recibia `course_name` desde el API (endpoint `/bootstrap`) pero solo almacenaba `course_id`:

```javascript
// ANTES - state.js updateStudents()
existing.course_id = serverStudent.course_id;
// course_name nunca se guardaba
```

**Solucion - Almacenar course_name:**

```javascript
// DESPUES - state.js updateStudents()
if (existing) {
  existing.full_name = serverStudent.full_name;
  existing.course_id = serverStudent.course_id;
  existing.course_name = serverStudent.course_name || null;  // NUEVO
  existing.photo_url = serverStudent.photo_url;
  existing.photo_opt_in = serverStudent.photo_pref_opt_in ?? false;
  existing.evidence_preference = serverStudent.evidence_preference ?? 'none';
  existing.guardian_name = serverStudent.guardian_name || null;
} else {
  this.students.push({
    id: serverStudent.id,
    full_name: serverStudent.full_name,
    course_id: serverStudent.course_id,
    course_name: serverStudent.course_name || null,  // NUEVO
    photo_url: serverStudent.photo_url,
    // ...
  });
}
```

### 13.3 Problema: Regresion - Dos Botones en Lugar de Uno

Despues de los cambios de diseno mobile, la pantalla de confirmacion mostraba dos botones (INGRESO y SALIDA) cuando deberia mostrar solo uno basado en el ultimo evento del estudiante.

**Causa:** El diseno mobile renderizaba ambos botones incondicionalmente:

```html
<!-- ANTES - renderMobile() -->
<button class="mobile-action-btn-entry" onclick="Views.scanResult.confirm('IN')">REGISTRAR INGRESO</button>
<button class="mobile-action-btn-exit" onclick="Views.scanResult.confirm('OUT')">REGISTRAR SALIDA</button>
```

**Solucion - Renderizado condicional:**

```javascript
// DESPUES - renderMobile() usa isEntry para mostrar solo un boton
<div class="mobile-action-buttons">
  ${isEntry ? `
  <button class="mobile-action-btn mobile-action-btn-entry"
          onclick="Views.scanResult.confirm()">
    <div class="mobile-action-btn-content">
      <span class="mobile-action-btn-label">Acción de Entrada</span>
      <span class="mobile-action-btn-text">REGISTRAR INGRESO</span>
    </div>
    <span class="material-symbols-outlined">login</span>
  </button>
  ` : `
  <button class="mobile-action-btn mobile-action-btn-exit"
          onclick="Views.scanResult.confirm()">
    <div class="mobile-action-btn-content">
      <span class="mobile-action-btn-label">Acción de Salida</span>
      <span class="mobile-action-btn-text">REGISTRAR SALIDA</span>
    </div>
    <span class="material-symbols-outlined">logout</span>
  </button>
  `}
</div>
```

La variable `isEntry` se calcula usando `State.nextEventTypeFor(student.id) === 'IN'` que determina automaticamente si el proximo evento debe ser entrada o salida.

### 13.4 Nuevo: Controles de Sincronizacion en Settings

Se agregaron dos nuevos botones en la pantalla de configuracion para facilitar la gestion de datos:

**Boton "Sincronizar Datos del Servidor":**

```javascript
// settings.js
Views.settings.forceSync = async function() {
  if (!Sync.isRealApiMode()) {
    UI.showToast('API no configurada. Configure la device key primero.', 'warning');
    return;
  }

  UI.showToast('Sincronizando con el servidor...', 'info');

  try {
    Sync.clearImageCache();
    const success = await Sync.syncBootstrap();

    if (success) {
      UI.showToast('Sincronización completa. Datos actualizados.', 'success');
    } else {
      UI.showToast('Error al sincronizar. Verifique la conexión.', 'error');
    }
  } catch (err) {
    console.error('Force sync error:', err);
    UI.showToast('Error: ' + err.message, 'error');
  }
};
```

**Boton "Limpiar Cache Local":**

```javascript
Views.settings.clearCache = function() {
  if (confirm('¿Limpiar cache local? Los datos de estudiantes se recargarán del servidor.')) {
    State.students = [];
    State.tags = [];
    State.teachers = [];

    if (Sync && Sync.clearImageCache) {
      Sync.clearImageCache();
    }

    localStorage.removeItem('kioskData');
    State.persist();
    UI.showToast('Cache limpiado. Reinicie la aplicación o sincronice.', 'success');
  }
};
```

### 13.5 Archivos Modificados

```
# Kiosk Preview
src/kiosk-app-preview/js/state.js
  - Linea 298-299: Agregado course_name en update path
  - Linea 309-310: Agregado course_name en create path
  - Linea 451: Agregado window.State = State

src/kiosk-app-preview/js/sync.js
  - Final del archivo: Agregado window.Sync = Sync

src/kiosk-app-preview/js/views/scan_result.js
  - loadAuthenticatedPhoto(): Debug logging mejorado
  - renderMobile(): Renderizado condicional de boton unico

src/kiosk-app-preview/js/views/settings.js
  - Lineas 63-77: Nueva seccion "Sincronización" con 2 botones
  - Lineas 154-184: forceSync() function
  - Lineas 186-206: clearCache() function
```

### 13.6 Testing

| Aspecto | Estado |
|---------|--------|
| Foto del estudiante carga correctamente | ✅ |
| Debug logs muestran Sync disponible | ✅ |
| Curso muestra nombre correcto (ej: "2° Básico B") | ✅ |
| Solo un boton visible (INGRESO o SALIDA) | ✅ |
| Boton correcto segun ultimo evento | ✅ |
| Boton forceSync sincroniza datos del servidor | ✅ |
| Boton clearCache limpia localStorage | ✅ |

---

*Actualizado el 21 de Enero de 2026 - Sesion Noche (Fixes Mobile Kiosk)*
