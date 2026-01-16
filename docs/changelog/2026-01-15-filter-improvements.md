# 2026-01-15: Refactoring Service Layer + Mejoras de Filtros

## Resumen

Sesion enfocada en dos areas principales:

### Backend - Refactoring al Patron CourseService
- **TeacherService**: Nueva capa de servicio con patron empresarial
- **GuardianService**: Nueva capa de servicio con patron empresarial
- **StudentService**: Nueva capa de servicio con patron empresarial (completado)
- **Soft Delete**: Eliminacion logica con status=DELETED y restauracion
- **Audit Logging**: Eventos de auditoria con IP tracking
- **Rate Limiting**: Proteccion de endpoints (60/30/10 por minuto)
- **Timestamps**: created_at/updated_at en los 3 modulos
- **Migracion DB**: Migraciones 0016 (teachers/guardians) y 0017 (students)

### Frontend - Filtros Reactivos
- **Filtros Reactivos**: Busqueda en tiempo real sin necesidad de boton "Filtrar"
- **Boton Limpiar Filtros**: Reset de todos los filtros con un solo clic
- **Estilos Unificados**: Labels, estructura y espaciado consistente en los 3 modulos
- **Nuevos Filtros**: Filtro por curso en Profesores, filtro por alumno en Apoderados
- **Bug Fixes**: Correccion de perdida de foco en busqueda y error 422 en Apoderados

---

## 1. Refactoring Backend: Patron CourseService

### Comparacion Antes vs Despues

| Caracteristica | Antes | Despues |
|----------------|-------|---------|
| Service Layer | Logica en endpoint | `TeacherService` / `GuardianService` |
| Rate Limiting | Sin limite | 60/30/10 por minuto |
| Audit Logging | Solo `logger.info` | `AuditEvent.TEACHER_*` / `GUARDIAN_*` |
| Soft Delete | Hard delete | `status: DELETED` con restauracion |
| Timestamps | Sin timestamps | `created_at` / `updated_at` |
| Busqueda | Solo ILIKE | Fuzzy search con ranking |
| Export CSV | No disponible | Endpoint `/export` |
| Validacion | Basica | Validacion de dependencias |

---

## 2. Nuevos Audit Events

**Archivo:** `app/core/audit.py`

```python
# Teacher Events
TEACHER_CREATED = "data.teacher.created"
TEACHER_UPDATED = "data.teacher.updated"
TEACHER_DELETED = "data.teacher.deleted"
TEACHER_EXPORTED = "data.teacher.exported"

# Guardian Events
GUARDIAN_CREATED = "data.guardian.created"
GUARDIAN_UPDATED = "data.guardian.updated"
GUARDIAN_DELETED = "data.guardian.deleted"
GUARDIAN_EXPORTED = "data.guardian.exported"
```

---

## 3. Migracion de Base de Datos

**Archivo:** `app/db/migrations/versions/0016_soft_delete_timestamps.py`

### Cambios en Tabla `guardians`

```sql
-- Nuevas columnas
ALTER TABLE guardians ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE guardians ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE guardians ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Indices
CREATE INDEX ix_guardians_status ON guardians(status);
CREATE INDEX ix_guardians_created_at ON guardians(created_at);
```

### Cambios en Tabla `teachers`

```sql
-- Nuevas columnas (status ya existia)
ALTER TABLE teachers ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE teachers ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Indice
CREATE INDEX ix_teachers_created_at ON teachers(created_at);
```

### Trigger para Auto-Update

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_teachers_updated_at
BEFORE UPDATE ON teachers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guardians_updated_at
BEFORE UPDATE ON guardians
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 4. TeacherService (NUEVO)

**Archivo:** `app/services/teacher_service.py` (~570 lineas)

### Roles y Permisos

```python
class TeacherService:
    WRITE_ROLES = {"ADMIN", "DIRECTOR"}
    READ_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR"}
    EXPORT_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR"}
```

### Metodos Implementados

| Metodo | Descripcion | Rate Limit |
|--------|-------------|------------|
| `list_teachers()` | Listar con paginacion y filtros | 60/min |
| `list_teachers_for_export()` | Export sin paginacion + audit | 10/min |
| `get_teacher_detail()` | Detalle con estadisticas | 60/min |
| `create_teacher()` | Crear con validacion email unico | 30/min |
| `update_teacher()` | Actualizar con tracking de cambios | 30/min |
| `delete_teacher()` | Soft delete (status=DELETED) | 10/min |
| `restore_teacher()` | Restaurar eliminado | 10/min |
| `search_teachers()` | Busqueda normal y fuzzy | 60/min |
| `assign_course()` | Asignar curso a profesor | 30/min |
| `unassign_course()` | Desasignar curso | 30/min |

