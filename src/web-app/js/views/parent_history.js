// Parent History - Historial de Asistencia
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
  const allowedStudentIds = new Set(students.map(s => s.id));
  let filteredStudentId;

  if (selectedStudentId) {
    const parsedId = parseInt(selectedStudentId);
    filteredStudentId = allowedStudentIds.has(parsedId) ? parsedId : (students[0]?.id || null);
  } else {
    filteredStudentId = students[0]?.id || null;
  }
  let startDate = weekAgo;
  let endDate = today;

  function renderHistory() {
    const selectedStudent = students.find(s => s.id === filteredStudentId);
    const course = selectedStudent ? State.getCourse(selectedStudent.course_id) : null;

    content.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <a href="#/parent/home" class="btn btn-secondary btn-sm" style="margin-bottom: 1rem;">
          ← Volver al inicio
        </a>
        <h2 style="font-size: 1.75rem; font-weight: 700; color: var(--color-gray-900); margin-bottom: 0.5rem;">
          Historial de Asistencia
        </h2>
        ${selectedStudent ? `
          <p style="color: var(--color-gray-500);">
            ${selectedStudent.full_name} ${course ? `- ${course.name}` : ''}
          </p>
        ` : ''}
      </div>

      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; align-items: end;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Alumno</label>
              <select id="student-select" class="form-select">
                ${students.map(s => {
                  const c = State.getCourse(s.course_id);
                  return `
                    <option value="${s.id}" ${s.id === filteredStudentId ? 'selected' : ''}>
                      ${Components.escapeHtml(s.full_name)} ${c ? `(${c.name})` : ''}
                    </option>
                  `;
                }).join('')}
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Desde</label>
              <input type="date" id="date-start" class="form-input" value="${startDate}">
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Hasta</label>
              <input type="date" id="date-end" class="form-input" value="${endDate}">
            </div>

            <div>
              <button class="btn btn-primary w-full" onclick="Views.parentHistory.applyFilters()">
                ${Components.icons.history}
                Buscar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <span>Eventos Registrados</span>
          <span id="event-count" style="font-size: 0.85rem; font-weight: 400; color: var(--color-gray-500);"></span>
        </div>
        <div class="card-body" id="history-table" style="padding: 0;"></div>
      </div>
    `;

    renderEventsTable();
  }

  function renderEventsTable() {
    const tableDiv = document.getElementById('history-table');
    const countSpan = document.getElementById('event-count');

    if (!filteredStudentId) {
      tableDiv.innerHTML = `<div style="padding: 2rem;">${Components.createEmptyState('Sin datos', 'Seleccione un alumno')}</div>`;
      return;
    }

    const events = State.getAttendanceEvents({ studentId: filteredStudentId })
      .filter(e => {
        const eventDate = e.ts.split('T')[0];
        return eventDate >= startDate && eventDate <= endDate;
      })
      .sort((a, b) => new Date(b.ts) - new Date(a.ts));

    if (countSpan) {
      countSpan.textContent = `${events.length} evento${events.length !== 1 ? 's' : ''}`;
    }

    if (events.length === 0) {
      tableDiv.innerHTML = `<div style="padding: 2rem;">${Components.createEmptyState('Sin eventos', 'No hay eventos en el rango seleccionado')}</div>`;
      return;
    }

    // Responsive: Cards en móvil, tabla en desktop
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      tableDiv.innerHTML = `
        <div style="padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
          ${events.map(event => {
            const isIn = event.type === 'IN';
            const bgColor = isIn ? 'var(--color-success-light)' : 'var(--color-info-light)';
            const iconColor = isIn ? 'var(--color-success)' : 'var(--color-info)';
            const icon = isIn ? '📥' : '📤';
            const label = isIn ? 'Ingreso' : 'Salida';

            return `
              <div style="background: white; border: 1px solid var(--color-gray-200); border-radius: 12px; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                <div style="width: 48px; height: 48px; background: ${bgColor}; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                  ${icon}
                </div>
                <div style="flex: 1;">
                  <div style="font-weight: 600; color: var(--color-gray-900);">${label}</div>
                  <div style="font-size: 0.85rem; color: var(--color-gray-500);">
                    ${Components.formatDate(event.ts)} a las ${Components.formatTime(event.ts)}
                  </div>
                  <div style="font-size: 0.8rem; color: var(--color-gray-400);">
                    Puerta: ${event.gate_id} ${(event.photo_url || event.photo_ref) ? '• 📷 Con foto' : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      const headers = ['Fecha', 'Tipo', 'Hora', 'Puerta', 'Foto'];
      const rows = events.map(event => {
        const typeChip = event.type === 'IN'
          ? Components.createChip('Ingreso', 'success')
          : Components.createChip('Salida', 'info');
        // TDD-BUG5 fix: Check photo_url (presigned URL) with photo_ref fallback
        const photoIcon = (event.photo_url || event.photo_ref) ? '📷' : '-';

        return [
          Components.formatDate(event.ts),
          typeChip,
          Components.formatTime(event.ts),
          event.gate_id,
          photoIcon
        ];
      });

      tableDiv.innerHTML = `<div style="padding: 0;">${Components.createTable(headers, rows, { perPage: 15 })}</div>`;
    }
  }

  Views.parentHistory.applyFilters = function() {
    filteredStudentId = parseInt(document.getElementById('student-select').value);
    startDate = document.getElementById('date-start').value;
    endDate = document.getElementById('date-end').value;

    renderEventsTable();
    Components.showToast('Filtros aplicados', 'success');
  };

  // R10-W1 fix: Store resize handler for cleanup
  let resizeTimeout;
  const resizeHandler = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(renderEventsTable, 250);
  };
  window.addEventListener('resize', resizeHandler);

  // R10-W1 fix: Cleanup function to remove listener on navigation
  Views.parentHistory.cleanup = function() {
    window.removeEventListener('resize', resizeHandler);
    clearTimeout(resizeTimeout);
  };

  renderHistory();
};
