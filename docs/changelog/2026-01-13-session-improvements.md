# 2026-01-13: Mejoras de Sesion

## Resumen

Sesion enfocada en:
- **Configuracion ngrok**: Actualizacion de URLs para nuevo tunel ngrok
- **WebAuthn**: Actualizacion de rpId y origin para nuevo dominio

---

## 1. Actualizacion de URLs para Nuevo Tunel ngrok

### Problema
Se abrio un nuevo tunel ngrok (`https://d22e09fa7f24.ngrok-free.app -> http://localhost:8043`) y era necesario actualizar todas las referencias en el codigo.

### Cambios Realizados

#### Kiosk Config (`src/kiosk-app/data/config.json`)
```json
{
  "apiBaseUrl": "https://d22e09fa7f24.ngrok-free.app/api/v1",
  "deviceApiKey": "local-dev-device-key",
  "tenantId": "1"
}
```

#### Web-App Default Config (`src/web-app/index.html`)
Agregado script de inicializacion para setear URL por defecto en localStorage:
```javascript
<script>
  (function() {
    const configKey = 'webAppConfig';
    const config = JSON.parse(localStorage.getItem(configKey) || '{}');
    if (!config.apiUrl) {
      config.apiUrl = 'https://d22e09fa7f24.ngrok-free.app/api/v1';
      localStorage.setItem(configKey, JSON.stringify(config));
    }
  })();
</script>
```

#### Super Admin API (`src/web-app/js/super-admin-api.js`)
Cambiado de `_baseUrl` hardcodeado a getter dinamico:
```javascript
// Antes:
_baseUrl: '/api/v1/super-admin',

// Despues:
get _baseUrl() {
  const config = JSON.parse(localStorage.getItem('webAppConfig') || '{}');
  const apiUrl = config.apiUrl || '/api/v1';
  return `${apiUrl}/super-admin`;
},
```

---

## 2. Actualizacion WebAuthn para Nuevo Dominio

### Problema
Al intentar autenticacion biometrica en el kiosk, se producia error:
```
SecurityError: The relying party ID is not a registrable domain suffix of,
nor equal to the current domain
```

El `rpId` estaba configurado para el dominio anterior de Cloudflare.

### Solucion
Actualizado `.env` con nuevo dominio ngrok:

```env
# Antes (Cloudflare):
WEBAUTHN_RP_ID=gocode-n09u.ondigitalocean.app
WEBAUTHN_RP_ORIGIN=https://gocode-n09u.ondigitalocean.app

# Despues (ngrok):
WEBAUTHN_RP_ID=d22e09fa7f24.ngrok-free.app
WEBAUTHN_RP_NAME=Sistema de Asistencia Escolar
WEBAUTHN_RP_ORIGIN=https://d22e09fa7f24.ngrok-free.app
WEBAUTHN_TIMEOUT_MS=60000
```

**Nota**: Las credenciales biometricas antiguas fueron eliminadas via consola de director ya que estan vinculadas al dominio anterior.

---

## 3. Fix: Fotos de Estudiantes No Cargaban (PUBLIC_BASE_URL)

### Problema
Al abrir la ficha de un alumno, las fotos no cargaban y mostraban error:
```
GET https://orchestra-toolkit-capitol-professor.trycloudflare.com/api/v1/photos/students/23/profile_bffbecb1.jpg
net::ERR_NAME_NOT_RESOLVED
```

La URL de las fotos usaba el dominio anterior de Cloudflare en lugar del nuevo ngrok.

### Causa Raiz
El endpoint `GET /api/v1/students/{id}` construye `photo_presigned_url` usando `settings.public_base_url`:

```python
# app/api/v1/students.py:22-27
def _build_photo_proxy_url(photo_key: str | None) -> str | None:
    base_url = str(settings.public_base_url).rstrip('/')
    return f"{base_url}/api/v1/photos/{photo_key}"
```

El `.env` tenia `PUBLIC_BASE_URL` con el dominio antiguo.

### Solucion
Actualizado `.env`:
```env
# Antes (Cloudflare - obsoleto):
PUBLIC_BASE_URL=https://orchestra-toolkit-capitol-professor.trycloudflare.com

# Despues (ngrok):
PUBLIC_BASE_URL=https://d22e09fa7f24.ngrok-free.app
```

**Nota**: Requiere reiniciar backend (config esta cacheada con `@lru_cache`).

---

## 4. UI: Renombrar columna "Foto" a "Aut. Foto"

### Problema
En la tabla de alumnos, la columna "Foto" causaba confusion porque parecia indicar si el alumno tiene foto cargada, cuando en realidad muestra si tiene **autorizacion** para captura de fotos.

### Solucion
Renombrado header de columna:
```javascript
// Antes:
<th>Foto</th>

// Despues:
<th>Aut. Foto</th>
```

---

## 5. Fix: Columna "Fuente" en Dashboard siempre mostraba "Manual"

### Problema
En el tablero en vivo del director, la columna "Fuente" mostraba "Manual" para todos los eventos de asistencia, aunque la base de datos tenia los valores correctos (BIOMETRIC, QR, NFC).

### Causa Raiz
El schema `DashboardEvent` y el mapper no incluian el campo `source`:

```python
# app/schemas/webapp.py - Faltaba:
source: str | None = None

# app/services/dashboard_service.py - Faltaba en _map_events_async:
source=event.source,
```

El frontend hacia fallback a "Manual" cuando `event.source` era undefined.

