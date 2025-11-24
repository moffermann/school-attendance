// Director Dashboard - Live events (real data)
Views.directorDashboard = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Tablero en Vivo';

  const today = new Date().toISOString().split('T')[0];
  let filters = { date: today, course_id: '', type: '', search: '' };
  let snapshot = { stats: { total_in: 0, total_out: 0, late_count: 0, no_in_count: 0, with_photos: 0 }, events: [], date: today };
  let currentPage = 1;
  const absences = State.getAbsences();
  const notifications = State.data.notifications || [];

  async function loadDashboard(showToast = false) {
    content.innerHTML = Components.createLoader('Cargando tablero en vivo...');
    try {
      snapshot = await State.fetchDashboardSnapshot({
        date: filters.date,
        course_id: filters.course_id || undefined,
        type: filters.type || undefined,
        search: filters.search || undefined
      });
      currentPage = 1;
      renderDashboard();
      if (showToast) Components.showToast('Tablero actualizado', 'success');
    } catch (error) {
      console.error('No se pudo cargar el tablero', error);
      content.innerHTML = Components.createEmptyState('No disponible', 'No se pudo cargar la información del tablero.');
    }
  }

  function renderDashboard() {
    const courses = State.getCourses();
    const stats = snapshot.stats || { total_in: 0, total_out: 0, late_count: 0, no_in_count: 0, with_photos: 0 };
    const pendingAbsences = absences.filter((a) => a.status === 'PENDING').length;
    const sentNotifications = notifications.length;

    content.innerHTML = `
      <div class="cards-grid">
        ${Components.createStatCard('Ingresos', stats.total_in)}
        ${Components.createStatCard('Salidas', stats.total_out)}
        ${Components.createStatCard('Atrasos', stats.late_count)}
        ${Components.createStatCard('Sin ingreso', stats.no_in_count)}
        ${Components.createStatCard('Con foto', stats.with_photos)}
        ${Components.createStatCard('Ausencias pendientes', pendingAbsences)}
        ${Components.createStatCard('Notificaciones enviadas', sentNotifications)}
      </div>

      <div class="card">
        <div class="card-header flex justify-between items-center">
          <span>Eventos del ${snapshot.date || filters.date}</span>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="Views.directorDashboard.exportCSV()">Exportar CSV</button>
            <button class="btn btn-secondary btn-sm" onclick="Views.directorDashboard.showPhotos()">Ver fotos</button>
            <button class="btn btn-primary btn-sm" onclick="Views.directorDashboard.refresh()">Refrescar</button>
          </div>
        </div>

        <div class="filters">
          <div class="filter-group">
            <label class="form-label">Fecha</label>
            <input type="date" id="filter-date" class="form-input" value="${filters.date}">
          </div>

          <div class="filter-group">
            <label class="form-label">Curso</label>
            <select id="filter-course" class="form-select">
              <option value="">Todos</option>
              ${courses.map(c => `<option value="${c.id}" ${filters.course_id === String(c.id) ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>

          <div class="filter-group">
            <label class="form-label">Tipo</label>
            <select id="filter-type" class="form-select">
              <option value="">Todos</option>
              <option value="IN" ${filters.type === 'IN' ? 'selected' : ''}>Ingreso</option>
              <option value="OUT" ${filters.type === 'OUT' ? 'selected' : ''}>Salida</option>
            </select>
          </div>

          <div class="filter-group">
            <label class="form-label">Buscar alumno</label>
            <input type="text" id="filter-search" class="form-input" placeholder="Nombre..." value="${filters.search}">
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
    const events = snapshot.events || [];

    const headers = ['Alumno', 'Curso', 'Tipo', 'Puerta', 'Hora', 'Foto'];
    const rows = events.map(event => {
      const typeChip = event.type === 'IN'
        ? Components.createChip('Ingreso', 'success')
        : Components.createChip('Salida', 'info');
      const photoButton = event.photo_url
        ? `<button class="btn btn-link" onclick="Views.directorDashboard.previewPhoto(${event.id})">📷 Ver</button>`
        : '-';

      return [
        event.student_name,
        event.course_name,
        typeChip,
        event.gate_id,
        Components.formatTime(event.ts),
        photoButton
      ];
    });

    tableDiv.innerHTML = Components.createTable(headers, rows, {
      perPage: 20,
      currentPage,
      onPageChange: 'Views.directorDashboard.changePage'
    });
  }

  function findEvent(eventId) {
    return (snapshot.events || []).find(e => e.id === eventId);
  }

  // Public methods
  Views.directorDashboard.changePage = function(page) {
    currentPage = page;
    renderEventsTable();
  };

  Views.directorDashboard.applyFilters = function() {
    filters = {
      date: document.getElementById('filter-date').value || today,
      course_id: document.getElementById('filter-course').value,
      type: document.getElementById('filter-type').value,
      search: document.getElementById('filter-search').value.trim()
    };
    currentPage = 1;
    loadDashboard(true);
  };

  Views.directorDashboard.refresh = function() {
    loadDashboard(true);
  };

  Views.directorDashboard.exportCSV = async function() {
    try {
      const blob = await State.exportDashboardCsv({
        date: filters.date,
        course_id: filters.course_id || undefined,
        type: filters.type || undefined,
        search: filters.search || undefined
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard_${filters.date || today}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      Components.showToast('CSV exportado', 'success');
    } catch (error) {
      console.error('Error al exportar CSV', error);
      Components.showToast('No se pudo exportar el CSV', 'error');
    }
  };

  Views.directorDashboard.showPhotos = function() {
    const eventsWithPhotos = (snapshot.events || []).filter(e => e.photo_url);
    const photosHTML = eventsWithPhotos.slice(0, 6).map(e => `
      <div class="card" style="margin-bottom: 1rem;">
        <div class="card-body">
          <strong>${e.student_name}</strong> - ${Components.formatTime(e.ts)}
          <div style="margin-top: 0.5rem;">
            <img src="${e.photo_url}" alt="Foto de ingreso" style="max-width: 240px; border-radius: 4px; width: 100%; height: auto;">
          </div>
        </div>
      </div>
    `).join('');

    Components.showModal('Fotos de evidencia', `
      <div>${photosHTML || '<p>No hay fotos disponibles</p>'}</div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);
  };

  Views.directorDashboard.previewPhoto = function(eventId) {
    const event = findEvent(eventId);
    if (!event || !event.photo_url) {
      Components.showToast('El evento no tiene foto asociada', 'info');
      return;
    }

    Components.showModal('Foto de evidencia', `
      <p><strong>${event.student_name}</strong> - ${Components.formatTime(event.ts)} (${event.course_name})</p>
      <div style="text-align:center;">
        <img src="${event.photo_url}" alt="Foto de asistencia" style="max-width: 100%; border-radius: 6px;">
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);
  };

  loadDashboard();
};
