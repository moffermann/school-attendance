# Reportes de "No Ingreso"

## Objetivo
Identificar estudiantes que no registraron ingreso dentro de la ventana de tolerancia y brindar herramientas a Dirección/Inspectoría para seguimiento y comunicación proactiva.

## Métricas clave
- **Total de alertas por curso** (diario/semanal).
- **Tiempo promedio de regularización** (desde alerta hasta primer IN).
- **Alertas resueltas vs. pendientes**.
- **Top cursos / alumnos con reincidencia**.

## Panel diario (por implementar)
1. Filtro por fecha y curso.
2. Tabla agrupada con:
   - Estudiante
   - Curso
   - Hora esperada de ingreso
   - Hora de alerta
   - Estado (pendiente/regulado)
   - Responsable de seguimiento
3. Exportación CSV/Excel.
4. Notas/bitácora por estudiante (acciones tomadas). ✅
5. Resumen visual de alertas activas/resueltas. ✅

## Fuente de datos
- Tabla `attendance_events`: búsqueda de eventos IN por fecha.
- Horarios de `schedules` + excepciones.
- Tabla puente `student_guardians` para notificaciones.
- Tabla `no_show_alerts` (nueva) con estado, timestamps y bitácora.
- Log de `notifications` para corroborar alertas enviadas.

## Próximos pasos
1. Persistir alertas en una tabla dedicada (`no_show_alerts`) con estado y timestamps.
2. Crear servicio/endpoint (`GET /api/v1/alerts/no-entry`) con filtros y paginación.
3. Construir vista Jinja con resumen + exportación en `docs/reporting/no_ingreso.md`.
4. Integrar con broadcast automatizado (recordatorio masivo) si persiste el estado.
