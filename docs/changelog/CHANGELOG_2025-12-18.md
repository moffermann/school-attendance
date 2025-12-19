# Changelog - 18 de Diciembre 2025

## Resumen Ejecutivo

Se completaron dos mejoras significativas en el sistema de asistencia escolar:
1. **Asignación de profesores a cursos** - Nueva funcionalidad CRUD
2. **Integración del módulo de horarios** - Conexión frontend-backend (fix crítico)

---

## 1. Cursos: Asignación de Profesores

### Descripción
Se implementó la capacidad de asignar profesores a cursos durante la creación y edición de los mismos.

### Archivos Modificados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `app/schemas/courses.py` | Backend | Agregado campo `teacher_ids` al schema `CourseCreate` |
| `app/services/course_service.py` | Backend | Lógica para asignar/actualizar profesores en `create_course` y `update_course` |
| `src/web-app/js/views/director_courses.js` | Frontend | Selector múltiple de profesores en formularios crear/editar |

### Funcionalidades Agregadas
- Selector múltiple de profesores en formulario de **crear curso**
- Selector múltiple de profesores en formulario de **editar curso** (con preselección de asignados)
- Validación de profesores existentes antes de asignar
- Soporte para selección múltiple (Ctrl/Cmd + click)

### Capturas de Pantalla
- Formulario muestra lista de profesores disponibles
- Los profesores ya asignados aparecen preseleccionados en edición

---

## 2. Horarios: Integración Frontend-Backend

### Descripción
El módulo de horarios tenía el backend completamente implementado, pero el frontend **nunca llamaba a la API** - solo guardaba en localStorage. Se corrigió esta desconexión.

### Problema Crítico Detectado y Corregido

**Mapeo de días de la semana incorrecto:**

| Sistema | Lunes | Martes | Miércoles | Jueves | Viernes |
|---------|-------|--------|-----------|--------|---------|
| Backend (ISO 8601) | 0 | 1 | 2 | 3 | 4 |
| Frontend (antes) | 1 | 2 | 3 | 4 | 5 |

**Impacto:** Un horario guardado para "Lunes" en el frontend se almacenaba como "Martes" en la base de datos.

**Solución:** Se cambió el frontend a convención ISO 8601 (0=Lunes).

### Archivos Modificados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/web-app/js/views/director_schedules.js` | Frontend | Corregido mapeo weekday, función `saveSchedule` async con validaciones |
| `src/web-app/js/api.js` | Frontend | Agregado `createSchedule`, corregida URL `getSchedules`, mejor manejo de errores HTTP |
| `src/web-app/js/state.js` | Frontend | Nuevos métodos async `createSchedule` y `updateSchedule` con soporte API |
| `src/web-app/css/styles.css` | Frontend | Clase `.border-warning` para indicador visual |

### Mejoras Implementadas

#### Validaciones en Frontend
- Campos requeridos (ambos horarios deben completarse)
- Formato HH:MM válido
- Hora de salida debe ser posterior a hora de entrada

#### UX Mejorada
- Campos vacíos para horarios no guardados (antes mostraba 08:00-16:00 confundiendo al usuario)
- Indicador visual (borde amarillo punteado) para horarios no guardados
- Botón muestra "Guardando..." durante operación
- Mensajes de error específicos por código HTTP (403, 404, 422)

#### Modo Dual (Demo vs API)
- `State.isApiAuthenticated()` determina el modo
- **Modo Demo:** funciona con localStorage (para desarrollo sin backend)
- **Modo API:** persiste en PostgreSQL via backend

### Flujo de Datos Corregido

```
Usuario hace clic en "Guardar"
         ↓
Validaciones frontend (formato, lógica)
         ↓
┌─────────────────────────┐
│ ¿Horario existente?     │
└─────────┬───────────────┘
     ↓              ↓
   (no)          (sí)
     ↓              ↓
POST /schedules/   PUT /schedules/{id}
courses/{id}
     ↓              ↓
     └──────┬───────┘
            ↓
      PostgreSQL
            ↓
   Actualizar State local
            ↓
   Toast "Horario guardado"
```

---

## Testing Recomendado

### Cursos
- [ ] Crear curso con profesores asignados
- [ ] Editar curso y cambiar profesores
- [ ] Verificar que profesores aparecen en detalle del curso

### Horarios
- [ ] Crear horario para Lunes → verificar en DB que `weekday=0`
- [ ] Crear horario para Viernes → verificar en DB que `weekday=4`
- [ ] Actualizar horario existente
- [ ] Refresh página → horarios persisten
- [ ] Validar error si hora salida < hora entrada

---

## Estadísticas

| Métrica | Valor |
|---------|-------|
| Archivos modificados | 7 |
| Líneas de código agregadas | ~250 |
| Bugs críticos corregidos | 1 (mapeo weekday) |
| Nuevos endpoints usados | 2 (POST/PUT schedules) |

---

## Próximos Pasos Sugeridos

1. **Excepciones de horario:** El CRUD de excepciones también está solo en localStorage
2. **Tests automatizados:** Agregar tests para validar mapeo de días
3. **Auditoría:** Revisar datos existentes en DB por posible corrupción del mapeo anterior

---

*Generado el 18 de Diciembre de 2025*
