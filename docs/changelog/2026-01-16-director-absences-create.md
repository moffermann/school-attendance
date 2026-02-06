# 2026-01-16: Modulo Completo de Ausencias para Director

## Resumen

Sesion enfocada en completar el modulo de Ausencias del Director con:
- Formulario de creacion de nuevas solicitudes de ausencia
- Mejoras de UX en botones de accion (color del boton Rechazar)
- Implementacion de Soft Delete para mantener trazabilidad

### Funcionalidades Agregadas
- **Formulario de creacion**: Directors/Inspectores pueden crear ausencias en nombre de los apoderados
- **Filtro por curso**: Selector de curso para filtrar la lista de alumnos
- **Validaciones frontend**: Validacion de fechas, rango maximo 30 dias, campos requeridos
- **UX mejorada**: Formulario colapsable, feedback visual, auto-switch a tab Pendientes
- **Boton Rechazar amarillo**: Distincion visual clara entre Aprobar (verde), Rechazar (amarillo) y Eliminar (rojo)
- **Soft Delete**: Eliminacion logica que preserva historial y trazabilidad

### Mantenimiento
- **ngrok tunnel**: Actualizacion de URL tras corte de luz en Buenos Aires
- **Docker containers**: Reinicio de contenedores tras el apagon
- **Migracion multi-tenant**: Correccion de aplicacion de migraciones en schemas de tenant

---

## 1. Nueva Funcionalidad: Crear Ausencias desde Director

### Justificacion

| Escenario | Solucion |
|-----------|----------|
| Apoderado llama por telefono | Director registra la ausencia |
| Apoderado informa en persona | Director registra la ausencia |
| Apoderado sin acceso al sistema | Director registra la ausencia |
| Registro retroactivo | Director puede crear con fechas pasadas |

El backend ya soportaba creacion de ausencias por roles ADMIN, DIRECTOR e INSPECTOR via `POST /absences`. Solo faltaba el formulario en el frontend.

---

## 2. Cambios en director_absences.js

**Archivo:** `src/web-app/js/views/director_absences.js`

### Nueva Variable de Estado

```javascript
let showCreateForm = false;  // Controla visibilidad del formulario
```

### Nuevas Funciones

| Funcion | Descripcion |
|---------|-------------|
| `renderCreateForm()` | Genera el HTML del formulario de creacion |
| `renderStudentOptions(courseId)` | Genera options de alumnos, filtrados opcionalmente por curso |
| `toggleCreateForm()` | Muestra/oculta el formulario |
| `filterStudentsByCourse(courseId)` | Actualiza dropdown de alumnos al cambiar curso |
| `submitNewAbsence()` | Valida y envia la solicitud al API |

### Estructura del Formulario

```html
<!-- Header con boton toggle -->
<div style="display: flex; justify-content: space-between;">
  <div>
    <h2>Solicitudes de Ausencia</h2>
    <p>Gestione las solicitudes de ausencia de los alumnos</p>
  </div>
  <button onclick="toggleCreateForm()">+ Nueva Solicitud</button>
</div>

<!-- Formulario colapsable -->
<div class="card" style="border: 2px solid var(--color-primary-light);">
  <form id="director-absence-form">
    <!-- Fila 1: Curso, Alumno, Tipo -->
    <select id="create-course">...</select>      <!-- Filtro opcional -->
    <select id="create-student" required>...</select>
    <select id="create-type" required>
      <option value="MEDICAL">Medica</option>
      <option value="FAMILY">Familiar</option>
      <option value="VACATION">Vacaciones</option>
      <option value="OTHER">Otro</option>
    </select>

    <!-- Fila 2: Fechas -->
    <input type="date" id="create-start-date" required>
    <input type="date" id="create-end-date" required>

    <!-- Fila 3: Comentario -->
    <textarea id="create-comment" placeholder="..."></textarea>

    <!-- Acciones -->
    <button onclick="submitNewAbsence()">Crear Solicitud</button>
    <button onclick="toggleCreateForm()">Cancelar</button>
  </form>
</div>
```

### Validaciones Implementadas

```javascript
Views.directorAbsences.submitNewAbsence = async function() {
  // 1. Alumno requerido
  if (!studentId) {
    Components.showToast('Seleccione un alumno', 'error');
    return;
  }

  // 2. Fechas requeridas
  if (!startDate || !endDate) {
    Components.showToast('Complete las fechas', 'error');
    return;
  }

  // 3. Fecha inicio <= fecha fin
  if (startDate > endDate) {
    Components.showToast('La fecha de inicio no puede ser mayor a la fecha fin', 'error');
    return;
  }

  // 4. Maximo 30 dias
  const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
  if (daysDiff > 30) {
    Components.showToast('El rango maximo es de 30 dias', 'error');
    return;
  }

  // ... enviar al API
};
```

### Payload al API

```javascript
const data = {
  student_id: parseInt(studentId),
  type: type,           // MEDICAL | FAMILY | VACATION | OTHER
  start: startDate,     // YYYY-MM-DD (formato legacy)
  end: endDate,         // YYYY-MM-DD (formato legacy)
  comment: comment || null,
};

await API.submitAbsence(data);
```

> **Nota**: El endpoint legacy `/absences` usa campos `start` y `end`, no `start_date` y `end_date`.

### Comportamiento Post-Creacion

1. Toast de exito: "Solicitud creada exitosamente"
2. Oculta el formulario
3. Incrementa contadores locales (`counts.pending++`, `counts.total++`)
4. Cambia a tab "Pendientes" si no estaba seleccionado
5. Recarga la lista de ausencias

---

## 3. Filtro de Alumnos por Curso

### Flujo de Usuario

1. Usuario abre formulario de creacion
2. Dropdown "Curso" muestra todos los cursos
3. Al seleccionar un curso, dropdown "Alumno" se filtra
4. Si selecciona "Todos los cursos", muestra todos los alumnos

### Implementacion

```javascript
// Generar opciones de alumnos
function renderStudentOptions(courseId) {
  let students = State.getStudents() || [];

  // Filtrar por curso si se especifica
  if (courseId) {
    students = students.filter(s => s.course_id === parseInt(courseId));
  }

  // Ordenar alfabeticamente
  students.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

  // Generar options con nombre de curso
  return students.map(s => {
    const course = State.getCourse(s.course_id);
    const courseLabel = course ? ` (${course.name})` : '';
    return `<option value="${s.id}">${s.full_name}${courseLabel}</option>`;
  }).join('');
}

// Handler del cambio de curso
Views.directorAbsences.filterStudentsByCourse = function(courseId) {
  const studentSelect = document.getElementById('create-student');
  if (studentSelect) {
    studentSelect.innerHTML = `
      <option value="">Seleccione un alumno...</option>
      ${renderStudentOptions(courseId)}
    `;
  }
};
```

---

## 4. Actualizacion de ngrok URL

Tras corte de luz en Buenos Aires, se actualizo la URL del tunnel ngrok.

### Archivos Modificados

| Archivo | Campo Modificado |
|---------|------------------|
| `kiosk-celular/data/config.json` | `apiBaseUrl` |
| `src/kiosk-app/data/config.json` | `apiBaseUrl` |
| `src/web-app/index.html` | `config.apiUrl` |

### Nueva URL

```json
{
  "apiBaseUrl": "https://b264c25aa91f.ngrok-free.app/api/v1"
}
```

---

## 5. Reinicio de Docker Desktop

Tras el apagon, Docker Desktop no estaba corriendo. Se inicio manualmente:

```bash
"/c/Program Files/Docker/Docker/Docker Desktop.exe" &
```

El usuario inicio los contenedores desde la UI de Docker Desktop.

---

## Archivos Modificados

```
Frontend (1 archivo):
- src/web-app/js/views/director_absences.js  - +90 lineas (formulario creacion)

Configuracion (3 archivos):
- kiosk-celular/data/config.json             - ngrok URL
- src/kiosk-app/data/config.json             - ngrok URL
- src/web-app/index.html                     - ngrok URL (sesion anterior)
```

---

## Testing Pendiente