### Solucion
1. Agregado campo `source` a `DashboardEvent` schema
2. Actualizado `_map_events_async()` para incluir `source=event.source`
3. Actualizado `_map_event()` (version sync) tambien

---

## 6. Fix Completo: Columna "Fuente" en Dashboard (Bootstrap)

### Problema
El fix anterior (#5) solo agregó `source` a `DashboardEvent` y `dashboard_service.py`, pero el dashboard del frontend usa los datos del **bootstrap** (`AttendanceEventSummary`), no del endpoint de dashboard.

### Causa Raíz
El frontend carga eventos de asistencia desde `bootstrap.attendance_events`, que usa el schema `AttendanceEventSummary` y el mapper `_map_attendance_event()` en `web_app_service.py`.

### Solución
1. Agregado campo `source` a `AttendanceEventSummary` en `webapp.py`:
```python
class AttendanceEventSummary(BaseModel):
    # ... otros campos ...
    source: str | None = None
```

2. Actualizado `_map_attendance_event()` en `web_app_service.py`:
```python
def _map_attendance_event(self, event: AttendanceEvent) -> AttendanceEventSummary:
    return AttendanceEventSummary(
        # ... otros campos ...
        source=event.source,
    )
```

---

## 7. Fix: Estilos de Chip para Columna "Fuente"

### Problema
Los valores BIOMETRIC mostraban sin estilo de chip/pastilla, mientras que NFC y QR sí tenían el estilo correcto.

### Causa Raíz
El código usaba clases CSS inexistentes:
- `chip-primary` (no existe)
- `chip-secondary` (no existe)

Clases disponibles: `chip-success`, `chip-warning`, `chip-error`, `chip-info`, `chip-gray`

### Solución
Actualizado `createSourceChip()` en `director_dashboard.js`:
```javascript
const sourceConfig = {
  'BIOMETRIC': { label: '🔐 Biométrico', color: 'success' },  // era 'primary'
  'QR': { label: '📱 QR', color: 'info' },
  'NFC': { label: '📶 NFC', color: 'warning' },
  'MANUAL': { label: '✋ Manual', color: 'gray' }  // era 'secondary'
};
```

---

## 8. Fix: Botón "Ver Perfil" en Modal "Alumnos Sin Ingreso"

### Problema
El botón "Ver Perfil" en el listado de alumnos sin ingreso no abría el perfil del estudiante.

### Causa Raíz (múltiples issues)
1. Parámetro incorrecto: usaba `?view=${id}` pero el handler espera `?viewProfile=${id}`
2. Intento de llamar `Views.directorStudents.viewProfile()` directamente fallaba porque esa vista no está cargada desde el dashboard (SPA lazy loading)
3. Intento de usar `Components.closeModal()` fallaba porque ese método no existe

### Solución Final
Usar la función global `Components.showStudentProfile()` que ya existe en components.js:698-763:
```javascript
<button onclick="document.querySelector('.modal-container').click(); Components.showStudentProfile(${s.id})">
  Ver Perfil
</button>
```

**Ventajas:**
- `Components.showStudentProfile()` es global y funciona desde cualquier vista
- No requiere navegación ni lazy loading
- Cierra el modal actual y abre directamente el perfil del estudiante
- Muestra información completa: datos básicos, estadísticas de asistencia, apoderados vinculados

---

## 9. UX: Navegación "Volver a la Lista" en Modal de Perfil

### Problema
El flujo anterior era tedioso:
1. Dashboard → Ver Lista → Modal lista
2. Ver Perfil → Cierra lista → Modal perfil
3. Cerrar perfil → Dashboard (perdió la lista)
4. Para ver otro perfil: repetir desde paso 1

### Solución
Modificado `Components.showStudentProfile()` para aceptar opciones `{ onBack, backLabel }`:

```javascript
// components.js - Nuevo parámetro options
showStudentProfile(studentId, options = {}) {
  const buttons = [];
  if (options.onBack) {
    buttons.push({
      label: options.backLabel || '← Volver a la lista',
      action: 'back',
      className: 'btn-primary',
      onClick: options.onBack
    });
  }
  buttons.push({ label: 'Cerrar', action: 'close', className: 'btn-secondary' });
  // ...
}

// director_dashboard.js - Uso con callback
onclick="Components.showStudentProfile(${s.id}, { onBack: () => Views.directorDashboard.showNoIngressList() })"
```

### Nuevo Flujo
1. Dashboard → Ver Lista → Modal lista
2. Ver Perfil → Modal perfil (con botón "← Volver a la lista")
3. Click "← Volver a la lista" → Modal lista (conserva navegación)
4. Ver otro perfil → Repetir desde paso 2

---

## Archivos Modificados

```
10 files changed

- src/kiosk-app/data/config.json - apiBaseUrl actualizado
- src/web-app/index.html - Script de inicializacion de config
- src/web-app/js/super-admin-api.js - _baseUrl dinamico
- src/web-app/js/components.js - showStudentProfile() con opciones onBack/backLabel
- src/web-app/js/views/director_students.js - Columna "Foto" -> "Aut. Foto"
- src/web-app/js/views/director_dashboard.js - Chip colors + boton Ver Perfil + callback volver
- app/schemas/webapp.py - Agregado source a DashboardEvent Y AttendanceEventSummary
- app/services/dashboard_service.py - Incluir source en mappers
- app/services/web_app_service.py - Incluir source en _map_attendance_event()
- .env - WebAuthn settings + PUBLIC_BASE_URL actualizados
```

---

## URLs de la Aplicacion

| App | URL |
|-----|-----|
| Web-App (Director/Parent) | https://d22e09fa7f24.ngrok-free.app/app |
| Kiosk | https://d22e09fa7f24.ngrok-free.app/kiosk |
| Login | https://d22e09fa7f24.ngrok-free.app/ |

---

## Estado de la Base de Datos

| Metrica | Valor |
|---------|-------|
| Tenant | demo-local (id: 1) |
| Estudiantes | 60 |
| Eventos totales | 3,429 |
| Eventos hoy | 2 |

**Arquitectura Multi-tenant**: Los datos estan en schema `tenant_demo_local`, no en `public`.

---

## Testing Realizado

- [ ] Login con nuevo dominio
- [ ] Registro biometrico con nuevo rpId
- [ ] Autenticacion biometrica
- [ ] Kiosk conecta a API via ngrok
- [ ] Dashboard muestra eventos

---

## 10. Fix: Modulo de Reportes mostraba datos incorrectos

### Problema
El modulo de Reportes mostraba datos de asistencia irreales:
- Columna "Atrasos" con valores muy altos (79, 75, 96)
- "NaN%" para cursos sin alumnos
- Tendencia usaba datos mock (hardcodeados)

### Causa Raiz (multiples issues)
1. **No filtraba por rango de fechas**: Los filtros de fecha inicio/fin eran ignorados
2. **Hora de atraso hardcodeada**: Usaba `'08:30:00'` en lugar del horario real del curso
3. **Contaba eventos en vez de estudiantes**: Si un alumno tenia 10 eventos IN tardios, contaba 10 atrasos
4. **Division por cero**: `courseStudents.length` podia ser 0 causando NaN%
5. **Datos mock en tendencia**: Linea `trendData = [45, 52, 48, 55, 50]; // Mock data`

### Solucion

#### 1. Agregado soporte de rango de fechas a `State.getAttendanceEvents()`:
```javascript
// state.js - Nuevos filtros startDate y endDate
if (filters.startDate) {
  events = events.filter(e => e.ts.split('T')[0] >= filters.startDate);
}
if (filters.endDate) {
  events = events.filter(e => e.ts.split('T')[0] <= filters.endDate);
}
```

#### 2. Reescrito `generateReport()` con logica correcta:
```javascript
// Usa filtros de fecha del UI
const events = State.getAttendanceEvents({
  courseId: course.id,
  startDate: startDate,
  endDate: endDate
});

// Usa horario real del curso (no hardcodeado)
const schedule = schedules.find(s => s.weekday === weekday);
if (isLate(firstInTime, schedule.in_time)) { ... }

// Cuenta estudiantes unicos (no eventos)
const studentsLate = new Set();
studentsLate.add(parseInt(studentId));

// Maneja division por cero
const attendancePercent = totalStudents > 0
  ? ((presentCount / totalStudents) * 100).toFixed(1)
  : '0.0';
```

#### 3. Tendencia usa datos reales:
```javascript
// Real trend data from events
const trendCounts = allDates.map(d => trendData[d] ? trendData[d].size : 0);
```

---

## Archivos Modificados

```
12 files changed

- src/kiosk-app/data/config.json - apiBaseUrl actualizado
- src/web-app/index.html - Script de inicializacion de config
- src/web-app/js/super-admin-api.js - _baseUrl dinamico
- src/web-app/js/state.js - Agregado filtros startDate/endDate a getAttendanceEvents()
- src/web-app/js/components.js - showStudentProfile() con opciones onBack/backLabel
- src/web-app/js/views/director_students.js - Columna "Foto" -> "Aut. Foto"
- src/web-app/js/views/director_dashboard.js - Chip colors + boton Ver Perfil + callback volver
- src/web-app/js/views/director_reports.js - Reescrito con logica correcta de reportes
- app/schemas/webapp.py - Agregado source a DashboardEvent Y AttendanceEventSummary
- app/services/dashboard_service.py - Incluir source en mappers
- app/services/web_app_service.py - Incluir source en _map_attendance_event()
- .env - WebAuthn settings + PUBLIC_BASE_URL actualizados
```

---

## URLs de la Aplicacion

| App | URL |
|-----|-----|
| Web-App (Director/Parent) | https://d22e09fa7f24.ngrok-free.app/app |
| Kiosk | https://d22e09fa7f24.ngrok-free.app/kiosk |
| Login | https://d22e09fa7f24.ngrok-free.app/ |

---

## Estado de la Base de Datos

| Metrica | Valor |
|---------|-------|
| Tenant | demo-local (id: 1) |
| Estudiantes | 60 |
| Eventos totales | 3,429 |
| Eventos hoy | 2 |

**Arquitectura Multi-tenant**: Los datos estan en schema `tenant_demo_local`, no en `public`.

---

## Testing Realizado

- [ ] Login con nuevo dominio
- [ ] Registro biometrico con nuevo rpId
- [ ] Autenticacion biometrica
- [ ] Kiosk conecta a API via ngrok
- [ ] Dashboard muestra eventos
- [ ] Reportes filtran por fecha correctamente
- [ ] Atrasos se calculan con horario real del curso

---

## 11. Fix: Bug de Timezone en Fechas de Reportes

### Problema
Al seleccionar rango de fechas 29-12-2025 a 02-01-2026 en filtros, el encabezado del reporte mostraba 28-12-2025 a 01-01-2026 (fechas desplazadas 1 dia atras).

### Causa Raiz
JavaScript interpreta strings de fecha como `'2025-12-29'` como medianoche UTC. En Chile (UTC-3 o UTC-4), esto se muestra como el dia anterior cuando se convierte a hora local.

Codigo problematico:
```javascript
// Interpretado como 2025-12-29 00:00:00 UTC
// En Chile: 2025-12-28 21:00:00 (dia anterior!)
const date = new Date('2025-12-29');
```

### Solucion

#### 1. `Components.formatDate()` en components.js:
```javascript
formatDate(dateString) {
  if (!dateString) return '-';
  // Para strings YYYY-MM-DD, agregar T00:00:00 para interpretar como hora local
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString('es-CL');
  }
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CL');
}
```

#### 2. `getDatesInRange()` en director_reports.js (2 instancias):
```javascript
const getDatesInRange = (start, end) => {
  const dates = [];
  // Agregar T00:00:00 para interpretar como hora local
  const current = new Date(`${start}T00:00:00`);
  const endDt = new Date(`${end}T00:00:00`);
  while (current <= endDt) {
    // Usar getFullYear/Month/Date para evitar shift de timezone
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};
```

**Nota**: Antes usaba `toISOString().split('T')[0]` que reconvertia a UTC causando el mismo problema.

---

## 12. Fix: Modulo de Metricas con mismos problemas que Reportes

### Problema
El modulo de Metricas Avanzadas tenia los mismos problemas que el modulo de Reportes:
- Hora de atraso hardcodeada `'08:30:00'` en vez del horario real del curso
- "Ultimos 30 dias" tomaba los ultimos 30 dias CON EVENTOS, no 30 dias calendario
- Tasa de asistencia contaba fines de semana como dias posibles
- Ausencias contaban dias sin horario programado

### Solucion

#### 1. Uso de horarios reales para calcular atrasos:
```javascript
// Helper: Get schedule for course on a date
const getScheduleForDate = (courseId, dateStr) => {
  const weekday = getWeekday(dateStr);
  return schedules.find(s => s.course_id === courseId && s.weekday === weekday);
};

// Late events (using actual course schedule)
const schedule = getScheduleForDate(student.course_id, date);
if (schedule && isLate(time, schedule.in_time)) {
  lateEvents.push(e);
}
```

#### 2. Ultimos 30 dias calendario (no dias con eventos):
```javascript
const getLast30Days = () => {
  const days = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    // ... format date
    days.push(`${y}-${m}-${day}`);
  }
  return days;
};
```

#### 3. Tasa de asistencia solo cuenta dias con clase:
```javascript
students.forEach(student => {
  last30Days.forEach(date => {
    if (hasSchedule(student.course_id, date)) {  // Solo si tiene clase
      totalPossibleDays++;
      if (hasAttended) totalPresentDays++;
    }
  });
});
```

#### 4. Ausencias correctas usando horario del alumno:
```javascript
const studentScheduleDays = last30Days.filter(date => hasSchedule(student.course_id, date));
const absences = Math.max(0, studentScheduleDays.length - studentPresentDays);
```

#### 5. Etiqueta Y en grafico de tendencia:
```javascript
Components.drawLineChart(trendCanvas, sampledData, sampledLabels, {
  yAxisLabel: 'Alumnos presentes'
});
```

### Cambios Adicionales
- Atrasos por alumno cuenta DIAS unicos con atraso (no eventos multiples)
- Ranking de atrasos muestra dias con atraso, no eventos
- Tendencia muestra 0 para dias sin clase (fines de semana)

---

## 13. Fix: Horarios de Sabado en Base de Datos

### Problema
Al calcular metricas para el curso "2 Basico A", el sistema contaba 26 dias con clase cuando deberian ser 22 (solo Lun-Vie). La UI del modulo "Horarios Base" solo permite configurar Lunes a Viernes, pero la base de datos tenia horarios para Sabado (weekday=5).

### Causa Raiz
Datos inconsistentes: 3 cursos tenian registros de horario para Sabado en la tabla `schedules`:
- Curso 1 (1 Basico A Rt)
- Curso 2 (1 Basico B r)
- Curso 3 (2 Basico A)

### Solucion
Eliminados los horarios de Sabado de la base de datos:
```sql
DELETE FROM tenant_demo_local.schedules WHERE weekday = 5;
-- 3 filas eliminadas
```

### Impacto
- Metricas de 2 Basico A: 22 dias con clase (antes 26)
- Tasa de asistencia: 9.5% (antes 8.1% - calculaba sobre mas dias)
- Los calculos ahora coinciden con lo que la UI permite configurar

---

## 14. Fix: Calculos No Consideraban Excepciones de Horario (Feriados)

### Problema
Los modulos de Metricas y Reportes no consideraban las excepciones de horario (feriados, suspensiones, salidas tempranas). Si un feriado como Navidad caia en dia de semana, igual se contaba como dia con clase.

### Causa Raiz
- La tabla `schedule_exceptions` existia pero no se usaba en los calculos
- `State.getScheduleExceptions()` existia pero no se llamaba
- Los helpers `hasSchedule()` y `getScheduleForDate()` solo verificaban el weekday base

### Solucion

#### 1. Nuevo helper `getException()` en ambos archivos:
```javascript
// Helper: Get exception for a date and course (if any)
const getException = (courseId, dateStr) => {
  // First check for GLOBAL exception (applies to all courses)
  const global = exceptions.find(e => e.scope === 'GLOBAL' && e.date === dateStr);
  if (global) return global;
  // Then check for COURSE-specific exception
  return exceptions.find(e => e.scope === 'COURSE' && e.course_id === courseId && e.date === dateStr);
};
```

#### 2. Modificado `hasSchedule()` en director_metrics.js:
```javascript
const hasSchedule = (courseId, dateStr) => {
  const weekday = getWeekday(dateStr);
  const baseSchedule = schedules.some(s => s.course_id === courseId && s.weekday === weekday);
  if (!baseSchedule) return false;

  // Check for exception (no class if exception exists without in_time)
  const exception = getException(courseId, dateStr);
  if (exception && !exception.in_time) return false; // Suspended day
  return true;
};
```

#### 3. Modificado `getScheduleForDate()` en ambos archivos:
```javascript
const getScheduleForDate = (courseId, schedules, dateStr) => {
  const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
  const weekday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const baseSchedule = schedules.find(s => s.weekday === weekday);
  if (!baseSchedule) return null;

  // Check for exception
  const exception = getException(courseId, dateStr);
  if (exception) {
    if (!exception.in_time) return null; // No class this day (holiday/suspension)
    // Return modified schedule from exception
    return { ...baseSchedule, in_time: exception.in_time, out_time: exception.out_time };
  }
  return baseSchedule;
};
```

### Tipos de Excepcion Soportados

| Tipo | `in_time` | Efecto |
|------|-----------|--------|
| Suspension/Feriado | `NULL` | El dia NO cuenta como dia de clase |
| Horario modificado | Tiene valor | El dia cuenta, pero usa el horario de la excepcion para calcular atrasos |

### Archivos Modificados
- `src/web-app/js/views/director_metrics.js` - Lineas 77, 112-147
- `src/web-app/js/views/director_reports.js` - Lineas 55, 84-108, 222, 252-272

---

## 15. Datos de Prueba: Excepciones de Horario

### Descripcion
Se agregaron excepciones de horario de prueba para verificar que los calculos funcionan correctamente.

### Excepciones Agregadas

| ID | Scope | Curso | Fecha | Horario | Razon |
|----|-------|-------|-------|---------|-------|
| 1 | GLOBAL | Todos | 2025-12-25 | Sin clase | Navidad - Feriado Nacional |
| 2 | GLOBAL | Todos | 2026-01-01 | Sin clase | Anio Nuevo - Feriado Nacional |
| 3 | COURSE | 3 | 2025-12-16 | Sin clase | Paseo Escolar |
| 4 | GLOBAL | Todos | 2025-12-20 | 08:00-12:00 | Cierre Semestre - Salida Temprana |

### SQL Ejecutado
```sql
INSERT INTO tenant_demo_local.schedule_exceptions
  (scope, course_id, date, in_time, out_time, reason, created_by)
VALUES
  ('GLOBAL', NULL, '2025-12-25', NULL, NULL, 'Navidad - Feriado Nacional', 1),
  ('GLOBAL', NULL, '2026-01-01', NULL, NULL, 'Anio Nuevo - Feriado Nacional', 1),
  ('COURSE', 3, '2025-12-16', NULL, NULL, 'Paseo Escolar', 1),
  ('GLOBAL', NULL, '2025-12-20', '08:00', '12:00', 'Cierre Semestre - Salida Temprana', 1);
```

### Verificacion - Diciembre 2025 para Curso 3

| Fecha | Dia | Tiene Horario | Excepcion | Con Clases |
|-------|-----|---------------|-----------|------------|
| 2025-12-16 | Martes | Si | Paseo Escolar | **No** |
| 2025-12-20 | Sabado | No | Salida Temprana | No (fin de semana) |
| 2025-12-25 | Jueves | Si | Navidad | **No** |

**Resultado**: Diciembre 2025 tiene 21 dias con clase para curso 3 (23 dias laborales - 2 excepciones)

---

## 16. Fix: UI de Excepciones No Persistia al Backend

### Problema
El modulo de Excepciones de Calendario (`/director/exceptions`) permitia crear y eliminar excepciones, pero los cambios solo se guardaban localmente (en State/localStorage). No se realizaba ninguna llamada HTTP al backend, por lo que al recargar la pagina o desde otro dispositivo, las excepciones desaparecian.

### Causa Raiz
1. `api.js` no tenia metodos para crear/eliminar excepciones
2. `director_exceptions.js` solo llamaba `State.addScheduleException()` sin llamar a la API
3. Los endpoints del backend ya existian:
   - `POST /api/v1/schedules/exceptions` - Crear excepcion
   - `DELETE /api/v1/schedules/exceptions/{id}` - Eliminar excepcion

### Solucion

#### 1. Agregados metodos en `api.js`:
```javascript
async createScheduleException(data) {
  const response = await this.request('/schedules/exceptions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.ok) { /* manejo de errores */ }
  return response.json();
},

async deleteScheduleException(exceptionId) {
  const response = await this.request(`/schedules/exceptions/${exceptionId}`, {
    method: 'DELETE',
  });
  if (!response.ok) { /* manejo de errores */ }
  return true;
},
```

#### 2. Actualizado `director_exceptions.js`:
```javascript
// Antes (solo local):
State.addScheduleException(exception);

// Ahora (backend + local):
const created = await API.createScheduleException(exception);
State.data.schedule_exceptions.push(created);
State.persist();

// Igual para eliminar:
await API.deleteScheduleException(id);
State.deleteScheduleException(id);
```

### Archivos Modificados
- `src/web-app/js/api.js` - Lineas 389-433: createScheduleException(), deleteScheduleException()
- `src/web-app/js/views/director_exceptions.js` - Lineas 162-214: createException(), deleteException() async con API

---

## Archivos Modificados (Total Sesion)

```
16 files changed

Frontend:
- src/web-app/js/api.js - Metodos createScheduleException(), deleteScheduleException()
- src/web-app/js/state.js - Filtros startDate/endDate en getAttendanceEvents()
- src/web-app/js/components.js - formatDate() timezone fix, showStudentProfile() con opciones
- src/web-app/js/views/director_students.js - Columna "Aut. Foto"
- src/web-app/js/views/director_dashboard.js - Chip colors, Ver Perfil, callback volver
- src/web-app/js/views/director_reports.js - Logica correcta + excepciones de horario
- src/web-app/js/views/director_metrics.js - Logica correcta + excepciones de horario
- src/web-app/js/views/director_exceptions.js - Conexion a backend API

Backend:
- app/schemas/webapp.py - source en DashboardEvent y AttendanceEventSummary
- app/services/dashboard_service.py - source en mappers
- app/services/web_app_service.py - source en _map_attendance_event()

Config:
- src/kiosk-app/data/config.json - apiBaseUrl ngrok
- src/web-app/index.html - Script config init
- src/web-app/js/super-admin-api.js - _baseUrl dinamico
- .env - WebAuthn settings ngrok

Database:
- DELETE schedules WHERE weekday = 5 (3 filas)
- INSERT schedule_exceptions (4 filas de prueba)
```

---

## Testing Actualizado

- [ ] Login con nuevo dominio
- [ ] Registro biometrico con nuevo rpId
- [ ] Autenticacion biometrica
- [ ] Kiosk conecta a API via ngrok
- [ ] Dashboard muestra eventos
- [x] Reportes filtran por fecha correctamente
- [x] Atrasos se calculan con horario real del curso
- [x] Metricas usan ultimos 30 dias calendario
- [x] Calculos excluyen fines de semana
- [x] Calculos excluyen feriados/excepciones
- [ ] Crear excepcion desde UI persiste en BD
- [ ] Eliminar excepcion desde UI elimina de BD

---

## 17. Feature: Soporte SMTP para Emails (Gmail, Google Workspace, Outlook)

### Problema
El sistema solo soportaba AWS SES para envio de emails. Muchas escuelas usan Gmail o Google Workspace y no tienen cuenta AWS.

### Solucion
Implementado cliente SMTP generico como alternativa a SES, permitiendo usar cualquier servidor SMTP.

### Archivos Creados/Modificados

#### Nuevo: `app/services/notifications/smtp_email.py`
Cliente SMTP con soporte para:
- Gmail (`smtp.gmail.com:587`)
- Google Workspace
- Outlook (`smtp.office365.com:587`)
- Cualquier servidor SMTP

```python
class SMTPEmailClient:
    async def send_email(self, to: str, subject: str, body_html: str) -> None:
        if not settings.enable_real_notifications:
            logger.info("[SMTP] Dry-run email to=%s", mask_email(to))
            return
        # ... envio real via SMTP
```

#### Modificado: `app/core/config.py`
Nuevas configuraciones:
```python
email_provider: str = Field(default="ses", env="EMAIL_PROVIDER")  # ses | smtp
smtp_host: str = Field(default="smtp.gmail.com", env="SMTP_HOST")
smtp_port: int = Field(default=587, env="SMTP_PORT")
smtp_user: str = Field(default="", env="SMTP_USER")
smtp_password: str = Field(default="", env="SMTP_PASSWORD")
smtp_use_tls: bool = Field(default=True, env="SMTP_USE_TLS")
smtp_from_name: str = Field(default="Sistema de Asistencia", env="SMTP_FROM_NAME")
```

#### Modificado: `app/workers/jobs/send_email.py`
Seleccion automatica de cliente:
```python
if settings.email_provider == "smtp":
    client = SMTPEmailClient()
else:
    client = SESEmailClient()
```

#### Modificado: `app/db/models/tenant_config.py`
Columnas SMTP para configuracion por tenant:
- `email_provider` - "ses" o "smtp"
- `smtp_host`, `smtp_port`, `smtp_user`
- `smtp_password_encrypted` (encriptado con Fernet)
- `smtp_use_tls`, `smtp_from_name`

#### Nueva Migracion: `0015_smtp_email_support.py`
```sql
ALTER TABLE tenant_configs ADD COLUMN email_provider VARCHAR(16) DEFAULT 'ses';
ALTER TABLE tenant_configs ADD COLUMN smtp_host VARCHAR(255);
ALTER TABLE tenant_configs ADD COLUMN smtp_port INTEGER DEFAULT 587;
ALTER TABLE tenant_configs ADD COLUMN smtp_user VARCHAR(255);
ALTER TABLE tenant_configs ADD COLUMN smtp_password_encrypted BYTEA;
ALTER TABLE tenant_configs ADD COLUMN smtp_use_tls BOOLEAN DEFAULT true;
ALTER TABLE tenant_configs ADD COLUMN smtp_from_name VARCHAR(255);
```

### Configuracion para Gmail

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notificaciones@tuescuela.cl
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx  # App Password (no password normal)
SMTP_USE_TLS=true
SMTP_FROM_NAME=Sistema de Asistencia
```

**Pasos para Gmail:**
1. Habilitar 2FA en cuenta Google
2. Generar App Password en https://myaccount.google.com/apppasswords
3. Usar App Password como SMTP_PASSWORD

### Flujo de Seleccion de Cliente

```
Worker recibe job de email
    |
    v
¿Tiene tenant_id?
    |-- Si --> ¿tenant.email_provider == "smtp"?
    |              |-- Si --> TenantSMTPEmailClient
    |              |-- No --> TenantSESEmailClient
    |
    |-- No --> ¿settings.email_provider == "smtp"?
                   |-- Si --> SMTPEmailClient
                   |-- No --> SESEmailClient
```

### Comparacion de Proveedores

| Caracteristica | AWS SES | SMTP (Gmail) |
|----------------|---------|--------------|
| Configuracion | Media | Facil |
| Costo | ~$0.10/1000 | Gratis |
| Limites | Alto | 500/dia (Gmail), 2000/dia (Workspace) |
| Requiere | Cuenta AWS | App Password |

---

## Archivos Modificados (Total Sesion)

```
21 files changed

Frontend:
- src/web-app/js/api.js - Metodos createScheduleException(), deleteScheduleException()
- src/web-app/js/state.js - Filtros startDate/endDate en getAttendanceEvents()
- src/web-app/js/components.js - formatDate() timezone fix, showStudentProfile() con opciones
- src/web-app/js/views/director_students.js - Columna "Aut. Foto"
- src/web-app/js/views/director_dashboard.js - Chip colors, Ver Perfil, callback volver
- src/web-app/js/views/director_reports.js - Logica correcta + excepciones de horario
- src/web-app/js/views/director_metrics.js - Logica correcta + excepciones de horario
- src/web-app/js/views/director_exceptions.js - Conexion a backend API

Backend:
- app/core/config.py - Configuracion SMTP (host, port, user, password, tls, from_name)
- app/services/notifications/smtp_email.py - NUEVO: Cliente SMTP generico
- app/workers/jobs/send_email.py - Seleccion automatica SES/SMTP
- app/db/models/tenant_config.py - Columnas SMTP para multi-tenant
- app/db/repositories/tenant_configs.py - Metodos update_smtp_config(), update_email_provider()
- app/schemas/webapp.py - source en DashboardEvent y AttendanceEventSummary
- app/services/dashboard_service.py - source en mappers
- app/services/web_app_service.py - source en _map_attendance_event()

Config:
- src/kiosk-app/data/config.json - apiBaseUrl ngrok
- src/web-app/index.html - Script config init
- src/web-app/js/super-admin-api.js - _baseUrl dinamico
- .env - WebAuthn settings ngrok
- .env.example - Documentacion SMTP

Database:
- 0015_smtp_email_support.py - Migracion SMTP
- DELETE schedules WHERE weekday = 5 (3 filas)
- INSERT schedule_exceptions (4 filas de prueba)
```

---

## Testing Actualizado

- [ ] Login con nuevo dominio
- [ ] Registro biometrico con nuevo rpId
- [ ] Autenticacion biometrica
- [ ] Kiosk conecta a API via ngrok
- [ ] Dashboard muestra eventos
- [x] Reportes filtran por fecha correctamente
- [x] Atrasos se calculan con horario real del curso
- [x] Metricas usan ultimos 30 dias calendario
- [x] Calculos excluyen fines de semana
- [x] Calculos excluyen feriados/excepciones
- [ ] Crear excepcion desde UI persiste en BD
- [ ] Eliminar excepcion desde UI elimina de BD
- [ ] Email via SMTP (dry-run)
- [ ] Email via SMTP (real con Gmail)

---

## 18. Feature: Modulo de Comunicados Masivos (Broadcast) Conectado al Backend

### Problema
El modulo de Comunicados en el frontend (`director_broadcast.js`) solo simulaba el envio de mensajes. No se conectaba al backend real.

### Solucion
Conectado el frontend al backend completo, incluyendo soporte para Email y WhatsApp.

### Cambios Realizados

#### 1. Backend: Nuevo tipo `NotificationType.BROADCAST`

**`app/schemas/notifications.py`**
```python
class NotificationType(str, Enum):
    INGRESO_OK = "INGRESO_OK"
    SALIDA_OK = "SALIDA_OK"
    NO_INGRESO_UMBRAL = "NO_INGRESO_UMBRAL"
    CAMBIO_HORARIO = "CAMBIO_HORARIO"
    BROADCAST = "BROADCAST"  # Comunicados masivos genericos
```

#### 2. Backend: Template Email para Broadcast

**`app/workers/jobs/send_email.py`**
```python
"BROADCAST": {
    "subject": "{subject}",
    "body": """
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">📢 Comunicado</h2>
        <div style="white-space: pre-wrap; line-height: 1.6;">{message}</div>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;">
        <p style="color: #666; font-size: 12px;">
            Este es un mensaje del Sistema de Control de Asistencia.
        </p>
    </div>
    """,
},
```

#### 3. Backend: Template WhatsApp para Broadcast

**`app/workers/jobs/send_whatsapp.py`**
```python
ATTENDANCE_MESSAGES = {
    "INGRESO_OK": "Ingreso registrado: {student_name} ingresó al colegio...",
    "SALIDA_OK": "Salida registrada: {student_name} salió del colegio...",
    "BROADCAST": "📢 *{subject}*\n\n{message}",  # Nuevo
}

# En _send():
if template == "BROADCAST":
    text = _build_caption(template, variables)
    await client.send_text_message(to=to, text=text)  # Texto plano, no template
```

#### 4. Backend: Metodo `send_text_message()` en WhatsApp Client

**`app/services/notifications/whatsapp.py`**
```python
async def send_text_message(self, to: str, text: str) -> None:
    """Send a plain text message via WhatsApp (for broadcasts)."""
    payload: dict[str, Any] = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }
    # ... envio