### Patron de Implementacion

```python
async def create_teacher(self, user, payload, request):
    # 1. Validar permisos
    if user.role not in self.WRITE_ROLES:
        raise HTTPException(403, "Sin permisos")

    # 2. Validar unicidad (email)
    if payload.email:
        existing = await self.teacher_repo.get_by_email(payload.email)
        if existing:
            raise HTTPException(400, "Email duplicado")

    try:
        # 3. Ejecutar logica
        teacher = await self.teacher_repo.create(...)

        # 4. Commit
        await self.session.commit()

        # 5. Audit log con IP
        client_ip = request.client.host if request and request.client else None
        audit_log(
            AuditEvent.TEACHER_CREATED,
            user_id=user.id,
            ip_address=client_ip,
            resource_type="teacher",
            resource_id=teacher.id,
            details={...}
        )

        return TeacherRead.model_validate(teacher)

    except Exception as e:
        await self.session.rollback()
        raise
```

---

## 5. GuardianService (NUEVO)

**Archivo:** `app/services/guardian_service.py` (~550 lineas)

### Metodos Implementados

| Metodo | Descripcion | Rate Limit |
|--------|-------------|------------|
| `list_guardians()` | Listar con paginacion y filtros | 60/min |
| `list_guardians_for_export()` | Export sin paginacion + audit | 10/min |
| `get_guardian_detail()` | Detalle con estadisticas | 60/min |
| `create_guardian()` | Crear con asociacion de alumnos | 30/min |
| `update_guardian()` | Actualizar con tracking de cambios | 30/min |
| `delete_guardian()` | Soft delete (status=DELETED) | 10/min |
| `restore_guardian()` | Restaurar eliminado | 10/min |
| `search_guardians()` | Busqueda normal y fuzzy | 60/min |
| `set_students()` | Actualizar alumnos asociados | 30/min |

---

## 6. StudentService (NUEVO)

**Archivo:** `app/services/student_service.py` (~480 lineas)

### Roles y Permisos

```python
class StudentService:
    WRITE_ROLES = {"ADMIN", "DIRECTOR"}
    READ_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR"}
    EXPORT_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR"}
```

### Metodos Implementados

| Metodo | Descripcion | Rate Limit |
|--------|-------------|------------|
| `list_students()` | Listar con paginacion y filtros | 60/min |
| `list_students_for_export()` | Export sin paginacion + audit | 10/min |
| `get_student_detail()` | Detalle con estadisticas | 60/min |
| `create_student()` | Crear con validacion curso | 30/min |
| `update_student()` | Actualizar con tracking de cambios | 30/min |
| `delete_student()` | Soft delete con warnings de dependencias | 10/min |
| `restore_student()` | Restaurar eliminado | 10/min |
| `search_students()` | Busqueda normal y fuzzy | 60/min |
| `upload_photo()` | Subir foto con audit logging | 30/min |
| `delete_photo()` | Eliminar foto con audit logging | 30/min |

### Delete con Validacion de Dependencias

```python
async def delete_student(self, user, student_id, request):
    # Validar dependencias antes de eliminar
    attendance_count = await self.student_repo.count_attendance_events(student_id)
    guardians_count = await self.student_repo.count_guardians(student_id)

    warnings = []
    if attendance_count > 0:
        warnings.append(f"El estudiante tiene {attendance_count} registros de asistencia")
    if guardians_count > 0:
        warnings.append(f"El estudiante está vinculado a {guardians_count} apoderados")

    # Soft delete procede pero retorna warnings
    await self.student_repo.soft_delete(student_id)

    # Audit log incluye warnings
    audit_log(
        AuditEvent.STUDENT_DELETED,
        details={"warnings": warnings, "attendance_events": attendance_count}
    )

    return {"deleted": True, "warnings": warnings}
```

### Schemas Creados

**Archivo:** `app/schemas/students.py` (~134 lineas)

