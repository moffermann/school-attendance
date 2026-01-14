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
