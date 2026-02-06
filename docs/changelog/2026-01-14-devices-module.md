# 2026-01-14: Modulo de Dispositivos

## Resumen

Sesion enfocada en:
- **Modulo de Dispositivos**: Conexion completa del CRUD al backend
- **Deteccion Automatica Offline**: Job APScheduler para marcar dispositivos desconectados
- **Prueba de Provisioning**: Validacion del script con dispositivo movil (celular)

---

## 1. Modulo de Dispositivos Conectado al Backend

### Problema
El modulo de "Puertas y Dispositivos" en la consola del director solo guardaba datos en localStorage. Los dispositivos creados no se persistian en la base de datos y se perdian al recargar.

### Causa Raiz
1. El frontend (`director_devices.js`) solo usaba `State.data.devices` (localStorage)
2. El backend solo tenia endpoints para heartbeat, ping y logs - faltaban CREATE, UPDATE, DELETE
3. No habia metodos en `api.js` para dispositivos

### Solucion

#### 1. Backend: Schemas para CRUD

**`app/schemas/devices.py`**
```python
class DeviceCreate(BaseModel):
    """Schema for creating a new device from admin UI."""
    device_id: str = Field(..., max_length=64)
    gate_id: str = Field(..., max_length=64)
    firmware_version: str = Field(default="1.0.0", max_length=32)
    battery_pct: int = Field(default=100, ge=0, le=100)
    pending_events: int = Field(default=0, ge=0)
    online: bool = Field(default=False)

class DeviceUpdate(BaseModel):
    """Schema for updating an existing device."""
    device_id: str | None = Field(default=None, max_length=64)
    gate_id: str | None = Field(default=None, max_length=64)
    firmware_version: str | None = Field(default=None, max_length=32)
    battery_pct: int | None = Field(default=None, ge=0, le=100)
    pending_events: int | None = Field(default=None, ge=0)
    online: bool | None = None
```

#### 2. Backend: Repository Methods

**`app/db/repositories/devices.py`**
```python
async def create(self, *, device_id: str, gate_id: str, ...) -> Device:
    """Create a new device from admin UI."""
    device = Device(
        device_id=device_id,
        gate_id=gate_id,
        firmware_version=firmware_version,
        battery_pct=battery_pct,
        pending_events=pending_events,
        online=online,
        last_sync=None,  # No sync yet - device created manually
    )
    self.session.add(device)
    await self.session.flush()
    return device

async def update(self, device: Device, **kwargs) -> Device:
    """Update device fields."""
    for key, value in kwargs.items():
        if value is not None and hasattr(device, key):
            setattr(device, key, value)
    await self.session.flush()
    return device

async def delete(self, device: Device) -> None:
    """Delete a device."""
    await self.session.delete(device)
    await self.session.flush()
```

#### 3. Backend: Service Methods

**`app/services/device_service.py`**
```python
async def create_device(self, payload: DeviceCreate) -> DeviceRead:
    try:
        device = await self.repository.create(...)
        await self.session.commit()
        return DeviceRead.model_validate(device, from_attributes=True)
    except IntegrityError as exc:
        await self.session.rollback()
        raise ValueError(f"Ya existe un dispositivo con ID '{payload.device_id}'") from exc

async def update_device(self, device_id: int, payload: DeviceUpdate) -> DeviceRead:
    device = await self.repository.get_by_id(device_id)
    if device is None:
        raise ValueError("Dispositivo no encontrado")
    update_data = payload.model_dump(exclude_unset=True, exclude_none=True)
    device = await self.repository.update(device, **update_data)
    await self.session.commit()
    return DeviceRead.model_validate(device, from_attributes=True)

async def delete_device(self, device_id: int) -> None:
    device = await self.repository.get_by_id(device_id)
    if device is None:
        raise ValueError("Dispositivo no encontrado")
    await self.repository.delete(device)
    await self.session.commit()
```

#### 4. Backend: API Endpoints

**`app/api/v1/devices.py`**
```python
@router.post("", response_model=DeviceRead, status_code=status.HTTP_201_CREATED)
async def create_device(
    payload: DeviceCreate,
    service: DeviceService = Depends(deps.get_device_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> DeviceRead:
    """Create a new device/kiosk."""

@router.patch("/{device_id}", response_model=DeviceRead)
async def update_device(device_id: int, payload: DeviceUpdate, ...) -> DeviceRead:
    """Update an existing device."""

@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(device_id: int, ...) -> None:
    """Delete a device."""
```

#### 5. Frontend: API Methods

**`src/web-app/js/api.js`**
```javascript
// Device management
async getDevices() {
  const response = await this.request('/devices');
  if (!response.ok) throw new Error('Error al obtener dispositivos');
  return response.json();
},

async createDevice(data) {
  const response = await this.request('/devices', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Error al crear dispositivo');
  }
  return response.json();
},

async updateDevice(deviceId, data) { ... },
async deleteDevice(deviceId) { ... },
async pingDevice(deviceId) { ... },
async getDeviceLogs(deviceId) { ... },
```

#### 6. Frontend: Vista Conectada

**`src/web-app/js/views/director_devices.js`**

Reescrito completamente para:
- Cargar dispositivos desde API en vez de localStorage
- Crear dispositivos via `API.createDevice()`
- Actualizar via `API.updateDevice()`
- Eliminar via `API.deleteDevice()`
- Ping via `API.pingDevice()`
- Logs via `API.getDeviceLogs()`

### Endpoints Disponibles

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| `GET` | `/api/v1/devices` | Listar dispositivos |
| `POST` | `/api/v1/devices` | Crear dispositivo |
| `PATCH` | `/api/v1/devices/{id}` | Actualizar dispositivo |
| `DELETE` | `/api/v1/devices/{id}` | Eliminar dispositivo |
| `POST` | `/api/v1/devices/{id}/ping` | Ping a dispositivo |
| `GET` | `/api/v1/devices/{id}/logs` | Obtener logs |
| `POST` | `/api/v1/devices/heartbeat` | Heartbeat de kiosk |

### Verificacion

Dispositivo KIOSK-003 creado desde UI y verificado en base de datos:
```sql
SELECT * FROM tenant_demo_local.devices;

 id | device_id |     gate_id     | firmware_version | battery_pct | online
----+-----------+-----------------+------------------+-------------+--------
  3 | KIOSK-001 | GATE-PRINCIPAL  | 1.0.0            |         100 | t
  4 | KIOSK-002 | GATE-SECUNDARIA | 1.0.0            |         100 | t
  5 | KIOSK-003 | PUERTA 3        | 1.0.0            |         100 | f
```

---

## 2. Deteccion Automatica de Dispositivos Offline

### Problema
El sistema no tenia forma automatica de marcar dispositivos como "Desconectado". Solo se actualizaba el estado cuando:
- El dispositivo enviaba un heartbeat
- El administrador hacia ping manual
- Se editaba manualmente desde la UI

### Solucion
Job con APScheduler que revisa cada 2 minutos y marca como offline los dispositivos sin actividad en los ultimos 5 minutos.

### Implementacion

#### 1. Nuevo Job: `mark_devices_offline.py`

