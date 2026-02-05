// Director Withdrawals History View
// Shows history of student withdrawals with filtering and export
Views.directorWithdrawals = async function () {
  const app = document.getElementById('app');

  // State variables
  let withdrawals = [];
  let searchTerm = '';
  let startDateFilter = '';
  let endDateFilter = '';
  let statusFilter = '';
  let currentOffset = 0;
  const PAGE_SIZE = 50;
  let total = 0;
  let hasMore = false;
  let counts = { completed: 0, cancelled: 0, total: 0 };
  let isLoading = false;
  let searchTimeout = null;

  // Get user info
  const user = State.getCurrentUser();
  const userName = user?.full_name || user?.email?.split('@')[0] || 'Director';
  const userInitial = userName.charAt(0).toUpperCase();
  const isDark = document.documentElement.classList.contains('dark');

  // Current path for active state
  const currentPath = '/director/withdrawals';

  // Render main layout
  function renderLayout() {
    app.innerHTML = `
      <div class="h-screen flex overflow-hidden bg-background-light dark:bg-background-dark">
        ${Components.directorSidebar(currentPath)}

        <!-- Main content -->
        <main class="flex-1 flex flex-col overflow-hidden">
          <!-- Header -->
          <header class="h-20 bg-white dark:bg-card-dark border-b border-border-light dark:border-border-dark flex items-center justify-between px-8 z-10 shadow-sm">
            <div class="flex items-center gap-4">
              <button class="desktop-hidden text-muted-light dark:text-muted-dark hover:text-primary transition-colors"
                      onclick="Components.toggleDirectorSidebar()">
                <span class="material-icons-round text-2xl">menu</span>
              </button>
              <h2 class="text-xl font-bold text-gray-800 dark:text-text-dark">Historial de Retiros</h2>
            </div>
            <div class="flex items-center gap-2 md:gap-4 flex-1 justify-end">
              <div class="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1 md:mx-2 mobile-hidden"></div>
              <div class="flex items-center gap-2 md:gap-3">
                <button class="p-2 rounded-full hover:bg-background-light dark:hover:bg-white/5 transition-colors text-muted-light dark:text-muted-dark"
                        onclick="Views.directorWithdrawals.toggleDarkMode()">
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
          <div class="flex-1 overflow-y-auto p-8 space-y-8" id="withdrawals-content">
            <!-- Loading state -->
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span class="ml-3 text-gray-500 dark:text-gray-400">Cargando historial...</span>
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

  // Render withdrawals content
  function renderWithdrawals() {
    const content = document.getElementById('withdrawals-content');
    if (!content) return;

    const statusOptions = [
      { value: '', label: 'Todos los estados' },
      { value: 'COMPLETED', label: 'Completado' },
      { value: 'CANCELLED', label: 'Cancelado' },
      { value: 'INITIATED', label: 'Iniciado' },
      { value: 'VERIFIED', label: 'Verificado' },
    ];

    // Pending withdrawal requests section
    const pendingRequests = State.getWithdrawalRequests({ status: 'PENDING' });
    const approvedRequests = State.getWithdrawalRequests({ status: 'APPROVED' });
    const actionableRequests = [...pendingRequests, ...approvedRequests];

    content.innerHTML = `
      <!-- Pending Withdrawal Requests -->
      ${actionableRequests.length > 0 ? `
        <div class="bg-white dark:bg-card-dark rounded-custom shadow-sm border border-amber-200 dark:border-amber-800/40 overflow-hidden">
          <div class="p-5 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800/40 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="material-icons-round text-amber-500">schedule_send</span>
              <div>
                <h4 class="text-base font-bold text-gray-900 dark:text-white">Solicitudes de Retiro</h4>
                <p class="text-xs text-gray-500 dark:text-gray-400">${pendingRequests.length} pendiente${pendingRequests.length !== 1 ? 's' : ''}, ${approvedRequests.length} aprobada${approvedRequests.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
          <div class="divide-y divide-gray-100 dark:divide-gray-700">
            ${actionableRequests.map(req => {
              const student = State.getStudent(req.student_id);
              const isPending = req.status === 'PENDING';
              const formattedDate = new Date(req.scheduled_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
              return `
                <div class="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <div class="w-10 h-10 rounded-lg ${isPending ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-green-50 dark:bg-green-900/20'} flex items-center justify-center flex-shrink-0">
                    <span class="material-icons-round text-lg ${isPending ? 'text-yellow-500' : 'text-green-500'}">${isPending ? 'hourglass_top' : 'check_circle'}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm font-semibold text-gray-900 dark:text-white">${student ? Components.escapeHtml(student.full_name) : 'Estudiante'}</span>
                      <span class="inline-flex items-center text-xs px-2 py-0.5 rounded-full ${isPending ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'} font-medium">
                        ${isPending ? 'Pendiente' : 'Aprobada'}
                      </span>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      ${formattedDate}${req.scheduled_time ? ' a las ' + req.scheduled_time.substring(0, 5) : ''}
                      &middot; Retira: ${req.pickup_name ? Components.escapeHtml(req.pickup_name) : '—'}
                      ${req.reason ? ' &middot; ' + Components.escapeHtml(req.reason) : ''}
                    </p>
                  </div>
                  ${isPending ? `
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <button onclick="Views.directorWithdrawals.approveRequest(${req.id})"
                              class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                              title="Aprobar">
                        <span class="material-icons-round text-sm">check</span> Aprobar
                      </button>
                      <button onclick="Views.directorWithdrawals.rejectRequest(${req.id})"
                              class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                              title="Rechazar">
                        <span class="material-icons-round text-sm">close</span> Rechazar
                      </button>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Title + Export Button -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 class="text-xl font-bold text-gray-800 dark:text-white">Historial de Retiros</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">Registro de todos los retiros autorizados de estudiantes</p>
        </div>
        <button class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700
                       text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2
                       shadow-lg shadow-emerald-200 dark:shadow-none transition-all"
                onclick="Views.directorWithdrawals.exportCSV()">
          <span class="material-icons-round">download</span>
          Exportar CSV
        </button>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Total Retiros -->
        <div class="bg-white dark:bg-card-dark p-6 rounded-custom shadow-sm border-l-4 border-indigo-500">
          <p class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">TOTAL RETIROS</p>
          <p class="text-4xl font-bold text-indigo-600 dark:text-indigo-400">${counts.total}</p>
        </div>

        <!-- Completados -->
        <div class="bg-white dark:bg-card-dark p-6 rounded-custom shadow-sm border-l-4 border-emerald-500">
          <p class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">COMPLETADOS</p>
          <p class="text-4xl font-bold text-emerald-600 dark:text-emerald-400">${counts.completed}</p>
        </div>

        <!-- Cancelados -->
        <div class="bg-white dark:bg-card-dark p-6 rounded-custom shadow-sm border-l-4 border-rose-400">
          <p class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">CANCELADOS</p>
          <p class="text-4xl font-bold text-rose-500 dark:text-rose-400">${counts.cancelled}</p>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white dark:bg-card-dark rounded-custom shadow-sm p-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <!-- Search -->
          <div class="relative">
            <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
            <input type="text" id="search-input" placeholder="Buscar por nombre..."
                   class="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-white dark:bg-gray-800
                          border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white
                          focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                   value="${searchTerm}"
                   oninput="Views.directorWithdrawals.handleSearch(this.value)">
          </div>

          <!-- Date From -->
          <div class="relative">
            <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">calendar_today</span>
            <input type="date" id="start-date" placeholder="Desde"
                   class="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-white dark:bg-gray-800
                          border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white
                          focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                   value="${startDateFilter}"
                   onchange="Views.directorWithdrawals.handleDateFilter('start', this.value)">
          </div>

          <!-- Date To -->
          <div class="relative">
            <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">event</span>
            <input type="date" id="end-date" placeholder="Hasta"
                   class="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-white dark:bg-gray-800
                          border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white
                          focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                   value="${endDateFilter}"
                   onchange="Views.directorWithdrawals.handleDateFilter('end', this.value)">
          </div>

          <!-- Status Filter -->
          <div class="relative">
            <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">filter_list</span>
            <select id="status-filter"
                    class="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-white dark:bg-gray-800
                           border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white
                           focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none"
                    onchange="Views.directorWithdrawals.handleStatusFilter(this.value)">
              ${statusOptions.map(o => `<option value="${o.value}" ${statusFilter === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Withdrawals Table -->
      <div class="bg-white dark:bg-card-dark rounded-custom shadow-sm overflow-hidden">
        ${isLoading ? `
          <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span class="ml-3 text-gray-500 dark:text-gray-400">Cargando...</span>
          </div>
        ` : withdrawals.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estudiante</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Retirado por</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha/Hora</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Metodo</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                ${withdrawals.map(w => renderWithdrawalRow(w)).join('')}
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          ${renderPagination()}
        ` : `
          <div class="text-center py-12">
            <span class="material-icons-round text-6xl text-gray-300 dark:text-gray-600">directions_walk</span>
            <p class="mt-4 text-gray-500 dark:text-gray-400">No hay retiros registrados</p>
            <p class="text-sm text-gray-400 dark:text-gray-500">Los retiros apareceran aqui cuando se realicen desde el kiosko</p>
          </div>
        `}
      </div>
    `;
  }

  // Render a single withdrawal row
  function renderWithdrawalRow(w) {
    const statusColors = {
      COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      CANCELLED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
      INITIATED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      VERIFIED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    };

    const statusLabels = {
      COMPLETED: 'Completado',
      CANCELLED: 'Cancelado',
      INITIATED: 'Iniciado',
      VERIFIED: 'Verificado',
    };

    // Verification method icons and labels (same style as dashboard)
    const methodIcons = {
      QR_SCAN: 'qr_code',
      BIOMETRIC: 'fingerprint',
      ADMIN_OVERRIDE: 'admin_panel_settings',
      PHOTO_MATCH: 'face',
    };
    const methodLabels = {
      QR_SCAN: 'QR',
      BIOMETRIC: 'Biométrico',
      ADMIN_OVERRIDE: 'Admin',
      PHOTO_MATCH: 'Foto',
    };
    const methodIcon = methodIcons[w.verification_method] || 'help_outline';
    const methodLabel = methodLabels[w.verification_method] || w.verification_method || 'N/A';

    // Use completed_at if available, otherwise initiated_at
    const rawDate = w.completed_at || w.initiated_at;
    const withdrawnAt = parseBackendDate(rawDate);
    const isValidDate = withdrawnAt !== null;

    const dateStr = isValidDate ? withdrawnAt.toLocaleDateString('es-CL') : 'N/A';
    const timeStr = isValidDate ? withdrawnAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : 'N/A';

    return `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <span class="text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                ${w.student_name ? w.student_name.charAt(0).toUpperCase() : '?'}
              </span>
            </div>
            <div>
              <p class="font-semibold text-gray-800 dark:text-white">${Components.escapeHtml(w.student_name || 'Desconocido')}</p>
              ${w.course_name ? `<p class="text-xs text-gray-500 dark:text-gray-400">${Components.escapeHtml(w.course_name)}</p>` : ''}
            </div>
          </div>
        </td>
        <td class="px-6 py-4">
          <p class="text-gray-800 dark:text-white">${Components.escapeHtml(w.pickup_name || 'N/A')}</p>
          ${w.pickup_relationship ? `<p class="text-xs text-gray-500 dark:text-gray-400">${Components.escapeHtml(w.pickup_relationship)}</p>` : ''}
        </td>
        <td class="px-6 py-4">
          <p class="text-gray-800 dark:text-white">${dateStr}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">${timeStr}</p>
        </td>
        <td class="px-6 py-4">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300">
            <span class="material-icons-round text-sm">${methodIcon}</span> ${methodLabel}
          </span>
        </td>
        <td class="px-6 py-4">
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[w.status] || 'bg-gray-100 text-gray-700'}">
            ${statusLabels[w.status] || w.status}
          </span>
        </td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-2">
            <button onclick="Views.directorWithdrawals.viewDetails(${w.id})"
                    class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                    title="Ver detalles">
              <span class="material-icons-round text-lg">visibility</span>
            </button>
            ${w.status !== 'COMPLETED' && w.status !== 'CANCELLED' ? `
              <button onclick="Views.directorWithdrawals.cancelWithdrawal(${w.id})"
                      class="p-2 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-500 transition-colors"
                      title="Cancelar retiro">
                <span class="material-icons-round text-lg">cancel</span>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  // Render pagination
  function renderPagination() {
    if (total <= PAGE_SIZE) return '';

    const currentPage = Math.floor(currentOffset / PAGE_SIZE) + 1;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    return `
      <div class="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between border-t border-gray-100 dark:border-gray-700">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Mostrando ${currentOffset + 1} - ${Math.min(currentOffset + PAGE_SIZE, total)} de ${total}
        </p>
        <div class="flex items-center gap-2">
          <button onclick="Views.directorWithdrawals.changePage(-1)"
                  class="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700
                         text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  ${currentPage === 1 ? 'disabled' : ''}>
            <span class="material-icons-round text-lg">chevron_left</span>
          </button>
          <span class="text-sm text-gray-600 dark:text-gray-400">Pagina ${currentPage} de ${totalPages}</span>
          <button onclick="Views.directorWithdrawals.changePage(1)"
                  class="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700
                         text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  ${!hasMore ? 'disabled' : ''}>
            <span class="material-icons-round text-lg">chevron_right</span>
          </button>
        </div>
      </div>
    `;
  }

  // Load withdrawals from API
  async function loadWithdrawals() {
    isLoading = true;
    renderWithdrawals();

    try {
      const filters = {
        offset: currentOffset,
        limit: PAGE_SIZE,
      };
      if (searchTerm) filters.search = searchTerm;
      if (startDateFilter) filters.date_from = startDateFilter;
      if (endDateFilter) filters.date_to = endDateFilter;
      if (statusFilter) filters.status = statusFilter;

      const response = await API.getWithdrawals(filters);
      withdrawals = response.items || response || [];
      total = response.total || withdrawals.length;
      hasMore = response.has_more || (currentOffset + PAGE_SIZE < total);

      // Update counts
      counts.total = total;
      counts.completed = withdrawals.filter(w => w.status === 'COMPLETED').length;
      counts.cancelled = withdrawals.filter(w => w.status === 'CANCELLED').length;

    } catch (error) {
      console.error('Error loading withdrawals:', error);
      Components.showToast('Error al cargar historial de retiros', 'error');
      withdrawals = [];
    } finally {
      isLoading = false;
      renderWithdrawals();
    }
  }

  // Event handlers
  Views.directorWithdrawals.handleSearch = function (value) {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchTerm = value;
      currentOffset = 0;
      loadWithdrawals();
    }, 300);
  };

  Views.directorWithdrawals.handleDateFilter = function (type, value) {
    if (type === 'start') startDateFilter = value;
    else endDateFilter = value;
    currentOffset = 0;
    loadWithdrawals();
  };

  Views.directorWithdrawals.handleStatusFilter = function (value) {
    statusFilter = value;
    currentOffset = 0;
    loadWithdrawals();
  };

  Views.directorWithdrawals.changePage = function (direction) {
    currentOffset += direction * PAGE_SIZE;
    if (currentOffset < 0) currentOffset = 0;
    loadWithdrawals();
  };

  Views.directorWithdrawals.toggleDarkMode = function () {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', document.documentElement.classList.contains('dark'));
    Views.directorWithdrawals();
  };

  // Helper function to parse dates from backend (handles various ISO 8601 formats)
  function parseBackendDate(dateValue) {
    if (!dateValue) return null;

    // Handle if dateValue is already a Date object
    if (dateValue instanceof Date) {
      return isNaN(dateValue.getTime()) ? null : dateValue;
    }

    // Handle string values
    if (typeof dateValue === 'string') {
      // Replace space with T if needed (some formats use space separator)
      let normalized = dateValue.replace(' ', 'T');

      // Try parsing directly
      let parsed = new Date(normalized);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }

      // If that fails, try without timezone suffix and add Z
      if (!normalized.endsWith('Z') && !normalized.includes('+') && !normalized.includes('-', 10)) {
        parsed = new Date(normalized + 'Z');
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }

    console.warn('[parseBackendDate] Could not parse date:', dateValue);
    return null;
  }

  Views.directorWithdrawals.viewDetails = async function (withdrawalId) {
    try {
      const w = await API.getWithdrawal(withdrawalId);

      // Debug: log the raw date values
      console.log('[Withdrawal Details] Raw API response:', JSON.stringify(w, null, 2));
      console.log('[Withdrawal Details] Date fields:', {
        completed_at: w.completed_at,
        initiated_at: w.initiated_at,
        completed_at_type: typeof w.completed_at,
        initiated_at_type: typeof w.initiated_at
      });

      // Use completed_at if available, otherwise initiated_at
      const rawDate = w.completed_at || w.initiated_at;
      const withdrawnAt = parseBackendDate(rawDate);
      const isValidDate = withdrawnAt !== null;

      console.log('[Withdrawal Details] Parsed result:', {
        rawDate,
        withdrawnAt,
        isValidDate
      });

      const dateStr = isValidDate ? withdrawnAt.toLocaleDateString('es-CL', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      }) : 'N/A';
      const timeStr = isValidDate ? withdrawnAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : 'N/A';

      const statusLabels = {
        COMPLETED: 'Completado',
        CANCELLED: 'Cancelado',
        INITIATED: 'Iniciado',
        VERIFIED: 'Verificado',
      };

      // Verification method icons and labels
      const methodIcons = {
        QR_SCAN: 'qr_code',
        BIOMETRIC: 'fingerprint',
        ADMIN_OVERRIDE: 'admin_panel_settings',
        PHOTO_MATCH: 'face',
      };
      const methodLabels = {
        QR_SCAN: 'Escaneo de QR',
        BIOMETRIC: 'Verificación Biométrica',
        ADMIN_OVERRIDE: 'Aprobación Administrativa',
        PHOTO_MATCH: 'Coincidencia de Foto',
      };
      const methodIcon = methodIcons[w.verification_method] || 'help_outline';
      const methodLabel = methodLabels[w.verification_method] || w.verification_method || 'N/A';

      Components.showModal('Detalles del Retiro', `
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Estudiante</p>
              <p class="font-semibold text-gray-800 dark:text-white">${Components.escapeHtml(w.student_name || 'N/A')}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Curso</p>
              <p class="font-semibold text-gray-800 dark:text-white">${Components.escapeHtml(w.course_name || 'N/A')}</p>
            </div>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Retirado por</p>
                <p class="font-semibold text-gray-800 dark:text-white">${Components.escapeHtml(w.pickup_name || 'N/A')}</p>
                ${w.pickup_relationship ? `<p class="text-sm text-gray-500">${Components.escapeHtml(w.pickup_relationship)}</p>` : ''}
              </div>
              <div>
                <p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Método de Verificación</p>
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <span class="material-icons-round text-base">${methodIcon}</span> ${methodLabel}
                </span>
              </div>
            </div>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Fecha</p>
                <p class="font-semibold text-gray-800 dark:text-white">${dateStr}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Hora</p>
                <p class="font-semibold text-gray-800 dark:text-white">${timeStr}</p>
              </div>
            </div>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Estado</p>
                <p class="font-semibold text-gray-800 dark:text-white">${statusLabels[w.status] || w.status}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Dispositivo</p>
                <p class="font-semibold text-gray-800 dark:text-white">${Components.escapeHtml(w.device_id || 'N/A')}</p>
              </div>
            </div>
          </div>

          ${w.reason ? `
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Motivo del Retiro</p>
              <p class="text-gray-800 dark:text-white">${Components.escapeHtml(w.reason)}</p>
            </div>
          ` : ''}

          ${w.cancellation_reason ? `
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4 bg-rose-50 dark:bg-rose-900/20 -mx-4 px-4 py-3 rounded-lg">
              <p class="text-xs text-rose-600 dark:text-rose-400 uppercase">Motivo de Cancelacion</p>
              <p class="text-rose-700 dark:text-rose-300">${Components.escapeHtml(w.cancellation_reason)}</p>
            </div>
          ` : ''}

          ${w.pickup_photo_ref ? `
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase mb-2">Foto de Verificación</p>
              <div style="position: relative; display: inline-block;">
                <img id="withdrawal-photo-${w.id}"
                     alt="Foto de verificación"
                     class="max-w-[200px] max-h-[200px] object-cover border border-gray-200 dark:border-gray-700 rounded-lg"
                     style="opacity: 0.3; transition: opacity 0.3s;">
                <span id="withdrawal-photo-loading-${w.id}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.5rem;">&#x23F3;</span>
              </div>
            </div>
          ` : ''}

          ${w.signature_data ? `
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase mb-2">Firma Digital</p>
              <img src="${w.signature_data}" alt="Firma" class="max-w-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white">
            </div>
          ` : ''}
        </div>
      `, [
        { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
      ]);

      // Load photo with authentication headers (img src can't send JWT)
      if (w.pickup_photo_ref) {
        const photoUrl = `${API.baseUrl}/withdrawals/${w.id}/photo`;
        API.loadAuthenticatedImage(photoUrl).then(blobUrl => {
          const img = document.getElementById(`withdrawal-photo-${w.id}`);
          const loading = document.getElementById(`withdrawal-photo-loading-${w.id}`);
          if (img && blobUrl) {
            img.src = blobUrl;
            img.style.opacity = '1';
          } else if (img) {
            img.parentElement.innerHTML = '<p class="text-gray-400 text-sm">No se pudo cargar la foto</p>';
          }
          if (loading) loading.remove();
        });
      }
    } catch (error) {
      console.error('Error loading withdrawal details:', error);
      Components.showToast('Error al cargar detalles', 'error');
    }
  };

  Views.directorWithdrawals.cancelWithdrawal = async function (withdrawalId) {
    const reason = prompt('Ingrese el motivo de cancelacion (minimo 10 caracteres):');
    if (!reason) return;
    if (reason.length < 10) {
      Components.showToast('El motivo debe tener al menos 10 caracteres', 'warning');
      return;
    }

    try {
      await API.cancelWithdrawal(withdrawalId, reason);
      Components.showToast('Retiro cancelado correctamente', 'success');
      loadWithdrawals();
    } catch (error) {
      console.error('Error canceling withdrawal:', error);
      Components.showToast(error.message || 'Error al cancelar retiro', 'error');
    }
  };

  Views.directorWithdrawals.approveRequest = async function (requestId) {
    const notes = prompt('Notas de aprobación (opcional):');
    if (notes === null) return; // user cancelled

    try {
      await API.approveWithdrawalRequest(requestId, notes || null);
      State.updateWithdrawalRequest(requestId, { status: 'APPROVED' });
      Components.showToast('Solicitud aprobada', 'success');
      renderWithdrawals();
    } catch (error) {
      console.error('Error approving request:', error);
      Components.showToast(error.message || 'Error al aprobar solicitud', 'error');
    }
  };

  Views.directorWithdrawals.rejectRequest = async function (requestId) {
    const notes = prompt('Motivo del rechazo:');
    if (notes === null) return; // user cancelled

    try {
      await API.rejectWithdrawalRequest(requestId, notes || null);
      State.updateWithdrawalRequest(requestId, { status: 'REJECTED' });
      Components.showToast('Solicitud rechazada', 'success');
      renderWithdrawals();
    } catch (error) {
      console.error('Error rejecting request:', error);
      Components.showToast(error.message || 'Error al rechazar solicitud', 'error');
    }
  };

  Views.directorWithdrawals.exportCSV = async function () {
    try {
      const filters = {};
      if (startDateFilter) filters.date_from = startDateFilter;
      if (endDateFilter) filters.date_to = endDateFilter;
      if (statusFilter) filters.status = statusFilter;

      Components.showToast('Generando archivo CSV...', 'info');
      const blob = await API.exportWithdrawalsCSV(filters);

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `retiros-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      Components.showToast('Archivo descargado', 'success');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      Components.showToast('Error al exportar CSV', 'error');
    }
  };

  // Initialize
  renderLayout();
  loadWithdrawals();
};