```python
class StudentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    DELETED = "DELETED"

class StudentFilters(BaseModel):
    status: str | None
    course_id: int | None
    search: str | None
    include_deleted: bool = False

class StudentWithStats(StudentRead):
    course_name: str | None
    guardians_count: int = 0
    attendance_events_count: int = 0
    last_attendance_date: datetime | None
    has_photo: bool = False

class StudentDeleteResponse(BaseModel):
    deleted: bool
    warnings: list[str] = []
```

### Migracion 0017: Timestamps en Students

**Archivo:** `app/db/migrations/versions/0017_students_timestamps.py`

```sql
-- Nuevas columnas
ALTER TABLE students ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE students ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Indice
CREATE INDEX ix_students_created_at ON students(created_at);

-- Trigger (reutiliza funcion de migracion 0016)
CREATE TRIGGER update_students_updated_at
BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Metodos Agregados al Repository

**Archivo:** `app/db/repositories/students.py`

| Metodo | Descripcion |
|--------|-------------|
| `restore(student_id)` | Cambiar status DELETED → ACTIVE |
| `get_active(student_id)` | Get solo si status != DELETED |
| `fuzzy_search(query, limit)` | Busqueda con ranking de relevancia |
| `list_for_export(status, course_id)` | Sin paginacion para CSV |
| `count_guardians(student_id)` | Contar apoderados vinculados |
| `count_attendance_events(student_id)` | Contar eventos de asistencia |

### Nuevo Audit Event

**Archivo:** `app/core/audit.py`

```python
# Student Events (ya existian CREATED/UPDATED/DELETED)
STUDENT_EXPORTED = "data.student.exported"  # NUEVO
```

### Multi-Tenant Fix

**Importante:** La migracion 0017 se aplico tanto al schema `public` como al schema del tenant `tenant_demo_local`. En sistemas multi-tenant, las migraciones deben aplicarse a cada tenant schema individualmente.

```sql
-- Aplicar a tenant schema
SET search_path TO tenant_demo_local;
ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS ix_students_created_at ON students(created_at);
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

## 7. Nuevos Endpoints

### Teachers API

```
GET    /api/v1/teachers/export          - Export CSV
GET    /api/v1/teachers/search          - Busqueda
GET    /api/v1/teachers/{id}            - Detalle
POST   /api/v1/teachers                 - Crear
PATCH  /api/v1/teachers/{id}            - Actualizar
DELETE /api/v1/teachers/{id}            - Soft delete
PATCH  /api/v1/teachers/{id}/restore    - Restaurar
POST   /api/v1/teachers/{id}/courses    - Asignar curso
DELETE /api/v1/teachers/{id}/courses    - Desasignar curso
```

### Guardians API

```
GET    /api/v1/guardians/export         - Export CSV
GET    /api/v1/guardians/search         - Busqueda
GET    /api/v1/guardians/{id}           - Detalle
POST   /api/v1/guardians                - Crear
PATCH  /api/v1/guardians/{id}           - Actualizar
DELETE /api/v1/guardians/{id}           - Soft delete
PATCH  /api/v1/guardians/{id}/restore   - Restaurar
PUT    /api/v1/guardians/{id}/students  - Actualizar alumnos
```

### Students API (Refactored)

```
GET    /api/v1/students/export          - Export CSV (NUEVO)
GET    /api/v1/students/search          - Busqueda fuzzy (NUEVO)
GET    /api/v1/students                 - Listar con paginacion
GET    /api/v1/students/{id}            - Detalle con estadisticas
POST   /api/v1/students                 - Crear
PATCH  /api/v1/students/{id}            - Actualizar
DELETE /api/v1/students/{id}            - Soft delete con warnings
POST   /api/v1/students/{id}/restore    - Restaurar (NUEVO)
POST   /api/v1/students/{id}/photo      - Subir foto (con audit)
DELETE /api/v1/students/{id}/photo      - Eliminar foto (con audit)
```

---

## 8. Modelos Actualizados

### Teacher Model

**Archivo:** `app/db/models/teacher.py`

```python
class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[int]
    full_name: Mapped[str]
    email: Mapped[str | None]
    status: Mapped[str]  # ACTIVE, INACTIVE, ON_LEAVE, DELETED
    can_enroll_biometric: Mapped[bool]

    # Nuevos campos
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]

    courses = relationship("Course", secondary=teacher_course_table)
```

### Guardian Model