- [ ] Crear ausencia desde director UI
- [ ] Verificar que aparece en tab Pendientes
- [ ] Filtrar alumnos por curso
- [ ] Validar fechas invalidas
- [ ] Validar rango > 30 dias
- [ ] Aprobar/rechazar ausencia creada por director

---

## Diagrama de Flujo: Crear Ausencia

```
┌─────────────────────────────────────────────────────────────┐
│                   Director Absences View                     │
├─────────────────────────────────────────────────────────────┤
│  [+ Nueva Solicitud]  ◄── Click                             │
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Formulario de Creacion                    │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Curso: [Dropdown]  ──► Filtra alumnos              │   │
│  │  Alumno: [Dropdown] *                               │   │
│  │  Tipo: [MEDICAL|FAMILY|VACATION|OTHER] *            │   │
│  │  Fecha Inicio: [Date] *                             │   │
│  │  Fecha Fin: [Date] *                                │   │
│  │  Comentario: [Textarea]                             │   │
│  │                                                      │   │
│  │  [Crear Solicitud]  [Cancelar]                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│                    Validaciones                              │
│                    - Alumno requerido                        │
│                    - Fechas requeridas                       │
│                    - start <= end                            │
│                    - Rango <= 30 dias                        │
│                            │                                 │
│                            ▼                                 │
│              POST /absences (API.submitAbsence)             │
│                            │                                 │
│                            ▼                                 │
│              Toast "Solicitud creada exitosamente"          │
│              Ocultar formulario                              │
│              Switch to PENDING tab                          │
│              Reload absences list                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Comparacion: Parent vs Director Form

| Caracteristica | Parent Form | Director Form |
|----------------|-------------|---------------|
| Alumnos visibles | Solo sus hijos | Todos los alumnos |
| Filtro por curso | No | Si |
| Tipos disponibles | SICK, PERSONAL | MEDICAL, FAMILY, VACATION, OTHER |
| Adjuntos | Si (simulado) | No |
| Conexion API | State.addAbsence (local) | API.submitAbsence (real) |

> **Nota**: El formulario de Parent (`parent_absences.js`) aun usa `State.addAbsence()` que guarda en estado local, no en el API. Esto es un trabajo pendiente para futuras sesiones.

---

## 6. Mejora UX: Color del Boton Rechazar

### Problema

El boton "Rechazar" usaba la clase `btn-outline-danger` (borde rojo) que no era visualmente distintivo del boton "Eliminar" (rojo solido).

### Solucion

Se cambio el boton Rechazar a color amarillo (amber) para crear una jerarquia visual clara:

| Accion | Color | Significado |
|--------|-------|-------------|
| Aprobar | Verde (`#22c55e`) | Accion positiva |
| Rechazar | Amarillo (`#f59e0b`) | Accion de advertencia |
| Eliminar | Rojo (`#ef4444`) | Accion destructiva |

### Codigo Modificado

**Archivo:** `src/web-app/js/views/director_absences.js`

```javascript
// Antes:
<button class="btn btn-sm btn-outline-danger">✕ Rechazar</button>

// Despues:
<button class="btn btn-sm"
        style="background-color: #f59e0b; color: white; border: none;"
        onclick="Views.directorAbsences.showRejectModal(${absence.id})"
        title="Rechazar">
  ✕ Rechazar
</button>
```

---

## 7. Soft Delete para Ausencias

### Justificacion

El hard delete eliminaba permanentemente los registros, perdiendo toda evidencia del sistema. Se implemento soft delete para:

1. **Auditoria**: Mantener registro de quien elimino y cuando
2. **Trazabilidad**: Posibilidad de revisar historial completo
3. **Recuperacion**: Opcion futura de restaurar registros eliminados
4. **Compliance**: Cumplimiento de requisitos de retencion de datos

### Migracion de Base de Datos

**Archivo:** `app/db/migrations/versions/0019_absence_soft_delete.py`

```python
revision = "0019_absence_soft_delete"
down_revision = "0018_absence_requests_updates"

def upgrade() -> None:
    # Columna para timestamp de eliminacion
    op.add_column(
        "absence_requests",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Columna para usuario que elimino
    op.add_column(
        "absence_requests",
        sa.Column(
            "deleted_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    # Indice para consultas eficientes de registros no eliminados
    op.create_index(
        "ix_absence_requests_deleted_at",
        "absence_requests",
        ["deleted_at"],
        unique=False,
    )

def downgrade() -> None:
    op.drop_index("ix_absence_requests_deleted_at", table_name="absence_requests")
    op.drop_column("absence_requests", "deleted_by_id")
    op.drop_column("absence_requests", "deleted_at")
```

### Cambios en el Modelo

**Archivo:** `app/db/models/absence_request.py`

```python
# Soft delete fields
deleted_at: Mapped[datetime | None] = mapped_column(
    DateTime(timezone=True), nullable=True, index=True
)
deleted_by_id: Mapped[int | None] = mapped_column(
    ForeignKey("users.id", ondelete="SET NULL"), nullable=True
)

# Relationships
deleted_by = relationship("User", foreign_keys=[deleted_by_id])
```

### Cambios en el Repository

**Archivo:** `app/db/repositories/absences.py`

#### Metodo `get()` con parametro `include_deleted`

```python
async def get(self, absence_id: int, include_deleted: bool = False) -> AbsenceRequest | None:
    stmt = (
        select(AbsenceRequest)
        .options(selectinload(AbsenceRequest.student).selectinload(Student.course))
        .where(AbsenceRequest.id == absence_id)
    )
    if not include_deleted:
        stmt = stmt.where(AbsenceRequest.deleted_at.is_(None))
    result = await self.session.execute(stmt)
    return result.scalar_one_or_none()
```

#### Metodo `delete()` - Soft Delete

```python
async def delete(self, absence_id: int, *, deleted_by_id: int) -> AbsenceRequest | None:
    """Soft delete an absence request (sets deleted_at timestamp)."""
    absence = await self.get(absence_id)
    if not absence:
        return None
    absence.deleted_at = datetime.now(timezone.utc)
    absence.deleted_by_id = deleted_by_id
    await self.session.flush()
    return absence
```

#### Metodo `hard_delete()` - Para cleanup administrativo

```python
async def hard_delete(self, absence_id: int) -> bool:
    """Hard delete an absence request (use with caution, only for admin cleanup)."""
    absence = await self.get(absence_id, include_deleted=True)
    if not absence:
        return False
    await self.session.delete(absence)
    await self.session.flush()
    return True
```

#### Filtro en todas las consultas

Todos los metodos de listado ahora incluyen el filtro:
```python
.where(AbsenceRequest.deleted_at.is_(None))
```

### Cambios en el Service

**Archivo:** `app/services/absence_service.py`

```python
deleted_absence = await self.absence_repo.delete(
    absence_id, deleted_by_id=user.id
)
```

---

## 8. Fix: Migracion Multi-Tenant

### Problema

Alembic aplica migraciones al schema `public` por defecto, pero la aplicacion usa schemas por tenant (ej: `tenant_demo_local`). Esto causo el error:

```
column absence_requests.deleted_at does not exist
```

### Solucion

Se ejecutaron los comandos SQL directamente en el schema del tenant:

```sql
SET search_path TO tenant_demo_local;

ALTER TABLE absence_requests
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE absence_requests
ADD COLUMN IF NOT EXISTS deleted_by_id INTEGER
REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_absence_requests_deleted_at
ON absence_requests(deleted_at);
```

### Comando Docker utilizado

```bash
docker exec school-attendance-postgres-local psql -U school_attendance -d school_attendance -c "
SET search_path TO tenant_demo_local;
ALTER TABLE absence_requests ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE absence_requests ADD COLUMN IF NOT EXISTS deleted_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_absence_requests_deleted_at ON absence_requests(deleted_at);
"
```

> **Nota importante**: En produccion, las migraciones deben aplicarse a cada tenant schema. Considerar crear un script que itere sobre todos los tenants.

---

## Archivos Modificados (Actualizacion Final)

