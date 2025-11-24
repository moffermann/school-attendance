// Director Alerts (no-ingreso) - datos reales
Views.directorAlerts = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Alertas de No Ingreso';

  const courses = State.getCourses();
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let filters = { start_date: weekAgo, end_date: today, status: 'PENDING', course_id: '' };
  let alerts = [];
  let currentPage = 1;

  async function loadAlerts(showToast = false) {
    content.innerHTML = Components.createLoader('Cargando alertas...');
    try {
      alerts = await State.fetchAlerts({
        start_date: filters.start_date,
        end_date: filters.end_date,
        status: filters.status || undefined,
        course_id: filters.course_id || undefined,
        limit: 300
      });
      renderAlerts();
      if (showToast) Components.showToast('Alertas actualizadas', 'success');
    } catch (error) {
      console.error('No se pudieron cargar alertas', error);
      content.innerHTML = Components.createEmptyState('No disponible', 'No se pudo cargar el listado de alertas.');
    }
  }

  function renderAlerts() {
    const summary = {
      total: alerts.length,
      pending: alerts.filter(a => a.status === 'PENDING').length,
      resolved: alerts.filter(a => a.status === 'RESOLVED').length,
    };

    content.innerHTML = `
      <div class="cards-grid">
        ${Components.createStatCard('Total', summary.total)}
        ${Components.createStatCard('Pendientes', summary.pending)}
        ${Components.createStatCard('Resueltas', summary.resolved)}
      </div>

      <div class="card mb-3">
        <div class="card-header flex justify-between items-center">
          <span>Filtros</span>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="Views.directorAlerts.export()">Exportar</button>
            <button class="btn btn-primary btn-sm" onclick="Views.directorAlerts.refresh()">Refrescar</button>
          </div>
        </div>
        <div class="card-body">
          <div class="flex gap-2 flex-wrap items-end">
            <div class="form-group" style="min-width: 180px;">
              <label class="form-label">Desde</label>
              <input type="date" id="filter-start" class="form-input" value="${filters.start_date}">
            </div>
            <div class="form-group" style="min-width: 180px;">
              <label class="form-label">Hasta</label>
              <input type="date" id="filter-end" class="form-input" value="${filters.end_date}">
            </div>
            <div class="form-group" style="min-width: 180px;">
              <label class="form-label">Estado</label>
              <select id="filter-status" class="form-select">
                <option value="">Todos</option>
                <option value="PENDING" ${filters.status === 'PENDING' ? 'selected' : ''}>Pendientes</option>
                <option value="RESOLVED" ${filters.status === 'RESOLVED' ? 'selected' : ''}>Resueltas</option>
              </select>
            </div>
            <div class="form-group" style="min-width: 200px;">
              <label class="form-label">Curso</label>
              <select id="filter-course" class="form-select">
                <option value="">Todos</option>
                ${courses.map(c => `<option value="${c.id}" ${filters.course_id === String(c.id) ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
            </div>
            <button class="btn btn-primary" onclick="Views.directorAlerts.applyFilters()">Aplicar</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Alertas</div>
        <div class="card-body" id="alerts-table"></div>
      </div>
    `;

    renderTable();
  }

  function renderTable() {
    const tableDiv = document.getElementById('alerts-table');
    const headers = ['Fecha', 'Alumno', 'Apoderado', 'Curso', 'Estado', 'Intentos', 'Última notificación', 'Acciones'];
    const rows = alerts.map(alert => {
      const statusChip = alert.status === 'PENDING'
        ? Components.createChip('Pendiente', 'warning')
        : Components.createChip('Resuelta', 'success');
      const lastNotif = alert.last_notification_at ? Components.formatDateTime(alert.last_notification_at) : '-';

      return [
        Components.formatDate(alert.alert_date),
        alert.student_name || alert.student_id,
        alert.guardian_name || alert.guardian_id,
        alert.course_name || '-',
        statusChip,
        alert.notification_attempts ?? 0,
        lastNotif,
        alert.status === 'PENDING'
          ? `<button class="btn btn-secondary btn-sm" onclick="Views.directorAlerts.resolve(${alert.id})">Marcar resuelta</button>`
          : '-'
      ];
    });

    tableDiv.innerHTML = Components.createTable(headers, rows, {
      perPage: 20,
      currentPage,
      onPageChange: 'Views.directorAlerts.changePage'
    });
  }

  Views.directorAlerts.changePage = function(page) {
    currentPage = page;
    renderTable();
  };

  Views.directorAlerts.refresh = function() {
    loadAlerts(true);
  };

  Views.directorAlerts.applyFilters = function() {
    filters = {
      start_date: document.getElementById('filter-start').value,
      end_date: document.getElementById('filter-end').value,
      status: document.getElementById('filter-status').value,
      course_id: document.getElementById('filter-course').value
    };
    currentPage = 1;
    loadAlerts(true);
  };

  Views.directorAlerts.export = async function() {
    try {
      const blob = await State.exportAlerts({
        start_date: filters.start_date,
        end_date: filters.end_date,
        status: filters.status || undefined,
        course_id: filters.course_id || undefined
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `no_entry_alerts_${filters.start_date}_${filters.end_date}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      Components.showToast('Exportación lista', 'success');
    } catch (error) {
      console.error('No se pudo exportar', error);
      Components.showToast('No se pudo exportar alertas', 'error');
    }
  };

  Views.directorAlerts.resolve = async function(alertId) {
    try {
      const notes = prompt('Notas (opcional):', '') || '';
      await State.resolveAlert(alertId, notes);
      Components.showToast('Alerta marcada como resuelta', 'success');
      await loadAlerts();
    } catch (error) {
      console.error('No se pudo resolver alerta', error);
      Components.showToast('No se pudo resolver la alerta', 'error');
    }
  };

  loadAlerts();
};