**Archivo:** `app/db/models/guardian.py`

```python
class Guardian(Base):
    __tablename__ = "guardians"

    id: Mapped[int]
    full_name: Mapped[str]
    contacts: Mapped[dict]
    notification_prefs: Mapped[dict]

    # Nuevos campos
    status: Mapped[str]  # ACTIVE, DELETED
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]

    students = relationship("Student", secondary=student_guardian_table)
```

---

## 8. Frontend - Boton Exportar CSV

### Profesores

```javascript
// director_teachers.js
<button class="btn btn-secondary" onclick="Views.directorTeachers.exportCSV()">Exportar</button>

Views.directorTeachers.exportCSV = async function() {
  const blob = await State.exportTeachersCSV({ status: statusFilter || undefined });
  // Download as profesores_YYYY-MM-DD.csv
};
```

### Apoderados

```javascript
// director_guardians.js
<button class="btn btn-secondary" onclick="Views.directorGuardians.exportCSV()">Exportar</button>

Views.directorGuardians.exportCSV = async function() {
  const blob = await State.exportGuardiansCSV({ status: statusFilter || undefined });
  // Download as apoderados_YYYY-MM-DD.csv
};
```

### State.js - Nuevos Metodos

```javascript
async exportTeachersCSV(filters = {})   // Llama API.exportTeachersCSV o genera local
async exportGuardiansCSV(filters = {})  // Llama API.exportGuardiansCSV o genera local
```

---

## 9. Frontend - Soporte Soft Delete

### Filtro por Estado DELETED

```javascript
// director_teachers.js y director_guardians.js
<select onchange="Views.directorTeachers.filterByStatus(this.value)">
  <option value="">Todos</option>
  <option value="ACTIVE">Activos</option>
  <option value="INACTIVE">Inactivos</option>
  <option value="ON_LEAVE">Con licencia</option>
  <option value="DELETED">Eliminados</option>
</select>
```

### Visual para Items Eliminados

```javascript
const isDeleted = teacher.status === 'DELETED';
// Fila con opacidad reducida
<tr${isDeleted ? ' style="opacity: 0.7;"' : ''}>

// Boton restaurar en vez de editar/eliminar
const actionButtons = isDeleted
  ? `<button class="btn btn-success btn-sm" onclick="Views.directorTeachers.confirmRestore(${teacher.id})">
       <i class="fas fa-undo"></i> Restaurar
     </button>`
  : `<button onclick="edit(...)">Editar</button>
     <button onclick="delete(...)">Eliminar</button>`;
```

### Metodo Restaurar

```javascript
Views.directorTeachers.confirmRestore = function(teacherId) {
  Components.showConfirmation(
    'Restaurar Profesor',
    '¿Desea restaurar este profesor?',
    [
      { label: 'Cancelar', action: 'cancel' },
      { label: 'Restaurar', action: 'restore', className: 'btn-success', onClick: async () => {
        await State.restoreTeacher(teacherId);
        Components.showToast('Profesor restaurado', 'success');
        renderTeachers();
      }}
    ]
  );
};
```

---

## 9. Mejoras en Filtros del Modulo Profesores

### Cambios Realizados

| Mejora | Antes | Despues |
|--------|-------|---------|
| Busqueda | Boton "Filtrar" | `onkeyup` reactivo |
| Filtro Curso | No existia | Dropdown con cursos asignados |
| Filtro Estado | Boton "Filtrar" | `onchange` reactivo |
| Reset | Manual | Boton "Limpiar" |

**Archivo:** `src/web-app/js/views/director_teachers.js`

---

## 10. Mejoras en Filtros del Modulo Alumnos

### Bug Corregido: Perdida de Foco

**Problema**: Al escribir en busqueda, el input perdia foco tras cada letra.

**Causa**: `search()` llamaba a `renderStudents()` que regeneraba todo el HTML.

**Solucion**: Crear `updateTableContent()` que solo actualiza la tabla.

**Archivo:** `src/web-app/js/views/director_students.js`

---

## 11. Mejoras en Filtros del Modulo Apoderados

### Cambios Realizados

| Mejora | Antes | Despues |
|--------|-------|---------|
| Filtro Alumno | No existia | Dropdown con alumnos asociados |
| Reset | No existia | Boton "Limpiar" |

**Archivo:** `src/web-app/js/views/director_guardians.js`