**`app/workers/jobs/mark_devices_offline.py`**
```python
"""Job to mark devices as offline if no heartbeat received."""

from datetime import datetime, timezone, timedelta
from loguru import logger
from sqlalchemy import or_, update

from app.db.session import async_session
from app.db.models.device import Device

# Devices without heartbeat for this duration are marked offline
OFFLINE_THRESHOLD_MINUTES = 5


async def _mark_devices_offline() -> None:
    """Mark devices as offline if last_sync is older than threshold or NULL."""
    threshold = datetime.now(timezone.utc) - timedelta(minutes=OFFLINE_THRESHOLD_MINUTES)

    async with async_session() as session:
        # Update devices where online=True AND (last_sync < threshold OR last_sync is NULL)
        stmt = (
            update(Device)
            .where(Device.online == True)
            .where(
                or_(
                    Device.last_sync < threshold,
                    Device.last_sync.is_(None),
                )
            )
            .values(online=False)
        )
        result = await session.execute(stmt)
        await session.commit()

        if result.rowcount > 0:
            logger.info(
                "[DeviceStatus] Marked %d device(s) as offline (no heartbeat in %d min)",
                result.rowcount,
                OFFLINE_THRESHOLD_MINUTES,
            )
        else:
            logger.debug("[DeviceStatus] All devices are up to date")
```

#### 2. Scheduler Actualizado

**`app/workers/scheduler.py`**
```python
from app.workers.jobs.mark_devices_offline import _mark_devices_offline

async def run_scheduler() -> None:
    scheduler = AsyncIOScheduler(timezone="UTC")

    # ... otros jobs ...

    # Mark devices offline if no heartbeat in 5 minutes
    scheduler.add_job(
        _mark_devices_offline,
        CronTrigger(minute="*/2"),  # Run every 2 minutes
        name="mark_devices_offline",
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()
```

### Logica del Job

```
Cada 2 minutos:
  Para cada dispositivo donde online = true:
    SI last_sync es NULL
       O last_sync < (ahora - 5 minutos):
    → Marcar online = false
```

### Casos Manejados

| Escenario | last_sync | online | Accion |
|-----------|-----------|--------|--------|
| Dispositivo nuevo (sin heartbeat) | NULL | true | → Marca offline |
| Sin heartbeat en 5+ min | < threshold | true | → Marca offline |
| Heartbeat reciente | > threshold | true | Sin cambio |
| Ya esta offline | cualquier | false | Sin cambio |

### Ejecucion

Para ejecutar el scheduler:
```bash
python -m app.workers.scheduler
```

---

## Archivos Modificados

```
8 files changed

Backend:
- app/schemas/devices.py - DeviceCreate, DeviceUpdate schemas
- app/db/repositories/devices.py - create(), update(), delete() methods
- app/services/device_service.py - create_device(), update_device(), delete_device()
- app/api/v1/devices.py - POST, PATCH, DELETE endpoints
- app/workers/jobs/mark_devices_offline.py - NUEVO: Job deteccion offline
- app/workers/scheduler.py - Agregado job mark_devices_offline

Frontend:
- src/web-app/js/api.js - 5 metodos de dispositivos
- src/web-app/js/views/director_devices.js - Reescrito para usar API
```

---

## Estado de la Base de Datos

| Tabla | Registros |
|-------|-----------|
| devices | 3 (KIOSK-001, KIOSK-002, KIOSK-003) |

---

## Testing Realizado

- [x] Crear dispositivo desde UI persiste en BD
- [x] Actualizar dispositivo persiste cambios
- [x] Eliminar dispositivo remueve de BD
- [x] Ping actualiza last_sync y online=true
- [x] Logs muestra informacion del dispositivo
- [ ] Job marca dispositivos offline automaticamente

---

## Jobs del Scheduler

| Job | Frecuencia | Descripcion |
|-----|------------|-------------|
| `detect_no_ingreso` | */5 min | Detecta alumnos sin ingreso |
| `cleanup_photos` | 2:00 AM | Limpia fotos huerfanas |
| `mark_devices_offline` | */2 min | **NUEVO** - Marca dispositivos offline |

---

## 3. Prueba de Provisioning con Dispositivo Movil

### Objetivo
Validar que el script de provisioning funciona correctamente y que multiples dispositivos pueden identificarse de forma unica.

### Prueba Realizada

1. **Ejecutar script de provisioning**:
```powershell
.\provision_kiosk.ps1 -DeviceId "CELULAR-TEST-001" -GateId "GATE-PRUEBAS" -DeviceKey "local-dev-device-key"
```

2. **Archivos generados**:
```
kiosk-celular/data/
├── device.json   → { "device_id": "CELULAR-TEST-001", "gate_id": "GATE-PRUEBAS" }
├── config.json   → { "apiBaseUrl": "https://ngrok.../api/v1", "deviceApiKey": "..." }
├── students.json
├── tags.json
└── teachers.json
```

3. **Copiar a kiosk-app y probar desde celular**

### Resultado

Evento de asistencia registrado correctamente:
```sql
SELECT device_id, gate_id, student_id, type FROM attendance_events WHERE device_id = 'CELULAR-TEST-001';

    device_id     |   gate_id    | student_id | type
------------------+--------------+------------+------
 CELULAR-TEST-001 | GATE-PRUEBAS |         23 | IN
```

### Estado de Dispositivos en BD

```sql
SELECT id, device_id, gate_id, online FROM devices;

 id |    device_id     |     gate_id     | online
----+------------------+-----------------+--------
  3 | KIOSK-001        | GATE-PRINCIPAL  | t
  4 | KIOSK-002        | GATE-SECUNDARIA | t
  5 | KIOSK-003        | PUERTA 3        | f
  6 | CELULAR-TEST-001 | GATE-PRUEBAS    | t
```

### Documentacion: Como Funciona la Identificacion de Dispositivos

El sistema **NO detecta automaticamente** que dispositivo se conecta. Cada dispositivo **se auto-identifica** mediante archivos de configuracion:

```
┌─────────────────────────────────────────────────────────────┐
│  DISPOSITIVO FISICO                                         │
│                                                             │
│  data/device.json → { "device_id": "KIOSK-001" }           │
│         │                                                   │
│         ▼                                                   │
│  Kiosk-app carga el archivo al iniciar                     │
│         │                                                   │
│         ▼                                                   │
│  Cada request incluye: device_id: "KIOSK-001"              │
│         │                                                   │
│         ▼                                                   │
│  Backend registra el evento con ese device_id              │
└─────────────────────────────────────────────────────────────┘
```

**En produccion**: Cada kiosk fisico tiene su **propia instalacion** del kiosk-app con su propio `device.json`. No comparten la misma URL.

### Issue Encontrado

El endpoint `/devices/heartbeat` retorna **Internal Server Error** al intentar registrar dispositivo via API. El dispositivo se registro directamente en BD como workaround.

```bash
# Esto falla con 500:
curl -X POST "/api/v1/devices/heartbeat" -d '{"device_id": "CELULAR-TEST-001", ...}'
```

**Pendiente**: Investigar causa del error en heartbeat.

---

## Archivos Modificados (Adicional)

