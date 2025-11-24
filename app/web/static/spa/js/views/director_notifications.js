// Director Notifications - bitácora y métricas
Views.directorNotifications = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Notificaciones';

  let filters = { status: '', channel: '', template: '' };
  let notifications = [];

  async function loadNotifications(showToast = false) {
    content.innerHTML = Components.createLoader('Cargando notificaciones...');
    try {
      const query = State.buildQuery({
        status: filters.status || undefined,
        channel: filters.channel || undefined,
        template: filters.template || undefined,
      });
      notifications = await State.apiFetch(`/notifications${query ? `?${query}` : ''}`);
      render();
      if (showToast) Components.showToast('Notificaciones actualizadas', 'success');
    } catch (error) {
      console.error('No se pudieron cargar las notificaciones', error);
      content.innerHTML = Components.createEmptyState('No disponible', 'No se pudo cargar la bitácora de notificaciones.');
    }
  }

  function render() {
    const totals = {
      total: notifications.length,
      sent: notifications.filter(n => n.status === 'sent').length,
      failed: notifications.filter(n => n.status === 'failed').length,
      queued: notifications.filter(n => n.status === 'queued').length,
    };

    content.innerHTML = `
      <div class="cards-grid">
        ${Components.createStatCard('Total', totals.total)}
        ${Components.createStatCard('Enviadas', totals.sent)}
        ${Components.createStatCard('Fallidas', totals.failed)}
        ${Components.createStatCard('En cola', totals.queued)}
      </div>

      <div class="card mb-3">
        <div class="card-header flex justify-between items-center">
          <span>Filtros</span>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="Views.directorNotifications.export()">Exportar CSV</button>
            <button class="btn btn-primary btn-sm" onclick="Views.directorNotifications.refresh()">Refrescar</button>
          </div>
        </div>
        <div class="card-body">
          <div class="filters">
            <div class="filter-group">
              <label class="form-label">Estado</label>
              <select id="filter-status" class="form-select">
                <option value="">Todos</option>
                <option value="queued" ${filters.status === 'queued' ? 'selected' : ''}>En cola</option>
                <option value="sent" ${filters.status === 'sent' ? 'selected' : ''}>Enviadas</option>
                <option value="failed" ${filters.status === 'failed' ? 'selected' : ''}>Fallidas</option>
              </select>
            </div>
            <div class="filter-group">
              <label class="form-label">Canal</label>
              <select id="filter-channel" class="form-select">
                <option value="">Todos</option>
                <option value="WHATSAPP" ${filters.channel === 'WHATSAPP' ? 'selected' : ''}>WhatsApp</option>
                <option value="EMAIL" ${filters.channel === 'EMAIL' ? 'selected' : ''}>Email</option>
              </select>
            </div>
            <div class="filter-group">
              <label class="form-label">Plantilla</label>
              <select id="filter-template" class="form-select">
                <option value="">Todas</option>
                <option value="INGRESO_OK" ${filters.template === 'INGRESO_OK' ? 'selected' : ''}>Ingreso OK</option>
                <option value="SALIDA_OK" ${filters.template === 'SALIDA_OK' ? 'selected' : ''}>Salida OK</option>
                <option value="NO_INGRESO_UMBRAL" ${filters.template === 'NO_INGRESO_UMBRAL' ? 'selected' : ''}>No ingreso</option>
                <option value="CAMBIO_HORARIO" ${filters.template === 'CAMBIO_HORARIO' ? 'selected' : ''}>Cambio horario</option>
              </select>
            </div>
            <div class="filter-group">
              <label class="form-label">&nbsp;</label>
              <button class="btn btn-primary" onclick="Views.directorNotifications.applyFilters()">Aplicar</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Bitácora</div>
        <div class="card-body" id="notifications-table"></div>
      </div>
    `;

    renderTable();
  }

  function renderTable() {
    const tableDiv = document.getElementById('notifications-table');
    const headers = ['Fecha', 'Canal', 'Plantilla', 'Estado', 'Destinatario', 'Intentos'];
    const rows = notifications.map((item) => {
      const statusChip =
        item.status === 'sent'
          ? Components.createChip('Enviada', 'success')
          : item.status === 'failed'
            ? Components.createChip('Fallida', 'error')
            : Components.createChip('En cola', 'warning');
      const channelChip =
        item.channel === 'WHATSAPP'
          ? Components.createChip('WhatsApp', 'success')
          : Components.createChip('Email', 'info');
      const dest = item.payload?.recipient || item.payload?.email || '-';

      return [
        Components.formatDateTime(item.ts_sent || item.ts_created),
        channelChip,
        item.template,
        statusChip,
        dest,
        item.retries ?? 0
      ];
    });

    tableDiv.innerHTML = Components.createTable(headers, rows, { perPage: 20, currentPage: 1 });
  }

  Views.directorNotifications.refresh = function() {
    loadNotifications(true);
  };

  Views.directorNotifications.applyFilters = function() {
    filters = {
      status: document.getElementById('filter-status').value,
      channel: document.getElementById('filter-channel').value,
      template: document.getElementById('filter-template').value,
    };
    loadNotifications(true);
  };

  Views.directorNotifications.export = async function() {
    try {
      const blob = await State.exportNotifications(filters);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'notifications.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      Components.showToast('Exportación lista', 'success');
    } catch (error) {
      console.error('No se pudo exportar notificaciones', error);
      Components.showToast('Error al exportar notificaciones', 'error');
    }
  };

  loadNotifications();
};