---

## 12. Bug Fix: Error 422 en Apoderados

**Problema**: `GET /api/v1/guardians?limit=200` retornaba 422.

**Causa**: Backend valida `limit <= 100`, frontend enviaba 200.

**Solucion**: Cambiar en `state.js` de `limit: 200` a `limit: 100`.

---

## Archivos Modificados/Creados

```
Backend (18 archivos):

CREADOS:
- app/services/teacher_service.py       - ~570 lineas
- app/services/guardian_service.py      - ~550 lineas
- app/services/student_service.py       - ~480 lineas (NUEVO)
- app/schemas/students.py               - ~134 lineas (NUEVO)
- app/db/migrations/versions/0016_soft_delete_timestamps.py
- app/db/migrations/versions/0017_students_timestamps.py (NUEVO)

MODIFICADOS:
- app/core/audit.py                     - +9 eventos (incluyendo STUDENT_EXPORTED)
- app/core/deps.py                      - +3 dependency functions
- app/db/models/teacher.py              - +timestamps
- app/db/models/guardian.py             - +status, timestamps
- app/db/models/student.py              - +timestamps (NUEVO)
- app/db/repositories/teachers.py       - +soft_delete, restore, search
- app/db/repositories/guardians.py      - +soft_delete, restore, search
- app/db/repositories/students.py       - +restore, fuzzy_search, count_* (NUEVO)
- app/schemas/teachers.py               - +TeacherFilters, TeacherWithStats
- app/schemas/guardians.py              - +GuardianFilters, GuardianWithStats
- app/api/v1/teachers.py                - Refactored to service + rate limits
- app/api/v1/guardians.py               - Refactored to service + rate limits
- app/api/v1/students.py                - Refactored to service + rate limits (NUEVO)

Frontend (4 archivos):
- src/web-app/js/views/director_teachers.js  - Filtros + restore UI
- src/web-app/js/views/director_students.js  - updateTableContent()
- src/web-app/js/views/director_guardians.js - Filtros + restore UI
- src/web-app/js/state.js                    - Fix limit + restore methods
```

---

## Testing Realizado

### Backend
- [x] TeacherService CRUD completo
- [x] GuardianService CRUD completo
- [x] StudentService CRUD completo (NUEVO)
- [x] Soft delete funciona (status=DELETED)
- [x] Restore funciona (status=ACTIVE)
- [x] Audit logs registran IP
- [x] Rate limiting activo
- [x] Migracion 0016 aplicada correctamente (teachers/guardians)
- [x] Migracion 0017 aplicada correctamente (students)
- [x] Triggers de updated_at funcionan
- [x] Multi-tenant: migraciones aplicadas a tenant_demo_local

### Frontend
- [x] Filtro DELETED muestra items eliminados
- [x] Items eliminados tienen opacidad reducida
- [x] Boton Restaurar visible solo para eliminados
- [x] Restaurar actualiza UI correctamente
- [x] Busqueda reactiva no pierde foco
- [x] Boton Limpiar resetea todos los filtros
- [x] Error 422 corregido

### Students (Pendiente)
- [ ] Test CRUD Students desde UI
- [ ] Verificar export CSV funciona
- [ ] Verificar fuzzy search
- [ ] Verificar delete con warnings de dependencias

---

## Resumen de Arquitectura

Los modulos de Profesores, Apoderados y Alumnos ahora siguen el mismo patron empresarial que Cursos:

```
┌─────────────────────────────────────────────────────────────┐
│                      API Endpoint                           │
│  - Rate limiting (@limiter.limit)                          │
│  - Request validation (Pydantic schemas)                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│  - Role validation (WRITE_ROLES, READ_ROLES)               │
│  - Business logic                                          │
│  - Audit logging with IP                                   │
│  - Transaction management (commit/rollback)                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Repository Layer                         │
│  - Database queries                                        │
│  - Soft delete (status=DELETED)                           │
│  - Fuzzy search                                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database                                 │
│  - Timestamps (created_at, updated_at)                     │
│  - Auto-update triggers                                    │
│  - Indices para performance                                │
└─────────────────────────────────────────────────────────────┘
```

---

*Refactoring de Teachers, Guardians y Students completado el 15 de Enero de 2026*
*Todos los modulos principales ahora usan el patron empresarial: CourseService, TeacherService, GuardianService, StudentService*