```
Provisioning:
- kiosk-celular/data/* - Configuracion generada para dispositivo de prueba
- src/kiosk-app/data/device.json - Actualizado a CELULAR-TEST-001
- src/kiosk-app/data/config.json - Actualizado con ngrok URL
```

---

## Estado de la Base de Datos (Actualizado)

| Tabla | Registros |
|-------|-----------|
| devices | 4 (KIOSK-001, KIOSK-002, KIOSK-003, CELULAR-TEST-001) |

---

## Testing Realizado (Actualizado)

- [x] Crear dispositivo desde UI persiste en BD
- [x] Actualizar dispositivo persiste cambios
- [x] Eliminar dispositivo remueve de BD
- [x] Ping actualiza last_sync y online=true
- [x] Logs muestra informacion del dispositivo
- [x] **Script de provisioning genera archivos correctos**
- [x] **Dispositivo movil se identifica correctamente**
- [x] **Eventos de asistencia registran device_id correcto**
- [ ] Job marca dispositivos offline automaticamente
- [ ] Investigar error 500 en endpoint heartbeat

---

---

## 4. Bugs Corregidos (Sesion Continuacion)

### 4.1 Fix: Heartbeat Endpoint 500 Error

**Problema**: El endpoint `/api/v1/devices/heartbeat` retornaba 500 Internal Server Error.

**Causa Raiz**: En `device_service.py:28`, el metodo `process_heartbeat` usaba:
```python
return DeviceRead.model_validate(device)  # ERROR: falta from_attributes
```

**Solucion**: Agregar `from_attributes=True` para convertir correctamente el objeto SQLAlchemy:
```python
return DeviceRead.model_validate(device, from_attributes=True)
```

**Archivo**: `app/services/device_service.py:28`

---

### 4.2 Fix: Job Offline No Funciona con Multi-Tenant

**Problema**: El job `mark_devices_offline` no marcaba dispositivos offline porque buscaba en el schema `public` donde no existe la tabla `devices`.

**Causa Raiz**: El job usaba `async_session()` directamente, que no tiene contexto de tenant. Los dispositivos estan en schemas como `tenant_demo_local`.

**Solucion**: Reescribir el job para iterar sobre todos los tenants activos:

```python
# 1. Obtener tenants activos desde public.tenants
async with async_session() as session:
    result = await session.execute(
        select(Tenant).where(Tenant.is_active == True)
    )
    tenants = list(result.scalars().all())

# 2. Para cada tenant, usar get_tenant_session con su schema
for tenant in tenants:
    schema_name = f"tenant_{sanitize_schema_name(tenant.slug)}"
    async with get_tenant_session(schema_name) as session:
        # Ejecutar UPDATE en el schema correcto
        stmt = update(Device).where(Device.online == True)...
```

**Archivo**: `app/workers/jobs/mark_devices_offline.py` (reescrito completamente)

---

### 4.3 Feature: Heartbeat Automatico en Kiosk

**Problema**: El kiosk no enviaba heartbeats automaticos, causando que el dispositivo siempre apareciera offline aunque estuviera activo.

**Solucion**: Implementar heartbeat automatico que:
1. Se ejecuta cada 2 minutos
2. Reporta nivel de bateria real usando `navigator.getBattery()` API
3. Reporta cantidad de eventos pendientes

**Implementacion**:
```javascript
// src/kiosk-app/js/sync.js
Sync.sendHeartbeat = async function() {
  // Obtener bateria si esta disponible
  let batteryPct = 100;
  if ('getBattery' in navigator) {
    const battery = await navigator.getBattery();
    batteryPct = Math.round(battery.level * 100);
  }

  const payload = {
    device_id: config.deviceId,
    gate_id: config.gateId,
    firmware_version: State.device.version || '1.0.0',
    battery_pct: batteryPct,
    pending_events: State.getPendingCount(),
    online: true
  };

  await fetch(`${config.baseUrl}/devices/heartbeat`, {
    method: 'POST',
    headers: this.getHeaders(),
    body: JSON.stringify(payload)
  });
};

Sync.startHeartbeat = function() {
  this.sendHeartbeat(); // Inmediatamente
  this._heartbeatIntervalId = setInterval(() => {
    this.sendHeartbeat();
  }, 2 * 60 * 1000); // Cada 2 minutos
};
```

**Archivos Modificados**:
- `src/kiosk-app/js/sync.js` - Agregado `sendHeartbeat()`, `startHeartbeat()`, `stopHeartbeat()`
- `src/kiosk-app/index.html` - Llamada a `Sync.startHeartbeat()` en inicializacion

---

## Archivos Modificados (Fixes)

```
Backend:
- app/services/device_service.py - Fix from_attributes=True en process_heartbeat
- app/workers/jobs/mark_devices_offline.py - Reescrito para multi-tenant

Frontend (Kiosk):
- src/kiosk-app/js/sync.js - Heartbeat automatico + reporte de bateria
- src/kiosk-app/index.html - Inicializacion de heartbeat
```

---

## Testing Realizado (Final)

- [x] Crear dispositivo desde UI persiste en BD
- [x] Actualizar dispositivo persiste cambios
- [x] Eliminar dispositivo remueve de BD
- [x] Ping actualiza last_sync y online=true
- [x] Logs muestra informacion del dispositivo
- [x] Script de provisioning genera archivos correctos
- [x] Dispositivo movil se identifica correctamente
- [x] Eventos de asistencia registran device_id correcto
- [x] **Heartbeat endpoint funciona correctamente (fix 500)**
- [x] **Job offline es multi-tenant aware**
- [x] **Kiosk envia heartbeats automaticos cada 2 min**
- [x] **Kiosk reporta nivel de bateria real**
- [x] **Ping desde consola director funciona correctamente**
- [x] **Dashboard muestra estado correcto (En Linea/Desconectado)**

---

## Notas Adicionales

### Mensaje "simulado" en Ping
El mensaje "OK (simulado)" que aparecia al hacer ping era debido a **cache del navegador** con codigo anterior. Al desactivar cache y recargar, el ping muestra correctamente "OK".

### Comportamiento del Ping
El boton "Ping" en la consola del director:
- Actualiza `last_sync` del dispositivo en la BD
- Confirma que el dispositivo existe y esta registrado
- **NO envia notificacion al kiosk** (el kiosk es pull-based, no push)

Para implementar notificaciones push al dispositivo se requeriria:
- WebSocket bidireccional, o
- Push Notifications via Service Worker, o
- Polling de "comandos pendientes" desde el kiosk

---

## Proximos Pasos

1. ~~Investigar error en heartbeat~~ **RESUELTO**
2. ~~Probar job de deteccion offline con scheduler corriendo~~ **RESUELTO**
3. ~~Verificar ping real funciona~~ **RESUELTO**
4. Agregar alertas cuando dispositivo se desconecta (opcional)
5. Restaurar configuracion original de kiosk-app (DEV-01) si es necesario
6. Revisar otros jobs (`detect_no_ingreso.py`, `cleanup_photos.py`) que tienen el mismo problema multi-tenant
7. (Opcional) Implementar notificacion push al kiosk cuando se hace ping

---

## Estado Final del Modulo Dispositivos