```
Backend (4 archivos):
- app/db/migrations/versions/0019_absence_soft_delete.py  - NUEVO (migracion soft delete)
- app/db/models/absence_request.py                        - +8 lineas (campos soft delete)
- app/db/repositories/absences.py                         - +30 lineas (metodos soft delete)
- app/services/absence_service.py                         - +1 linea (deleted_by_id)

Frontend (1 archivo):
- src/web-app/js/views/director_absences.js               - +90 lineas (formulario) + 1 linea (color boton)

Configuracion (3 archivos):
- kiosk-celular/data/config.json                          - ngrok URL
- src/kiosk-app/data/config.json                          - ngrok URL
- src/web-app/index.html                                  - ngrok URL
```

---

## Testing Completado

- [x] Crear ausencia desde director UI
- [x] Verificar que aparece en tab Pendientes
- [x] Filtrar alumnos por curso
- [x] Aprobar ausencia
- [x] Rechazar ausencia (con razon)
- [x] Eliminar ausencia (soft delete)
- [x] Verificar soft delete en BD (deleted_at y deleted_by_id seteados)
- [x] Verificar que registros eliminados no aparecen en listados

### Verificacion en Base de Datos

```sql
-- Verificar soft delete
SET search_path TO tenant_demo_local;
SELECT id, type, status, deleted_at, deleted_by_id
FROM absence_requests
WHERE deleted_at IS NOT NULL;

-- Resultado: ID 14, FAMILY, deleted_at = 2026-01-16 XX:XX:XX, deleted_by_id = 1
```

---

## Diagrama: Flujo de Soft Delete

```
┌─────────────────────────────────────────────────────────────┐
│                    Director Absences View                    │
├─────────────────────────────────────────────────────────────┤
│  Solicitud PENDING                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Alumno: Juan Perez                                  │   │
│  │  Tipo: MEDICAL  |  Fechas: 2026-01-15 al 2026-01-17 │   │
│  │                                                      │   │
│  │  [Aprobar]  [Rechazar]  [🗑️ Eliminar]               │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│                              ▼ Click Eliminar               │
│                    Confirmacion: "¿Eliminar?"               │
│                              │                              │
│                              ▼ Confirmar                    │
│              DELETE /absences/{id}                          │
│                              │                              │
│                              ▼                              │
│              AbsenceService.delete()                        │
│              └── absence_repo.delete(id, deleted_by_id)     │
│                              │                              │
│                              ▼                              │
│              UPDATE absence_requests SET                    │
│                deleted_at = NOW(),                          │
│                deleted_by_id = {user.id}                    │
│              WHERE id = {id}                                │
│                              │                              │
│                              ▼                              │
│              Toast: "Solicitud eliminada"                   │
│              Registro ya no visible en UI                   │
│              (pero preservado en BD)                        │
└─────────────────────────────────────────────────────────────┘
```

---

> **Nota**: El formulario de Parent (`parent_absences.js`) ahora usa `API.submitAbsence()` y soporta subida real de archivos a MinIO.

---

## 9. Fix: Tipos de Ausencia en Parent App

### Problema

El dropdown de tipos de ausencia en `parent_absences.js` mostraba opciones incorrectas:
- SICK (no existe en backend)
- PERSONAL (no existe en backend)

El backend define los tipos en `app/schemas/absences.py`:
```python
class AbsenceType(str, Enum):
    MEDICAL = "MEDICAL"
    FAMILY = "FAMILY"
    VACATION = "VACATION"
    OTHER = "OTHER"
```

### Solucion

**Archivo:** `src/web-app/js/views/parent_absences.js`

```javascript
// Antes:
<select id="absence-type" class="form-select" required>
  <option value="SICK">Enfermedad</option>
  <option value="PERSONAL">Personal</option>
</select>

// Despues:
<select id="absence-type" class="form-select" required>
  <option value="MEDICAL">🏥 Médica</option>
  <option value="FAMILY">👨‍👩‍👧 Familiar</option>
  <option value="VACATION">🏖️ Vacaciones</option>
  <option value="OTHER">📋 Otro</option>
</select>
```

Tambien se corrigio el `typeConfig` para mostrar correctamente en el historial:

```javascript
const typeConfig = {
  MEDICAL: { icon: '🏥', label: 'Médica', color: 'warning' },
  FAMILY: { icon: '👨‍👩‍👧', label: 'Familiar', color: 'info' },
  VACATION: { icon: '🏖️', label: 'Vacaciones', color: 'primary' },
  OTHER: { icon: '📋', label: 'Otro', color: 'secondary' }
};
```

---

## 10. Implementacion: Subida de Archivos a MinIO

### Contexto

El formulario de ausencias del Parent mostraba un area para adjuntar archivos, pero solo guardaba el nombre del archivo como texto. El archivo nunca se subia realmente al servidor.

### Arquitectura Implementada

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐
│   Parent App    │───►│  FastAPI Backend │───►│    MinIO    │
│ (parent_absences│    │  POST /absences/ │    │  (S3-like)  │
│     .js)        │    │  {id}/attachment │    │  Port 9043  │
└─────────────────┘    └──────────────────┘    └─────────────┘
```

### Flujo de Subida (2 pasos)

1. **Crear solicitud** → `POST /absences` → Retorna `{id: 33, ...}`
2. **Subir archivo** → `POST /absences/33/attachment` → Actualiza `attachment_ref`

### Backend: Nuevo Endpoint

**Archivo:** `app/api/v1/absences.py`

```python
@router.post("/{absence_id}/attachment", response_model=AbsenceRead)
@limiter.limit("10/minute")
async def upload_absence_attachment(
    request: Request,
    absence_id: int = Path(..., ge=1),
    file: UploadFile = File(...),
    service: AbsenceService = Depends(deps.get_absence_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> AbsenceRead:
    """Upload attachment for an absence request.

    Accepts PDF, JPG, or PNG files up to 5MB.
    Only the absence owner or admin roles can upload.
    Only PENDING requests can have attachments uploaded.
    """
    return await service.upload_attachment(user, absence_id, file, request)
```

### Backend: Service Method

**Archivo:** `app/services/absence_service.py`

```python
async def upload_attachment(
    self,
    user: "AuthUser | TenantAuthUser",
    absence_id: int,
    file: UploadFile,
    request: Request | None = None,
) -> AbsenceRead:
    """Upload attachment for an absence request."""
    from app.services.photo_service import PhotoService

    # 1. Validar que la ausencia existe
    absence = await self.absence_repo.get(absence_id)
    if not absence:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    # 2. Verificar acceso - solo el dueño o admin puede subir
    student_ids = await self._get_student_ids_for_user(user)
    if student_ids is not None and absence.student_id not in student_ids:
        raise HTTPException(status_code=403, detail="Sin acceso a esta solicitud")

    # 3. Solo se puede subir a solicitudes PENDING
    if absence.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden adjuntar archivos a solicitudes pendientes",
        )

    # 4. Validar tipo de archivo
    allowed_types = {"application/pdf", "image/jpeg", "image/png", "image/jpg"}
    content_type = file.content_type or "application/octet-stream"
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Tipo de archivo no permitido. Permitidos: PDF, JPG, PNG",
        )

    # 5. Validar tamaño (max 5MB)
    max_size = 5 * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=400,
            detail="El archivo excede el tamaño máximo de 5MB",
        )

    # 6. Generar key unico para MinIO
    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "bin"
    key = f"absences/{absence_id}/{uuid.uuid4()}.{ext}"

    # 7. Subir a MinIO usando PhotoService existente
    photo_service = PhotoService()
    try:
        await photo_service.store_photo(key, content, content_type)
        absence.attachment_ref = key
        await self.session.commit()
        await self.session.refresh(absence)
        # ... audit logging
    finally:
        photo_service.close()
```

### Backend: Helper para URLs

```python
def _build_attachment_url(self, attachment_ref: str | None) -> str | None:
    """Build URL for attachment (presigned URL or direct path)."""
    if not attachment_ref:
        return None
    from app.core.config import settings
    base_url = str(settings.public_base_url).rstrip("/")
    return f"{base_url}/api/v1/photos/{attachment_ref}"
```

### Frontend: API Method

**Archivo:** `src/web-app/js/api.js`

```javascript
/**
 * Upload attachment for an absence request
 * @param {number} absenceId - Absence request ID
 * @param {File} file - File to upload (PDF, JPG, PNG, max 5MB)
 * @returns {Promise<Object>} Updated absence with attachment_url
 */