```

**Nota**: WhatsApp Business API normalmente requiere templates pre-aprobados para mensajes iniciados por el negocio. Los mensajes de texto plano solo funcionan dentro de la ventana de 24 horas despues de que el usuario escribio primero.

#### 5. Frontend: Conexion con API

**`src/web-app/js/views/director_broadcast.js`**
```javascript
Views.directorBroadcast.sendBroadcast = async function() {
  // Validaciones...

  // Build payload
  const payload = {
    subject,
    message,
    template: 'BROADCAST',
    audience: courseId
      ? { scope: 'course', course_ids: [parseInt(courseId)] }
      : { scope: 'global' },
  };

  try {
    const result = await API.sendBroadcast(payload);
    // Mostrar resultado con job_id
  } catch (error) {
    // Mostrar error
  }
};
```

#### 6. Database: Feature Flag Habilitado

```sql
INSERT INTO tenant_features (tenant_id, feature_name, is_enabled)
VALUES (1, 'broadcasts', true);
```

### Flujo Completo

```
Director llena formulario en Web-App
    |
    v
Frontend envia POST /api/v1/broadcasts/send
    |
    v
Backend valida y encola job en Redis (queue: "broadcasts")
    |
    v
RQ Worker procesa job (process_broadcast.py)
    |
    v
