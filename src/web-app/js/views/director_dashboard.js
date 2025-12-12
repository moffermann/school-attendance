// Director Dashboard - Live events
Views.directorDashboard = function() {
  const app = document.getElementById('app');
  const stats = State.getTodayStats();
  const todayEvents = State.getTodayEvents();

  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Tablero en Vivo';

  let currentPage = 1;
  let filteredEvents = [...todayEvents];
  let filters = { course: '', type: '', search: '' };

  // Stat card con icono y color personalizado
  function createEnhancedStatCard(label, value, icon, colorClass) {
    const colors = {
      primary: { bg: 'var(--gradient-primary)', light: 'var(--color-primary-50)' },
      success: { bg: 'var(--gradient-success)', light: 'var(--color-success-light)' },
      warning: { bg: 'var(--gradient-warning)', light: 'var(--color-warning-light)' },
      error: { bg: 'var(--gradient-error)', light: 'var(--color-error-light)' }
    };
    const color = colors[colorClass] || colors.primary;

    return `
      <div class="stat-card" style="position: relative;">
        <div style="position: absolute; top: 1rem; right: 1rem; width: 48px; height: 48px; background: ${color.light}; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
          ${icon}
        </div>
        <div class="stat-label">${Components.escapeHtml(label)}</div>
        <div class="stat-value">${Components.escapeHtml(String(value))}</div>
      </div>
    `;
  }

  function renderDashboard() {
    const courses = State.getCourses();
    const todayFormatted = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

    content.innerHTML = `
      <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
          <p style="color: var(--color-gray-500); font-size: 0.9rem; text-transform: capitalize;">${todayFormatted}</p>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <span style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: var(--color-success-light); color: #065f46; border-radius: 9999px; font-size: 0.8rem; font-weight: 600;">
            <span style="width: 8px; height: 8px; background: var(--color-success); border-radius: 50%; animation: pulse 2s infinite;"></span>
            En vivo
          </span>
        </div>
      </div>

      <div class="cards-grid">
        ${createEnhancedStatCard('Ingresos Hoy', stats.totalIn, '📥', 'success')}
        ${createEnhancedStatCard('Salidas Hoy', stats.totalOut, '📤', 'primary')}
        ${createEnhancedStatCard('Atrasos', stats.lateCount, '⏰', 'warning')}
        ${createEnhancedStatCard('Sin Ingreso', stats.noInCount, '❌', 'error')}
      </div>

      ${stats.noInCount > 0 ? `
      <!-- Alerta destacada de alumnos sin ingreso -->
      <div class="card" style="background: linear-gradient(135deg, var(--color-error-light) 0%, #fff 100%); border-left: 4px solid var(--color-error); margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 2rem;">🚨</span>
            <div>
              <strong style="color: var(--color-error-dark); font-size: 1.1rem;">${stats.noInCount} alumno${stats.noInCount > 1 ? 's' : ''} sin registro de entrada</strong>
              <p style="margin: 0.25rem 0 0; font-size: 0.9rem; color: var(--color-gray-600);">
                Estos alumnos no han registrado ingreso hoy.
              </p>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="Views.directorDashboard.showNoIngressList()">
              👁️ Ver Lista
            </button>
            <button class="btn btn-primary btn-sm" onclick="Router.navigate('/director/reports?filter=no-ingress')">
              📊 Ir a Reportes
            </button>
          </div>
        </div>
      </div>
      ` : ''}

      <div class="card">
        <div class="card-header flex justify-between items-center">
          <span style="font-size: 1.1rem;">Eventos de Hoy</span>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="Views.directorDashboard.exportCSV()">
              ${Components.icons.reports}
              Exportar CSV
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Views.directorDashboard.showPhotos()">
              📷 Ver Fotos
            </button>
          </div>
        </div>

        <div class="filters">
          <div class="filter-group">
            <label class="form-label">Curso</label>
            <select id="filter-course" class="form-select">
              <option value="">Todos los cursos</option>
              ${courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>

          <div class="filter-group">
            <label class="form-label">Tipo de Evento</label>
            <select id="filter-type" class="form-select">
              <option value="">Todos</option>
              <option value="IN">Ingreso</option>
              <option value="OUT">Salida</option>
            </select>
          </div>

          <div class="filter-group">
            <label class="form-label">Buscar alumno</label>
            <input type="text" id="filter-search" class="form-input" placeholder="Escriba un nombre...">
          </div>

          <div class="filter-group">
            <label class="form-label">&nbsp;</label>
            <button class="btn btn-primary" onclick="Views.directorDashboard.applyFilters()">
              Aplicar Filtros
            </button>
          </div>
        </div>

        <div class="card-body">
          <div id="events-table"></div>
        </div>
      </div>

      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      </style>
    `;

    renderEventsTable();
  }

  function renderEventsTable() {
    const tableDiv = document.getElementById('events-table');

    if (filteredEvents.length === 0) {
      tableDiv.innerHTML = Components.createEmptyState(
        'Sin eventos',
        filters.course || filters.type || filters.search
          ? 'No hay eventos que coincidan con los filtros seleccionados'
          : 'No hay eventos registrados hoy'
      );
      return;
    }

    const headers = ['Alumno', 'Curso', 'Tipo', 'Puerta', 'Hora', 'Foto'];
    const rows = filteredEvents.map(event => {
      const student = State.getStudent(event.student_id);
      const course = State.getCourse(student?.course_id);
      const typeChip = event.type === 'IN'
        ? Components.createChip('Ingreso', 'success')
        : Components.createChip('Salida', 'info');
      // TDD-BUG5 fix: Check photo_url (presigned URL) with photo_ref fallback
      const photoIcon = (event.photo_url || event.photo_ref) ? '📷' : '-';

      return [
        student ? Components.escapeHtml(student.full_name) : '-',
        course ? Components.escapeHtml(course.name) : '-',
        typeChip,
        event.gate_id,
        Components.formatTime(event.ts),
        photoIcon
      ];
    });

    tableDiv.innerHTML = Components.createTable(headers, rows, {
      perPage: 20,
      currentPage,
      onPageChange: 'Views.directorDashboard.changePage'
    });
  }

  // Public methods
  Views.directorDashboard.changePage = function(page) {
    currentPage = page;
    renderEventsTable();
  };

  Views.directorDashboard.applyFilters = function() {
    filters.course = document.getElementById('filter-course').value;
    filters.type = document.getElementById('filter-type').value;
    filters.search = document.getElementById('filter-search').value.toLowerCase();

    filteredEvents = todayEvents.filter(event => {
      const student = State.getStudent(event.student_id);

      if (filters.course && student.course_id !== parseInt(filters.course)) {
        return false;
      }

      if (filters.type && event.type !== filters.type) {
        return false;
      }

      if (filters.search && !student.full_name.toLowerCase().includes(filters.search)) {
        return false;
      }

      return true;
    });

    currentPage = 1;
    renderEventsTable();
    Components.showToast('Filtros aplicados', 'success');
  };

  Views.directorDashboard.exportCSV = function() {
    Components.showToast('Exportando CSV... (simulado)', 'info');
  };

  Views.directorDashboard.showPhotos = function() {
    // TDD-BUG5 fix: Check photo_url (presigned URL) with photo_ref fallback
    const eventsWithPhotos = filteredEvents.filter(e => e.photo_url || e.photo_ref);
    const photosHTML = eventsWithPhotos.slice(0, 6).map(e => {
      const student = State.getStudent(e.student_id);
      return `
        <div class="card" style="margin-bottom: 1rem;">
          <div class="card-body">
            <strong>${student.full_name}</strong> - ${Components.formatTime(e.ts)}
            <div style="margin-top: 0.5rem;">
              <img src="assets/placeholder_photo.svg" alt="Foto" style="max-width: 200px; border-radius: 4px;">
            </div>
          </div>
        </div>
      `;
    }).join('');

    Components.showModal('Fotos de Evidencia', `
      <div>${photosHTML || '<p>No hay fotos disponibles</p>'}</div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);
  };

  // UX #10: Show list of students without entry today
  Views.directorDashboard.showNoIngressList = function() {
    const students = State.getStudents();
    const todayStr = new Date().toISOString().split('T')[0];

    // Get students who have NOT registered IN today
    const studentsWithIN = new Set(
      todayEvents
        .filter(e => e.type === 'IN')
        .map(e => e.student_id)
    );

    const noIngressStudents = students.filter(s => !studentsWithIN.has(s.id));

    const listHTML = noIngressStudents.length > 0
      ? `
        <table style="width: 100%;">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Curso</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${noIngressStudents.slice(0, 20).map(s => {
              const course = State.getCourse(s.course_id);
              return `
                <tr>
                  <td>${Components.escapeHtml(s.full_name)}</td>
                  <td>${course ? Components.escapeHtml(course.name) : '-'}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="Router.navigate('/director/students?view=${s.id}')">
                      Ver Perfil
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        ${noIngressStudents.length > 20 ? `<p style="margin-top: 1rem; text-align: center; color: var(--color-gray-500);">... y ${noIngressStudents.length - 20} más. <a href="#" onclick="Router.navigate('/director/reports?filter=no-ingress'); return false;">Ver todos en Reportes</a></p>` : ''}
      `
      : '<p>Todos los alumnos han registrado entrada hoy. ✅</p>';

    Components.showModal(`🚨 Alumnos Sin Ingreso (${noIngressStudents.length})`, `
      <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--color-warning-light); border-radius: 8px; font-size: 0.9rem;">
        <strong>💡 Nota:</strong> Estos alumnos no tienen registro de entrada el día de hoy (${new Date().toLocaleDateString('es-CL')}).
      </div>
      ${listHTML}
    `, [
      { label: 'Ir a Reportes', action: () => Router.navigate('/director/reports?filter=no-ingress'), className: 'btn-primary' },
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);
  };

  renderDashboard();
};
