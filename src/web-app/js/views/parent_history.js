// Parent History
Views.parentHistory = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout('parent');

  const content = document.getElementById('view-content');

  if (!State.currentGuardianId) {
    content.innerHTML = Components.createEmptyState('Error', 'No hay apoderado seleccionado');
    return;
  }

  const students = State.getGuardianStudents(State.currentGuardianId);
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Get student from URL if present
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const selectedStudentId = urlParams.get('student');

  // Security: Validate that the requested student belongs to this guardian
  // This prevents guardians from accessing other students' data via URL manipulation
  const allowedStudentIds = new Set(students.map(s => s.id));
  let filteredStudentId;

  if (selectedStudentId) {
    const parsedId = parseInt(selectedStudentId);
    // Only use the URL parameter if the student belongs to this guardian
    filteredStudentId = allowedStudentIds.has(parsedId) ? parsedId : (students[0]?.id || null);
  } else {
    filteredStudentId = students[0]?.id || null;
  }
  let startDate = weekAgo;
  let endDate = today;

  function renderHistory() {
    content.innerHTML = `
      <h2 class="mb-3">Historial de Asistencia</h2>

      <div class="filters">
        <div class="filter-group">
          <label class="form-label">Alumno</label>
          <select id="student-select" class="form-select">
            ${students.map(s => `
              <option value="${s.id}" ${s.id === filteredStudentId ? 'selected' : ''}>
                ${Components.escapeHtml(s.full_name)}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="filter-group">
          <label class="form-label">Desde</label>
          <input type="date" id="date-start" class="form-input" value="${startDate}">
        </div>

        <div class="filter-group">
          <label class="form-label">Hasta</label>
          <input type="date" id="date-end" class="form-input" value="${endDate}">
        </div>

        <div class="filter-group">
          <label class="form-label">&nbsp;</label>
          <button class="btn btn-primary" onclick="Views.parentHistory.applyFilters()">Filtrar</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Eventos Registrados</div>
        <div class="card-body" id="history-table"></div>
      </div>
    `;

    renderEventsTable();
  }

  function renderEventsTable() {
    const tableDiv = document.getElementById('history-table');

    if (!filteredStudentId) {
      tableDiv.innerHTML = Components.createEmptyState('Sin datos', 'Seleccione un alumno');
      return;
    }

    const events = State.getAttendanceEvents({ studentId: filteredStudentId })
      .filter(e => {
        const eventDate = e.ts.split('T')[0];
        return eventDate >= startDate && eventDate <= endDate;
      });

    if (events.length === 0) {
      tableDiv.innerHTML = Components.createEmptyState('Sin eventos', 'No hay eventos en el rango seleccionado');
      return;
    }

    const headers = ['Fecha', 'Tipo', 'Hora', 'Puerta', 'Foto'];
    const rows = events.map(event => {
      const typeChip = event.type === 'IN'
        ? Components.createChip('Ingreso', 'success')
        : Components.createChip('Salida', 'info');
      const photoIcon = event.photo_ref ? '📷' : '-';

      return [
        Components.formatDate(event.ts),
        typeChip,
        Components.formatTime(event.ts),
        event.gate_id,
        photoIcon
      ];
    });

    tableDiv.innerHTML = Components.createTable(headers, rows, { perPage: 20 });
  }

  Views.parentHistory.applyFilters = function() {
    filteredStudentId = parseInt(document.getElementById('student-select').value);
    startDate = document.getElementById('date-start').value;
    endDate = document.getElementById('date-end').value;

    renderEventsTable();
    Components.showToast('Filtros aplicados', 'success');
  };

  renderHistory();
};
