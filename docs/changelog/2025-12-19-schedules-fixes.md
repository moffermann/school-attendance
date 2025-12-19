# Changelog - 19 de Diciembre 2025

## Módulo de Horarios - Rediseño Completo de UI + Fixes Críticos

### Resumen Ejecutivo

Se realizó un **rediseño completo de la interfaz** del módulo de horarios junto con múltiples correcciones críticas:

**Mejoras de Interfaz (UI/UX):**
- Nuevo Time Picker Modal moderno con grid visual de horas/minutos
- Tarjetas de días con estados visuales (guardado/no guardado)
- Sistema de presets de horarios comunes
- Animaciones de feedback visual
- Diseño responsive para móviles

**Fixes Críticos:**
- Bug crítico: horarios no se mostraban después de recargar página
- Prevención de duplicados en base de datos
- Nuevo botón "Guardar todos" para mejor UX
- Corrección de error JavaScript en time picker

---

## 0. REDISEÑO COMPLETO DE INTERFAZ DE HORARIOS

### Antes vs Después

**ANTES:** Inputs de tiempo nativos del navegador, sin feedback visual, diseño básico, el usuario debia escribir el horario de entrada y salida en cada dia.

**DESPUÉS:** Interfaz moderna con time picker personalizado, tarjetas por día, estados visuales y animaciones.

### 0.1 Time Picker Modal Personalizado

Se creó un selector de hora modal con diseño moderno que reemplaza el input nativo del navegador.

**Archivo:** `src/web-app/js/views/director_schedules.js`

```javascript
function createTimePickerModal() {
  const modal = document.createElement('div');
  modal.className = 'time-picker-overlay';
  modal.id = 'time-picker-modal';
  modal.innerHTML = `
    <div class="time-picker-container">
      <div class="time-picker-header">
        <span class="time-picker-title">Seleccionar Hora</span>
        <button class="time-picker-close" onclick="Views.directorSchedules.closeTimePicker()">×</button>
      </div>

      <!-- Display de hora seleccionada -->
      <div class="time-picker-display">
        <span id="tp-hour">08</span>:<span id="tp-minute">00</span>
      </div>

      <!-- Presets de horarios comunes -->
      <div class="time-picker-presets">
        <span class="presets-label">Rápido:</span>
        <button class="tp-preset" onclick="Views.directorSchedules.setPresetTime('07:00')">07:00</button>
        <button class="tp-preset" onclick="Views.directorSchedules.setPresetTime('07:30')">07:30</button>
        <button class="tp-preset" onclick="Views.directorSchedules.setPresetTime('08:00')">08:00</button>
        <!-- ... más presets ... -->
      </div>

      <!-- Grid de horas (06-21) -->
      <div class="time-picker-body">
        <div class="time-picker-section">
          <label>Hora</label>
          <div class="hours-grid">
            ${Array.from({length: 16}, (_, i) => i + 6).map(h =>
              `<button class="tp-btn tp-hour" data-value="${h}">${String(h).padStart(2, '0')}</button>`
            ).join('')}
          </div>
        </div>

        <!-- Grid de minutos (00, 05, 10, ..., 55) -->
        <div class="time-picker-section">
          <label>Minutos</label>
          <div class="minutes-grid">
            ${Array.from({length: 12}, (_, i) => i * 5).map(m =>
              `<button class="tp-btn tp-minute" data-value="${m}">${String(m).padStart(2, '0')}</button>`
            ).join('')}
          </div>
        </div>
      </div>

      <!-- Botones de acción -->
      <div class="time-picker-actions">
        <button class="btn btn-secondary" onclick="Views.directorSchedules.closeTimePicker()">Cancelar</button>
        <button class="btn btn-primary" onclick="Views.directorSchedules.confirmTimePicker()">Confirmar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}