async uploadAbsenceAttachment(absenceId, file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await this.requestMultipart(`/absences/${absenceId}/attachment`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error al subir archivo' }));
    if (response.status === 400) {
      throw new Error(error.detail || 'Archivo no válido');
    } else if (response.status === 404) {
      throw new Error('Solicitud no encontrada');
    } else if (response.status === 403) {
      throw new Error('Sin permisos para adjuntar archivo');
    }
    throw new Error(error.detail || 'Error al subir archivo');
  }
  return response.json();
},
```

### Frontend: Flujo en parent_absences.js

**Archivo:** `src/web-app/js/views/parent_absences.js`

```javascript
Views.parentAbsences.submitRequest = async function() {
  // ... validaciones ...

  const file = fileInput.files[0] || null;

  // Validar tamaño (max 5MB)
  if (file && file.size > 5 * 1024 * 1024) {
    Components.showToast('El archivo excede el tamaño máximo de 5MB', 'error');
    return;
  }

  try {
    let created;

    if (State.isApiAuthenticated()) {
      // Paso 1: Crear solicitud
      created = await API.submitAbsence(absence);

      // Paso 2: Subir archivo si existe
      if (file) {
        submitBtn.innerHTML = '⏳ Subiendo archivo...';
        try {
          const updated = await API.uploadAbsenceAttachment(created.id, file);
          created = updated;  // Actualizar con info del attachment
        } catch (uploadError) {
          console.error('Error uploading attachment:', uploadError);
          Components.showToast('Solicitud creada, pero error al subir archivo: ' + uploadError.message, 'warning');
        }
      }

      // Actualizar estado local
      State.data.absences.push(created);
      State.persist();
    } else {
      // Demo mode - solo guarda localmente
      State.addAbsence(absence);
    }

    Components.showToast('Solicitud enviada exitosamente', 'success');
    // ... reset form ...
  } catch (error) {
    // ...
  }
};
```

### Estructura de Almacenamiento en MinIO

```
bucket: school-attendance (configurado en .env)
└── absences/
    └── {absence_id}/
        └── {uuid}.{extension}

Ejemplo:
absences/33/b8db94d1-ef4a-4695-8a13-0ccab29f61a2.pdf
```

### Validaciones Implementadas

| Validacion | Codigo HTTP | Mensaje |
|------------|-------------|---------|
| Solicitud no existe | 404 | "Solicitud no encontrada" |
| Sin permisos | 403 | "Sin acceso a esta solicitud" |
| Status != PENDING | 400 | "Solo se pueden adjuntar archivos a solicitudes pendientes" |
| Tipo no permitido | 400 | "Tipo de archivo no permitido. Permitidos: PDF, JPG, PNG" |
| Tamaño > 5MB | 400 | "El archivo excede el tamaño máximo de 5MB" |

---

## 11. Vista de Detalles en Director

### Problema

La tabla de ausencias del director solo mostraba informacion basica. No habia forma de:
- Ver si una solicitud tenia archivo adjunto
- Ver el detalle completo de una solicitud
- Descargar/visualizar el archivo adjunto

### Solucion

Se agregaron:
1. Columna "Adjunto" con indicador visual
2. Boton "👁 Ver" para cada fila
3. Modal de detalle con toda la informacion

### Nueva Columna "Adjunto"

**Archivo:** `src/web-app/js/views/director_absences.js`

```javascript
// En el header de la tabla
<th>Adjunto</th>

// En cada fila
const hasAttachment = absence.attachment_ref || absence.attachment_url;
const attachmentIcon = hasAttachment
  ? '<span style="color: var(--color-success);" title="Ver adjunto">📎</span>'
  : '<span style="color: var(--color-gray-300);">-</span>';

<td style="text-align: center;">${attachmentIcon}</td>
```

### Boton "Ver" en Acciones

```javascript
<td style="white-space: nowrap;">
  <button class="btn btn-secondary btn-sm"
          onclick="Views.directorAbsences.showDetail(${absence.id})"
          title="Ver detalles">
    👁 Ver
  </button>
  ${activeTab === 'PENDING' ? `
    <button class="btn btn-success btn-sm">✓</button>
    <button class="btn btn-sm" style="background-color: #f59e0b;">✕</button>
    <button class="btn btn-error btn-sm">🗑</button>
  ` : ''}
</td>
```

### Funcion showDetail()

```javascript
Views.directorAbsences.showDetail = function(absenceId) {
  const absence = absences.find(a => a.id === absenceId);
  if (!absence) {
    Components.showToast('Solicitud no encontrada', 'error');
    return;
  }

  // Build attachment section
  let attachmentHtml = '<span style="color: var(--color-gray-400);">Sin adjunto</span>';
  if (absence.attachment_url || absence.attachment_ref) {
    const attachmentUrl = absence.attachment_url || `/api/v1/photos/${absence.attachment_ref}`;
    const fileName = absence.attachment_ref ? absence.attachment_ref.split('/').pop() : 'archivo';
    attachmentHtml = `
      <a href="${attachmentUrl}" target="_blank" rel="noopener noreferrer"
         style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem;
                background: var(--color-primary-light); border-radius: 8px;
                text-decoration: none; color: var(--color-primary);">
        <span style="font-size: 1.5rem;">📎</span>
        <span>
          <strong style="display: block;">Ver/Descargar Adjunto</strong>
          <span style="font-size: 0.85rem;">${fileName}</span>
        </span>
      </a>
    `;
  }

  const modalContent = `
    <div style="display: grid; gap: 1.25rem;">
      <!-- Alumno & Curso -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div>
          <label>Alumno</label>
          <strong>${studentName}</strong>
        </div>
        <div>
          <label>Curso</label>
          <span>${courseName}</span>
        </div>
      </div>

      <!-- Tipo & Estado -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div>
          <label>Tipo de Ausencia</label>
          <span>${typeInfo.icon} ${typeInfo.label}</span>
        </div>
        <div>
          <label>Estado</label>
          <span class="chip chip-${statusInfo.color}">${statusInfo.icon} ${statusInfo.label}</span>
        </div>
      </div>

      <!-- Fechas -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
        <div><label>Fecha Inicio</label><span>${startDate}</span></div>
        <div><label>Fecha Fin</label><span>${endDate}</span></div>
        <div><label>Total Días</label><span>${days} día(s)</span></div>
      </div>

      <!-- Comentario -->
      <div>
        <label>Comentario / Motivo</label>
        <div style="background: var(--color-gray-50); padding: 0.75rem;">
          ${absence.comment || 'Sin comentario'}
        </div>
      </div>

      <!-- Razon rechazo (solo si rechazada) -->
      ${absence.status === 'REJECTED' && absence.rejection_reason ? `
        <div>
          <label style="color: var(--color-error);">Razón del Rechazo</label>
          <div style="background: var(--color-error-light);">
            ${absence.rejection_reason}
          </div>
        </div>
      ` : ''}

      <!-- Archivo Adjunto -->
      <div>
        <label>Archivo Adjunto</label>
        ${attachmentHtml}
      </div>

      <!-- Timestamps -->
      <div style="border-top: 1px solid var(--color-gray-200); padding-top: 1rem;">
        <span>Fecha de solicitud: ${ts_submitted}</span>
        ${ts_resolved ? `<span>Fecha de resolución: ${ts_resolved}</span>` : ''}
      </div>
    </div>
  `;

  // Botones de accion segun estado
  const buttons = [{ label: 'Cerrar', className: 'btn-secondary' }];
  if (absence.status === 'PENDING') {
    buttons.unshift(
      { label: '✓ Aprobar', className: 'btn-success', onClick: () => approve(absenceId) },
      { label: '✕ Rechazar', className: 'btn-warning', onClick: () => showRejectModal(absenceId) }
    );
  }

  Components.showModal(`Detalle de Solicitud #${absenceId}`, modalContent, buttons);
};
```

### Acceso al Archivo via Photo Proxy

El archivo se sirve a traves del endpoint existente `/api/v1/photos/{key}`:

```python
# app/api/v1/photos.py
@router.get("/{key:path}")
async def get_photo_proxy(key: str, ...) -> Response:
    """Proxy endpoint for serving photos through the API."""
    photo_service = PhotoService()
    result = await photo_service.get_photo(key)
    return Response(content=photo_data, media_type=content_type)
