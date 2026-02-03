// Director Students Management
// Counter for race condition protection when loading photos
let photoLoadCounter = 0;

Views.directorStudents = function () {
  const app = document.getElementById('app');

  // Current path for active state
  const currentPath = '/director/students';

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

  // Get user info
  const user = State.getCurrentUser();
  const userName = user?.full_name || 'Director';

  const courses = State.getCourses();
  let filteredStudents = State.getStudents();
  let searchTerm = '';
  let selectedCourse = '';
  let selectedStatus = '';  // '', 'ACTIVE', 'INACTIVE', 'DELETED'

  // Pagination state
  const PAGE_SIZE = 10;
  let currentPage = 1;

  // Helper to get current dark mode state
  const isDarkMode = () => document.documentElement.classList.contains('dark');

  // Toggle dark mode
  window.toggleDarkMode = function () {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDarkMode() ? 'enabled' : 'disabled');
    renderStudents();
  };

  // Toggle mobile sidebar
  window.toggleMobileSidebar = function () {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar && backdrop) {
      sidebar.classList.toggle('mobile-hidden');
      backdrop.classList.toggle('hidden');
    }
  };

  // Helper to get progress bar color based on percentage
  const getProgressColor = (pct) => {
    if (pct >= 70) return 'bg-emerald-500';
    if (pct >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  // Pagination helpers
  const getTotalPages = () => Math.ceil(filteredStudents.length / PAGE_SIZE);
  const getPaginatedStudents = () => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  };

  // Helper to render table rows
  function renderTableRows() {
    const paginatedStudents = getPaginatedStudents();

    if (paginatedStudents.length === 0) {
      return `
        <tr>
          <td colspan="6" class="px-6 py-12 text-center">
            <div class="flex flex-col items-center justify-center">
              <span class="material-icons-round text-5xl text-slate-300 dark:text-slate-600 mb-3">school</span>
              <p class="text-slate-500 dark:text-slate-400 font-medium">
                ${searchTerm || selectedCourse || selectedStatus
                  ? 'No hay alumnos que coincidan con los filtros'
                  : 'No hay alumnos registrados'}
              </p>
            </div>
          </td>
        </tr>
      `;
    }

    return paginatedStudents.map(student => {
      const course = State.getCourse(student.course_id);
      const stats = State.getStudentAttendanceStats(student.id);
      const percentage = stats.percentage || 0;
      const isDeleted = student.status === 'DELETED';
      const isInactive = student.status === 'INACTIVE';

      // Status badge
      let statusBadge;
      if (isDeleted) {
        statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">Eliminado</span>`;
      } else if (isInactive) {
        statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">Inactivo</span>`;
      } else {
        statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Activo</span>`;
      }

      // Photo auth badge
      const photoAuthBadge = student.photo_pref_opt_in
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">SI</span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">NO</span>`;

      // Avatar (initial or photo)
      const avatarContent = student.photo_url
        ? `<img src="${student.photo_url}" class="w-full h-full object-cover" alt="${Components.escapeHtml(student.full_name)}" />`
        : student.full_name.charAt(0).toUpperCase();

      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group ${isDeleted ? 'opacity-70' : ''}">
          <td class="px-6 py-4">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-100 dark:border-indigo-800 overflow-hidden">
                ${avatarContent}
              </div>
              <span class="font-bold text-slate-700 dark:text-slate-200">${Components.escapeHtml(student.full_name)}</span>
            </div>
          </td>
          <td class="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">${course ? Components.escapeHtml(course.name) : '-'}</td>
          <td class="px-6 py-4 text-center">${statusBadge}</td>
          <td class="px-6 py-4 min-w-[160px]">
            <div class="flex items-center gap-3">
              <span class="text-sm font-bold text-slate-700 dark:text-slate-200">${percentage}%</span>
              <div class="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div class="h-full ${getProgressColor(percentage)} rounded-full" style="width: ${percentage}%"></div>
              </div>
            </div>
          </td>
          <td class="px-6 py-4 text-center">${photoAuthBadge}</td>
          <td class="px-6 py-4 text-right">
            <div class="flex justify-end gap-1 opacity-80 group-hover:opacity-100">
              ${isDeleted ? `
                <button onclick="Views.directorStudents.restoreStudent(${student.id})"
                        class="px-3 py-1.5 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-600 dark:text-green-400 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1"
                        title="Restaurar estudiante">
                  <span class="material-icons-round text-[16px]">restore</span>
                  Restaurar
                </button>
              ` : `
                <button onclick="Views.directorStudents.viewProfile(${student.id})"
                        class="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg transition-all duration-200"
                        title="Ver Perfil">
                  <span class="material-icons-round text-[20px]">visibility</span>
                </button>
                <button onclick="Views.directorStudents.showEnrollMenu(${student.id})"
                        class="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg transition-all duration-200"
                        title="Generar Credencial QR/NFC">
                  <span class="material-icons-round text-[20px]">qr_code_2</span>
                </button>
                <button onclick="Views.directorStudents.viewAttendance(${student.id})"
                        class="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg transition-all duration-200"
                        title="Ver Asistencia">
                  <span class="material-icons-round text-[20px]">calendar_today</span>
                </button>
                <button onclick="Views.directorStudents.showEditForm(${student.id})"
                        class="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg transition-all duration-200"
                        title="Editar">
                  <span class="material-icons-round text-[20px]">edit</span>
                </button>
                <button onclick="Views.directorStudents.confirmDelete(${student.id})"
                        class="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 rounded-lg transition-all duration-200"
                        title="Eliminar">
                  <span class="material-icons-round text-[20px]">delete</span>
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Update table content without full re-render
  function updateTableContent() {
    const tbody = document.getElementById('students-tbody');
    const countSpan = document.getElementById('student-count');
    const paginationInfo = document.getElementById('pagination-info');

    if (tbody) {
      tbody.innerHTML = renderTableRows();
    }

    if (countSpan) {
      countSpan.textContent = `(${filteredStudents.length})`;
    }

    // Update pagination
    if (paginationInfo) {
      const start = filteredStudents.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
      const end = Math.min(currentPage * PAGE_SIZE, filteredStudents.length);
      paginationInfo.textContent = `Mostrando ${start} a ${end} de ${filteredStudents.length} alumnos`;
    }

    // Update pagination buttons state
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage >= getTotalPages();
  }

  function renderStudents() {
    const totalStudents = filteredStudents.length;
    const start = totalStudents > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
    const end = Math.min(currentPage * PAGE_SIZE, totalStudents);

    app.innerHTML = `
      <div class="h-screen flex overflow-hidden bg-slate-50 dark:bg-background-dark">
        <!-- Sidebar -->
        <aside id="sidebar" class="w-64 bg-sidebar-dark text-gray-300 flex-shrink-0 flex-col transition-all duration-300 mobile-hidden border-r border-indigo-900/50 shadow-2xl z-50">
          <div class="h-20 flex items-center justify-between px-6 border-b border-indigo-900/50">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg">
                <div class="w-4 h-4 bg-indigo-900 rounded-full"></div>
              </div>
              <h1 class="text-xl font-bold tracking-tight text-white">NEUVOX</h1>
            </div>
            <button class="desktop-hidden text-gray-400 hover:text-white p-1" onclick="toggleMobileSidebar()">
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

        <!-- Mobile Sidebar Backdrop -->
        <div id="sidebar-backdrop" class="fixed inset-0 bg-black/50 z-40 hidden desktop-hidden" onclick="toggleMobileSidebar()"></div>

        <!-- Main Content -->
        <main class="flex-1 flex flex-col overflow-hidden">
          <!-- Header -->
          <header class="h-20 bg-white dark:bg-card-dark border-b border-slate-200 dark:border-border-dark flex items-center justify-between px-8 z-10">
            <div class="flex items-center gap-4">
              <button class="desktop-hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg" onclick="toggleMobileSidebar()">
                <span class="material-icons-round text-2xl text-slate-600 dark:text-slate-300">menu</span>
              </button>
              <h2 class="text-xl font-bold text-slate-800 dark:text-white">
                Gestion de Alumnos <span id="student-count" class="text-slate-400 font-medium ml-1">(${totalStudents})</span>
              </h2>
            </div>
            <div class="flex items-center gap-4">
              <!-- Dark Mode Toggle -->
              <button onclick="toggleDarkMode()" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Cambiar tema">
                <span class="material-icons-round text-xl text-slate-500 dark:text-slate-400">${isDarkMode() ? 'light_mode' : 'dark_mode'}</span>
              </button>
              <!-- User -->
              <div class="flex items-center gap-2 cursor-pointer">
                <div class="w-9 h-9 rounded-full border border-gray-200 bg-indigo-600 flex items-center justify-center text-white font-semibold">
                  ${userName.charAt(0).toUpperCase()}
                </div>
                <div class="text-right mobile-hidden">
                  <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">${Components.escapeHtml(userName)}</p>
                </div>
              </div>
              <!-- Logout -->
              <a class="ml-1 md:ml-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 border px-2 md:px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 dark:border-gray-600" href="#" onclick="event.preventDefault(); State.logout(); Router.navigate('/login')">
                <span class="material-icons-round text-lg">logout</span>
                <span class="mobile-hidden">Salir</span>
              </a>
            </div>
          </header>

          <!-- Content Area -->
          <div class="flex-1 overflow-y-auto p-8 space-y-6">
            <!-- Filters Section -->
            <div class="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm flex flex-wrap items-end gap-4">
              <!-- Search -->
              <div class="flex-1 min-w-[240px]">
                <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Buscar alumno</label>
                <div class="relative">
                  <span class="material-icons-round absolute left-3 top-2.5 text-slate-400">search</span>
                  <input type="text" id="search-student"
                         class="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                         placeholder="Buscar por nombre..."
                         value="${Components.escapeHtml(searchTerm)}"
                         onkeyup="Views.directorStudents.search(this.value)">
                </div>
              </div>

              <!-- Course Filter -->
              <div class="w-48">
                <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Curso</label>
                <select id="filter-course"
                        class="w-full py-2.5 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        onchange="Views.directorStudents.filterByCourse(this.value)">
                  <option value="">Todos los cursos</option>
                  ${courses.map(c => `<option value="${c.id}" ${selectedCourse === String(c.id) ? 'selected' : ''}>${Components.escapeHtml(c.name)}</option>`).join('')}
                </select>
              </div>

              <!-- Status Filter -->
              <div class="w-48">
                <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Estado</label>
                <select id="filter-status"
                        class="w-full py-2.5 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        onchange="Views.directorStudents.filterByStatus(this.value)">
                  <option value="" ${selectedStatus === '' ? 'selected' : ''}>Activos</option>
                  <option value="INACTIVE" ${selectedStatus === 'INACTIVE' ? 'selected' : ''}>Inactivos</option>
                  <option value="DELETED" ${selectedStatus === 'DELETED' ? 'selected' : ''}>Eliminados</option>
                  <option value="ALL" ${selectedStatus === 'ALL' ? 'selected' : ''}>Todos</option>
                </select>
              </div>

              <!-- Clear Filters -->
              <button onclick="Views.directorStudents.clearFilters()"
                      class="px-5 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Limpiar Filtros
              </button>

              <!-- New Student Button -->
              <button onclick="Views.directorStudents.showCreateForm()"
                      class="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 px-6 py-2.5 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-2 transition-all">
                <span class="material-icons-round text-xl">person_add</span>
                + Nuevo Alumno
              </button>
            </div>

            <!-- Students Table -->
            <div class="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden">
              <!-- Table Header -->
              <div class="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                <h3 class="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Lista de Alumnos</h3>
              </div>

              <!-- Table -->
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                      <th class="px-6 py-4">Nombre</th>
                      <th class="px-6 py-4">Curso</th>
                      <th class="px-6 py-4 text-center">Estado</th>
                      <th class="px-6 py-4">Asistencia</th>
                      <th class="px-6 py-4 text-center">Aut. Foto</th>
                      <th class="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody id="students-tbody" class="divide-y divide-slate-50 dark:divide-slate-800">
                    ${renderTableRows()}
                  </tbody>
                </table>
              </div>

              <!-- Pagination -->
              <div class="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span id="pagination-info">Mostrando ${start} a ${end} de ${totalStudents} alumnos</span>
                <div class="flex gap-2">
                  <button id="prev-page-btn" onclick="Views.directorStudents.prevPage()"
                          class="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          ${currentPage === 1 ? 'disabled' : ''}>
                    Anterior
                  </button>
                  <button id="next-page-btn" onclick="Views.directorStudents.nextPage()"
                          class="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          ${currentPage >= getTotalPages() ? 'disabled' : ''}>
                    Siguiente
                  </button>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <footer class="text-center text-[10px] text-slate-400 dark:text-slate-500 font-medium pt-4 pb-8 uppercase tracking-[2px]">
              &copy; 2026 NEUVOX. Todos los derechos reservados.
            </footer>
          </div>
        </main>
      </div>
    `;
  }

  // Pagination methods
  Views.directorStudents.prevPage = function () {
    if (currentPage > 1) {
      currentPage--;
      updateTableContent();
    }
  };

  Views.directorStudents.nextPage = function () {
    if (currentPage < getTotalPages()) {
      currentPage++;
      updateTableContent();
    }
  };

  // Helper function to apply all current filters
  async function applyCurrentFilters() {
    // Reset to first page when filters change
    currentPage = 1;

    // Para DELETED o ALL, necesitamos llamar a la API
    if (selectedStatus === 'DELETED' || selectedStatus === 'ALL') {
      try {
        const params = new URLSearchParams();
        if (searchTerm && searchTerm.length >= 2) params.append('q', searchTerm);
        if (selectedCourse) params.append('course_id', selectedCourse);
        if (selectedStatus === 'DELETED') params.append('status', 'DELETED');

        const queryString = params.toString();
        const url = `/students${queryString ? '?' + queryString : ''}`;
        const response = await API.request(url);

        if (response.ok) {
          const data = await response.json();
          filteredStudents = data.items || [];
        } else {
          Components.showToast('Error al cargar estudiantes', 'error');
          filteredStudents = [];
        }
      } catch (error) {
        console.error('Error fetching students:', error);
        Components.showToast('Error de conexion', 'error');
        filteredStudents = [];
      }
    } else {
      // Filtrado local para ACTIVE e INACTIVE
      filteredStudents = State.getStudents().filter(student => {
        const term = searchTerm.toLowerCase();
        if (term && !student.full_name.toLowerCase().includes(term)) {
          return false;
        }

        if (selectedCourse && student.course_id !== parseInt(selectedCourse)) {
          return false;
        }

        // Filtrar por estado (los datos locales solo tienen ACTIVE por defecto)
        if (selectedStatus === 'INACTIVE' && student.status !== 'INACTIVE') {
          return false;
        }

        return true;
      });
    }
  }

  // Reactive filter methods
  Views.directorStudents.search = function (term) {
    searchTerm = term;
    applyCurrentFilters().then(() => updateTableContent());
  };

  Views.directorStudents.filterByCourse = function (course) {
    selectedCourse = course;
    applyCurrentFilters().then(() => updateTableContent());
  };

  Views.directorStudents.filterByStatus = async function (status) {
    selectedStatus = status;
    await applyCurrentFilters();
    renderStudents();
  };

  Views.directorStudents.clearFilters = async function () {
    searchTerm = '';
    selectedCourse = '';
    selectedStatus = '';
    currentPage = 1;
    filteredStudents = State.getStudents();
    renderStudents();
  };

  // Legacy method for compatibility
  Views.directorStudents.applyFilters = async function () {
    searchTerm = document.getElementById('search-student')?.value || '';
    selectedCourse = document.getElementById('filter-course')?.value || '';
    selectedStatus = document.getElementById('filter-status')?.value || '';
    await applyCurrentFilters();
    renderStudents();
  };

  Views.directorStudents.showCreateForm = function () {
    const coursesOptions = courses.map(c =>
      `<option value="${c.id}">${Components.escapeHtml(c.name)} - ${Components.escapeHtml(c.grade)}</option>`
    ).join('');

    // Get guardians for selector
    const guardians = State.getGuardians();
    const guardiansOptions = guardians.map(g =>
      `<option value="${g.id}">${Components.escapeHtml(g.full_name)} (${Components.escapeHtml(g.email || 'sin email')})</option>`
    ).join('');

    Components.showModal('Nuevo Alumno', `
      <form id="student-form">
        <div class="form-group">
          <label class="form-label">Nombre Completo *</label>
          <input type="text" id="student-name" class="form-input" required placeholder="Ej: Juan Perez Garcia">
        </div>
        <div class="form-group">
          <label class="form-label">Curso *</label>
          <select id="student-course" class="form-select" required>
            <option value="">Seleccione un curso</option>
            ${coursesOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">RUT o N Matricula (opcional)</label>
          <input type="text" id="student-rut" class="form-input" placeholder="Ej: 12.345.678-9 o MAT-2024-001">
          <small style="color: var(--color-gray-500); display: block; margin-top: 0.25rem;">
            Identificador unico del alumno en el colegio
          </small>
        </div>

        <!-- Guardian selector -->
        <div class="form-group">
          <label class="form-label">Apoderado</label>
          <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
            <select id="student-guardian" class="form-select" style="flex: 1;">
              <option value="">Sin apoderado asignado</option>
              ${guardiansOptions}
            </select>
            <button type="button" class="btn btn-secondary btn-sm" onclick="Views.directorStudents.goToCreateGuardian()" title="Crear nuevo apoderado" style="white-space: nowrap;">
              + Nuevo
            </button>
          </div>
          <small style="color: var(--color-gray-500); display: block; margin-top: 0.25rem;">
            El apoderado recibira notificaciones de asistencia.
            <a href="#/director/guardians" style="color: var(--color-primary);">Ir a gestion de apoderados</a>
          </small>
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" id="student-photo">
            <span>Autorizar captura de fotos</span>
          </label>
        </div>

        <!-- Nota sobre enrolamiento -->
        <div style="background: var(--color-info-light); padding: 0.75rem; border-radius: 8px; margin-top: 1rem; font-size: 0.85rem;">
          <strong>Credenciales QR/NFC:</strong>
          <p style="margin: 0.25rem 0 0; color: var(--color-gray-600);">
            Despues de guardar el alumno, podras generar su credencial QR o NFC desde el boton "Ver perfil" en la tabla.
          </p>
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorStudents.saveStudent() }
    ]);
  };

  Views.directorStudents.goToCreateGuardian = function () {
    document.querySelector('.modal-container').click();
    Components.showToast('Cree el apoderado y luego vuelva a crear el alumno', 'info', 3000);
    Router.navigate('/director/guardians');
  };

  Views.directorStudents.saveStudent = async function (studentId = null) {
    const name = document.getElementById('student-name').value.trim();
    const courseId = parseInt(document.getElementById('student-course').value);
    const nationalId = document.getElementById('student-rut')?.value.trim() || '';
    const photoOptIn = document.getElementById('student-photo').checked;
    const guardianSelect = document.getElementById('student-guardian');
    const guardianId = guardianSelect ? parseInt(guardianSelect.value) || null : null;
    const photoFileInput = document.getElementById('student-photo-file');
    const photoFile = photoFileInput?.files?.[0] || null;

    if (!name || !courseId) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    // Convert photoOptIn to evidence_preference for new API
    const evidencePreference = photoOptIn ? 'photo' : 'none';

    const studentData = {
      full_name: name,
      course_id: courseId,
      national_id: nationalId || null,
      evidence_preference: evidencePreference
    };

    let newStudentId = studentId;
    try {
      if (studentId) {
        // Update existing student
        if (State.isApiAuthenticated()) {
          await API.updateStudent(studentId, studentData);
        }
        State.updateStudent(studentId, { ...studentData, photo_pref_opt_in: photoOptIn });
      } else {
        // Create new student
        if (State.isApiAuthenticated()) {
          const createdStudent = await API.createStudent(studentData);
          newStudentId = createdStudent.id;
          // Add to local state with the real ID from backend
          State.addStudent({ ...studentData, id: newStudentId, status: 'ACTIVE', photo_pref_opt_in: photoOptIn });
        } else {
          // Demo mode - only localStorage
          const newStudent = State.addStudent({ ...studentData, photo_pref_opt_in: photoOptIn });
          newStudentId = newStudent.id;
        }
      }
    } catch (error) {
      console.error('Error saving student:', error);
      Components.showToast(error.message || 'Error al guardar estudiante', 'error');
      return;
    }

    // Upload photo if a new one was selected
    if (photoFile && newStudentId) {
      try {
        Components.showToast('Subiendo foto...', 'info', 2000);
        await API.uploadStudentPhoto(newStudentId, photoFile);
        Components.showToast('Foto subida correctamente', 'success');
      } catch (e) {
        console.error('Error uploading photo:', e);
        Components.showToast(e.message || 'Error al subir la foto', 'error');
      }
    }

    // Handle guardian association
    if (newStudentId) {
      const guardians = State.getGuardians();

      // Find current guardian (if editing)
      const currentGuardian = guardians.find(g => g.student_ids && g.student_ids.includes(newStudentId));

      // Remove from old guardian if different
      if (currentGuardian && currentGuardian.id !== guardianId) {
        State.updateGuardian(currentGuardian.id, {
          student_ids: currentGuardian.student_ids.filter(id => id !== newStudentId)
        });
      }

      // Add to new guardian if selected
      if (guardianId) {
        const newGuardian = State.getGuardian(guardianId);
        if (newGuardian) {
          const guardianStudentIds = newGuardian.student_ids || [];
          if (!guardianStudentIds.includes(newStudentId)) {
            State.updateGuardian(guardianId, {
              student_ids: [...guardianStudentIds, newStudentId]
            });
          }
        }
      }
    }

    Components.showToast(studentId ? 'Alumno actualizado correctamente' : 'Alumno creado correctamente', 'success');
    document.querySelector('.modal-container').click(); // Close modal
    filteredStudents = State.getStudents();
    currentPage = 1;
    renderStudents();
  };

  Views.directorStudents.showEditForm = async function (studentId) {
    const student = State.getStudent(studentId);
    if (!student) return;

    // Try to get photo URL from backend if available
    let photoPreviewUrl = null;
    try {
      const studentDetails = await API.getStudent(studentId);
      photoPreviewUrl = studentDetails.photo_presigned_url;
    } catch (e) {
      console.log('Could not fetch student photo details:', e);
    }

    // Generate unique ID for this photo load (race condition protection)
    const currentPhotoLoadId = ++photoLoadCounter;

    const coursesOptions = courses.map(c =>
      `<option value="${c.id}" ${c.id === student.course_id ? 'selected' : ''}>${Components.escapeHtml(c.name)} - ${Components.escapeHtml(c.grade)}</option>`
    ).join('');

    // Get guardians and find current guardian for this student
    const guardians = State.getGuardians();
    const currentGuardian = guardians.find(g => g.student_ids && g.student_ids.includes(studentId));
    const guardiansOptions = guardians.map(g =>
      `<option value="${g.id}" ${currentGuardian && currentGuardian.id === g.id ? 'selected' : ''}>${Components.escapeHtml(g.full_name)} (${Components.escapeHtml(g.email || 'sin email')})</option>`
    ).join('');

    // Build photo HTML with loading state if URL exists
    const photoHTML = photoPreviewUrl
      ? `<div style="position: relative; display: inline-block; width: 100%; height: 100%;">
           <img id="photo-preview" src="" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.3;" data-loading="true">
           <div id="photo-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px;">...</div>
         </div>`
      : `<span id="photo-placeholder" style="font-size: 2rem; color: var(--color-gray-400);"><span class="material-icons-round">photo_camera</span></span>`;

    Components.showModal('Editar Alumno', `
      <form id="student-form">
        <!-- Photo Upload Section -->
        <div class="form-group">
          <label class="form-label">Foto del Alumno</label>
          <div style="display: flex; gap: 1rem; align-items: flex-start;">
            <div id="photo-preview-container" style="width: 100px; height: 100px; border: 2px dashed var(--color-gray-300); border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--color-gray-50);">
              ${photoHTML}
            </div>
            <div style="flex: 1;">
              <input type="file" id="student-photo-file" accept="image/jpeg,image/png,image/webp" style="display: none;" onchange="Views.directorStudents.previewPhoto(this)">
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('student-photo-file').click()">
                ${photoPreviewUrl ? 'Cambiar foto' : 'Subir foto'}
              </button>
              ${photoPreviewUrl ? `
                <button type="button" class="btn btn-error btn-sm" onclick="Views.directorStudents.removePhotoPreview(${studentId})" style="margin-left: 0.5rem;">
                  Eliminar
                </button>
              ` : ''}
              <small style="color: var(--color-gray-500); display: block; margin-top: 0.5rem;">
                Formatos: JPG, PNG, WebP. Maximo: 5MB
              </small>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Nombre Completo *</label>
          <input type="text" id="student-name" class="form-input" required value="${Components.escapeHtml(student.full_name)}">
        </div>
        <div class="form-group">
          <label class="form-label">Curso *</label>
          <select id="student-course" class="form-select" required>
            ${coursesOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">RUT o N Matricula</label>
          <input type="text" id="student-rut" class="form-input" value="${Components.escapeHtml(student.national_id || '')}" placeholder="Ej: 12.345.678-9 o MAT-2024-001">
          <small style="color: var(--color-gray-500); display: block; margin-top: 0.25rem;">
            Identificador unico del alumno en el colegio
          </small>
        </div>

        <!-- Guardian selector -->
        <div class="form-group">
          <label class="form-label">Apoderado</label>
          <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
            <select id="student-guardian" class="form-select" style="flex: 1;">
              <option value="">Sin apoderado asignado</option>
              ${guardiansOptions}
            </select>
            <button type="button" class="btn btn-secondary btn-sm" onclick="Views.directorStudents.goToCreateGuardian()" title="Crear nuevo apoderado" style="white-space: nowrap;">
              + Nuevo
            </button>
          </div>
          <small style="color: var(--color-gray-500); display: block; margin-top: 0.25rem;">
            El apoderado recibira notificaciones de asistencia.
          </small>
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" id="student-photo" ${student.photo_pref_opt_in ? 'checked' : ''}>
            <span>Autorizar captura de fotos</span>
          </label>
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorStudents.saveStudent(studentId) }
    ]);

    // Load photo with authentication after modal is rendered
    if (photoPreviewUrl) {
      API.loadAuthenticatedImage(photoPreviewUrl).then(blobUrl => {
        // Verify no navigation occurred during load (race condition protection)
        if (photoLoadCounter !== currentPhotoLoadId) return;

        const img = document.getElementById('photo-preview');
        const loading = document.getElementById('photo-loading');

        if (img && blobUrl) {
          img.src = blobUrl;
          img.style.opacity = '1';
          img.removeAttribute('data-loading');
        }
        if (loading) loading.remove();
      }).catch(err => {
        console.error('Error loading photo:', err);
        const loading = document.getElementById('photo-loading');
        if (loading) loading.innerHTML = 'Error';
      });
    }
  };

  // Preview photo before upload
  Views.directorStudents.previewPhoto = function (input) {
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        Components.showToast('La imagen es demasiado grande. Maximo 5MB', 'error');
        input.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = function (e) {
        const container = document.getElementById('photo-preview-container');
        container.innerHTML = `<img id="photo-preview" src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove photo preview and mark for deletion
  Views.directorStudents.removePhotoPreview = async function (studentId) {
    try {
      await API.deleteStudentPhoto(studentId);
      const container = document.getElementById('photo-preview-container');
      container.innerHTML = `<span id="photo-placeholder" style="font-size: 2rem; color: var(--color-gray-400);"><span class="material-icons-round">photo_camera</span></span>`;
      document.getElementById('student-photo-file').value = '';
      Components.showToast('Foto eliminada', 'success');
    } catch (e) {
      Components.showToast(e.message || 'Error al eliminar foto', 'error');
    }
  };

  Views.directorStudents.confirmDelete = function (studentId) {
    const student = State.getStudent(studentId);
    if (!student) return;

    Components.showModal('Confirmar Eliminacion', `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">
          <span class="material-icons-round text-red-500" style="font-size: 48px;">warning</span>
        </div>
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">Esta seguro de eliminar al alumno?</p>
        <p style="font-weight: 600; color: var(--color-error);">${Components.escapeHtml(student.full_name)}</p>
        <p style="font-size: 0.9rem; color: var(--color-gray-500); margin-top: 1rem;">
          Esta accion eliminara tambien todos los registros de asistencia del alumno.
        </p>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      {
        label: 'Eliminar', action: 'delete', className: 'btn-error', onClick: async () => {
          try {
            // Delete from backend if authenticated
            if (State.isApiAuthenticated()) {
              await API.deleteStudent(studentId);
            }
            // Delete from local state
            State.deleteStudent(studentId);
            document.querySelector('.modal-container').click();
            Components.showToast('Alumno eliminado', 'success');
            filteredStudents = State.getStudents();
            currentPage = 1;
            renderStudents();
          } catch (error) {
            console.error('Error deleting student:', error);
            Components.showToast(error.message || 'Error al eliminar estudiante', 'error');
          }
        }
      }
    ]);
  };

  Views.directorStudents.restoreStudent = async function (studentId) {
    Components.showModal('Restaurar Estudiante', `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">
          <span class="material-icons-round text-green-500" style="font-size: 48px;">restore</span>
        </div>
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">Restaurar este estudiante?</p>
        <p style="font-size: 0.9rem; color: var(--color-gray-500); margin-top: 1rem;">
          El estudiante volvera a aparecer en las listas normales.
        </p>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      {
        label: 'Restaurar', action: 'restore', className: 'btn-success', onClick: async () => {
          try {
            // Call API to restore student
            const response = await API.request(`/students/${studentId}/restore`, {
              method: 'POST'
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.detail || 'Error al restaurar');
            }

            document.querySelector('.modal-container').click();
            Components.showToast('Estudiante restaurado', 'success');

            // Refresh the list
            await Views.directorStudents.applyFilters();
          } catch (error) {
            console.error('Error restoring student:', error);
            Components.showToast(error.message || 'Error al restaurar estudiante', 'error');
          }
        }
      }
    ]);
  };

  Views.directorStudents.viewProfile = async function (studentId) {
    const student = State.getStudent(studentId);
    const course = State.getCourse(student.course_id);
    const guardians = State.getGuardians().filter(g => g.student_ids.includes(studentId));
    const stats = State.getStudentAttendanceStats(studentId);

    // Try to get photo URL from backend
    let photoUrl = null;
    try {
      const studentDetails = await API.getStudent(studentId);
      photoUrl = studentDetails.photo_presigned_url;
    } catch (e) {
      console.log('Could not fetch student photo:', e);
    }

    // Generate unique ID for this photo load (race condition protection)
    const currentPhotoLoadId = ++photoLoadCounter;

    // Helper to format contact type labels
    const contactLabels = { email: 'Email', phone: 'Telefono', whatsapp: 'WhatsApp' };
    const formatContacts = (contacts) => {
      if (!contacts || typeof contacts !== 'object') return 'Sin contactos';
      const entries = Object.entries(contacts).filter(([_, v]) => v);
      if (entries.length === 0) return 'Sin contactos';
      return entries.map(([type, value]) =>
        `${contactLabels[type] || type}: ${Components.escapeHtml(String(value))}`
      ).join(' | ');
    };

    const guardiansHTML = guardians.map(g => `
      <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--color-gray-100);">
        <strong>${Components.escapeHtml(g.full_name)}</strong><br>
        <span style="font-size: 0.85rem; color: var(--color-gray-500);">
          ${formatContacts(g.contacts)}
        </span>
      </li>
    `).join('');

    // Build photo HTML with loading state if URL exists
    const photoHTML = photoUrl
      ? `<div style="position: relative; display: inline-block;">
           <img id="profile-photo" src="" style="width: 120px; height: 120px; object-fit: cover; border-radius: 50%; border: 3px solid var(--color-primary); opacity: 0.3;" data-loading="true">
           <div id="profile-photo-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px;">...</div>
         </div>`
      : `<div style="width: 120px; height: 120px; border-radius: 50%; background: var(--color-gray-200); display: flex; align-items: center; justify-content: center; font-size: 3rem; color: var(--color-gray-400);"><span class="material-icons-round" style="font-size: 48px;">person</span></div>`;

    Components.showModal(`Perfil - ${student.full_name}`, `
      <div class="card mb-2">
        <div class="card-header">Informacion Basica</div>
        <div class="card-body">
          <div style="display: flex; gap: 1.5rem; align-items: flex-start;">
            <div style="flex-shrink: 0;">
              ${photoHTML}
            </div>
            <div style="flex: 1; display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
              <div><strong>Nombre:</strong><br>${Components.escapeHtml(student.full_name)}</div>
              <div><strong>Curso:</strong><br>${course ? Components.escapeHtml(course.name + ' - ' + course.grade) : '-'}</div>
              <div><strong>RUT/Matricula:</strong><br>${student.national_id || 'No registrado'}</div>
              <div><strong>ID Sistema:</strong><br><span style="font-family: monospace; color: var(--color-gray-500);">#${student.id}</span> <small style="color: var(--color-gray-400);">(auto)</small></div>
            </div>
          </div>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-header">Estadisticas de Asistencia</div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
            <div style="background: var(--color-success-light); padding: 1rem; border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-success);">${stats.percentage}%</div>
              <div style="font-size: 0.8rem; color: var(--color-gray-600);">Asistencia</div>
            </div>
            <div style="background: var(--color-primary-light); padding: 1rem; border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-primary);">${stats.daysPresent}</div>
              <div style="font-size: 0.8rem; color: var(--color-gray-600);">Dias Presente</div>
            </div>
            <div style="background: var(--color-warning-light); padding: 1rem; border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-warning);">${stats.lateArrivals}</div>
              <div style="font-size: 0.8rem; color: var(--color-gray-600);">Atrasos</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Apoderados Vinculados</div>
        <div class="card-body">
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${guardiansHTML || '<li style="color: var(--color-gray-500);">Sin apoderados registrados</li>'}
          </ul>
        </div>
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' },
      {
        label: 'Enrolar QR', action: 'qr', className: 'btn-secondary', onClick: () => {
          document.querySelector('.modal-container').click();
          if (typeof QREnrollment !== 'undefined') {
            QREnrollment.showStudentEnrollmentModal(studentId);
          } else {
            Components.showToast('Servicio QR no disponible', 'error');
          }
        }
      },
      {
        label: 'Enrolar NFC', action: 'nfc', className: 'btn-secondary', onClick: () => {
          document.querySelector('.modal-container').click();
          if (typeof NFCEnrollment !== 'undefined') {
            NFCEnrollment.showStudentEnrollmentModal(studentId);
          } else {
            Components.showToast('Servicio NFC no disponible', 'error');
          }
        }
      },
      {
        label: 'Ver Asistencia', action: 'attendance', className: 'btn-primary', onClick: () => {
          document.querySelector('.modal-container').click();
          Views.directorStudents.viewAttendance(studentId);
        }
      }
    ]);

    // Load photo with authentication after modal is rendered
    if (photoUrl) {
      API.loadAuthenticatedImage(photoUrl).then(blobUrl => {
        // Verify no navigation occurred during load (race condition protection)
        if (photoLoadCounter !== currentPhotoLoadId) return;

        const img = document.getElementById('profile-photo');
        const loading = document.getElementById('profile-photo-loading');

        if (img && blobUrl) {
          img.src = blobUrl;
          img.style.opacity = '1';
          img.removeAttribute('data-loading');
        }
        if (loading) loading.remove();
      }).catch(err => {
        console.error('Error loading profile photo:', err);
        const loading = document.getElementById('profile-photo-loading');
        if (loading) loading.innerHTML = 'Error';
      });
    }
  };

  Views.directorStudents.viewAttendance = function (studentId) {
    const student = State.getStudent(studentId);
    if (!student) return;

    const course = State.getCourse(student.course_id);
    const stats = State.getStudentAttendanceStats(studentId);
    const events = State.getAttendanceEvents({ studentId }).slice(0, 20);

    const eventsHTML = events.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Tipo</th>
            <th>Fuente</th>
          </tr>
        </thead>
        <tbody>
          ${events.map(e => `
            <tr>
              <td>${Components.formatDate(e.ts)}</td>
              <td>${Components.formatTime(e.ts)}</td>
              <td>${e.type === 'IN' ? Components.createChip('Entrada', 'success') : Components.createChip('Salida', 'info')}</td>
              <td>${Components.createChip(e.source || 'QR', 'gray')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p style="color: var(--color-gray-500); text-align: center;">Sin registros de asistencia</p>';

    Components.showModal(`Asistencia - ${student.full_name}`, `
      <div style="margin-bottom: 1rem; padding: 1rem; background: var(--color-gray-50); border-radius: 8px;">
        <strong>${Components.escapeHtml(student.full_name)}</strong>
        <span style="color: var(--color-gray-500);">${course ? ' - ' + Components.escapeHtml(course.name) : ''}</span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 1.5rem;">
        <div style="text-align: center; padding: 0.75rem; background: ${stats.percentage >= 90 ? 'var(--color-success-light)' : stats.percentage >= 75 ? 'var(--color-warning-light)' : 'var(--color-error-light)'}; border-radius: 8px;">
          <div style="font-size: 1.25rem; font-weight: 700;">${stats.percentage}%</div>
          <div style="font-size: 0.7rem;">Asistencia</div>
        </div>
        <div style="text-align: center; padding: 0.75rem; background: var(--color-gray-100); border-radius: 8px;">
          <div style="font-size: 1.25rem; font-weight: 700;">${stats.daysPresent}</div>
          <div style="font-size: 0.7rem;">Presente</div>
        </div>
        <div style="text-align: center; padding: 0.75rem; background: var(--color-gray-100); border-radius: 8px;">
          <div style="font-size: 1.25rem; font-weight: 700;">${stats.totalSchoolDays - stats.daysPresent}</div>
          <div style="font-size: 0.7rem;">Ausente</div>
        </div>
        <div style="text-align: center; padding: 0.75rem; background: var(--color-gray-100); border-radius: 8px;">
          <div style="font-size: 1.25rem; font-weight: 700;">${stats.lateArrivals}</div>
          <div style="font-size: 0.7rem;">Atrasos</div>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <span>Registrar Asistencia Manual</span>
        </div>
        <div class="card-body">
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-success" onclick="Views.directorStudents.registerAttendance(${studentId}, 'IN')">
              Registrar Entrada
            </button>
            <button class="btn btn-secondary" onclick="Views.directorStudents.registerAttendance(${studentId}, 'OUT')">
              Registrar Salida
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Ultimos 20 Registros</div>
        <div class="card-body" style="max-height: 300px; overflow-y: auto;">
          ${eventsHTML}
        </div>
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);
  };

  Views.directorStudents.registerAttendance = async function (studentId, type) {
    try {
      // Call the attendance API endpoint
      const response = await API.request('/attendance/events', {
        method: 'POST',
        body: JSON.stringify({
          student_id: studentId,
          type: type,
          device_id: 'WEB-APP',
          gate_id: 'MANUAL-ENTRY',
          source: 'MANUAL'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Error al registrar asistencia');
      }

      // Also update local state for immediate UI feedback
      State.addAttendanceEvent({
        student_id: studentId,
        type: type,
        source: 'MANUAL'
      });

      Components.showToast(`${type === 'IN' ? 'Entrada' : 'Salida'} registrada correctamente`, 'success');
      // Refresh the modal
      document.querySelector('.modal-container').click();
      Views.directorStudents.viewAttendance(studentId);
    } catch (error) {
      console.error('Error registering attendance:', error);
      Components.showToast(error.message || 'Error al registrar asistencia', 'error');
    }
  };

  Views.directorStudents.showEnrollMenu = function (studentId) {
    const student = State.getStudent(studentId);
    if (!student) return;

    Components.showModal('Generar Credencial', `
      <div style="text-align: center; padding: 1rem;">
        <p style="margin-bottom: 1.5rem;">
          Selecciona el tipo de credencial para <strong>${Components.escapeHtml(student.full_name)}</strong>:
        </p>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <button class="btn btn-primary btn-lg" onclick="Views.directorStudents.enrollQR(${studentId})">
            <span class="material-icons-round mr-2">qr_code_2</span> Generar QR
            <small style="display: block; font-weight: normal; font-size: 0.8rem;">Para imprimir en credencial</small>
          </button>
          <button class="btn btn-secondary btn-lg" onclick="Views.directorStudents.enrollNFC(${studentId})">
            <span class="material-icons-round mr-2">contactless</span> Escribir NFC
            <small style="display: block; font-weight: normal; font-size: 0.8rem;">Requiere lector NFC</small>
          </button>
        </div>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' }
    ]);
  };

  Views.directorStudents.enrollQR = function (studentId) {
    document.querySelector('.modal-container')?.click();
    if (typeof QREnrollment !== 'undefined') {
      QREnrollment.showStudentEnrollmentModal(studentId);
    } else {
      Components.showToast('Servicio QR no disponible', 'error');
    }
  };

  Views.directorStudents.enrollNFC = function (studentId) {
    document.querySelector('.modal-container')?.click();
    if (typeof NFCEnrollment !== 'undefined') {
      NFCEnrollment.showStudentEnrollmentModal(studentId);
    } else {
      Components.showToast('Servicio NFC no disponible', 'error');
    }
  };

  renderStudents();

  // Check for viewProfile query param to auto-open student profile
  const hash = window.location.hash;
  const queryMatch = hash.match(/\?viewProfile=(\d+)/);
  if (queryMatch) {
    const studentId = parseInt(queryMatch[1]);
    if (studentId && State.getStudent(studentId)) {
      setTimeout(() => Views.directorStudents.viewProfile(studentId), 100);
    }
  }
};
