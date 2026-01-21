// Director Dashboard - Diseño Aprobado NEUVOX (Tailwind)
// NO MODIFICAR CLASES TAILWIND - Copiadas exactamente del diseño aprobado

Views.directorDashboard = function() {
  const app = document.getElementById('app');
  let stats = State.getTodayStats();
  let todayEvents = State.getTodayEvents();
  const courses = State.getCourses();
  const user = State.getCurrentUser();
  const userName = user?.full_name || 'Director';
  const currentPath = window.location.hash.slice(1) || '/director/dashboard';

  // Variables de estado
  let currentPage = 1;
  let filteredEvents = [...todayEvents];
  let filters = { course: '', type: '', search: '' };
  let autoRefreshInterval = null;
  let autoRefreshPaused = false;
  const AUTO_REFRESH_INTERVAL_MS = 30000; // 30 seconds
  const EVENTS_PER_PAGE = 20;

  // Helper: check if nav item is active
  const isActive = (path) => currentPath === path;
  const navItemClass = (path) => isActive(path)
    ? 'flex items-center px-6 py-3 bg-indigo-800/50 text-white border-l-4 border-indigo-500 group transition-colors'
    : 'flex items-center px-6 py-3 hover:bg-white/5 hover:text-white group transition-colors border-l-4 border-transparent';
  const iconClass = (path) => isActive(path)
    ? 'material-icons-round mr-3'
    : 'material-icons-round mr-3 text-gray-400 group-hover:text-white transition-colors';

  // Navigation items - del diseño aprobado
  const navItems = [
    { path: '/director/dashboard', icon: 'dashboard', label: 'Tablero' },
    { path: '/director/reports', icon: 'analytics', label: 'Reportes' },
    { path: '/director/metrics', icon: 'bar_chart', label: 'Métricas' },
    { path: '/director/schedules', icon: 'schedule', label: 'Horarios' },
    { path: '/director/exceptions', icon: 'event_busy', label: 'Excepciones' },
    { path: '/director/broadcast', icon: 'campaign', label: 'Comunicados' },
    { path: '/director/devices', icon: 'devices', label: 'Dispositivos' },
    { path: '/director/students', icon: 'school', label: 'Alumnos' },
    { path: '/director/guardians', icon: 'family_restroom', label: 'Apoderados' },
    { path: '/director/teachers', icon: 'badge', label: 'Profesores' },
    { path: '/director/courses', icon: 'class', label: 'Cursos' },
    { path: '/director/absences', icon: 'person_off', label: 'Ausencias' },
    { path: '/director/notifications', icon: 'notifications', label: 'Notificaciones' },
    { path: '/director/biometric', icon: 'fingerprint', label: 'Biometría' },
  ];

  // Format date for header - del diseño
  const today = new Date();
  const todayFormatted = today.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  const capitalizedDate = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);
  const currentTime = today.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

  // ========================================
  // RENDER PRINCIPAL - HTML del diseño aprobado
  // ========================================
  app.innerHTML = `
<div class="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-body transition-colors duration-300 antialiased h-screen flex overflow-hidden">
  <!-- Mobile Backdrop -->
  <div id="sidebar-backdrop" class="fixed inset-0 bg-black/50 z-40 hidden" onclick="Views.directorDashboard.toggleMobileSidebar()"></div>

  <!-- Sidebar - EXACTO del diseño aprobado -->
  <aside class="w-64 bg-sidebar-dark text-gray-300 flex-shrink-0 flex-col transition-all duration-300 mobile-hidden border-r border-indigo-900/50 shadow-2xl z-50">
    <div class="h-20 flex items-center justify-between px-6 border-b border-indigo-900/50">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg">
          <div class="w-4 h-4 bg-indigo-900 rounded-full"></div>
        </div>
        <h1 class="text-xl font-bold tracking-tight text-white">NEUVOX</h1>
      </div>
      <button class="desktop-hidden text-gray-400 hover:text-white p-1" onclick="Views.directorDashboard.toggleMobileSidebar()">
        <span class="material-icons-round">close</span>
      </button>
    </div>
    <nav class="flex-1 overflow-y-auto py-6 space-y-1">
      ${navItems.map(item => `
        <a class="${navItemClass(item.path)}" href="#${item.path}">
          <span class="${iconClass(item.path)}">${item.icon}</span>
          <span class="font-medium text-sm">${item.label}</span>
        </a>
      `).join('')}
    </nav>
  </aside>

  <!-- Main Content -->
  <main class="flex-1 flex flex-col overflow-hidden relative bg-gray-50 dark:bg-background-dark">
    <!-- Header - EXACTO del diseño aprobado -->
    <header class="h-20 bg-white dark:bg-card-dark border-b border-border-light dark:border-border-dark flex items-center justify-between px-8 z-10 shadow-sm">
      <div class="flex items-center gap-4">
        <button class="desktop-hidden text-muted-light dark:text-muted-dark hover:text-primary transition-colors" onclick="Views.directorDashboard.toggleMobileSidebar()">
          <span class="material-icons-round text-2xl">menu</span>
        </button>
        <h2 class="text-xl font-bold text-gray-800 dark:text-text-dark">Tablero en Vivo</h2>
      </div>
      <div class="flex items-center gap-2 md:gap-4 flex-1 justify-end">
        <div class="flex items-center gap-2">
          <span id="live-indicator" class="text-xs font-medium px-2 md:px-3 py-1 bg-green-100 text-green-700 rounded-full flex items-center gap-1 cursor-pointer" onclick="Views.directorDashboard.toggleAutoRefresh()">
            <span class="w-2 h-2 rounded-full bg-green-500" id="live-dot"></span>
            <span id="live-text" class="mobile-hidden">${autoRefreshPaused ? 'Pausado' : 'En vivo'}</span>
          </span>
        </div>
        <div class="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1 md:mx-2 mobile-hidden"></div>
        <div class="flex items-center gap-2 md:gap-3">
          <button class="p-2 rounded-full hover:bg-background-light dark:hover:bg-white/5 transition-colors text-muted-light dark:text-muted-dark" onclick="Views.directorDashboard.toggleDarkMode()">
            <span class="material-icons-round" id="dark-mode-icon">dark_mode</span>
          </button>
          <div class="flex items-center gap-2 cursor-pointer">
            <div class="w-9 h-9 rounded-full border border-gray-200 bg-indigo-600 flex items-center justify-center text-white font-semibold">
              ${userName.charAt(0).toUpperCase()}
            </div>
            <div class="text-right mobile-hidden">
              <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">${Components.escapeHtml(userName)}</p>
            </div>
          </div>
          <a class="ml-1 md:ml-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 border px-2 md:px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 dark:border-gray-600" href="#" onclick="event.preventDefault(); State.logout(); Router.navigate('/login')">
            <span class="material-icons-round text-lg">logout</span>
            <span class="mobile-hidden">Salir</span>
          </a>
        </div>
      </div>
    </header>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8 scroll-smooth">
      <!-- Date and Update Time -->
      <div class="flex justify-between items-center mb-2">
        <div class="text-sm text-gray-500">${capitalizedDate}</div>
        <div class="text-xs text-gray-400">Actualizado: <span id="last-update-time">${currentTime}</span></div>
      </div>

      <!-- Metric Cards - EXACTO del diseño aprobado -->
      <div id="stats-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        ${renderMetricCards()}
      </div>

      <!-- Alert Banner - EXACTO del diseño aprobado -->
      <div id="no-ingress-alert" class="${stats.noInCount > 0 ? '' : 'hidden'}">
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-xl p-4 flex-responsive">
          <div class="flex items-center gap-4">
            <div class="bg-red-100 dark:bg-red-800 p-2 rounded-full flex-shrink-0">
              <span class="material-icons-round text-red-600 dark:text-red-300">warning</span>
            </div>
            <div>
              <h4 class="text-red-800 dark:text-red-200 font-bold text-lg">
                <span id="alert-count">${stats.noInCount}</span> alumnos <span class="font-medium text-red-600 dark:text-red-300">sin registro de entrada</span>
              </h4>
              <p class="text-sm text-red-500 dark:text-red-400">Estos alumnos no han registrado ingreso hoy.</p>
            </div>
          </div>
          <div class="flex gap-3 flex-shrink-0">
            <button class="btn-responsive px-4 py-2 bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm flex items-center justify-center gap-2" onclick="Views.directorDashboard.showNoIngressList()">
              <span class="material-icons-round text-base">visibility</span> Ver Lista
            </button>
            <button class="btn-responsive px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-indigo-200 flex items-center justify-center gap-2" onclick="Router.navigate('/director/reports?filter=no-ingress')">
              <span class="material-icons-round text-base">assessment</span> Ir a Reportes
            </button>
          </div>
        </div>
      </div>

      <!-- Events Table Section - EXACTO del diseño aprobado -->
      <div class="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-gray-100 dark:border-border-dark overflow-hidden">
        <div class="p-6 border-b border-gray-100 dark:border-border-dark flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h3 class="text-lg font-bold text-gray-800 dark:text-text-dark">Eventos de Hoy</h3>
          <div class="flex gap-3">
            <button class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-card-dark border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 flex items-center gap-2" onclick="Views.directorDashboard.exportCSV()">
              <span class="material-icons-round text-base">file_download</span> Exportar CSV
            </button>
            <button class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-card-dark border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 flex items-center gap-2" onclick="Views.directorDashboard.showPhotos()">
              <span class="material-icons-round text-base">photo_camera</span> Ver Fotos
            </button>
          </div>
        </div>

        <!-- Filter Bar - EXACTO del diseño aprobado -->
        <div class="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-end bg-gray-50/50 dark:bg-white/5">
          <div class="md:col-span-3">
            <label class="block text-xs font-semibold text-gray-500 mb-1.5">Curso</label>
            <div class="relative">
              <select id="filter-course" class="w-full pl-3 pr-10 py-2.5 text-sm border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-card-dark text-gray-700 dark:text-gray-200 shadow-sm appearance-none">
                <option value="">Todos los cursos</option>
                ${courses.map(c => `<option value="${c.id}">${Components.escapeHtml(c.name)}</option>`).join('')}
              </select>
              <span class="absolute right-3 top-2.5 pointer-events-none text-gray-400 material-icons-round text-lg">expand_more</span>
            </div>
          </div>
          <div class="md:col-span-3">
            <label class="block text-xs font-semibold text-gray-500 mb-1.5">Tipo de Evento</label>
            <div class="relative">
              <select id="filter-type" class="w-full pl-3 pr-10 py-2.5 text-sm border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-card-dark text-gray-700 dark:text-gray-200 shadow-sm appearance-none">
                <option value="">Todos</option>
                <option value="IN">Ingreso</option>
                <option value="OUT">Salida</option>
              </select>
              <span class="absolute right-3 top-2.5 pointer-events-none text-gray-400 material-icons-round text-lg">expand_more</span>
            </div>
          </div>
          <div class="md:col-span-4">
            <label class="block text-xs font-semibold text-gray-500 mb-1.5">Buscar alumno</label>
            <input id="filter-search" class="w-full pl-4 pr-4 py-2.5 text-sm border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-card-dark text-gray-700 dark:text-gray-200 shadow-sm" placeholder="Escriba un nombre..." type="text">
          </div>
          <div class="md:col-span-2">
            <button class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-md shadow-indigo-200 transition-colors" onclick="Views.directorDashboard.applyFilters()">
              Aplicar Filtros
            </button>
          </div>
        </div>

        <!-- Events Table -->
        <div id="events-table" class="overflow-x-auto">
          ${renderEventsTableHTML()}
        </div>

        <!-- Pagination - EXACTO del diseño aprobado -->
        <div id="pagination-footer" class="px-6 py-4 border-t border-gray-100 dark:border-border-dark flex items-center justify-between">
          ${renderPagination()}
        </div>
      </div>

      <!-- Footer - del diseño aprobado -->
      <footer class="text-center text-xs text-muted-light dark:text-muted-dark pt-8 pb-4">
        © 2024 NEUVOX. Todos los derechos reservados.
      </footer>
    </div>
  </main>
</div>
  `;

  // ========================================
  // FUNCIONES DE RENDERIZADO
  // ========================================

  function renderMetricCards() {
    return `
      <!-- Ingresos -->
      <div class="relative bg-white dark:bg-card-dark p-6 rounded-xl shadow-sm border border-gray-100 dark:border-border-dark group transition-all">
        <div class="flex justify-between items-start mb-4">
          <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">INGRESOS HOY</p>
          <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <span class="material-icons-round text-blue-500">login</span>
          </div>
        </div>
        <h3 class="text-4xl font-bold text-blue-600 dark:text-blue-400" id="stat-in">${stats.totalIn}</h3>
      </div>
      <!-- Salidas -->
      <div class="relative bg-white dark:bg-card-dark p-6 rounded-xl shadow-sm border border-gray-100 dark:border-border-dark group transition-all">
        <div class="flex justify-between items-start mb-4">
          <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">SALIDAS HOY</p>
          <div class="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
            <span class="material-icons-round text-indigo-500">logout</span>
          </div>
        </div>
        <h3 class="text-4xl font-bold text-indigo-600 dark:text-indigo-400" id="stat-out">${stats.totalOut}</h3>
      </div>
      <!-- Atrasos -->
      <div class="relative bg-white dark:bg-card-dark p-6 rounded-xl shadow-sm border border-gray-100 dark:border-border-dark group transition-all">
        <div class="flex justify-between items-start mb-4">
          <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">ATRASOS</p>
          <div class="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <span class="material-icons-round text-yellow-500">access_time</span>
          </div>
        </div>
        <h3 class="text-4xl font-bold text-yellow-600 dark:text-yellow-400" id="stat-late">${stats.lateCount}</h3>
      </div>
      <!-- Sin Ingreso -->
      <div class="relative bg-white dark:bg-card-dark p-6 rounded-xl shadow-sm border border-gray-100 dark:border-border-dark group transition-all">
        <div class="flex justify-between items-start mb-4">
          <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">SIN INGRESO</p>
          <div class="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <span class="material-icons-round text-red-500">close</span>
          </div>
        </div>
        <h3 class="text-4xl font-bold text-red-600 dark:text-red-400" id="stat-noin">${stats.noInCount}</h3>
      </div>
    `;
  }

  function renderEventsTableHTML() {
    if (filteredEvents.length === 0) {
      return `
        <div class="p-8 text-center text-gray-500 dark:text-gray-400">
          <span class="material-icons-round text-4xl mb-2 block">event_busy</span>
          <p>${filters.course || filters.type || filters.search
            ? 'No hay eventos que coincidan con los filtros seleccionados'
            : 'No hay eventos registrados hoy'}</p>
        </div>
      `;
    }

    // Paginate events
    const startIdx = (currentPage - 1) * EVENTS_PER_PAGE;
    const paginatedEvents = filteredEvents.slice(startIdx, startIdx + EVENTS_PER_PAGE);

    const rows = paginatedEvents.map(event => {
      const student = State.getStudent(event.student_id);
      const course = State.getCourse(student?.course_id);
      const hasPhoto = event.photo_url || event.photo_ref;

      // Type badge - EXACTO del diseño
      const typeBadge = event.type === 'IN'
        ? `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Ingreso</span>`
        : `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Salida</span>`;

      // Source badge - EXACTO del diseño
      const sourceIcon = {
        'QR': 'qr_code',
        'BIOMETRIC': 'fingerprint',
        'NFC': 'nfc',
        'MANUAL': 'edit'
      }[event.source] || 'edit';
      const sourceLabel = {
        'QR': 'QR',
        'BIOMETRIC': 'Biométrico',
        'NFC': 'NFC',
        'MANUAL': 'Manual'
      }[event.source] || 'Manual';

      const sourceBadge = `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300">
          <span class="material-icons-round text-sm">${sourceIcon}</span> ${sourceLabel}
        </span>
      `;

      // Photo button
      const photoButton = hasPhoto
        ? `<button class="text-gray-400 hover:text-indigo-600 transition-colors" onclick="Views.directorDashboard.showEventPhoto(${event.id})">
             <span class="material-icons-round">photo_camera</span>
           </button>`
        : `<span class="text-gray-300">-</span>`;

      // Format time
      const eventTime = new Date(event.ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

      return `
        <tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
          <td class="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">${student ? Components.escapeHtml(student.full_name) : '-'}</td>
          <td class="px-6 py-4 text-gray-500 dark:text-gray-400">${course ? Components.escapeHtml(course.name) : '-'}</td>
          <td class="px-6 py-4 text-center">${typeBadge}</td>
          <td class="px-6 py-4 text-center">${sourceBadge}</td>
          <td class="px-6 py-4 text-gray-500 dark:text-gray-400">${event.gate_id || '-'}</td>
          <td class="px-6 py-4 text-gray-900 dark:text-gray-100 font-medium">${eventTime}</td>
          <td class="px-6 py-4 text-center">${photoButton}</td>
        </tr>
      `;
    }).join('');

    return `
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-gray-50 dark:bg-white/5 border-y border-gray-200 dark:border-border-dark">
            <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ALUMNO</th>
            <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">CURSO</th>
            <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">TIPO</th>
            <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">FUENTE</th>
            <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">PUERTA</th>
            <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">HORA</th>
            <th class="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">FOTO</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-border-dark text-sm bg-white dark:bg-card-dark">
          ${rows}
        </tbody>
      </table>
    `;
  }

  function renderPagination() {
    const totalPages = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);
    const startIdx = (currentPage - 1) * EVENTS_PER_PAGE + 1;
    const endIdx = Math.min(currentPage * EVENTS_PER_PAGE, filteredEvents.length);

    const prevDisabled = currentPage <= 1;
    const nextDisabled = currentPage >= totalPages;

    return `
      <span class="text-sm text-gray-500">Mostrando ${filteredEvents.length > 0 ? startIdx : 0} a ${endIdx} de ${filteredEvents.length} entradas</span>
      <div class="flex gap-2">
        <button class="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 ${prevDisabled ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600'}" ${prevDisabled ? 'disabled' : ''} onclick="Views.directorDashboard.changePage(${currentPage - 1})">
          <span class="material-icons-round">chevron_left</span>
        </button>
        <button class="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 ${nextDisabled ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600'}" ${nextDisabled ? 'disabled' : ''} onclick="Views.directorDashboard.changePage(${currentPage + 1})">
          <span class="material-icons-round">chevron_right</span>
        </button>
      </div>
    `;
  }

  // ========================================
  // FUNCIONES DE ACTUALIZACIÓN (sin re-render completo)
  // ========================================

  function updateStatsDisplay() {
    const statsGrid = document.getElementById('stats-grid');
    if (statsGrid) {
      statsGrid.innerHTML = renderMetricCards();
    }

    // Update alert
    const alertContainer = document.getElementById('no-ingress-alert');
    if (alertContainer) {
      if (stats.noInCount > 0) {
        alertContainer.classList.remove('hidden');
        const alertCount = document.getElementById('alert-count');
        if (alertCount) alertCount.textContent = stats.noInCount;
      } else {
        alertContainer.classList.add('hidden');
      }
    }
  }

  function renderEventsTable() {
    const tableDiv = document.getElementById('events-table');
    const paginationDiv = document.getElementById('pagination-footer');
    if (tableDiv) {
      tableDiv.innerHTML = renderEventsTableHTML();
    }
    if (paginationDiv) {
      paginationDiv.innerHTML = renderPagination();
    }
  }

  function applyFiltersToEvents() {
    filteredEvents = todayEvents.filter(event => {
      const student = State.getStudent(event.student_id);
      if (filters.course && student?.course_id !== parseInt(filters.course)) return false;
      if (filters.type && event.type !== filters.type) return false;
      if (filters.search && student && !student.full_name.toLowerCase().includes(filters.search)) return false;
      return true;
    });
  }

  // ========================================
  // AUTO-REFRESH
  // ========================================

  Views.directorDashboard.cleanup = function() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
  };

  Views.directorDashboard.toggleAutoRefresh = function() {
    autoRefreshPaused = !autoRefreshPaused;
    const liveText = document.getElementById('live-text');
    const liveDot = document.getElementById('live-dot');
    const liveIndicator = document.getElementById('live-indicator');

    if (liveText) liveText.textContent = autoRefreshPaused ? 'Pausado' : 'En vivo';
    if (liveDot) {
      liveDot.classList.toggle('bg-green-500', !autoRefreshPaused);
      liveDot.classList.toggle('bg-gray-400', autoRefreshPaused);
    }
    if (liveIndicator) {
      liveIndicator.classList.toggle('bg-green-100', !autoRefreshPaused);
      liveIndicator.classList.toggle('text-green-700', !autoRefreshPaused);
      liveIndicator.classList.toggle('bg-gray-100', autoRefreshPaused);
      liveIndicator.classList.toggle('text-gray-700', autoRefreshPaused);
    }

    Components.showToast(
      autoRefreshPaused ? 'Auto-refresh pausado' : 'Auto-refresh reanudado',
      'info'
    );
  };

  async function refreshData() {
    if (autoRefreshPaused) return;

    try {
      if (State.isApiAuthenticated() && typeof API !== 'undefined' && API.getBootstrap) {
        try {
          const bootstrap = await API.getBootstrap();
          if (bootstrap && bootstrap.attendance_events) {
            State.data.attendance_events = bootstrap.attendance_events;
            State.persist();
          }
        } catch (apiError) {
          console.warn('API refresh failed, using local data:', apiError.message);
        }
      }

      const newStats = State.getTodayStats();
      const newEvents = State.getTodayEvents();
      const hasNewEvents = newEvents.length !== todayEvents.length;

      stats = newStats;
      todayEvents = newEvents;
      applyFiltersToEvents();
      updateStatsDisplay();

      if (hasNewEvents) {
        renderEventsTable();
      }

      const lastUpdate = document.getElementById('last-update-time');
      if (lastUpdate) {
        lastUpdate.textContent = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      }
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
    }
  }

  // ========================================
  // DARK MODE & MOBILE SIDEBAR
  // ========================================

  Views.directorDashboard.toggleDarkMode = function() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('darkMode', isDark);
    const icon = document.getElementById('dark-mode-icon');
    if (icon) icon.textContent = isDark ? 'light_mode' : 'dark_mode';
  };

  Views.directorDashboard.toggleMobileSidebar = function() {
    const sidebar = document.querySelector('aside');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) {
      const isHidden = sidebar.classList.contains('mobile-hidden');
      if (isHidden) {
        // Mostrar sidebar como overlay
        sidebar.classList.remove('mobile-hidden');
        sidebar.classList.add('fixed', 'inset-y-0', 'left-0', 'z-50', 'flex');
        if (backdrop) backdrop.classList.remove('hidden');
      } else {
        // Ocultar sidebar
        sidebar.classList.add('mobile-hidden');
        sidebar.classList.remove('fixed', 'inset-y-0', 'left-0', 'z-50', 'flex');
        if (backdrop) backdrop.classList.add('hidden');
      }
    }
  };

  // Initialize dark mode from localStorage
  const savedDarkMode = localStorage.getItem('darkMode') === 'true';
  if (savedDarkMode) {
    document.documentElement.classList.add('dark');
  }
  // Set initial icon
  setTimeout(() => {
    const icon = document.getElementById('dark-mode-icon');
    if (icon) icon.textContent = savedDarkMode ? 'light_mode' : 'dark_mode';
  }, 0);

  // ========================================
  // PUBLIC METHODS
  // ========================================

  Views.directorDashboard.changePage = function(page) {
    const totalPages = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderEventsTable();
  };

  Views.directorDashboard.applyFilters = function() {
    filters.course = document.getElementById('filter-course')?.value || '';
    filters.type = document.getElementById('filter-type')?.value || '';
    filters.search = (document.getElementById('filter-search')?.value || '').toLowerCase();

    applyFiltersToEvents();
    currentPage = 1;
    renderEventsTable();
    Components.showToast('Filtros aplicados', 'success');
  };

  Views.directorDashboard.exportCSV = function() {
    if (filteredEvents.length === 0) {
      Components.showToast('No hay eventos para exportar', 'warning');
      return;
    }

    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const headers = ['Fecha', 'Hora', 'Alumno', 'Curso', 'Tipo', 'Puerta', 'Fuente'];
    const rows = filteredEvents.map(event => {
      const student = State.getStudent(event.student_id);
      const course = student ? State.getCourse(student.course_id) : null;
      const date = event.ts.split('T')[0];
      const time = new Date(event.ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      const eventType = event.type === 'IN' ? 'Ingreso' : 'Salida';
      const source = event.source || 'MANUAL';

      return [date, time, student?.full_name || '-', course?.name || '-', eventType, event.gate_id || '-', source]
        .map(escapeCSV).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `eventos_asistencia_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    Components.showToast(`${filteredEvents.length} eventos exportados a CSV`, 'success');
  };

  Views.directorDashboard.showPhotos = function() {
    const eventsWithPhotos = filteredEvents.filter(e => e.photo_url || e.photo_ref);

    if (eventsWithPhotos.length === 0) {
      Components.showModal('Fotos de Evidencia', `
        <p style="text-align: center; color: var(--color-gray-500);">No hay fotos disponibles para los eventos filtrados.</p>
      `, [{ label: 'Cerrar', action: 'close', className: 'btn-secondary' }]);
      return;
    }

    const photosToShow = eventsWithPhotos.slice(0, 6);
    const photosHTML = photosToShow.map((e, idx) => {
      const student = State.getStudent(e.student_id);
      const studentName = student ? Components.escapeHtml(student.full_name) : 'Desconocido';
      const eventTime = new Date(e.ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="card" style="margin-bottom: 1rem;">
          <div class="card-body">
            <strong>${studentName}</strong> - ${eventTime}
            <div style="margin-top: 0.5rem; position: relative; min-height: 100px; display: flex; align-items: center; justify-content: center;">
              <img id="evidence-photo-${idx}" src="assets/placeholder_photo.svg" alt="Foto" style="max-width: 200px; border-radius: 4px; opacity: 0.3; transition: opacity 0.3s;" data-loading="true">
              <span id="evidence-loading-${idx}" style="position: absolute; font-size: 1.5rem;">⏳</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    Components.showModal('Fotos de Evidencia', `
      <div>${photosHTML}</div>
      ${eventsWithPhotos.length > 6 ? `<p style="text-align: center; color: var(--color-gray-500); margin-top: 1rem;">Mostrando 6 de ${eventsWithPhotos.length} fotos</p>` : ''}
    `, [{ label: 'Cerrar', action: 'close', className: 'btn-secondary' }]);

    photosToShow.forEach((event, idx) => {
      let photoUrl = event.photo_url;
      if (!photoUrl && event.photo_ref) {
        photoUrl = `${API.baseUrl}/photos/${event.photo_ref}`;
      }
      if (!photoUrl) return;

      API.loadAuthenticatedImage(photoUrl).then(blobUrl => {
        const img = document.getElementById(`evidence-photo-${idx}`);
        const loading = document.getElementById(`evidence-loading-${idx}`);
        if (img && blobUrl) {
          img.src = blobUrl;
          img.style.opacity = '1';
          img.removeAttribute('data-loading');
        } else if (img) {
          img.style.opacity = '0.5';
        }
        if (loading) loading.remove();
      }).catch(() => {
        const loading = document.getElementById(`evidence-loading-${idx}`);
        if (loading) loading.textContent = '❌';
      });
    });
  };

  Views.directorDashboard.showEventPhoto = function(eventId) {
    const event = filteredEvents.find(e => e.id === eventId) || todayEvents.find(e => e.id === eventId);
    if (!event) {
      Components.showToast('Evento no encontrado', 'error');
      return;
    }

    let photoUrl = event.photo_url;
    if (!photoUrl && event.photo_ref) {
      photoUrl = `${API.baseUrl}/photos/${event.photo_ref}`;
    }

    if (!photoUrl) {
      Components.showToast('Este evento no tiene foto', 'warning');
      return;
    }

    const student = State.getStudent(event.student_id);
    const studentName = student ? Components.escapeHtml(student.full_name) : 'Desconocido';
    const eventType = event.type === 'IN' ? 'Ingreso' : 'Salida';
    const eventTime = new Date(event.ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    Components.showModal(`Foto de ${studentName}`, `
      <div style="text-align: center;">
        <p style="margin-bottom: 1rem; color: var(--color-gray-600);">${eventType} - ${eventTime}</p>
        <div style="position: relative; min-height: 200px; display: flex; align-items: center; justify-content: center;">
          <img id="single-event-photo" src="assets/placeholder_photo.svg" alt="Foto de evidencia" style="max-width: 100%; max-height: 400px; border-radius: 8px; opacity: 0.3; transition: opacity 0.3s;">
          <span id="single-photo-loading" style="position: absolute; font-size: 2rem;">⏳ Cargando...</span>
        </div>
      </div>
    `, [{ label: 'Cerrar', action: 'close', className: 'btn-secondary' }]);

    API.loadAuthenticatedImage(photoUrl).then(blobUrl => {
      const img = document.getElementById('single-event-photo');
      const loading = document.getElementById('single-photo-loading');
      if (img && blobUrl) {
        img.src = blobUrl;
        img.style.opacity = '1';
      } else if (img) {
        img.style.opacity = '0.5';
      }
      if (loading) loading.remove();
    }).catch((err) => {
      console.error('Error loading photo:', err);
      const loading = document.getElementById('single-photo-loading');
      if (loading) loading.textContent = '❌ Error al cargar la foto';
    });
  };

  Views.directorDashboard.showNoIngressList = function() {
    const students = State.getStudents();
    const studentsWithIN = new Set(todayEvents.filter(e => e.type === 'IN').map(e => e.student_id));
    const noIngressStudents = students.filter(s => !studentsWithIN.has(s.id));

    noIngressStudents.sort((a, b) => {
      const courseA = State.getCourse(a.course_id);
      const courseB = State.getCourse(b.course_id);
      const courseNameA = courseA ? courseA.name : 'ZZZ';
      const courseNameB = courseB ? courseB.name : 'ZZZ';
      if (courseNameA !== courseNameB) return courseNameA.localeCompare(courseNameB);
      return a.full_name.localeCompare(b.full_name);
    });

    const listHTML = noIngressStudents.length > 0
      ? `
        <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--color-gray-200); border-radius: 8px;">
          <table style="width: 100%;">
            <thead style="position: sticky; top: 0; background: var(--color-gray-50); z-index: 1;">
              <tr>
                <th style="padding: 0.75rem; text-align: left;">Alumno</th>
                <th style="padding: 0.75rem; text-align: left;">Curso</th>
                <th style="padding: 0.75rem; text-align: center;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${noIngressStudents.map(s => {
                const course = State.getCourse(s.course_id);
                return `
                  <tr style="border-bottom: 1px solid var(--color-gray-100);">
                    <td style="padding: 0.5rem 0.75rem;">${Components.escapeHtml(s.full_name)}</td>
                    <td style="padding: 0.5rem 0.75rem;">${course ? Components.escapeHtml(course.name) : '-'}</td>
                    <td style="padding: 0.5rem 0.75rem; text-align: center;">
                      <button class="btn btn-secondary btn-sm" onclick="Components.showStudentProfile(${s.id}, { onBack: () => Views.directorDashboard.showNoIngressList() })">Ver Perfil</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        <p style="margin-top: 0.75rem; text-align: center; color: var(--color-gray-500); font-size: 0.85rem;">
          Mostrando ${noIngressStudents.length} alumno${noIngressStudents.length !== 1 ? 's' : ''} sin ingreso
        </p>
      `
      : '<p style="text-align: center; padding: 2rem;">Todos los alumnos han registrado entrada hoy. ✅</p>';

    Components.showModal(`Alumnos Sin Ingreso (${noIngressStudents.length})`, `
      <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--color-warning-light); border-radius: 8px; font-size: 0.9rem;">
        <strong>Nota:</strong> Estos alumnos no tienen registro de entrada el día de hoy (${new Date().toLocaleDateString('es-CL')}).
      </div>
      ${listHTML}
    `, [{ label: 'Cerrar', action: 'close', className: 'btn-secondary' }]);
  };

  // ========================================
  // START AUTO-REFRESH
  // ========================================

  autoRefreshInterval = setInterval(refreshData, AUTO_REFRESH_INTERVAL_MS);

  if (typeof Router !== 'undefined' && Router.onViewChange) {
    Router.onViewChange(Views.directorDashboard.cleanup);
  }
};
