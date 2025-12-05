// Director Notifications Log (Bitácora de Notificaciones)
Views.directorNotifications = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Bitácora de Notificaciones';

  let filters = {
    status: '',
    channel: '',
    type: '',
    dateFrom: '',
    dateTo: ''
  };
  let currentPage = 1;

  function render() {
    const stats = State.getNotificationStats();
    const notifications = State.getNotifications(filters);

    content.innerHTML = `
      <div class="cards-grid">
        ${Components.createStatCard('Total Enviadas', stats.total)}
        ${Components.createStatCard('Entregadas', stats.delivered)}
        ${Components.createStatCard('Fallidas', stats.failed)}
        ${Components.createStatCard('Pendientes', stats.pending)}
      </div>

      <div class="card">
        <div class="card-header">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <span>Filtros</span>
            <button class="btn btn-secondary btn-sm" onclick="Views.directorNotifications.exportCSV()">
              Exportar CSV
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="filters-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Estado</label>
              <select id="filter-status" class="form-select" onchange="Views.directorNotifications.applyFilters()">
                <option value="">Todos</option>
                <option value="delivered" ${filters.status === 'delivered' ? 'selected' : ''}>Entregadas</option>
                <option value="failed" ${filters.status === 'failed' ? 'selected' : ''}>Fallidas</option>
                <option value="pending" ${filters.status === 'pending' ? 'selected' : ''}>Pendientes</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Canal</label>
              <select id="filter-channel" class="form-select" onchange="Views.directorNotifications.applyFilters()">
                <option value="">Todos</option>
                <option value="whatsapp" ${filters.channel === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
                <option value="email" ${filters.channel === 'email' ? 'selected' : ''}>Email</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Tipo</label>
              <select id="filter-type" class="form-select" onchange="Views.directorNotifications.applyFilters()">
                <option value="">Todos</option>
                <option value="IN" ${filters.type === 'IN' ? 'selected' : ''}>Ingreso</option>
                <option value="OUT" ${filters.type === 'OUT' ? 'selected' : ''}>Salida</option>
                <option value="NO_SHOW" ${filters.type === 'NO_SHOW' ? 'selected' : ''}>Sin Ingreso</option>
                <option value="ABSENCE_APPROVED" ${filters.type === 'ABSENCE_APPROVED' ? 'selected' : ''}>Ausencia Aprobada</option>
                <option value="SCHEDULE_CHANGE" ${filters.type === 'SCHEDULE_CHANGE' ? 'selected' : ''}>Cambio Horario</option>
                <option value="BROADCAST" ${filters.type === 'BROADCAST' ? 'selected' : ''}>Broadcast</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Desde</label>
              <input type="date" id="filter-date-from" class="form-input" value="${filters.dateFrom}" onchange="Views.directorNotifications.applyFilters()">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Hasta</label>
              <input type="date" id="filter-date-to" class="form-input" value="${filters.dateTo}" onchange="Views.directorNotifications.applyFilters()">
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="Views.directorNotifications.clearFilters()">Limpiar Filtros</button>
            <span style="color: var(--color-gray-500); font-size: 0.875rem; line-height: 2rem;">
              ${notifications.length} notificación(es) encontrada(s)
            </span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Historial de Notificaciones</div>
        <div class="card-body" id="notifications-list">
          ${renderNotificationsList(notifications)}
        </div>
      </div>
    `;
  }

  function renderNotificationsList(notifications) {
    if (notifications.length === 0) {
      return Components.createEmptyState(
        'Sin notificaciones',
        'No hay notificaciones que coincidan con los filtros seleccionados'
      );
    }

    const headers = ['Fecha/Hora', 'Alumno', 'Apoderado', 'Tipo', 'Canal', 'Estado', 'Mensaje', 'Acciones'];

    const rows = notifications.map(n => {
      const student = State.getStudent(n.student_id);
      const guardian = State.getGuardian(n.guardian_id);

      const statusChip = n.status === 'delivered'
        ? Components.createChip('Entregada', 'success')
        : n.status === 'failed'
          ? Components.createChip('Fallida', 'error')
          : Components.createChip('Pendiente', 'warning');

      const channelChip = n.channel === 'whatsapp'
        ? Components.createChip('WhatsApp', 'success')
        : Components.createChip('Email', 'info');

      const typeLabel = getTypeLabel(n.type);

      const actions = n.status === 'failed'
        ? `<button class="btn btn-secondary btn-sm" onclick="Views.directorNotifications.retry(${n.id})">Reintentar</button>`
        : n.status === 'pending'
          ? Components.createChip('En cola', 'gray')
          : '-';

      const messagePreview = n.message
        ? (n.message.length > 40 ? Components.escapeHtml(n.message.substring(0, 40)) + '...' : Components.escapeHtml(n.message))
        : '-';

      return [
        Components.formatDateTime(n.sent_at),
        student ? Components.escapeHtml(student.full_name) : '-',
        guardian ? Components.escapeHtml(guardian.name || `Apoderado #${guardian.id}`) : '-',
        typeLabel,
        channelChip,
        statusChip,
        `<span title="${Components.escapeHtml(n.message || '')}">${messagePreview}</span>`,
        actions
      ];
    });

    return Components.createTable(headers, rows, {
      perPage: 15,
      currentPage: currentPage,
      onPageChange: 'Views.directorNotifications.changePage'
    });
  }

  function getTypeLabel(type) {
    const types = {
      'IN': 'Ingreso',
      'OUT': 'Salida',
      'NO_SHOW': 'Sin Ingreso',
      'ABSENCE_APPROVED': 'Ausencia',
      'ABSENCE_REJECTED': 'Ausencia Rech.',
      'SCHEDULE_CHANGE': 'Cambio Horario',
      'BROADCAST': 'Broadcast'
    };
    return types[type] || type;
  }

  Views.directorNotifications.applyFilters = function() {
    filters.status = document.getElementById('filter-status').value;
    filters.channel = document.getElementById('filter-channel').value;
    filters.type = document.getElementById('filter-type').value;
    filters.dateFrom = document.getElementById('filter-date-from').value;
    filters.dateTo = document.getElementById('filter-date-to').value;
    currentPage = 1;
    render();
  };

  Views.directorNotifications.clearFilters = function() {
    filters = { status: '', channel: '', type: '', dateFrom: '', dateTo: '' };
    currentPage = 1;
    render();
  };

  Views.directorNotifications.changePage = function(page) {
    currentPage = page;
    const notifications = State.getNotifications(filters);
    document.getElementById('notifications-list').innerHTML = renderNotificationsList(notifications);
  };

  Views.directorNotifications.retry = function(id) {
    if (State.retryNotification(id)) {
      Components.showToast('Notificación reenviada a la cola', 'success');
      render();
    } else {
      Components.showToast('No se pudo reenviar la notificación', 'error');
    }
  };

  Views.directorNotifications.exportCSV = function() {
    const notifications = State.getNotifications(filters);

    if (notifications.length === 0) {
      Components.showToast('No hay datos para exportar', 'warning');
      return;
    }

    const headers = ['ID', 'Fecha', 'Hora', 'Alumno', 'Apoderado', 'Tipo', 'Canal', 'Estado', 'Mensaje', 'Error'];

    const rows = notifications.map(n => {
      const student = State.getStudent(n.student_id);
      const guardian = State.getGuardian(n.guardian_id);
      const date = n.sent_at ? n.sent_at.split('T')[0] : '';
      const time = n.sent_at ? n.sent_at.split('T')[1].substring(0, 5) : '';

      return [
        n.id,
        date,
        time,
        student ? student.full_name : '',
        guardian ? (guardian.name || `Apoderado #${guardian.id}`) : '',
        getTypeLabel(n.type),
        n.channel,
        n.status,
        n.message || '',
        n.error || ''
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Download
    // TDD-R7-BUG1 fix: Store blob URL and revoke after download to prevent memory leak
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const blobUrl = URL.createObjectURL(blob);
    link.href = blobUrl;
    link.download = `notificaciones_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    // Revoke blob URL after download to free memory
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

    Components.showToast(`${notifications.length} notificaciones exportadas`, 'success');
  };

  Views.directorNotifications.showDetails = function(id) {
    const notification = State.getNotifications().find(n => n.id === id);
    if (!notification) return;

    const student = State.getStudent(notification.student_id);
    const guardian = State.getGuardian(notification.guardian_id);

    const content = `
      <div style="display: grid; gap: 1rem;">
        <div><strong>Fecha:</strong> ${Components.formatDateTime(notification.sent_at)}</div>
        <div><strong>Alumno:</strong> ${student ? Components.escapeHtml(student.full_name) : '-'}</div>
        <div><strong>Apoderado:</strong> ${guardian ? Components.escapeHtml(guardian.name || `#${guardian.id}`) : '-'}</div>
        <div><strong>Tipo:</strong> ${getTypeLabel(notification.type)}</div>
        <div><strong>Canal:</strong> ${notification.channel}</div>
        <div><strong>Estado:</strong> ${notification.status}</div>
        <div><strong>Mensaje:</strong><br><div style="background: var(--color-gray-100); padding: 0.5rem; border-radius: 4px; margin-top: 0.5rem;">${Components.escapeHtml(notification.message || '-')}</div></div>
        ${notification.error ? `<div><strong>Error:</strong> <span style="color: var(--color-error);">${Components.escapeHtml(notification.error)}</span></div>` : ''}
      </div>
    `;

    Components.showModal('Detalle de Notificación', content, [
      { label: 'Cerrar', action: 'close' }
    ]);
  };

  render();
};
