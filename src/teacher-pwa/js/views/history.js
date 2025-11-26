Views.history = async function() {
  if (!State.currentCourseId) {
    Router.navigate('/classes');
    return;
  }

  const app = document.getElementById('app');
  const queue = await IDB.getAll('queue');
  const students = await IDB.getAll('students');
  const courses = await IDB.getAll('courses');
  const currentCourse = courses.find(c => c.id === State.currentCourseId);

  // Get filter params from URL or use defaults
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const dateFilter = params.get('date') || new Date().toISOString().split('T')[0];
  const typeFilter = params.get('type') || 'all';

  // Filter events
  let courseEvents = queue.filter(e => e.course_id === State.currentCourseId);

  // Filter by date
  if (dateFilter) {
    courseEvents = courseEvents.filter(e => e.ts && e.ts.startsWith(dateFilter));
  }

  // Filter by type
  if (typeFilter !== 'all') {
    courseEvents = courseEvents.filter(e => e.type === typeFilter);
  }

  // Calculate stats
  const stats = {
    total: courseEvents.length,
    in: courseEvents.filter(e => e.type === 'IN').length,
    out: courseEvents.filter(e => e.type === 'OUT').length,
    synced: courseEvents.filter(e => e.status === 'synced').length,
    pending: courseEvents.filter(e => e.status === 'pending').length,
    errors: courseEvents.filter(e => e.status === 'error').length,
  };

  // Group by student for summary
  const studentStats = {};
  courseEvents.forEach(e => {
    if (!studentStats[e.student_id]) {
      studentStats[e.student_id] = { in: null, out: null, student_id: e.student_id };
    }
    if (e.type === 'IN' && (!studentStats[e.student_id].in || e.ts > studentStats[e.student_id].in)) {
      studentStats[e.student_id].in = e.ts;
    }
    if (e.type === 'OUT' && (!studentStats[e.student_id].out || e.ts > studentStats[e.student_id].out)) {
      studentStats[e.student_id].out = e.ts;
    }
  });

  const courseName = currentCourse ? UI.escapeHtml(currentCourse.name) : 'Curso';

  app.innerHTML = `
    ${UI.createHeader('Historial - ' + courseName)}
    <div class="container" style="padding-bottom:80px">
      <!-- Filters -->
      <div class="card mb-2">
        <div class="card-header">Filtros</div>
        <div class="flex gap-2 flex-wrap">
          <div class="form-group" style="flex: 1; min-width: 140px;">
            <label class="form-label">Fecha</label>
            <input type="date" id="filter-date" class="form-input" value="${dateFilter}">
          </div>
          <div class="form-group" style="flex: 1; min-width: 120px;">
            <label class="form-label">Tipo</label>
            <select id="filter-type" class="form-select">
              <option value="all" ${typeFilter === 'all' ? 'selected' : ''}>Todos</option>
              <option value="IN" ${typeFilter === 'IN' ? 'selected' : ''}>Entrada</option>
              <option value="OUT" ${typeFilter === 'OUT' ? 'selected' : ''}>Salida</option>
            </select>
          </div>
          <div class="form-group" style="align-self: flex-end;">
            <button class="btn btn-primary" onclick="Views.history.applyFilters()">Filtrar</button>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid mb-2">
        <div class="stat-card">
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat-card stat-success">
          <div class="stat-value">${stats.in}</div>
          <div class="stat-label">Entradas</div>
        </div>
        <div class="stat-card stat-info">
          <div class="stat-value">${stats.out}</div>
          <div class="stat-label">Salidas</div>
        </div>
        <div class="stat-card ${stats.pending > 0 ? 'stat-warning' : ''}">
          <div class="stat-value">${stats.pending}</div>
          <div class="stat-label">Pendientes</div>
        </div>
      </div>

      <!-- Student Summary -->
      <div class="card mb-2">
        <div class="card-header">Resumen por Alumno (${Object.keys(studentStats).length})</div>
        <div class="student-summary-list">
          ${Object.values(studentStats).map(stat => {
            const student = students.find(s => s.id === stat.student_id);
            const safeName = UI.escapeHtml(student?.full_name || 'Alumno #' + stat.student_id);
            const inTime = stat.in ? UI.formatTime(stat.in) : '-';
            const outTime = stat.out ? UI.formatTime(stat.out) : '-';
            return `
              <div class="student-summary-item">
                <span class="student-name">${safeName}</span>
                <span class="student-times">
                  <span class="time-in" title="Entrada">🟢 ${inTime}</span>
                  <span class="time-out" title="Salida">🔴 ${outTime}</span>
                </span>
              </div>
            `;
          }).join('')}
          ${Object.keys(studentStats).length === 0 ? '<div class="text-center text-muted p-2">Sin registros</div>' : ''}
        </div>
      </div>

      <!-- Events Table -->
      <div class="card">
        <div class="card-header">Detalle de Eventos</div>
        <table>
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Tipo</th>
              <th>Hora</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${courseEvents.slice(-100).reverse().map(e => {
              const student = students.find(s => s.id === e.student_id);
              const safeName = UI.escapeHtml(student?.full_name || String(e.student_id));
              return `
                <tr>
                  <td>${safeName}</td>
                  <td>${UI.createChip(e.type, e.type === 'IN' ? 'success' : 'info')}</td>
                  <td>${UI.formatTime(e.ts)}</td>
                  <td>${UI.createChip(e.status, e.status === 'synced' ? 'success' : e.status === 'error' ? 'error' : 'warning')}</td>
                </tr>
              `;
            }).join('')}
            ${courseEvents.length === 0 ? '<tr><td colspan="4" class="text-center">Sin eventos para esta fecha</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>
    ${UI.createBottomNav('/history')}
  `;

  // Setup filter handlers
  document.getElementById('filter-date')?.addEventListener('change', () => Views.history.applyFilters());
  document.getElementById('filter-type')?.addEventListener('change', () => Views.history.applyFilters());
};

Views.history.applyFilters = function() {
  const date = document.getElementById('filter-date')?.value || '';
  const type = document.getElementById('filter-type')?.value || 'all';
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (type !== 'all') params.set('type', type);
  window.location.hash = '#/history?' + params.toString();
  Views.history();
};