```

### 0.2 Tarjetas de Días con Estados Visuales

Cada día de la semana se muestra en una tarjeta con indicadores visuales de estado.

```javascript
function renderSchedules() {
  const courses = State.getCourses();

  content.innerHTML = courses.map(course => {
    const schedules = State.getSchedules().filter(s => s.course_id === course.id);

    return `
      <div class="schedule-course-card">
        <!-- Header del curso con botones de acción masiva -->
        <div class="schedule-course-header">
          <h3 class="schedule-course-title">
            <svg><!-- icono --></svg>
            ${course.name}
          </h3>
          <div class="schedule-bulk-actions">
            <button class="btn btn-sm btn-success" onclick="Views.directorSchedules.saveAllSchedules(${course.id})">
              Guardar todos
            </button>
            <button class="btn btn-sm btn-danger-outline" onclick="Views.directorSchedules.deleteAllSchedules(${course.id})">
              Borrar todos
            </button>
          </div>
        </div>

        <!-- Grid de 5 días -->
        <div class="schedule-grid-container">
          <div class="schedule-grid">
            ${[0,1,2,3,4].map(weekday => {
              const schedule = schedules.find(s => s.weekday === weekday);
              const hasSchedule = schedule && schedule.id;

              return `
                <div class="schedule-day-card ${hasSchedule ? 'saved' : 'unsaved'}"
                     data-course="${course.id}" data-weekday="${weekday}">

                  <!-- Header del día con badge de estado -->
                  <div class="schedule-day-header">
                    <span class="day-name">${weekdays[weekday]}</span>
                    <span class="schedule-day-badge ${hasSchedule ? 'saved' : 'unsaved'}">
                      ${hasSchedule ? 'Guardado' : 'Sin guardar'}
                    </span>
                  </div>

                  <!-- Inputs de hora -->
                  <div class="schedule-times">
                    <div class="time-input-group">
                      <label>Entrada</label>
                      <input type="text" class="schedule-time-input"
                             value="${schedule?.in_time || ''}"
                             data-field="in_time"
                             data-schedule-id="${schedule?.id || ''}"
                             onclick="Views.directorSchedules.openTimePicker(this)"
                             readonly>
                    </div>
                    <div class="time-input-group">
                      <label>Salida</label>
                      <input type="text" class="schedule-time-input"
                             value="${schedule?.out_time || ''}"
                             data-field="out_time"
                             onclick="Views.directorSchedules.openTimePicker(this)"
                             readonly>
                    </div>
                  </div>

                  <!-- Botones de acción por día -->
                  <div class="schedule-day-actions">
                    <button class="btn-icon btn-save" title="Guardar">💾</button>
                    <button class="btn-icon btn-copy" title="Copiar a siguientes">📋</button>
                    <button class="btn-icon btn-delete" title="Borrar">🗑️</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}
```

### 0.3 Estilos CSS Modernos

**Archivo:** `src/web-app/css/styles.css` (~800 líneas nuevas)

#### Time Picker Modal
```css
/* Overlay con blur de fondo */
.time-picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: none;
  align-items: center;
  justify-content: center;
}

.time-picker-overlay.show {
  display: flex;
}

/* Contenedor principal */
.time-picker-container {
  background: white;
  border-radius: var(--border-radius-xl);
  box-shadow: var(--shadow-xl);
  max-width: 380px;
  width: 100%;
  animation: modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Display grande de hora */
.time-picker-display {
  text-align: center;
  padding: var(--spacing-xl);
  background: linear-gradient(135deg, var(--color-primary-50), var(--color-gray-50));
  font-size: 3rem;
  font-weight: 700;
  color: var(--color-primary);
}

/* Grid de botones de hora */
.hours-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
}

.minutes-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

/* Botón de hora/minuto */
.tp-btn {
  padding: var(--spacing-sm);
  border: 1px solid var(--color-gray-200);
  background: white;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tp-btn.active {
  background: var(--gradient-primary);
  color: white;
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

/* Presets de horarios */
.tp-preset {
  padding: var(--spacing-xs) var(--spacing-md);
  background: white;
  border: 1px solid var(--color-gray-200);
  border-radius: var(--border-radius-full);
  font-weight: 600;
  cursor: pointer;
}

.tp-preset:hover {
  background: var(--color-primary-50);
  color: var(--color-primary);
}
```

#### Tarjetas de Días
```css
/* Tarjeta de día */
.schedule-day-card {
  background: var(--color-gray-50);
  border-radius: var(--border-radius-lg);
  padding: var(--spacing-lg);
  border: 2px solid var(--color-gray-200);
  transition: all var(--transition-base);
}

/* Estado: Guardado */
.schedule-day-card.saved {
  background: white;
  border-color: var(--color-success);
  border-style: solid;
}

/* Estado: Sin guardar */
.schedule-day-card.unsaved {
  background: linear-gradient(135deg, var(--color-gray-50), white);
  border-color: var(--color-warning);
  border-style: dashed;
}

/* Estado: Guardando */
.schedule-day-card.saving {
  opacity: 0.7;
  pointer-events: none;
}

/* Badge de estado */
.schedule-day-badge.saved {
  background: var(--color-success-light);
  color: #065f46;
}

.schedule-day-badge.unsaved {
  background: var(--color-warning-light);
  color: #92400e;
}
```

#### Animaciones de Feedback
```css
/* Animación cuando se actualiza hora */
@keyframes timeUpdated {
  0%, 100% {
    transform: scale(1);
    border-color: var(--color-gray-200);
  }
  50% {
    transform: scale(1.02);
    border-color: var(--color-success);
    background: var(--color-success-light);
  }
}

.schedule-time-input.time-updated {
  animation: timeUpdated 0.5s ease;
}

/* Animación de copiado */
@keyframes copied {
  50% {
    transform: scale(1.02);
    border-color: var(--color-success);
    background: var(--color-success-light);
  }
}

.schedule-day-card.copied {
  animation: copied 0.5s ease;
}

/* Animación de error */
@keyframes shake {
  20%, 60% { transform: translateX(-5px); }
  40%, 80% { transform: translateX(5px); }
}

.schedule-day-card.shake {
  animation: shake 0.5s ease;
}
```

#### Responsive para Móviles
```css
@media (max-width: 768px) {
  .schedule-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .hours-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .time-picker-display {
    font-size: 2.5rem;
  }

  /* Mostrar nombre corto del día */
  .day-name { display: none; }
  .day-short { display: block; }
}

@media (max-width: 480px) {
  .schedule-grid {
    grid-template-columns: 1fr;
  }

  .day-name { display: block; }
  .day-short { display: none; }
}
```

### 0.4 Funcionalidades Adicionales

#### Copiar horario a días siguientes
```javascript
Views.directorSchedules.copyToNext = function(courseId, weekday) {
  const sourceCard = document.querySelector(`.schedule-day-card[data-course="${courseId}"][data-weekday="${weekday}"]`);
  const inTime = sourceCard.querySelector('[data-field="in_time"]').value;
  const outTime = sourceCard.querySelector('[data-field="out_time"]').value;

  if (!inTime || !outTime) {
    Components.showToast('Primero ingrese un horario válido', 'warning');
    return;
  }

  // Copiar a días siguientes (weekday+1 hasta viernes)
  for (let i = weekday + 1; i < 5; i++) {
    const targetCard = document.querySelector(`.schedule-day-card[data-course="${courseId}"][data-weekday="${i}"]`);
    targetCard.querySelector('[data-field="in_time"]').value = inTime;
    targetCard.querySelector('[data-field="out_time"]').value = outTime;
    targetCard.classList.add('copied');
    setTimeout(() => targetCard.classList.remove('copied'), 500);
  }

  Components.showToast(`Horario copiado a ${4 - weekday} día(s)`, 'success');
};
```

#### Borrar horario de un día
```javascript
Views.directorSchedules.clearDay = function(courseId, weekday) {
  const card = document.querySelector(`.schedule-day-card[data-course="${courseId}"][data-weekday="${weekday}"]`);
  const inTimeInput = card.querySelector('[data-field="in_time"]');
  const outTimeInput = card.querySelector('[data-field="out_time"]');

  inTimeInput.value = '';
  outTimeInput.value = '';
  inTimeInput.dataset.scheduleId = '';
  outTimeInput.dataset.scheduleId = '';

  card.classList.remove('saved');
  card.classList.add('unsaved');

  Components.showToast(`Horario del ${weekdays[weekday]} borrado`, 'success');
};
```

### Capturas de Pantalla

#### Time Picker Modal
```
┌─────────────────────────────────────┐
│  Seleccionar Hora              [X]  │
├─────────────────────────────────────┤
│                                     │
│            08 : 30                  │
│                                     │
├─────────────────────────────────────┤
│ Rápido: [07:00] [07:30] [08:00] ... │
├─────────────────────────────────────┤
│ Hora                                │
│ [06][07][08][09][10][11]            │
│ [12][13][14][15][16][17]            │
│ [18][19][20][21]                    │
├─────────────────────────────────────┤
│ Minutos                             │
│ [00][05][10][15]                    │
│ [20][25][30][35]                    │
│ [40][45][50][55]                    │
├─────────────────────────────────────┤
│  [Cancelar]         [Confirmar]     │
└─────────────────────────────────────┘
```

#### Tarjetas de Días
```
┌─────────────────────────────────────────────────────────────────┐
│ 📚 1° Básico A                    [Guardar todos] [Borrar todos]│
├─────────────────────────────────────────────────────────────────┤
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐        │
│ │ Lunes     │ │ Martes    │ │ Miércoles │ │ Jueves    │ ...    │
│ │ ✓Guardado │ │ ✓Guardado │ │ ⚠Sin guard│ │ ⚠Sin guard│        │
│ │           │ │           │ │           │ │           │        │
│ │ Entrada   │ │ Entrada   │ │ Entrada   │ │ Entrada   │        │
│ │ [08:00]   │ │ [08:00]   │ │ [--:--]   │ │ [--:--]   │        │
│ │           │ │           │ │           │ │           │        │
│ │ Salida    │ │ Salida    │ │ Salida    │ │ Salida    │        │
│ │ [16:00]   │ │ [16:00]   │ │ [--:--]   │ │ [--:--]   │        │
│ │           │ │           │ │           │ │           │        │
│ │ [💾][📋][🗑]│ │ [💾][📋][🗑]│ │ [💾][📋][🗑]│ │ [💾][📋][🗑]│        │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Impacto UX

| Aspecto | Antes | Después |
|---------|-------|---------|
| Selección de hora | Input nativo (varía por navegador) | Modal consistente con grid visual |
| Feedback de guardado | Ninguno | Badge + borde de color + animación |
| Acciones masivas | No existía | "Guardar todos", "Borrar todos" |
| Copiar horarios | No existía | Botón para copiar a días siguientes |
| Responsive | Básico | Grid adaptativo + nombres cortos |
| Presets | No existía | 8 horarios comunes con un clic |

---

## 1. BUG CRÍTICO: Horarios no se cargan después de recargar página

### Problema Detectado

Los horarios creados para cursos **sin estudiantes asignados** no aparecían en la interfaz después de recargar la página, a pesar de existir correctamente en la base de datos.

**Síntoma:** Usuario crea horario para "3° Básico A" → Guarda exitosamente → Recarga página → Horarios aparecen vacíos.

**Verificación en DB:** Los horarios SÍ existían en PostgreSQL:
```sql
SELECT s.id, c.name, s.weekday, s.in_time, s.out_time
FROM schedules s JOIN courses c ON s.course_id = c.id
WHERE c.id = 12;

 id |    curso    | weekday | in_time  | out_time
----+-------------+---------+----------+----------
 44 | 3° Básico A |       0 | 08:30:00 | 17:00:00
 45 | 3° Básico A |       1 | 08:30:00 | 17:00:00
 ...
```

### Causa Raíz

En `app/services/web_app_service.py`, el método `_load_schedules()` solo cargaba horarios para cursos que tenían estudiantes asignados:

```python
# CÓDIGO ANTERIOR (con bug)
async def _load_schedules(self, course_ids: set[int]) -> list[Schedule]:
    if not course_ids:  # Si no hay cursos con estudiantes, retorna vacío
        return []
    stmt = (
        select(Schedule)
        .where(Schedule.course_id.in_(course_ids))  # Solo cursos con estudiantes
        ...
    )
```

El flujo del bootstrap era:
1. Cargar estudiantes → obtener `course_ids` de estudiantes
2. Cargar horarios solo para esos `course_ids`
3. **Cursos sin estudiantes quedaban excluidos**

### Solución Implementada

Se modificó `_load_schedules()` para que usuarios staff (ADMIN, DIRECTOR, INSPECTOR) vean horarios de **todos** los cursos:

**Archivo:** `app/services/web_app_service.py` (líneas 141-149)

```python
# CÓDIGO CORREGIDO
async def _load_schedules(self, course_ids: set[int], is_staff: bool) -> list[Schedule]:
    stmt = select(Schedule).order_by(Schedule.course_id, Schedule.weekday)
    # Staff users see all schedules; non-staff only see schedules for their courses
    if not is_staff:
        if not course_ids:
            return []
        stmt = stmt.where(Schedule.course_id.in_(course_ids))
    result = await self.session.execute(stmt)
    return list(result.scalars().all())
```

También se actualizó la llamada en `build_bootstrap_payload()`:

```python
# Línea 74
schedules = await self._load_schedules(course_ids, is_staff)
```

### Impacto
- Usuarios ADMIN/DIRECTOR/INSPECTOR ahora ven horarios de todos los cursos
- Usuarios PARENT siguen viendo solo horarios de cursos de sus hijos
- No hay cambios en permisos de edición

---

## 2. Prevención de Duplicados en Horarios

### Problema Detectado

Al guardar horarios múltiples veces, se creaban registros duplicados en la base de datos:

```sql
SELECT * FROM schedules WHERE course_id = 11;
 id | course_id | weekday | in_time  | out_time
----+-----------+---------+----------+----------
 28 |        11 |       0 | 08:00:00 | 16:00:00
 33 |        11 |       0 | 08:00:00 | 16:00:00  -- DUPLICADO
 29 |        11 |       1 | 08:00:00 | 16:00:00
 34 |        11 |       1 | 08:00:00 | 16:00:00  -- DUPLICADO
```

### Solución Implementada

#### 2.1 Constraint en Base de Datos

**Archivo:** `app/db/models/schedule.py`

```python
class Schedule(Base):
    __tablename__ = "schedules"
    __table_args__ = (
        UniqueConstraint("course_id", "weekday", name="uq_schedule_course_weekday"),
    )
    # ... resto del modelo
```

#### 2.2 Método de búsqueda para Upsert

**Archivo:** `app/db/repositories/schedules.py` (líneas 27-34)

```python
async def get_by_course_and_weekday(self, course_id: int, weekday: int) -> Schedule | None:
    """Get schedule by course_id and weekday for upsert operations."""
    stmt = select(Schedule).where(
        Schedule.course_id == course_id,
        Schedule.weekday == weekday
    )
    result = await self.session.execute(stmt)
    return result.scalar_one_or_none()
```

#### 2.3 Lógica Upsert en Servicio

**Archivo:** `app/services/schedule_service.py` (líneas 23-43)

```python
async def create_schedule(self, course_id: int, payload: ScheduleCreate) -> ScheduleRead:
    # Upsert: check if schedule exists for this course_id + weekday
    existing = await self.repository.get_by_course_and_weekday(course_id, payload.weekday)
    if existing:
        # Update existing schedule
        schedule = await self.repository.update(
            existing.id,
            weekday=payload.weekday,
            in_time=payload.in_time,
            out_time=payload.out_time,
        )
    else:
        # Create new schedule
        schedule = await self.repository.create(
            course_id,
            weekday=payload.weekday,
            in_time=payload.in_time,
            out_time=payload.out_time,
        )
    await self.session.commit()
    return ScheduleRead.model_validate(schedule, from_attributes=True)
```

### Impacto
- Imposible crear duplicados a nivel de DB (constraint)
- API hace upsert automático (actualiza si existe, crea si no)
- Datos históricos duplicados fueron limpiados manualmente

---

## 3. Nuevo Botón "Guardar Todos"

### Requerimiento

El usuario debe hacer clic en "Guardar" 5 veces (una por cada día) para guardar un horario completo. Se solicitó un botón que guarde todos los días de una vez.

### Implementación

**Archivo:** `src/web-app/js/views/director_schedules.js` (líneas 457-566)

```javascript
// Guardar todos los horarios de un curso
Views.directorSchedules.saveAllSchedules = async function(courseId) {
  const saveAllBtn = document.querySelector(`.schedule-course-card .btn-success[onclick*="saveAllSchedules(${courseId})"]`);
  if (saveAllBtn) {
    saveAllBtn.disabled = true;
    saveAllBtn.innerHTML = `
      <svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"></circle>
      </svg>
      Guardando...
    `;
  }

  let savedCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let weekday = 0; weekday < 5; weekday++) {
    const card = document.querySelector(`.schedule-day-card[data-course="${courseId}"][data-weekday="${weekday}"]`);
    const inTimeInput = card.querySelector('[data-field="in_time"]');
    const outTimeInput = card.querySelector('[data-field="out_time"]');

    const inTime = inTimeInput.value;
    const outTime = outTimeInput.value;

    // Saltar días sin horarios
    if (!inTime || !outTime) continue;

    // Validación de formato HH:MM
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(inTime) || !timeRegex.test(outTime)) {
      errors.push(`${weekdays[weekday]}: Formato de hora inválido`);
      errorCount++;
      continue;
    }

    // Validación lógica de horas
    if (outTime <= inTime) {
      errors.push(`${weekdays[weekday]}: Hora de salida debe ser posterior a entrada`);
      errorCount++;
      continue;
    }

    // Guardar el día
    const scheduleId = inTimeInput.dataset.scheduleId || null;

    try {
      const scheduleData = {
        weekday: weekday,
        in_time: inTime,
        out_time: outTime
      };

      if (scheduleId) {
        await State.updateSchedule(scheduleId, scheduleData);
      } else {
        const newSchedule = await State.createSchedule(courseId, scheduleData);
        inTimeInput.dataset.scheduleId = newSchedule.id;
        outTimeInput.dataset.scheduleId = newSchedule.id;
      }

      // Actualizar estado visual
      card.classList.remove('unsaved');
      card.classList.add('saved');
      savedCount++;
    } catch (error) {
      errors.push(`${weekdays[weekday]}: ${error.message || 'Error al guardar'}`);
      errorCount++;
    }
  }

  // Restaurar botón y mostrar resumen
  if (saveAllBtn) {
    saveAllBtn.disabled = false;
    saveAllBtn.innerHTML = `...Guardar todos`;
  }

  if (savedCount === 0 && errorCount === 0) {
    Components.showToast('No hay horarios para guardar', 'info');
  } else if (errorCount > 0) {
    Components.showToast(`${savedCount} guardados, ${errorCount} errores`, 'warning');
  } else {
    Components.showToast(`${savedCount} horarios guardados exitosamente`, 'success');
  }
};
```

### CSS para animación de carga

**Archivo:** `src/web-app/css/styles.css` (líneas 148-154)

```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spin {
  animation: spin 0.8s linear infinite;
}
```

---

## 4. Fix: Error JavaScript "activeTimePicker is null"

### Problema Detectado

Error en consola al confirmar selección de hora:
```
Uncaught TypeError: can't access property "classList", activeTimePicker is null
```

### Causa Raíz

En `confirmTimePicker()`, el código llamaba a `closeTimePicker()` que setea `activeTimePicker = null`, y luego intentaba usar `activeTimePicker` en el `setTimeout`:

```javascript
// CÓDIGO ANTERIOR (con bug)
Views.directorSchedules.confirmTimePicker = function() {
  if (activeTimePicker) {
    activeTimePicker.value = `${hour}:${minute}`;
    activeTimePicker.classList.add('time-updated');
    setTimeout(() => activeTimePicker.classList.remove('time-updated'), 500);
    // ↑ ERROR: activeTimePicker ya es null cuando se ejecuta el setTimeout
  }
  Views.directorSchedules.closeTimePicker(); // Esto setea activeTimePicker = null
};
```

### Solución Implementada

**Archivo:** `src/web-app/js/views/director_schedules.js` (líneas 138-151)

```javascript
// CÓDIGO CORREGIDO
Views.directorSchedules.confirmTimePicker = function() {
  if (activeTimePicker) {
    const hour = document.getElementById('tp-hour').textContent;
    const minute = document.getElementById('tp-minute').textContent;
    activeTimePicker.value = `${hour}:${minute}`;
    activeTimePicker.dispatchEvent(new Event('change'));

    // Guardar referencia ANTES de que closeTimePicker la anule
    const inputElement = activeTimePicker;
    inputElement.classList.add('time-updated');
    setTimeout(() => inputElement.classList.remove('time-updated'), 500);
  }
  Views.directorSchedules.closeTimePicker();
};
```

### Impacto
- Eliminado error de consola
- Animación visual de confirmación funciona correctamente

---

## Archivos Modificados

| Archivo | Tipo de Cambio |
|---------|----------------|
| `app/services/web_app_service.py` | Fix bootstrap horarios |
| `app/db/models/schedule.py` | UniqueConstraint |
| `app/db/repositories/schedules.py` | Método upsert |
| `app/services/schedule_service.py` | Lógica upsert |
| `src/web-app/js/views/director_schedules.js` | Botón guardar todos + fix JS |
| `src/web-app/css/styles.css` | Animación spin |

---

## Testing Realizado

- [x] Crear horario para curso sin estudiantes → Verificado en DB
- [x] Recargar página → Horarios persisten correctamente
- [x] Guardar todos los días con un clic → Funciona
- [x] No se crean duplicados → Verificado con constraint
- [x] Sin errores en consola JavaScript

---

## Notas Técnicas

### Convención de Días (ISO 8601)
- **Backend:** `weekday` 0-6 donde 0=Lunes, 6=Domingo
- **Frontend:** Usa misma convención después del fix anterior

### Patrón Upsert
El servicio implementa "upsert" (UPDATE or INSERT):
1. Busca si existe horario para (course_id, weekday)
2. Si existe → UPDATE
3. Si no existe → INSERT

Esto evita duplicados y simplifica el código del frontend.