| Funcionalidad | Estado |
|---------------|--------|
| CRUD Dispositivos | ✅ Completo |
| Heartbeat Automatico | ✅ Completo |
| Reporte de Bateria | ✅ Completo |
| Deteccion Offline | ✅ Corregido (multi-tenant) |
| Ping desde Consola | ✅ Funcional |
| Dashboard Estados | ✅ Funcional |

---
---

# Módulo Estudiantes

## Resumen Ejecutivo

Se implementaron mejoras significativas en el módulo de estudiantes:
1. **Endpoint POST /students** - Crear nuevos estudiantes (CRÍTICO - faltaba)
2. **Endpoint DELETE /students/{id}** - Eliminar estudiantes (CRÍTICO - faltaba)
3. **Endpoint GET /students con paginación** - Lista paginada con búsqueda y filtros
4. **Integración Frontend-Backend** - CREATE/UPDATE/DELETE ahora persisten en DB
5. **Soporte HEIC** - Conversión automática de fotos iPhone a JPEG
6. **Cache de fotos** - Limpieza automática en logout (ya implementado)

---

## 5. Endpoint POST /students - Crear Estudiantes (CRÍTICO)

### Descripción
Se detectó que el endpoint para crear estudiantes **no existía**. El frontend guardaba en localStorage pero no persistía en la base de datos. Este bug crítico fue corregido.

### Archivos Modificados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `app/api/v1/students.py` | Backend | Nuevo endpoint `POST /students` con schema de creación |
| `app/db/repositories/students.py` | Backend | Nuevo método `create()` |

### Endpoint Agregado

```
POST /api/v1/students
```

#### Request Body
```json
{
  "full_name": "Luna Torres",
  "course_id": 1,
  "national_id": "12.345.678-9",
  "evidence_preference": "photo"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `full_name` | string | Sí | Nombre completo (2-255 chars) |
| `course_id` | int | Sí | ID del curso |
| `national_id` | string | No | RUT o documento (max 20 chars) |
| `evidence_preference` | string | No | "photo", "audio", o "none" (default) |

#### Response (201 Created)
```json
{
  "id": 61,
  "full_name": "Luna Torres",
  "national_id": "12.345.678-9",
  "course_id": 1,
  "status": "ACTIVE",
  "photo_url": null,
  "photo_presigned_url": null,
  "evidence_preference": "photo"
}
```

#### Roles Permitidos
- ADMIN
- DIRECTOR

---

## 5.1 Endpoint DELETE /students/{id} - Eliminar Estudiantes (CRÍTICO)

### Descripción
Se detectó que el endpoint para eliminar estudiantes **no existía**. El frontend solo eliminaba de localStorage.

### Archivos Modificados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `app/api/v1/students.py` | Backend | Nuevo endpoint `DELETE /students/{id}` |
| `app/db/repositories/students.py` | Backend | Nuevo método `delete()` |
| `src/web-app/js/api.js` | Frontend | Método `deleteStudent()` |
| `src/web-app/js/views/director_students.js` | Frontend | Llama a API al eliminar |

### Endpoint Agregado

```
DELETE /api/v1/students/{student_id}
```

#### Response
- **204 No Content** - Estudiante eliminado correctamente
- **404 Not Found** - Estudiante no encontrado

#### Comportamiento
- Elimina la foto del estudiante de S3 si existe
- Elimina el registro del estudiante de la base de datos

#### Roles Permitidos
- ADMIN
- DIRECTOR

---

## 5.2 Integración Frontend-Backend CRUD

### Problema
El frontend guardaba estudiantes solo en localStorage, sin llamar a la API.

### Solución
Se modificó `director_students.js` para llamar a los endpoints:

| Operación | Antes | Después |
|-----------|-------|---------|
| Crear | `State.addStudent()` | `API.createStudent()` + State |
| Actualizar | `State.updateStudent()` | `API.updateStudent()` + State |
| Eliminar | `State.deleteStudent()` | `API.deleteStudent()` + State |

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/web-app/js/api.js` | Métodos `createStudent()`, `deleteStudent()` |
| `src/web-app/js/views/director_students.js` | `saveStudent()` y `confirmDelete()` llaman API |

---

## 6. Endpoint GET /students con Paginación y Búsqueda

### Descripción
Nuevo endpoint para listar estudiantes con paginación, búsqueda por nombre/RUT, y filtros por curso y estado.

### Archivos Modificados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `app/api/v1/students.py` | Backend | Nuevo endpoint `GET /students` con response schemas |
| `app/db/repositories/students.py` | Backend | Nuevo método `list_paginated()` con filtros y conteo |

### Endpoint Agregado

```
GET /api/v1/students
```

#### Parámetros de Query
| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `skip` | int | 0 | Offset para paginación |
| `limit` | int | 50 | Máximo de registros (1-200) |
| `q` | string | null | Búsqueda por nombre o RUT (min 2 chars) |
| `course_id` | int | null | Filtrar por curso |
| `status` | string | null | Filtrar por estado (ACTIVE, INACTIVE) |

#### Response
```json
{
  "items": [
    {
      "id": 1,
      "full_name": "Juan Pérez",
      "national_id": "12.345.678-9",
      "course_id": 1,
      "status": "ACTIVE",
      "photo_url": "students/1/profile_abc123.jpg",
      "photo_presigned_url": "https://api/v1/photos/students/...",
      "evidence_preference": "photo"
    }
  ],
  "total": 150,
  "skip": 0,
  "limit": 50,
  "has_more": true
}
```

#### Roles Permitidos
- ADMIN
- DIRECTOR
- INSPECTOR

---

## 7. Soporte HEIC (Fotos iPhone)

### Descripción
El endpoint `POST /students/{id}/photo` ahora acepta imágenes HEIC/HEIF (formato nativo de iPhone) y las convierte automáticamente a JPEG.

### Archivos Modificados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `app/api/v1/students.py` | Backend | Lógica de conversión HEIC → JPEG |
| `pyproject.toml` | Config | Agregadas dependencias Pillow y pillow-heif |

### Dependencias Agregadas

```toml
"Pillow>=10.0",
"pillow-heif>=0.15"
```

### Formatos Soportados

| MIME Type | Extensión | Acción |
|-----------|-----------|--------|
| `image/jpeg` | .jpg/.jpeg | Almacenado directo |
| `image/png` | .png | Almacenado directo |
| `image/webp` | .webp | Almacenado directo |
| `image/heic` | .heic | **Convertido a JPEG** |
| `image/heif` | .heif | **Convertido a JPEG** |

### Comportamiento
- Conversión automática con calidad 85%
- Se preserva la relación de aspecto
- Imágenes con canal alpha se convierten a RGB
- Si pillow-heif no está instalado, HEIC es rechazado con mensaje de error claro

---

## 8. Campo Legacy `photo_pref_opt_in`

### Estado Actual
El modelo `Student` tiene dos campos para preferencia de evidencia:
- `photo_pref_opt_in` (bool) - **Legacy**, mantener para backward compatibility
- `evidence_preference` (string: "photo"|"audio"|"none") - **Nuevo**

