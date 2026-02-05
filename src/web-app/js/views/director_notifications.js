// Uses centralized Components for sidebar - see components.js
// Director Notifications Log (Bitácora de Notificaciones) - Redesigned with Tailwind
Views.directorNotifications = function() {
  const app = document.getElementById('app');

  // State variables
  let filters = {
    status: '',
    channel: '',
    type: '',
    dateFrom: '',
    dateTo: ''
  };
  let currentPage = 1;
  const ITEMS_PER_PAGE = 15;

  // Get user info
  const user = State.getCurrentUser();
  const userName = user?.full_name || user?.email?.split('@')[0] || 'Director';
  const userInitial = userName.charAt(0).toUpperCase();
  const isDark = document.documentElement.classList.contains('dark');

  // Current path for active state
  const currentPath = '/director/notifications';

  // Render main layout
  function renderLayout() {
    app.innerHTML = `
      <div class="h-screen flex overflow-hidden bg-background-light dark:bg-background-dark">
        <!-- Sidebar -->
        ${Components.directorSidebar(currentPath)}
        <div id="sidebar-backdrop" class="fixed inset-0 bg-black/50 z-40 hidden" onclick="Components.toggleDirectorSidebar()"></div>

        <!-- Main content -->
        <main class="flex-1 flex flex-col overflow-hidden">
          <!-- Header -->
          <header class="h-20 bg-white dark:bg-card-dark border-b border-border-light dark:border-border-dark flex items-center justify-between px-8 z-10 shadow-sm">
            <div class="flex items-center gap-4">
              <button class="desktop-hidden text-muted-light dark:text-muted-dark hover:text-primary transition-colors"
                      onclick="Components.toggleDirectorSidebar()">
                <span class="material-icons-round text-2xl">menu</span>
              </button>
              <h2 class="text-xl font-bold text-gray-800 dark:text-text-dark">Bitácora de Notificaciones</h2>
            </div>
            <div class="flex items-center gap-2 md:gap-4 flex-1 justify-end">
              <div class="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1 md:mx-2 mobile-hidden"></div>
              <div class="flex items-center gap-2 md:gap-3">
                <div id="notification-bell-placeholder"></div>
                <button class="p-2 rounded-full hover:bg-background-light dark:hover:bg-white/5 transition-colors text-muted-light dark:text-muted-dark"
                        onclick="Views.directorNotifications.toggleDarkMode()">
                  <span class="material-icons-round">${isDark ? 'light_mode' : 'dark_mode'}</span>
                </button>
                <div class="flex items-center gap-2 cursor-pointer">
                  <div class="w-9 h-9 rounded-full border border-gray-200 bg-indigo-600 flex items-center justify-center text-white font-semibold">
                    ${userInitial}
                  </div>
                  <div class="text-right mobile-hidden">
                    <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">${Components.escapeHtml(userName)}</p>
                  </div>
                </div>
                <a class="ml-1 md:ml-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 border px-2 md:px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 dark:border-gray-600"
                   href="#" onclick="event.preventDefault(); State.logout(); Router.navigate('/login')">
                  <span class="material-icons-round text-lg">logout</span>
                  <span class="mobile-hidden">Salir</span>
                </a>
              </div>
            </div>
          </header>

          <!-- Content area -->
          <div class="flex-1 overflow-y-auto p-8 space-y-6" id="notifications-content">
            <!-- Loading state -->
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span class="ml-3 text-gray-500 dark:text-gray-400">Cargando notificaciones...</span>
            </div>
          </div>

          <!-- Footer -->
          <footer class="text-center text-xs text-gray-400 dark:text-gray-500 py-4 border-t border-gray-100 dark:border-gray-800">
            &copy; 2026 NEUVOX. Todos los derechos reservados.
          </footer>
        </main>
      </div>
    `;
  }

  // Get type label
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

  // Get channel badge HTML
  function getChannelBadge(channel) {
    const ch = (channel || '').toLowerCase();
    if (ch === 'whatsapp') {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-100 dark:border-emerald-800">
        <span class="material-icons-round text-xs">chat</span> WHATSAPP
      </span>`;
    }
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold border border-blue-100 dark:border-blue-800">
      <span class="material-icons-round text-xs">mail</span> EMAIL
    </span>`;
  }

  // Parse payload if it's a JSON string
  function parsePayload(payload) {
    if (!payload) return {};
    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload);
      } catch (e) {
        return {};
      }
    }
    return payload;
  }

  // Build message preview from payload
  function buildMessagePreview(payload, template) {
    const data = parsePayload(payload);
    if (!data || Object.keys(data).length === 0) return '-';

    const studentName = data.student_name || '';
    const time = data.time || '';

    if (template === 'INGRESO_OK') {
      return `${studentName} ingreso a las ${time}`;
    } else if (template === 'SALIDA_OK') {
      return `${studentName} salio a las ${time}`;
    } else if (template === 'NO_INGRESO_UMBRAL') {
      return `${studentName} no registro ingreso`;
    } else if (template === 'BROADCAST' && data.subject) {
      return data.subject.substring(0, 30);
    }
    if (studentName && time) return `${studentName} - ${time}`;
    return studentName || '-';
  }

  // Get status badge HTML
  function getStatusBadge(status) {
    const st = (status || '').toLowerCase();
    // Fix: Backend uses 'sent' not 'delivered' for successful notifications
    if (st === 'delivered' || st === 'sent') {
      return `<span class="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase">Entregada</span>`;
    }
    if (st === 'failed') {
      return `<span class="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] font-bold uppercase">Fallida</span>`;
    }
    if (st === 'queued') {
      return `<span class="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase">En Cola</span>`;
    }
    return `<span class="px-2 py-0.5 rounded bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] font-bold uppercase">Pendiente</span>`;
  }

  // Render content
  function render() {
    const content = document.getElementById('notifications-content');
    if (!content) return;

    const stats = State.getNotificationStats();
    const allNotifications = State.getNotifications(filters);

    // Pagination
    const totalItems = allNotifications.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
    const paginatedNotifications = allNotifications.slice(startIndex, endIndex);

    content.innerHTML = `
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <!-- Total Enviadas -->
        <div class="bg-white dark:bg-card-dark p-6 rounded-custom shadow-sm border-t-4 border-purple-500">
          <p class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">TOTAL ENVIADAS</p>
          <p class="text-4xl font-bold text-purple-600 dark:text-purple-400">${stats.total}</p>
        </div>

        <!-- Entregadas -->
        <div class="bg-white dark:bg-card-dark p-6 rounded-custom shadow-sm border-t-4 border-emerald-500">
          <p class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">ENTREGADAS</p>
          <p class="text-4xl font-bold text-emerald-600 dark:text-emerald-400">${stats.delivered}</p>
        </div>

        <!-- Fallidas -->
        <div class="bg-white dark:bg-card-dark p-6 rounded-custom shadow-sm border-t-4 border-rose-500">
          <p class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">FALLIDAS</p>
          <p class="text-4xl font-bold text-rose-500 dark:text-rose-400">${stats.failed}</p>
        </div>

        <!-- Pendientes -->
        <div class="bg-white dark:bg-card-dark p-6 rounded-custom shadow-sm border-t-4 border-orange-400">
          <p class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">PENDIENTES</p>
          <p class="text-4xl font-bold text-orange-500 dark:text-orange-400">${stats.pending}</p>
        </div>
      </div>

      <!-- Filters Card -->
      <div class="bg-white dark:bg-card-dark rounded-custom p-6 shadow-sm border border-gray-100 dark:border-border-dark">
        <div class="flex justify-between items-center mb-6">
          <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">Filtros</h4>
          <button class="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                  onclick="Views.directorNotifications.exportCSV()">
            <span class="material-icons-round text-sm">download</span>
            Exportar CSV
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <!-- Estado -->
          <div>
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Estado</label>
            <select id="filter-status" class="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                       focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                       text-gray-700 dark:text-gray-200"
                    onchange="Views.directorNotifications.applyFilters()">
              <option value="" ${filters.status === '' ? 'selected' : ''}>Todos</option>
              <option value="delivered" ${filters.status === 'delivered' ? 'selected' : ''}>Entregada</option>
              <option value="failed" ${filters.status === 'failed' ? 'selected' : ''}>Fallida</option>
              <option value="pending" ${filters.status === 'pending' ? 'selected' : ''}>Pendiente</option>
            </select>
          </div>

          <!-- Canal -->
          <div>
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Canal</label>
            <select id="filter-channel" class="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                       focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                       text-gray-700 dark:text-gray-200"
                    onchange="Views.directorNotifications.applyFilters()">
              <option value="" ${filters.channel === '' ? 'selected' : ''}>Todos</option>
              <option value="whatsapp" ${filters.channel === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
              <option value="email" ${filters.channel === 'email' ? 'selected' : ''}>Email</option>
            </select>
          </div>

          <!-- Tipo -->
          <div>
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Tipo</label>
            <select id="filter-type" class="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                       focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                       text-gray-700 dark:text-gray-200"
                    onchange="Views.directorNotifications.applyFilters()">
              <option value="" ${filters.type === '' ? 'selected' : ''}>Todos</option>
              <option value="IN" ${filters.type === 'IN' ? 'selected' : ''}>Ingreso</option>
              <option value="OUT" ${filters.type === 'OUT' ? 'selected' : ''}>Salida</option>
              <option value="NO_SHOW" ${filters.type === 'NO_SHOW' ? 'selected' : ''}>Sin Ingreso</option>
              <option value="ABSENCE_APPROVED" ${filters.type === 'ABSENCE_APPROVED' ? 'selected' : ''}>Ausencia Aprobada</option>
              <option value="SCHEDULE_CHANGE" ${filters.type === 'SCHEDULE_CHANGE' ? 'selected' : ''}>Cambio Horario</option>
              <option value="BROADCAST" ${filters.type === 'BROADCAST' ? 'selected' : ''}>Broadcast</option>
            </select>
          </div>

          <!-- Desde -->
          <div>
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Desde</label>
            <input type="date" id="filter-date-from" class="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                      focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                      text-gray-700 dark:text-gray-200"
                   value="${filters.dateFrom}"
                   onchange="Views.directorNotifications.applyFilters()">
          </div>

          <!-- Hasta -->
          <div>
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Hasta</label>
            <input type="date" id="filter-date-to" class="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                      focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                      text-gray-700 dark:text-gray-200"
                   value="${filters.dateTo}"
                   onchange="Views.directorNotifications.applyFilters()">
          </div>
        </div>

        <!-- Clear filters + counter -->
        <div class="mt-4 flex items-center justify-between">
          <button class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  onclick="Views.directorNotifications.clearFilters()">
            Limpiar Filtros
          </button>
          <span class="text-xs text-gray-400 dark:text-gray-500">${totalItems} notificacion(es) encontrada(s)</span>
        </div>
      </div>

      <!-- Table Card -->
      <div class="bg-white dark:bg-card-dark rounded-custom shadow-sm border border-gray-100 dark:border-border-dark overflow-hidden">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">Historial de Notificaciones</h4>
        </div>

        <!-- Table -->
        ${renderNotificationsTable(paginatedNotifications)}

        <!-- Footer Pagination -->
        <div class="px-6 py-4 border-t border-gray-50 dark:border-slate-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <button class="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onclick="Views.directorNotifications.prevPage()" id="btn-prev-page" ${currentPage <= 1 ? 'disabled' : ''}>
            Anterior
          </button>
          <span class="font-medium" id="pagination-info">Pagina ${currentPage} de ${totalPages}</span>
          <button class="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onclick="Views.directorNotifications.nextPage()" id="btn-next-page" ${currentPage >= totalPages ? 'disabled' : ''}>
            Siguiente
          </button>
        </div>
      </div>
    `;
  }

  // Render notifications table
  function renderNotificationsTable(notifications) {
    if (notifications.length === 0) {
      return `
        <div class="text-center py-12">
          <span class="material-icons-round text-4xl text-gray-300 dark:text-gray-600">notifications_off</span>
          <p class="mt-2 text-gray-500 dark:text-gray-400">No hay notificaciones que coincidan con los filtros seleccionados</p>
        </div>
      `;
    }

    const rows = notifications.map(n => {
      const student = State.getStudent(n.student_id);
      const guardian = State.getGuardian(n.guardian_id);

      const studentName = student ? Components.escapeHtml(student.full_name) : '-';
      const guardianName = guardian ? Components.escapeHtml(guardian.name || `Apoderado #${guardian.id}`) : '-';
      const typeLabel = getTypeLabel(n.type);
      const channelBadge = getChannelBadge(n.channel);
      const statusBadge = getStatusBadge(n.status);

      const messagePreview = n.message
        ? (n.message.length > 30 ? Components.escapeHtml(n.message.substring(0, 30)) + '...' : Components.escapeHtml(n.message))
        : '-';
      const fullMessage = Components.escapeHtml(n.message || '');

      // Actions
      let actionsHtml;
      if ((n.status || '').toLowerCase() === 'failed') {
        actionsHtml = `
          <div class="flex flex-col gap-1 items-start">
            <button class="text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                    onclick="Views.directorNotifications.retry(${n.id})">
              Reintentar
            </button>
            <button class="text-indigo-600 dark:text-indigo-400 hover:underline text-[11px] font-bold"
                    onclick="Views.directorNotifications.showDetails(${n.id})">
              Ver detalle
            </button>
          </div>
        `;
      } else {
        actionsHtml = `
          <button class="text-indigo-600 dark:text-indigo-400 hover:underline text-[11px] font-bold"
                  onclick="Views.directorNotifications.showDetails(${n.id})">
            Ver detalle
          </button>
        `;
      }

      return `
        <tr class="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
          <td class="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">${Components.formatDateTime(n.sent_at)}</td>
          <td class="px-6 py-4 text-xs text-gray-700 dark:text-gray-300 font-medium">${studentName}</td>
          <td class="px-6 py-4 text-xs text-gray-700 dark:text-gray-300 font-medium">${guardianName}</td>
          <td class="px-6 py-4 text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">${typeLabel}</td>
          <td class="px-6 py-4">${channelBadge}</td>
          <td class="px-6 py-4">${statusBadge}</td>
          <td class="px-6 py-4 text-xs text-gray-400 dark:text-gray-500 truncate max-w-[120px]" title="${fullMessage}">${messagePreview}</td>
          <td class="px-6 py-4">${actionsHtml}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
              <th class="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha/Hora</th>
              <th class="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Alumno</th>
              <th class="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Apoderado</th>
              <th class="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
              <th class="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Canal</th>
              <th class="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
              <th class="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mensaje</th>
              <th class="px-6 py-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50 dark:divide-slate-700">
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  // Public methods
  Views.directorNotifications.toggleDarkMode = function() {
    document.documentElement.classList.toggle('dark');
    renderLayout();
    render();
  };

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

  Views.directorNotifications.prevPage = function() {
    if (currentPage > 1) {
      currentPage--;
      render();
    }
  };

  Views.directorNotifications.nextPage = function() {
    const allNotifications = State.getNotifications(filters);
    const totalPages = Math.ceil(allNotifications.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
      currentPage++;
      render();
    }
  };

  Views.directorNotifications.retry = function(id) {
    if (State.retryNotification(id)) {
      Components.showToast('Notificacion reenviada a la cola', 'success');
      render();
    } else {
      Components.showToast('No se pudo reenviar la notificacion', 'error');
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
        <div><strong>Mensaje:</strong><br><div style="background: var(--color-gray-100); padding: 0.5rem; border-radius: 4px; margin-top: 0.5rem;">${Components.escapeHtml(notification.message || buildMessagePreview(notification.payload, notification.template))}</div></div>
        ${notification.error ? `<div><strong>Error:</strong> <span style="color: var(--color-error);">${Components.escapeHtml(notification.error)}</span></div>` : ''}
      </div>
    `;

    Components.showModal('Detalle de Notificacion', content, [
      { label: 'Cerrar', action: 'close' }
    ]);
  };

  // Initialize
  renderLayout();
  render();
};