```

Este endpoint ya existia para las fotos de alumnos y ahora tambien sirve los attachments de ausencias.

---

## Archivos Modificados (Sesion Completa)

```
Backend (5 archivos):
- app/db/migrations/versions/0019_absence_soft_delete.py  - NUEVO (migracion soft delete)
- app/db/models/absence_request.py                        - +8 lineas (campos soft delete)
- app/db/repositories/absences.py                         - +30 lineas (metodos soft delete)
- app/services/absence_service.py                         - +100 lineas (upload_attachment, _build_attachment_url)
- app/api/v1/absences.py                                  - +17 lineas (endpoint attachment)

Frontend (2 archivos):
- src/web-app/js/views/director_absences.js               - +150 lineas (formulario, detalle, adjunto)
- src/web-app/js/views/parent_absences.js                 - ~30 lineas modificadas (tipos, upload)
- src/web-app/js/api.js                                   - +25 lineas (uploadAbsenceAttachment)

Configuracion (3 archivos):
- kiosk-celular/data/config.json                          - ngrok URL
- src/kiosk-app/data/config.json                          - ngrok URL
- src/web-app/index.html                                  - ngrok URL
```

---

## Testing Completado (Actualizado)

- [x] Crear ausencia desde director UI
- [x] Verificar que aparece en tab Pendientes
- [x] Filtrar alumnos por curso
- [x] Aprobar ausencia
- [x] Rechazar ausencia (con razon)
- [x] Eliminar ausencia (soft delete)
- [x] Verificar soft delete en BD
- [x] **Crear ausencia desde Parent App con tipos correctos**
- [x] **Subir archivo PDF desde Parent App**
- [x] **Verificar archivo guardado en MinIO**
- [x] **Ver detalle de ausencia en Director**
- [x] **Ver/descargar archivo adjunto desde modal de detalle**

### Verificacion de Upload en Base de Datos

```sql
SELECT id, student_id, type, attachment_ref, status, ts_submitted
FROM tenant_demo_local.absence_requests
WHERE attachment_ref IS NOT NULL;

-- Resultado:
-- id | student_id |   type   |                    attachment_ref                    |  status
-- 33 |        101 | VACATION | absences/33/b8db94d1-ef4a-4695-8a13-0ccab29f61a2.pdf | PENDING
```

---

## 12. Fix: Descarga de Adjuntos con Autenticacion

### Problema

Al pulsar el boton "Ver/Descargar Adjunto" en el modal de detalle, el archivo se abria en una nueva pestaña mostrando:
```json
{"detail":"Authentication required"}
```

### Causa Raiz

El endpoint `/api/v1/photos/{key}` requiere autenticacion JWT. Cuando se usa un enlace `<a href="..." target="_blank">`, el navegador abre la URL en una nueva pestaña **sin enviar** los headers de autenticacion.

### Solucion

Cambiar de un enlace `<a>` a un boton que invoca una funcion JavaScript que:
1. Hace fetch con headers de autenticacion
2. Obtiene el archivo como Blob
3. Crea una URL temporal (Blob URL)
4. Abre el archivo en nueva pestaña o descarga

### Codigo Implementado

**Archivo:** `src/web-app/js/views/director_absences.js`

#### HTML del boton (en showDetail)

```javascript
// Antes: enlace <a> que no envia auth headers
attachmentHtml = `
  <a href="${attachmentUrl}" target="_blank">Ver/Descargar Adjunto</a>
`;