### Property de Compatibilidad
```python
@property
def effective_evidence_preference(self) -> str:
    if self.evidence_preference and self.evidence_preference != "none":
        return self.evidence_preference
    if self.photo_pref_opt_in:
        return "photo"
    return "none"
```

### Plan de Migración (Futuro)
1. Migrar datos: convertir `photo_pref_opt_in=True` → `evidence_preference="photo"`
2. Actualizar kiosks para usar `evidence_preference`
3. Deprecar campo en API responses
4. Eliminar columna de DB

---

## Estado Final del Módulo Estudiantes

| Métrica | Valor |
|---------|-------|
| Archivos modificados | 6 |
| Nuevos endpoints backend | 3 (POST, GET, DELETE) |
| Nuevos métodos API frontend | 2 (createStudent, deleteStudent) |
| Bugs críticos corregidos | 2 (POST y DELETE no existían) |
| Formatos de imagen soportados | +2 (HEIC, HEIF) |
| Dependencias agregadas | 2 (Pillow, pillow-heif) |

---

## Testing Recomendado - Estudiantes

### Crear Estudiante (CRÍTICO)
- [ ] POST /students con datos válidos → estudiante creado con ID
- [ ] Verificar en DB que el estudiante existe
- [ ] Crear desde frontend y verificar persistencia
- [ ] Recargar página → estudiante sigue visible

### Eliminar Estudiante (CRÍTICO)
- [ ] DELETE /students/{id} → 204 No Content
- [ ] Verificar en DB que el estudiante no existe
- [ ] Eliminar desde frontend y verificar persistencia
- [ ] Recargar página → estudiante no aparece

### Actualizar Estudiante
- [ ] PATCH /students/{id} → datos actualizados
- [ ] Actualizar desde frontend y verificar en DB
- [ ] Recargar página → cambios persisten

### Paginación
- [ ] GET /students sin parámetros → primeros 50 estudiantes
- [ ] GET /students?skip=50&limit=25 → paginación correcta
- [ ] GET /students?q=juan → búsqueda por nombre
- [ ] GET /students?q=12.345 → búsqueda por RUT
- [ ] GET /students?course_id=1 → filtro por curso
- [ ] GET /students?status=ACTIVE → filtro por estado
- [ ] Verificar `has_more` es correcto

### HEIC Upload
- [ ] Subir foto .heic desde iPhone
- [ ] Verificar conversión a JPEG
- [ ] Verificar que se visualiza correctamente
- [ ] Probar con pillow-heif no instalado (mensaje de error)

---

## 9. Soft Delete de Estudiantes

### Descripción
Se cambió el comportamiento de eliminación de estudiantes de **hard delete** (eliminación permanente) a **soft delete** (marcado como DELETED). Esto preserva los registros para consultas históricas y auditoría.

### Archivos Modificados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `app/api/v1/students.py` | Backend | DELETE usa soft delete, nuevo endpoint restore |
| `app/db/repositories/students.py` | Backend | Método `soft_delete()`, `list_paginated()` modificado |
| `app/db/models/student.py` | Model | Cascade delete en enrollments |
| `app/db/models/enrollment.py` | Model | Fix campo `year` (era `school_year`) |
| `src/web-app/js/views/director_students.js` | Frontend | Filtro estado, columna estado, botón restaurar |

### Cambios en Backend

#### DELETE /students/{id} - Ahora es Soft Delete
```python
@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(...):
    """Soft delete a student (marks as DELETED).

    The student record is preserved for historical queries and auditing.
    """
    # Validar que existe y no está ya eliminado
    if student.status == "DELETED":
        raise HTTPException(400, "El estudiante ya fue eliminado")

    # Soft delete - marcar como DELETED
    await repo.soft_delete(student_id)
```

#### Nuevo Endpoint: POST /students/{id}/restore
```python
@router.post("/{student_id}/restore", response_model=StudentResponse)
async def restore_student(...):
    """Restore a soft-deleted student.

    Changes status from DELETED back to ACTIVE.
    """
    if student.status != "DELETED":
        raise HTTPException(400, "El estudiante no está eliminado")

    student = await repo.update(student_id, status="ACTIVE")
```

#### Repository: soft_delete()
```python
async def soft_delete(self, student_id: int) -> bool:
    """Soft delete a student by marking status as DELETED."""
    student = await self.get(student_id)
    if not student:
        return False
    student.status = "DELETED"
    await self.session.flush()
    return True
```

#### Repository: list_paginated() modificado
```python
async def list_paginated(
    self, *, skip=0, limit=50, search=None,
    course_id=None, status=None, include_deleted=False
):
    # Excluir DELETED por defecto
    if not include_deleted:
        base_query = base_query.where(Student.status != "DELETED")
```

### Protección de Endpoints

Los siguientes endpoints ahora rechazan estudiantes con status DELETED:
- `GET /students/{id}` - 404 Not Found
- `PATCH /students/{id}` - 404 Not Found
- `POST /students/{id}/photo` - 404 Not Found
- `DELETE /students/{id}/photo` - 404 Not Found

### Cambios en Frontend

#### Filtro por Estado
```javascript
<select id="filter-status" class="form-select">
  <option value="">Activos</option>
  <option value="INACTIVE">Inactivos</option>
  <option value="DELETED">Eliminados</option>
  <option value="ALL">Todos</option>
</select>
```

#### Columna de Estado con Chips
```javascript
const statusChip = student.status === 'DELETED'
  ? Components.createChip('Eliminado', 'error')
  : student.status === 'INACTIVE'
    ? Components.createChip('Inactivo', 'warning')
    : Components.createChip('Activo', 'success');
```

#### Botón Restaurar para Eliminados
```javascript
${isDeleted ? `
  <button class="btn btn-success btn-sm"
          onclick="Views.directorStudents.restoreStudent(${student.id})">
    ♻️ Restaurar
  </button>
` : `
  // Botones normales: Ver, Credencial, Asistencia, Editar, Eliminar
`}
```

### Bugs Corregidos

| Bug | Causa | Solución |
|-----|-------|----------|
| Error al eliminar estudiante | Columna `school_year` no existe | Cambiar a `year` en modelo Enrollment |
| Foreign key constraint | Enrollments huérfanos | Agregar `cascade="all, delete-orphan"` |
| URL duplicada en filtro | `/api/v1/api/v1/students` | Remover prefijo en `applyFilters()` |
| URL duplicada en restaurar | `/api/v1/api/v1/students/restore` | Remover prefijo en `restoreStudent()` |

### Flujo de Soft Delete

```
┌─────────────────────────────────────────────────────────────┐
│  ELIMINAR ESTUDIANTE                                         │
│                                                             │
│  1. Usuario hace clic en 🗑️                                 │
│  2. Modal de confirmación                                   │
│  3. DELETE /api/v1/students/{id}                            │
│  4. Backend: student.status = "DELETED"                     │
│  5. Estudiante desaparece de lista normal                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  RESTAURAR ESTUDIANTE                                        │
│                                                             │
│  1. Filtrar por "Eliminados"                                │
│  2. Ver lista de estudiantes eliminados                     │
│  3. Clic en ♻️ Restaurar                                    │
│  4. POST /api/v1/students/{id}/restore                      │
│  5. Backend: student.status = "ACTIVE"                      │
│  6. Estudiante vuelve a lista normal                        │
└─────────────────────────────────────────────────────────────┘
```

