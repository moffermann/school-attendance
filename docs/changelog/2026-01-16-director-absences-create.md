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

> **Nota**: El formulario de Parent (`parent_absences.js`) aun usa `State.addAbsence()` que guarda en estado local, no en el API. Esto es un trabajo pendiente para futuras sesiones.

---

*Completado el 16 de Enero de 2026*