// Despues: boton que llama funcion con fetch autenticado
attachmentHtml = `
  <button type="button" onclick="Views.directorAbsences.downloadAttachment('${attachmentRef}', '${fileName}')"
     style="display: inline-flex; align-items: center; gap: 0.5rem; ...">
    <span>📎</span>
    <span>Ver/Descargar Adjunto<br/><small>${fileName}</small></span>
  </button>
`;
```

#### Funcion downloadAttachment

```javascript
Views.directorAbsences.downloadAttachment = async function(attachmentRef, fileName) {
  if (!attachmentRef) {
    Components.showToast('No hay archivo adjunto', 'error');
    return;
  }

  try {
    Components.showToast('Descargando archivo...', 'info');

    // Build the URL for the photo endpoint
    // Note: API.baseUrl already includes /api/v1, so we just add /photos/
    const photoUrl = `/photos/${attachmentRef}`;

    // Make authenticated request using API's access token
    const response = await fetch(API.baseUrl + photoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API.accessToken}`,
        'X-Tenant': State.tenant || 'demo_local',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    // Get the blob from the response
    const blob = await response.blob();

    // Create a temporary URL for the blob
    const blobUrl = URL.createObjectURL(blob);

    // Determine content type for proper handling
    const contentType = response.headers.get('content-type') || '';

    // For PDFs and images, open in new tab
    if (contentType.includes('pdf') || contentType.includes('image')) {
      window.open(blobUrl, '_blank');
    } else {
      // For other files, trigger download
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || 'archivo';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    // Clean up the blob URL after a delay
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

    Components.showToast('Archivo descargado', 'success');
  } catch (error) {
    console.error('Error downloading attachment:', error);
    Components.showToast('Error al descargar: ' + error.message, 'error');
  }
};
```

### Flujo de Descarga

```
┌───────────────────────────────────────────────────────────┐
│                 Modal Detalle Solicitud                    │
├───────────────────────────────────────────────────────────┤
│  [Ver/Descargar Adjunto] ◄── Click                        │
│              │                                             │
│              ▼                                             │
│  downloadAttachment(attachmentRef, fileName)              │
│              │                                             │
│              ▼                                             │
│  fetch(API.baseUrl + '/photos/' + attachmentRef, {        │
│    headers: {                                              │
│      'Authorization': 'Bearer ' + API.accessToken,        │
│      'X-Tenant': 'demo_local'                             │
│    }                                                       │
│  })                                                        │
│              │                                             │
│              ▼                                             │
│  response.blob()  →  Blob URL                             │
│              │                                             │
│              ▼                                             │
│  content-type == 'pdf' || 'image'?                        │
│      ├── Si: window.open(blobUrl, '_blank')              │
│      └── No: <a download>.click()                         │
│              │                                             │
│              ▼                                             │
│  Toast: "Archivo descargado"                              │
│  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)   │
└───────────────────────────────────────────────────────────┘
```

### Bugs Corregidos Durante Implementacion

| Bug | Causa | Solucion |
|-----|-------|----------|
| URL duplicada `/api/v1/api/v1/...` | `API.baseUrl` ya incluye `/api/v1` | Cambiar path de `/api/v1/photos/` a `/photos/` |
| 403 Authentication required | Variable de token incorrecta | Cambiar `State.apiToken` a `API.accessToken` |

### Consideraciones

| Aspecto | Detalle |
|---------|---------|
| Memoria | Blob URL se libera automaticamente despues de 60s |
| Seguridad | Token JWT enviado en header, no expuesto en URL |
| UX | Toast informativo durante descarga |
| Compatibilidad | Funciona en todos los navegadores modernos |

---

## 13. Correccion Critica: SQLAlchemy Session Refresh

### Problema Reportado

Un tester encontro un error 500 al crear estudiantes:

```
sqlalchemy.exc.InvalidRequestError: Could not refresh instance '<Student at 0x1ee1cba36e0>'
```

### Causa Raiz

El patron `await session.commit()` seguido de `await session.refresh(obj)` puede fallar porque:

1. Despues del `commit()`, SQLAlchemy expira todos los objetos por defecto (`expire_on_commit=True`)
2. El objeto puede quedar "detached" de la sesion
3. El `refresh()` intenta recargar un objeto que ya no esta asociado a la sesion

### Solucion Implementada

Cambiar el patron de:

```python
await self.session.commit()
await self.session.refresh(student)  # Puede fallar
```

A:

```python
await self.session.commit()
# Re-fetch instead of refresh to avoid detached instance issues
student = await self.student_repo.get(student.id)
```

### Archivos Corregidos

| Servicio | Metodos Corregidos |
|----------|-------------------|
| `student_service.py` | `create_student`, `update_student`, `restore_student`, `upload_photo`, `delete_photo` |
| `teacher_service.py` | `create_teacher`, `update_teacher`, `restore_teacher` |
| `guardian_service.py` | `create_guardian`, `update_guardian`, `restore_guardian` |
| `course_service.py` | `create_course`, `update_course` |
| `absence_service.py` | `submit_request`, `create_absence`, `approve_absence`, `reject_absence`, `upload_attachment` |

### Impacto

- **Total de correcciones:** 18 lugares en 5 servicios
- **Criticidad:** Alta - Afectaba todas las operaciones de creacion/actualizacion
- **Regresion:** El bug era intermitente, dependia del estado de la sesion

---

## 14. Fix: Guardian Contacts Display en Modal de Estudiante

### Problema Reportado

Al abrir el modal de detalle de un estudiante en la vista del Director:

```
director_students.js:704 Uncaught (in promise) TypeError: g.contacts.map is not a function
```

### Causa Raiz

El codigo asumia que `guardian.contacts` era un array de objetos:

```javascript
// Codigo original (incorrecto)
${g.contacts.map(c => `${c.type}: ${c.value} ${c.verified ? '✅' : '⏳'}`).join(' | ')}
```

Pero el modelo Guardian define `contacts` como un **objeto JSON** (dict):

```python
# Guardian model
contacts: Mapped[dict] = mapped_column(JSON, default=lambda: {})
# Estructura real: {"email": "...", "phone": "...", "whatsapp": "..."}
```

### Solucion Implementada

**Archivo:** `src/web-app/js/views/director_students.js`

```javascript
// Helper to format contact type labels
const contactLabels = { email: 'Email', phone: 'Teléfono', whatsapp: 'WhatsApp' };
const formatContacts = (contacts) => {
  if (!contacts || typeof contacts !== 'object') return 'Sin contactos';
  const entries = Object.entries(contacts).filter(([_, v]) => v);
  if (entries.length === 0) return 'Sin contactos';
  return entries.map(([type, value]) =>
    `${contactLabels[type] || type}: ${Components.escapeHtml(String(value))}`
  ).join(' | ');
};

const guardiansHTML = guardians.map(g => `
  <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--color-gray-100);">
    <strong>${Components.escapeHtml(g.full_name)}</strong><br>
    <span style="font-size: 0.85rem; color: var(--color-gray-500);">
      ${formatContacts(g.contacts)}
    </span>
  </li>
`).join('');
```

### Mejoras Adicionales

- Validacion null-safe con `contacts || {}`
- Filtra valores vacios con `.filter(([_, v]) => v)`
- Escape de valores con `Components.escapeHtml()`
- Labels en español para tipos de contacto

---

## 15. Fix: MissingGreenlet en Creacion de Cursos

### Problema Reportado

Error 500 al crear un curso:

```
sqlalchemy.exc.MissingGreenlet: greenlet_spawn has not been called; can't call await_only() here.
Was IO attempted in an unexpected place?
```

### Causa Raiz

En el `course_service.py`, despues de crear un curso con `course_repo.create()`, se intentaba asignar profesores:

```python
course = await self.course_repo.create(name=..., grade=...)

if teachers:
    course.teachers = teachers  # <-- FALLA AQUI
```

El problema es que `course.teachers` no estaba inicializado. Al asignar una nueva lista, SQLAlchemy intenta primero cargar los valores existentes (lazy-load), pero esto falla en contexto async porque no hay un greenlet activo.

### Solucion Implementada

**Archivo:** `app/db/repositories/courses.py`

Inicializar las relaciones al crear el curso:

```python
async def create(self, *, name: str, grade: str) -> Course:
    course = Course(
        name=name.strip(),
        grade=grade.strip(),
        status=CourseStatus.ACTIVE.value,
    )
    # Initialize relationships to avoid lazy-load issues in async context
    course.teachers = []
    course.students = []
    course.schedules = []
    self.session.add(course)
    await self.session.flush()
    return course
```

### Por que Funciona

Al inicializar `course.teachers = []` ANTES de agregar el objeto a la sesion, SQLAlchemy marca la relacion como "loaded" (con una lista vacia). Cuando luego asignamos `course.teachers = teachers` en el servicio, SQLAlchemy ya tiene el valor actual en memoria y no necesita hacer lazy-load.

---

## 16. Fix: Mostrar Nombre de Apoderado en Kiosko

### Problema Reportado

En la pantalla de registro de salida del kiosko, se mostraba "Apoderado: No registrado" aunque el alumno sí tenía apoderados registrados.

### Causa Raiz

El schema `KioskStudentRead` no incluía el campo `guardian_name`, y el endpoint no cargaba la relación de apoderados:

```python
# Antes: No incluia guardian_name
class KioskStudentRead(BaseModel):
    id: int
    full_name: str
    course_id: int | None = None
    # ... sin guardian_name

# El endpoint no cargaba guardians
students_raw = await student_repo.list_all()  # Sin include_guardians
```

### Solucion Implementada

#### 1. Schema actualizado

**Archivo:** `app/api/v1/kiosk.py`

```python
class KioskStudentRead(BaseModel):
    """Student data for kiosk display."""
    id: int
    full_name: str
    course_id: int | None = None
    photo_url: str | None = None
    photo_pref_opt_in: bool = False
    evidence_preference: str = "none"
    # NUEVO: Guardian name for display on scan result
    guardian_name: str | None = None
```

#### 2. Repository actualizado

**Archivo:** `app/db/repositories/students.py`

```python
async def list_all(
    self, limit: int = 5000, *, include_guardians: bool = False
) -> list[Student]:
    stmt = select(Student).order_by(Student.full_name).limit(limit)
    if include_guardians:
        stmt = stmt.options(selectinload(Student.guardians))
    result = await self.session.execute(stmt)
    return list(result.scalars().all())
```

#### 3. Endpoints actualizados

```python
# En bootstrap y /students
students_raw = await student_repo.list_all(include_guardians=True)

for s in students_raw:
    # Get first guardian name for display
    guardian_name = None
    if s.guardians:
        guardian_name = s.guardians[0].full_name

    students.append(KioskStudentRead(
        # ... otros campos ...
        guardian_name=guardian_name,
    ))
```

### Nota

El kiosko necesita resincronizar para obtener los nuevos datos con el nombre del apoderado. Esto sucede automaticamente en el siguiente ciclo de sync, o se puede forzar manualmente desde el menu de administracion del kiosko.

---

## 17. Fix: Visualizacion de Fotos de Evidencia en Director Dashboard

### Problema

Al hacer clic en el boton "📷 Ver Fotos" o en el icono de foto de un evento individual, la imagen no cargaba y mostraba error 404:

```
GET /app/events/6730/abc123.jpg 404 (Not Found)
```

### Causa Raiz

El campo `photo_ref` contiene la ruta de almacenamiento en MinIO (ej: `events/6730/abc123.jpg`), pero el codigo lo estaba usando directamente como URL relativa, lo que resolvia a `/app/events/...` en lugar de pasar por el endpoint proxy de fotos.

### Solucion

**Archivo:** `src/web-app/js/views/director_dashboard.js`

#### 1. Nueva funcion `showEventPhoto()` para fotos individuales

```javascript
Views.directorDashboard.showEventPhoto = function(eventId) {
  const event = filteredEvents.find(e => e.id === eventId) || todayEvents.find(e => e.id === eventId);
  if (!event) {
    UI.showAlert('Evento no encontrado', 'error');
    return;
  }

  // Build full photo URL - photo_url may be presigned URL, photo_ref is storage key
  let photoUrl = event.photo_url;
  if (!photoUrl && event.photo_ref) {
    photoUrl = `${API.baseUrl}/photos/${event.photo_ref}`;
  }

  if (!photoUrl) {
    UI.showAlert('Este evento no tiene foto asociada', 'warning');
    return;
  }

  // ... modal display con carga async
};
```

#### 2. Correccion en `showPhotos()` para galeria de fotos

```javascript
// ANTES (incorrecto):
const photoUrl = event.photo_url || event.photo_ref;

// DESPUES (correcto):
let photoUrl = event.photo_url;
if (!photoUrl && event.photo_ref) {
  photoUrl = `${API.baseUrl}/photos/${event.photo_ref}`;
}
```

#### 3. Icono de foto clickeable por evento

```javascript
const hasPhoto = event.photo_url || event.photo_ref;
const photoCell = hasPhoto
  ? `<button class="btn btn-link" style="padding: 0; font-size: 1.2rem;"
       onclick="Views.directorDashboard.showEventPhoto(${event.id})"
       title="Ver foto">📷</button>`
  : '-';
```

### Resultado

- Las fotos ahora cargan correctamente a traves del endpoint `/api/v1/photos/{key:path}`
- El icono 📷 solo aparece en registros que tienen foto asociada
- Click en el icono abre un modal con la foto individual del evento
- El boton "Ver Fotos" sigue mostrando la galeria completa de fotos del dia

---

## 18. Fix: Lista Completa de Alumnos Sin Ingreso

### Problema

El modal "Ver Lista" de alumnos sin registro de ingreso solo mostraba los primeros 20 estudiantes. El boton "Ver todos en Reportes" no funcionaba correctamente y forzaba al usuario a generar un reporte cuando solo queria ver la lista completa.

### Requerimiento

- Mostrar TODOS los alumnos sin ingreso directamente en el modal
- Eliminar el boton que redirige a reportes
- Permitir scroll cuando hay muchos alumnos

### Solucion

**Archivo:** `src/web-app/js/views/director_dashboard.js`

#### Funcion `showNoIngressList()` reescrita

```javascript
Views.directorDashboard.showNoIngressList = function() {
  // Sort by course, then by name for better readability
  noIngressStudents.sort((a, b) => {
    const courseA = courses.find(c => c.id === a.course_id);
    const courseB = courses.find(c => c.id === b.course_id);
    const courseNameA = courseA ? courseA.name : 'ZZZ';
    const courseNameB = courseB ? courseB.name : 'ZZZ';
    if (courseNameA !== courseNameB) {
      return courseNameA.localeCompare(courseNameB);
    }
    return a.full_name.localeCompare(b.full_name);
  });

  const listHTML = `
    <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--color-gray-200); border-radius: 8px;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead style="position: sticky; top: 0; background: var(--color-gray-50); z-index: 1;">
          <tr>
            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--color-gray-200);">Alumno</th>
            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--color-gray-200);">Curso</th>
          </tr>
        </thead>
        <tbody>
          ${noIngressStudents.map(s => {
            const course = courses.find(c => c.id === s.course_id);
            return `<tr style="border-bottom: 1px solid var(--color-gray-100);">
              <td style="padding: 0.75rem;">${s.full_name}</td>
              <td style="padding: 0.75rem;">${course ? course.name : 'Sin curso'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  UI.showModal(
    `Alumnos sin registro de ingreso (${noIngressStudents.length})`,
    listHTML,
    [{ text: 'Cerrar', class: 'btn-secondary', onclick: 'UI.closeModal()' }]
  );
};
```

### Cambios Clave

| Antes | Despues |
|-------|---------|
| `.slice(0, 20)` limitaba a 20 alumnos | Sin limite, muestra todos |
| Lista plana sin organizacion | Ordenada por curso y luego por nombre |
| Boton "Ver todos en Reportes" | Solo boton "Cerrar" |
| Sin scroll | Container con `max-height: 400px` y `overflow-y: auto` |
| Headers se desplazan | Headers sticky que permanecen visibles |

### Resultado

- El modal ahora muestra la lista completa de alumnos sin ingreso
- Los alumnos estan agrupados visualmente por curso
- El scroll permite navegar listas largas sin perder los encabezados
- UX simplificada sin redirecciones innecesarias

---

## 19. Fix Critico: Workers Multi-Tenant para Notificaciones

### Problema Reportado

Al enviar un broadcast (comunicado masivo) a un curso, los emails no llegaban a los destinatarios. Los logs mostraban:

```
Broadcast enqueued job_id=%s recipients=%d subject=%s
```

Pero luego aparecia el error:

```
Notification %s not found
```

### Diagnostico

1. **Worker container no estaba corriendo** - Solo scheduler, rq-dashboard, postgres, minio y redis estaban activos
2. **Despues de iniciar el worker**, aparecio el error real: las notificaciones se creaban en el schema del tenant (`tenant_demo_local`) pero el worker las buscaba en el schema `public`

### Causa Raiz

Los background workers usaban `async_session()` que conecta al schema `public` por defecto:

```python
# En send_email.py (antes)
async with async_session() as session:
    notification = await session.get(Notification, notification_id)
    # notification = None porque busca en public, no en tenant_demo_local
```

### Solucion Implementada

Propagar `tenant_id` y `tenant_schema` a traves de toda la cadena de jobs:

#### 1. BroadcastService

**Archivo:** `app/services/broadcast_service.py`

```python
class BroadcastService:
    def __init__(self, session, tenant_id: int | None = None, tenant_schema: str | None = None):
        self.session = session
        self.tenant_id = tenant_id
        self.tenant_schema = tenant_schema

    async def enqueue_broadcast(self, payload: BroadcastCreate) -> str:
        # ... existing code ...
        self.queue.enqueue(
            "app.workers.jobs.process_broadcast.process_broadcast_job",
            {
                "job_id": job_id,
                "payload": payload.model_dump(),
                "guardian_ids": guardian_ids,
                "tenant_id": self.tenant_id,        # NUEVO
                "tenant_schema": self.tenant_schema, # NUEVO
            },
            job_id=job_id,
        )
```

#### 2. Dependencies

**Archivo:** `app/core/deps.py`

```python
async def get_broadcast_service(
    request: Request,
    session: AsyncSession = Depends(get_tenant_db),
) -> BroadcastService:
    # MT-WORKER-FIX: Pass tenant context for background job processing
    tenant = getattr(request.state, "tenant", None)
    tenant_id = tenant.id if tenant else None
    tenant_schema = getattr(request.state, "tenant_schema", None)
    return BroadcastService(session, tenant_id=tenant_id, tenant_schema=tenant_schema)

async def get_notification_dispatcher(
    request: Request,
    session: AsyncSession = Depends(get_tenant_db),
) -> NotificationDispatcher:
    # MT-WORKER-FIX: Pass tenant context for background job processing
    tenant = getattr(request.state, "tenant", None)
    tenant_id = tenant.id if tenant else None
    tenant_schema = getattr(request.state, "tenant_schema", None)
    return NotificationDispatcher(session, tenant_id=tenant_id, tenant_schema=tenant_schema)
```

#### 3. Process Broadcast Job

**Archivo:** `app/workers/jobs/process_broadcast.py`

```python
from contextlib import asynccontextmanager
from app.db.session import async_session, get_tenant_session

@asynccontextmanager
async def _get_session(tenant_schema: str | None):
    """Get session with proper tenant context for worker jobs."""
    if tenant_schema:
        async for session in get_tenant_session(tenant_schema):
            yield session
            return
    async with async_session() as session:
        yield session

async def _process(job_payload: dict) -> None:
    tenant_id = job_payload.get("tenant_id")
    tenant_schema = job_payload.get("tenant_schema")

    async with _get_session(tenant_schema) as session:
        dispatcher = NotificationDispatcher(
            session,
            tenant_id=tenant_id,
            tenant_schema=tenant_schema
        )
        # ... process notifications
```

#### 4. NotificationDispatcher

**Archivo:** `app/services/notifications/dispatcher.py`

```python
class NotificationDispatcher:
    def __init__(self, session, tenant_id: int | None = None, tenant_schema: str | None = None):
        self.session = session
        self.tenant_id = tenant_id
        self.tenant_schema = tenant_schema

    async def enqueue_manual_notification(self, payload) -> NotificationRead:
        # ... create notification ...

        # MT-WORKER-FIX: Pass tenant context so worker can find notification
        job_args = (
            notification.id,
            recipient,
            payload.template.value,
            payload.variables,
            self.tenant_id,      # NUEVO
            self.tenant_schema,  # NUEVO
        )
        self._queue.enqueue(job_func, *job_args)
```

#### 5. Send Email Job

**Archivo:** `app/workers/jobs/send_email.py`

```python
@asynccontextmanager
async def _get_session(tenant_schema: str | None):
    """MT-WORKER-FIX: Get session with proper tenant context."""
    if tenant_schema:
        async for session in get_tenant_session(tenant_schema):
            yield session
            return
    async with async_session() as session:
        yield session

async def _send(
    notification_id: int,
    to: str,
    template: str,
    variables: dict,
    tenant_id: int | None = None,
    tenant_schema: str | None = None,
) -> None:
    # MT-WORKER-FIX: Use tenant session to find notification
    async with _get_session(tenant_schema) as session:
        notification = await session.get(Notification, notification_id)
        # Ahora encuentra la notificacion en el schema correcto
```

#### 6. Send WhatsApp Job

**Archivo:** `app/workers/jobs/send_whatsapp.py`

Mismo patron que `send_email.py` - agregado `_get_session()` y parametros de tenant.

### Diagrama del Flujo Corregido

```
┌─────────────────────────────────────────────────────────────────────┐
│                      API Request (con X-Tenant header)               │
├─────────────────────────────────────────────────────────────────────┤
│  request.state.tenant = Tenant(id=1)                                │
│  request.state.tenant_schema = "tenant_demo_local"                  │
│                              │                                       │
│                              ▼                                       │
│              BroadcastService(session, tenant_id=1,                 │
│                              tenant_schema="tenant_demo_local")     │
│                              │                                       │
│                              ▼                                       │
│              RQ Job Payload:                                         │
│              {                                                       │
│                "job_id": "...",                                     │
│                "tenant_id": 1,                                      │
│                "tenant_schema": "tenant_demo_local"                 │
│              }                                                       │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Worker (background process)                     │
├─────────────────────────────────────────────────────────────────────┤
│  process_broadcast_job(payload)                                     │
│                              │                                       │
│                              ▼                                       │
│  tenant_schema = payload["tenant_schema"]  # "tenant_demo_local"   │
│  session = get_tenant_session(tenant_schema)                        │
│                              │                                       │
│                              ▼                                       │
│  SET search_path TO tenant_demo_local  ◄── Session con schema       │
│                              │                                       │
│                              ▼                                       │
│  notification = session.get(Notification, id)  ✓ ENCONTRADA         │
│                              │                                       │
│                              ▼                                       │
│  [SMTP] Email sent to=lo**********@gmail.com                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Archivos Modificados

```
Backend (6 archivos):
- app/services/broadcast_service.py       - +10 lineas (tenant context)
- app/core/deps.py                        - +12 lineas (extract tenant from request)
- app/workers/jobs/process_broadcast.py   - +20 lineas (tenant session)
- app/services/notifications/dispatcher.py - +8 lineas (pass tenant to jobs)
- app/workers/jobs/send_email.py          - +15 lineas (tenant session)
- app/workers/jobs/send_whatsapp.py       - +15 lineas (tenant session)
```

---

## 20. Configuracion SMTP para Worker y Tenant

### Problema

Despues del fix multi-tenant, los logs mostraban:

```
[SES:tenant=%s] Dry-run email to=%s
```

Indicando que:
1. El worker estaba en modo dry-run (`ENABLE_REAL_NOTIFICATIONS=false`)
2. El tenant estaba configurado para usar SES en lugar de SMTP

### Solucion Parte 1: docker-compose.local.yml

Se agregaron las variables de entorno SMTP al servicio worker:

**Archivo:** `docker-compose.local.yml`

```yaml
worker:
  environment:
    # ... existing vars ...
    # Email configuration (SMTP with Gmail)
    EMAIL_PROVIDER: smtp
    SMTP_HOST: smtp.gmail.com
    SMTP_PORT: "587"
    SMTP_USER: contacto@gocode.homes
    SMTP_PASSWORD: ${SMTP_PASSWORD}  # Referencia a .env
    SMTP_USE_TLS: "true"
    SMTP_FROM_NAME: Sistema de Asistencia
    ENABLE_REAL_NOTIFICATIONS: "true"  # Cambio de false a true
```

### Solucion Parte 2: Configuracion SMTP por Tenant

El sistema soporta configuracion SMTP por tenant, con el password encriptado usando Fernet:

```bash
# 1. Encriptar el password SMTP dentro del worker container
docker-compose -f docker-compose.local.yml exec -T worker python -c "
from app.core.encryption import encrypt
import os
smtp_password = os.environ.get('SMTP_PASSWORD', '')
encrypted = encrypt(smtp_password)
print(f'Encrypted (hex): {encrypted.hex()}')
"

# 2. Actualizar tenant_configs con el password encriptado
docker-compose -f docker-compose.local.yml exec -T postgres psql \
  -U school_attendance -d school_attendance -c "
UPDATE tenant_configs SET
  email_provider = 'smtp',
  smtp_host = 'smtp.gmail.com',
  smtp_port = 587,
  smtp_user = 'contacto@gocode.homes',
  smtp_password_encrypted = decode('<hex_from_step_1>', 'hex'),
  smtp_use_tls = true,
  smtp_from_name = 'Sistema de Asistencia'
WHERE tenant_id = 1;
"
```

### Verificacion de Configuracion

```sql
SELECT tenant_id, email_provider, smtp_host, smtp_port, smtp_user,
       smtp_use_tls, smtp_from_name, length(smtp_password_encrypted) as pwd_len
FROM tenant_configs WHERE tenant_id = 1;

-- Resultado:
-- tenant_id | email_provider |   smtp_host    | smtp_port |       smtp_user       | smtp_use_tls |    smtp_from_name     | pwd_len
-- ----------+----------------+----------------+-----------+-----------------------+--------------+-----------------------+---------
--         1 | smtp           | smtp.gmail.com |       587 | contacto@gocode.homes | t            | Sistema de Asistencia |     120
```

### Flujo de Seleccion de Cliente Email

```python
# app/workers/jobs/send_email.py

# 1. Si hay tenant_id, intenta usar config del tenant
if tenant_id:
    config = await config_repo.get_decrypted(tenant_id)
    if config and config.email_provider == "smtp" and config.smtp_user:
        client = TenantSMTPEmailClient(config)  # Usa credenciales del tenant

# 2. Fallback a configuracion global
if client is None:
    if settings.email_provider == "smtp":
        client = SMTPEmailClient()  # Usa credenciales de .env
    elif settings.email_provider == "ses":
        client = SESEmailClient()
```

### Resultado Final

Logs del worker despues del fix:

```
17:37:58 notifications: app.workers.jobs.send_email.send_email_message(
  6695, 'lorelynp@gmail.com', 'BROADCAST', {...}, 1, 'tenant_demo_local')

17:37:59 | DEBUG | Using tenant SMTP client for tenant_id=1
17:38:02 | INFO  | [SMTP:tenant=1] Email sent to=lo**********@gmail.com
17:38:02 | INFO  | [Worker] Email sent notification_id=6695 to=lorelynp@gmail.com
17:38:02 Successfully completed job in 0:00:04.178416s
17:38:02 notifications: Job OK
```

### Archivos Modificados

```
Configuracion (1 archivo):
- docker-compose.local.yml  - +8 lineas (SMTP env vars para worker)

Base de datos:
- tenant_configs (UPDATE)   - email_provider, smtp_*, smtp_password_encrypted
```

---

## Resumen de la Sesion

| Seccion | Tipo | Descripcion |
|---------|------|-------------|
| 1-11 | Feature | Modulo completo de ausencias para Director |
| 12 | Fix | Descarga de adjuntos con autenticacion |
| 13 | Fix Critico | SQLAlchemy session refresh |
| 14 | Fix | Guardian contacts display |
| 15 | Fix | MissingGreenlet en cursos |
| 16 | Fix | Nombre de apoderado en kiosko |
| 17 | Fix | Visualizacion de fotos en Director |
| 18 | Fix | Lista completa sin ingreso |
| 19 | Fix Critico | Workers multi-tenant para notificaciones |
| 20 | Config | SMTP para worker y tenant |

---

*Completado el 16 de Enero de 2026*