### Testing Realizado

- [x] Eliminar estudiante marca como DELETED (no borra de DB)
- [x] Estudiante eliminado no aparece en listado normal
- [x] Filtrar por "Eliminados" muestra estudiantes con status DELETED
- [x] Restaurar cambia status de DELETED a ACTIVE
- [x] Estudiante restaurado aparece en listado normal
- [x] Endpoints protegidos rechazan estudiantes DELETED
- [x] Edición de estudiantes funciona y persiste en DB

---

## 10. Registro Manual de Asistencia

### Descripción
Se implementó la funcionalidad para registrar entradas y salidas manuales de estudiantes desde el módulo de alumnos. Los registros se persisten en la base de datos con source `MANUAL` para distinguirlos de los registros automáticos (QR, NFC, biométrico).

### Problema Original
Los botones "Registrar Entrada" y "Registrar Salida" en el modal de asistencia solo guardaban en `localStorage` y no persistían en la base de datos.

### Solución
Se modificó la función `registerAttendance()` para llamar al endpoint existente `POST /api/v1/attendance/events` con valores específicos para identificar registros manuales desde la web.

### Archivo Modificado

| Archivo | Cambio |
|---------|--------|
| `src/web-app/js/views/director_students.js` | Función `registerAttendance()` ahora llama API |

### Código Implementado

```javascript
Views.directorStudents.registerAttendance = async function(studentId, type) {
  try {
    const response = await API.request('/attendance/events', {
      method: 'POST',
      body: JSON.stringify({
        student_id: studentId,
        type: type,              // 'IN' o 'OUT'
        device_id: 'WEB-APP',    // Identifica origen web
        gate_id: 'MANUAL-ENTRY', // Identifica entrada manual
        source: 'MANUAL'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Error al registrar asistencia');
    }

    // También actualiza localStorage para feedback inmediato
    State.addAttendanceEvent({ student_id: studentId, type, source: 'MANUAL' });

    Components.showToast(`${type === 'IN' ? 'Entrada' : 'Salida'} registrada`, 'success');
  } catch (error) {
    Components.showToast(error.message || 'Error al registrar asistencia', 'error');
  }
};
```

### Estructura del Registro en DB

| Campo | Valor |
|-------|-------|
| student_id | ID del estudiante |
| type | IN / OUT |
| source | MANUAL |
| device_id | WEB-APP |
| gate_id | MANUAL-ENTRY |
| occurred_at | Timestamp UTC |

### Testing Realizado

- [x] Registrar entrada manual persiste en DB
- [x] Registrar salida manual persiste en DB
- [x] Source = MANUAL distingue de otros métodos
- [x] Manejo de errores con toast
- [x] Actualización de UI inmediata

---

## Estado Final del Módulo Estudiantes (Completo)

| Funcionalidad | Estado |
|---------------|--------|
| CREATE estudiante | ✅ Completo |
| READ estudiante | ✅ Completo |
| UPDATE estudiante | ✅ Completo |
| DELETE (soft) | ✅ Completo |
| RESTORE | ✅ Completo |
| Filtro por estado | ✅ Completo |
| Columna estado UI | ✅ Completo |
| Paginación | ✅ Completo |
| Búsqueda | ✅ Completo |
| Upload foto HEIC | ✅ Completo |
| Asistencia manual | ✅ Completo |

---

*Módulo de Estudiantes completado el 14 de Enero de 2026*

---
---

# Módulo Apoderados (Guardians)

## Resumen Ejecutivo

Se completó la integración del módulo de Apoderados con el backend:
1. **Endpoints API completos** - GET, POST, PATCH, DELETE para guardians
2. **Integración Frontend-Backend** - CRUD persiste en base de datos
3. **Fix modelo PushSubscription** - Alineado con schema real de DB
4. **Asociación estudiantes-apoderados** - Gestión de relaciones many-to-many

---

## 11. Endpoint GET /guardians - Listar Apoderados

### Archivos Creados/Modificados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `app/api/v1/guardians.py` | Backend | Endpoints CRUD completos |
| `app/schemas/guardians.py` | Backend | Schemas de request/response |
| `app/db/repositories/guardians.py` | Backend | Métodos de repositorio |
| `app/api/v1/router.py` | Backend | Registro del router |

### Endpoint

```
GET /api/v1/guardians
```

#### Parámetros de Query
| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `q` | string | null | Búsqueda por nombre (min 2 chars) |
| `skip` | int | 0 | Offset para paginación |
| `limit` | int | 50 | Máximo de registros (1-200) |

#### Response
```json
{
  "items": [
    {
      "id": 1,
      "full_name": "Roberto González Silva",
      "contacts": {"email": "roberto@example.com", "phone": "+56912345678"},
      "student_ids": [1, 5, 12],
      "student_count": 3
    }
  ],
  "total": 100,
  "skip": 0,
  "limit": 50,
  "has_more": true
}
```

---

## 12. Endpoint POST /guardians - Crear Apoderado

### Endpoint

```
POST /api/v1/guardians
```

#### Request Body
```json
{
  "full_name": "María López Torres",
  "contacts": {
    "email": "maria@example.com",
    "phone": "+56987654321",
    "whatsapp": "+56987654321"
  },
  "student_ids": [1, 2]
}
```

#### Response (201 Created)
```json
{
  "id": 104,
  "full_name": "María López Torres",
  "contacts": {"email": "maria@example.com", "phone": "+56987654321"},
  "student_ids": [1, 2]
}
```

### Bug Corregido: MissingGreenlet en Create

**Problema**: Error 500 al crear apoderado - `MissingGreenlet: greenlet_spawn has not been called`

**Causa**: Después de `repo.create()` y `session.refresh()`, acceder a `guardian.students` disparaba lazy loading en contexto async.

**Solución**: Siempre recargar con eager loading después de crear:
```python
# app/api/v1/guardians.py líneas 99-104
if payload.student_ids:
    await repo.set_students(guardian.id, payload.student_ids)

# Always reload with eager loading to avoid lazy load issues
guardian = await repo.get(guardian.id)

await session.commit()
```

---

## 13. Endpoint PATCH /guardians/{id} - Actualizar Apoderado

### Endpoint

```
PATCH /api/v1/guardians/{guardian_id}
```

#### Request Body (campos opcionales)
```json
{
  "full_name": "Nuevo Nombre",
  "contacts": {"email": "nuevo@email.com"},
  "student_ids": [1, 2, 3]
}
```

---

## 14. Endpoint DELETE /guardians/{id} - Eliminar Apoderado

### Endpoint

```
DELETE /api/v1/guardians/{guardian_id}
```

#### Response
- **204 No Content** - Eliminado correctamente
- **404 Not Found** - Apoderado no encontrado

### Bug Corregido: PushSubscription Schema Mismatch

**Problema**: Error 500 al eliminar - `column push_subscriptions.guardian_id does not exist`

**Causa**: El modelo `PushSubscription` tenía `guardian_id` pero la tabla real tiene `user_id`.

