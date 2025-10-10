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

  function renderDashboard() {
    const courses = State.getCourses();

    content.innerHTML = `
      <div class="cards-grid">
        ${Components.createStatCard('Ingresos Hoy', stats.totalIn)}
        ${Components.createStatCard('Salidas Hoy', stats.totalOut)}
        ${Components.createStatCard('Atrasos', stats.lateCount)}
        ${Components.createStatCard('Sin Ingreso', stats.noInCount)}
      </div>

      <div class="card">
        <div class="card-header flex justify-between items-center">
          <span>Eventos de Hoy</span>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="Views.directorDashboard.exportCSV()">Exportar CSV</button>
            <button class="btn btn-secondary btn-sm" onclick="Views.directorDashboard.showPhotos()">Ver Fotos</button>
          </div>
        </div>

        <div class="filters">
          <div class="filter-group">
            <label class="form-label">Curso</label>
            <select id="filter-course" class="form-select">
              <option value="">Todos</option>
              ${courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>

          <div class="filter-group">
            <label class="form-label">Tipo</label>
            <select id="filter-type" class="form-select">
              <option value="">Todos</option>
              <option value="IN">Ingreso</option>
              <option value="OUT">Salida</option>
            </select>
          </div>

          <div class="filter-group">
            <label class="form-label">Buscar alumno</label>
            <input type="text" id="filter-search" class="form-input" placeholder="Nombre...">
          </div>

          <div class="filter-group">
            <label class="form-label">&nbsp;</label>
            <button class="btn btn-primary" onclick="Views.directorDashboard.applyFilters()">Filtrar</button>
          </div>
        </div>

        <div class="card-body">
          <div id="events-table"></div>
        </div>
      </div>
    `;

    renderEventsTable();
  }

  function renderEventsTable() {
    const tableDiv = document.getElementById('events-table');

    const headers = ['Alumno', 'Curso', 'Tipo', 'Puerta', 'Hora', 'Foto'];
    const rows = filteredEvents.map(event => {
      const student = State.getStudent(event.student_id);
      const course = State.getCourse(student.course_id);
      const typeChip = event.type === 'IN'
        ? Components.createChip('Ingreso', 'success')
        : Components.createChip('Salida', 'info');
      const photoIcon = event.photo_ref ? '📷' : '-';

      return [
        student.full_name,
        course.name,
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
    const eventsWithPhotos = filteredEvents.filter(e => e.photo_ref);
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

  renderDashboard();
};