Para cada guardian:
    ├── Encola job Email (send_email.py)
    └── Encola job WhatsApp (send_whatsapp.py)
    |
    v
Workers envian mensajes via SMTP/SES y WhatsApp API
```

### API Request/Response

**Request:**
```json
POST /api/v1/broadcasts/send
{
  "subject": "Suspension de clases",
  "message": "Estimado apoderado, le informamos que...",
  "template": "BROADCAST",
  "audience": {
    "scope": "course",
    "course_ids": [3]
  }
}
```

**Response (202 Accepted):**
```json
{
  "job_id": "abc123-def456"
}
```

### Archivos Modificados

```
Backend:
- app/schemas/notifications.py - NotificationType.BROADCAST
- app/workers/jobs/send_email.py - Template BROADCAST
- app/workers/jobs/send_whatsapp.py - Template + logica BROADCAST
- app/services/notifications/whatsapp.py - send_text_message()

Frontend:
- src/web-app/js/views/director_broadcast.js - Conexion a API

Database:
- INSERT tenant_features (broadcasts = true)
```

---

## Archivos Modificados (Total Sesion)

```
25 files changed

Frontend:
- src/web-app/js/api.js - Metodos createScheduleException(), deleteScheduleException()
- src/web-app/js/state.js - Filtros startDate/endDate en getAttendanceEvents()
- src/web-app/js/components.js - formatDate() timezone fix, showStudentProfile() con opciones
- src/web-app/js/views/director_students.js - Columna "Aut. Foto"
- src/web-app/js/views/director_dashboard.js - Chip colors, Ver Perfil, callback volver
- src/web-app/js/views/director_reports.js - Logica correcta + excepciones de horario
- src/web-app/js/views/director_metrics.js - Logica correcta + excepciones de horario
- src/web-app/js/views/director_exceptions.js - Conexion a backend API
- src/web-app/js/views/director_broadcast.js - Conexion a backend API (NUEVO)