**Análisis del Schema Real**:
```sql
\d tenant_demo_local.push_subscriptions
   Columna    |           Tipo
--------------+--------------------------
 id           | integer
 user_id      | integer (FK → users)     -- NO guardian_id
 endpoint     | character varying(512)
 p256dh       | character varying(255)
 auth         | character varying(255)
 user_agent   | character varying(512)
 created_at   | timestamp with time zone
 last_used_at | timestamp with time zone -- NO updated_at
```

**Solución**: Alinear modelo con DB real:

**Antes** (`app/db/models/push_subscription.py`):
```python
guardian_id: Mapped[int] = mapped_column(ForeignKey("guardians.id"))
is_active: Mapped[bool]       # No existía
device_name: Mapped[str]      # No existía
updated_at: Mapped[datetime]  # Era last_used_at
```

**Después**:
```python
user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
# Eliminados: is_active, device_name
last_used_at: Mapped[datetime | None]  # Nombre correcto

# Relación bidireccional con User
user = relationship("User", back_populates="push_subscriptions")
```

**Modelo User actualizado** (`app/db/models/user.py`):
```python
push_subscriptions = relationship(
    "PushSubscription", back_populates="user", cascade="all, delete-orphan"
)
```

### Arquitectura de Notificaciones Push

```
Guardian ←──(puede tener)──→ User ←──(tiene)──→ PushSubscription
```

- `User` con role `PARENT` tiene `guardian_id` FK a `Guardian`
- `PushSubscription` pertenece a `User` (para web app login)
- Los apoderados sin cuenta de usuario reciben notificaciones por email/WhatsApp

---

## 15. Endpoints de Asociación Estudiantes-Apoderados

### PUT /guardians/{id}/students - Reemplazar Asociaciones

```
PUT /api/v1/guardians/{guardian_id}/students
```

#### Request Body
```json
{
  "student_ids": [1, 5, 12]
}
```

Reemplaza **todas** las asociaciones existentes.

### POST /guardians/{id}/students/{student_id} - Agregar Asociación

```
POST /api/v1/guardians/{guardian_id}/students/{student_id}
```

Agrega un estudiante sin afectar los existentes.

### DELETE /guardians/{id}/students/{student_id} - Remover Asociación

```
DELETE /api/v1/guardians/{guardian_id}/students/{student_id}
```

Remueve la asociación específica.

---

## 16. Integración Frontend

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/web-app/js/api.js` | Métodos `getGuardians()`, `createGuardian()`, `updateGuardian()`, `deleteGuardian()`, `setGuardianStudents()` |
| `src/web-app/js/state.js` | Métodos async `refreshGuardians()`, `addGuardian()`, `updateGuardian()`, `deleteGuardian()`, `setGuardianStudents()` |
| `src/web-app/js/views/director_guardians.js` | Vista conectada a API en lugar de localStorage |

### API Methods Agregados

```javascript
// src/web-app/js/api.js

async getGuardians(params = {}) { ... }
async getGuardian(guardianId) { ... }
async createGuardian(data) { ... }
async updateGuardian(guardianId, data) { ... }
async deleteGuardian(guardianId) { ... }
async setGuardianStudents(guardianId, studentIds) { ... }
```

### State Methods Actualizados

```javascript
// src/web-app/js/state.js

async refreshGuardians() {
  // Carga desde API si autenticado, localStorage como fallback
}

async addGuardian(guardian) {
  // Llama API.createGuardian() + actualiza state local
}

async updateGuardian(id, data) {
  // Llama API.updateGuardian() + actualiza state local
}

async deleteGuardian(id) {
  // Llama API.deleteGuardian() + remueve de state local
}
```

---

## Testing Realizado - Apoderados

| Operación | Método | Endpoint | Estado |
|-----------|--------|----------|--------|
| Listar | GET | /guardians | ✅ |
| Crear | POST | /guardians | ✅ |
| Editar | PATCH | /guardians/{id} | ✅ |
| Eliminar | DELETE | /guardians/{id} | ✅ |
| Asociar estudiantes | PUT | /guardians/{id}/students | ✅ |

### Verificación en Base de Datos

```sql
-- Apoderado creado desde UI y verificado
SELECT id, full_name, contacts->>'email' FROM tenant_demo_local.guardians
WHERE full_name = 'Apoderado Prueba';
-- Resultado: ID 103, eliminado correctamente después

-- Edición verificada
SELECT id, full_name FROM tenant_demo_local.guardians WHERE id = 102;
-- Resultado: "Lorelyn Prada Torres" (actualizado desde "Lorelyn Prada")
```

---

## Estado Final del Módulo Apoderados

| Funcionalidad | Estado |
|---------------|--------|
| LIST apoderados | ✅ Completo |
| CREATE apoderado | ✅ Completo |
| UPDATE apoderado | ✅ Completo |
| DELETE apoderado | ✅ Completo |
| Búsqueda por nombre | ✅ Completo |
| Paginación | ✅ Completo |
| Asociar estudiantes | ✅ Completo |
| Frontend conectado | ✅ Completo |

---

## Archivos Modificados - Módulo Apoderados

```
Backend (6 archivos):
- app/api/v1/guardians.py - Endpoints CRUD
- app/api/v1/router.py - Registro del router
- app/schemas/guardians.py - Schemas request/response
- app/db/repositories/guardians.py - Métodos de repositorio
- app/db/models/push_subscription.py - Fix schema mismatch
- app/db/models/user.py - Agregada relación push_subscriptions