Backend:
- app/core/config.py - Configuracion SMTP
- app/services/notifications/smtp_email.py - NUEVO: Cliente SMTP generico
- app/services/notifications/whatsapp.py - send_text_message() (NUEVO metodo)
- app/workers/jobs/send_email.py - Seleccion SES/SMTP + template BROADCAST
- app/workers/jobs/send_whatsapp.py - Template + logica BROADCAST
- app/db/models/tenant_config.py - Columnas SMTP
- app/db/repositories/tenant_configs.py - Metodos SMTP
- app/schemas/notifications.py - NotificationType.BROADCAST
- app/schemas/webapp.py - source en DashboardEvent y AttendanceEventSummary
- app/services/dashboard_service.py - source en mappers
- app/services/web_app_service.py - source en _map_attendance_event()

Config:
- src/kiosk-app/data/config.json - apiBaseUrl ngrok
- src/web-app/index.html - Script config init
- src/web-app/js/super-admin-api.js - _baseUrl dinamico
- .env - WebAuthn + SMTP settings
- .env.example - Documentacion SMTP

Database:
- 0015_smtp_email_support.py - Migracion SMTP
- DELETE schedules WHERE weekday = 5
- INSERT schedule_exceptions (4 filas)
- INSERT tenant_features (broadcasts = true)
```

---

## Testing Actualizado

- [ ] Login con nuevo dominio
- [ ] Registro biometrico con nuevo rpId
- [ ] Autenticacion biometrica
- [ ] Kiosk conecta a API via ngrok
- [ ] Dashboard muestra eventos
- [x] Reportes filtran por fecha correctamente
- [x] Atrasos se calculan con horario real del curso
- [x] Metricas usan ultimos 30 dias calendario
- [x] Calculos excluyen fines de semana
- [x] Calculos excluyen feriados/excepciones
- [ ] Crear excepcion desde UI persiste en BD
- [ ] Eliminar excepcion desde UI elimina de BD
- [ ] Email via SMTP (dry-run)
- [ ] Email via SMTP (real con Gmail)
- [ ] Broadcast via frontend envia a backend
- [ ] Broadcast genera emails correctamente
- [ ] Broadcast genera WhatsApp correctamente

---

## Proximos Pasos

1. Probar flujo completo de broadcast desde UI
2. Verificar emails llegan via SMTP Gmail
3. Continuar testing de funcionalidades