Frontend (3 archivos):
- src/web-app/js/api.js - 6 métodos de apoderados
- src/web-app/js/state.js - 5 métodos async CRUD
- src/web-app/js/views/director_guardians.js - Conectado a API
```

---

*Módulo de Apoderados completado el 14 de Enero de 2026*

---
---

# Módulo Profesores (Teachers)

## Resumen Ejecutivo

Se completó la integración del módulo de Profesores con el backend:
1. **Endpoints API completos** - GET, POST, PATCH, DELETE para teachers
2. **Asignación de cursos** - Endpoints para asignar/desasignar cursos a profesores
3. **Integración Frontend-Backend** - CRUD persiste en base de datos
4. **Búsqueda y paginación** - Lista paginada con búsqueda por nombre o email

---

## 17. Endpoint GET /teachers - Listar Profesores

### Archivos Creados/Modificados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `app/api/v1/teachers.py` | Backend | Endpoints CRUD admin agregados |
| `app/schemas/teachers.py` | Backend | Schemas TeacherCreate, TeacherUpdate, TeacherListResponse |
| `app/db/repositories/teachers.py` | Backend | Métodos list_paginated, update, delete, unassign_course |

### Endpoint

```
GET /api/v1/teachers
```

#### Parámetros de Query
| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `q` | string | null | Búsqueda por nombre o email (min 2 chars) |
| `page` | int | 1 | Número de página |
| `page_size` | int | 20 | Registros por página (max 100) |

#### Response
```json
{
  "items": [
    {
      "id": 1,
      "full_name": "María González López",
      "email": "maria.gonzalez@demo.example.com",
      "status": "ACTIVE",
      "can_enroll_biometric": false
    }
  ],
  "total": 4,
  "page": 1,
  "page_size": 20,
  "pages": 1
}
```

#### Roles Permitidos
- ADMIN
- DIRECTOR
- INSPECTOR

---

## 18. Endpoint POST /teachers - Crear Profesor

### Endpoint

```
POST /api/v1/teachers
```

#### Request Body
```json
{
  "full_name": "Juan Pérez García",
  "email": "juan.perez@example.com",
  "status": "ACTIVE",
  "can_enroll_biometric": false
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `full_name` | string | Sí | Nombre completo (2-255 chars) |
| `email` | string | No | Email único |
| `status` | string | No | ACTIVE, INACTIVE, ON_LEAVE (default: ACTIVE) |
| `can_enroll_biometric` | bool | No | Puede enrolar biométrico (default: false) |

#### Response (201 Created)
```json
{
  "id": 15,
  "full_name": "Juan Pérez García",
  "email": "juan.perez@example.com",
  "status": "ACTIVE",
  "can_enroll_biometric": false
}
```

#### Validaciones
- Email único (409 Conflict si ya existe)
- Nombre mínimo 2 caracteres

#### Roles Permitidos
- ADMIN
- DIRECTOR

---

## 19. Endpoint PATCH /teachers/{id} - Actualizar Profesor

### Endpoint

```
PATCH /api/v1/teachers/{teacher_id}
```

#### Request Body (campos opcionales)
```json
{
  "full_name": "Nuevo Nombre",
  "email": "nuevo@email.com",
  "status": "INACTIVE",
  "can_enroll_biometric": true
}
```

#### Validaciones
- 404 si profesor no existe
- 409 si nuevo email ya está en uso por otro profesor

#### Roles Permitidos
- ADMIN
- DIRECTOR

---

## 20. Endpoint DELETE /teachers/{id} - Eliminar Profesor

### Endpoint

```
DELETE /api/v1/teachers/{teacher_id}
```

#### Response
- **204 No Content** - Eliminado correctamente
- **404 Not Found** - Profesor no encontrado

#### Comportamiento
- Elimina el profesor de la base de datos
- Elimina todas las asignaciones de cursos automáticamente

#### Roles Permitidos
- ADMIN
- DIRECTOR

---

## 21. Endpoints de Asignación de Cursos

### POST /teachers/{id}/courses/{course_id} - Asignar Curso

```
POST /api/v1/teachers/{teacher_id}/courses/{course_id}
```

Asigna un curso a un profesor.

#### Response
- **204 No Content** - Asignado correctamente
- **404 Not Found** - Profesor o curso no encontrado

### DELETE /teachers/{id}/courses/{course_id} - Desasignar Curso

```
DELETE /api/v1/teachers/{teacher_id}/courses/{course_id}
```

Remueve la asignación de un curso.

#### Response
- **204 No Content** - Desasignado correctamente
- **404 Not Found** - Profesor o curso no encontrado

---

## 22. Integración Frontend

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/web-app/js/api.js` | Métodos `getTeachers()`, `getTeacher()`, `createTeacher()`, `updateTeacher()`, `deleteTeacher()`, `assignCourseToTeacher()`, `unassignCourseFromTeacher()` |
| `src/web-app/js/state.js` | Métodos async para CRUD de profesores con fallback a localStorage |
| `src/web-app/js/views/director_teachers.js` | Vista reescrita para usar API |

### API Methods Agregados

```javascript
// src/web-app/js/api.js

async getTeachers(params = {}) { ... }
async getTeacher(teacherId) { ... }
async createTeacher(data) { ... }
async updateTeacher(teacherId, data) { ... }
async deleteTeacher(teacherId) { ... }
async assignCourseToTeacher(teacherId, courseId) { ... }
async unassignCourseFromTeacher(teacherId, courseId) { ... }
```

### State Methods Actualizados

```javascript
// src/web-app/js/state.js

async refreshTeachers() {
  // Carga desde API si autenticado, localStorage como fallback
  if (!this.isApiAuthenticated()) return this.data.teachers || [];
  const response = await API.getTeachers({ page: 1, page_size: 100 });
  this.data.teachers = response.items || [];
  // ...
}
```

### Bug Corregido: Error 422 en page_size

**Problema**: El frontend pedía `page_size=200` pero el backend limita a 100.

**Solución**: Cambiar en `state.js`:
```javascript
// Antes
const response = await API.getTeachers({ page_size: 200 });

// Después
const response = await API.getTeachers({ page: 1, page_size: 100 });
```

---

## Testing Realizado - Profesores

| Operación | Método | Endpoint | Estado |
|-----------|--------|----------|--------|
| Listar | GET | /teachers | ✅ |
| Crear | POST | /teachers | ✅ |
| Editar | PATCH | /teachers/{id} | ✅ |
| Eliminar | DELETE | /teachers/{id} | ✅ |
| Asignar curso | POST | /teachers/{id}/courses/{course_id} | ✅ |
| Desasignar curso | DELETE | /teachers/{id}/courses/{course_id} | ✅ |

### Verificación en Base de Datos

```sql
-- Profesor creado y editado desde UI
SELECT id, full_name, email, status FROM tenant_demo_local.teachers ORDER BY id;

 id |       full_name       |              email              | status
----+-----------------------+---------------------------------+--------
  1 | María González López  | maria.gonzalez@demo.example.com | ACTIVE
  2 | Pedro Ramírez Castro  | pedro.ramirez@demo.example.com  | ACTIVE
  3 | Carmen Silva Morales  | carmen.silva@demo.example.com   | ACTIVE
 14 | Maria Venezuela Perez | venezuela@noemail.com           | ACTIVE

-- Cursos asignados verificados
SELECT t.full_name, c.name as curso
FROM tenant_demo_local.teachers t
JOIN tenant_demo_local.teacher_courses tc ON t.id = tc.teacher_id
JOIN tenant_demo_local.courses c ON tc.course_id = c.id
WHERE t.id = 14;

       full_name       |    curso
-----------------------+-------------
 Maria Venezuela Perez | 4° Básico A
```

---

## Estado Final del Módulo Profesores

| Funcionalidad | Estado |
|---------------|--------|
| LIST profesores | ✅ Completo |
| CREATE profesor | ✅ Completo |
| UPDATE profesor | ✅ Completo |
| DELETE profesor | ✅ Completo |
| Búsqueda por nombre/email | ✅ Completo |
| Paginación | ✅ Completo |
| Asignar cursos | ✅ Completo |
| Desasignar cursos | ✅ Completo |
| Frontend conectado | ✅ Completo |

---

## Archivos Modificados - Módulo Profesores

```
Backend (3 archivos):
- app/api/v1/teachers.py - Endpoints CRUD admin
- app/schemas/teachers.py - Schemas TeacherCreate, TeacherUpdate, TeacherListResponse
- app/db/repositories/teachers.py - Métodos list_paginated, update, delete, unassign_course

Frontend (3 archivos):
- src/web-app/js/api.js - 7 métodos de profesores
- src/web-app/js/state.js - Métodos async CRUD con fallback
- src/web-app/js/views/director_teachers.js - Reescrito para usar API
```

---

*Módulo de Profesores completado el 14 de Enero de 2026*
