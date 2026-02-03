// Director Absences Management (Redesigned with Tailwind)
Views.directorAbsences = async function() {
  const app = document.getElementById('app');

  // State variables
  let absences = [];
  let activeTab = 'PENDING';
  let searchTerm = '';
  let startDateFilter = '';
  let endDateFilter = '';
  let typeFilter = '';
  let currentOffset = 0;
  const PAGE_SIZE = 50;
  let total = 0;
  let hasMore = false;
  let counts = { pending: 0, approved: 0, rejected: 0, total: 0 };
  let isLoading = false;
  let searchTimeout = null;
  let showCreateForm = false;
  let sidebarOpen = false;

  // Get user info
  const user = State.getCurrentUser();
  const userName = user?.full_name || user?.email?.split('@')[0] || 'Director';
  const userInitial = userName.charAt(0).toUpperCase();
  const isDark = document.documentElement.classList.contains('dark');

  // Avatar colors for rotating
  const avatarColors = [
    { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400' },
    { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
    { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
    { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400' },
  ];

  // Current path for active state
  const currentPath = '/director/absences';

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

  // Render main layout
  function renderLayout() {
    app.innerHTML = `
      <div class="h-screen flex overflow-hidden bg-background-light dark:bg-background-dark">
        <!-- Sidebar -->
        <aside id="sidebar" class="w-64 bg-sidebar-dark text-gray-300 flex-shrink-0 flex-col transition-all duration-300 mobile-hidden border-r border-indigo-900/50 shadow-2xl z-50">
          <div class="h-20 flex items-center justify-between px-6 border-b border-indigo-900/50">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg">
                <div class="w-4 h-4 bg-indigo-900 rounded-full"></div>
              </div>
              <h1 class="text-xl font-bold tracking-tight text-white">NEUVOX</h1>
            </div>
            <button class="desktop-hidden text-gray-400 hover:text-white p-1" onclick="Views.directorAbsences.toggleSidebar()">
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
        <div id="sidebar-backdrop" class="fixed inset-0 bg-black/50 z-40 hidden desktop-hidden" onclick="Views.directorAbsences.toggleSidebar()"></div>

        <!-- Main content -->
        <main class="flex-1 flex flex-col overflow-hidden">
          <!-- Header -->
          <header class="h-20 bg-white dark:bg-card-dark border-b border-border-light dark:border-border-dark flex items-center justify-between px-8 z-10 shadow-sm">
            <div class="flex items-center gap-4">
              <button class="desktop-hidden text-muted-light dark:text-muted-dark hover:text-primary transition-colors"
                      onclick="Views.directorAbsences.toggleSidebar()">
                <span class="material-icons-round text-2xl">menu</span>
              </button>
              <h2 class="text-xl font-bold text-gray-800 dark:text-text-dark">Solicitudes de Ausencia</h2>
            </div>
            <div class="flex items-center gap-2 md:gap-4 flex-1 justify-end">
              <div class="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1 md:mx-2 mobile-hidden"></div>
              <div class="flex items-center gap-2 md:gap-3">
                <button class="p-2 rounded-full hover:bg-background-light dark:hover:bg-white/5 transition-colors text-muted-light dark:text-muted-dark"
                        onclick="Views.directorAbsences.toggleDarkMode()">
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
          <div class="flex-1 overflow-y-auto p-8 space-y-8" id="absences-content">
            <!-- Loading state -->
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span class="ml-3 text-gray-500 dark:text-gray-400">Cargando solicitudes...</span>
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

  // Render absences content
  function renderAbsences() {
    const content = document.getElementById('absences-content');
    if (!content) return;

    const typeOptions = [
      { value: '', label: 'Todos los tipos' },
      { value: 'VACATION', label: 'Vacaciones' },
      { value: 'FAMILY', label: 'Familiar' },
      { value: 'MEDICAL', label: 'Medico' },
      { value: 'OTHER', label: 'Otro' },
    ];

    content.innerHTML = `
      <!-- Title + Button -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 class="text-xl font-bold text-gray-800 dark:text-white">Solicitudes de Ausencia</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">Gestione las solicitudes de ausencia de los alumnos</p>
        </div>
        <button class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700
                       text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2
                       shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
                onclick="Views.directorAbsences.toggleCreateForm()">
          <span class="material-icons-round">add</span>
          Nueva Solicitud
        </button>
      </div>

      <!-- Create form (inline, collapsible) -->
      ${showCreateForm ? renderCreateForm() : ''}

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Pendientes -->
        <div class="bg-white dark:bg-card-dark p-6 rounded-custom shadow-sm border-l-4 border-indigo-500">
          <p class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">PENDIENTES</p>
          <p class="text-4xl font-bold text-indigo-600 dark:text-indigo-400">${counts.pending}</p>
        </div>

        <!-- Aprobadas -->
        <div class="bg-white dark:bg-card-dark p-6 rounded-custom shadow-sm border-l-4 border-emerald-500">
          <p class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">APROBADAS</p>
          <p class="text-4xl font-bold text-emerald-600 dark:text-emerald-400">${counts.approved}</p>
        </div>

        <!-- Rechazadas -->
        <div class="bg-white dark:bg-card-dark p-6 rounded-custom shadow-sm border-l-4 border-rose-400">
          <p class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">RECHAZADAS</p>
          <p class="text-4xl font-bold text-rose-500 dark:text-rose-400">${counts.rejected}</p>
        </div>
      </div>

      <!-- Filters Card -->
      <div class="bg-white dark:bg-card-dark rounded-custom p-6 shadow-sm border border-gray-100 dark:border-border-dark">
        <div class="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
          <!-- Buscar -->
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Buscar</label>
            <div class="relative">
              <span class="absolute left-3 top-2.5 text-gray-400 material-icons-round text-xl">search</span>
              <input type="text" id="search-absence"
                     class="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                            focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                            text-gray-700 dark:text-gray-200 placeholder-gray-400"
                     placeholder="Nombre alumno, comentario..."
                     value="${Components.escapeHtml(searchTerm)}"
                     onkeyup="Views.directorAbsences.search(this.value)">
            </div>
          </div>

          <!-- Tipo -->
          <div>
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Tipo</label>
            <select id="filter-type"
                    class="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                           focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                           text-gray-700 dark:text-gray-200"
                    onchange="Views.directorAbsences.filterByType(this.value)">
              ${typeOptions.map(o => `<option value="${o.value}" ${typeFilter === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>

          <!-- Desde -->
          <div>
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Desde</label>
            <input type="date" id="filter-start-date"
                   class="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                          focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                          text-gray-700 dark:text-gray-200"
                   value="${startDateFilter}"
                   onchange="Views.directorAbsences.filterByStartDate(this.value)">
          </div>

          <!-- Hasta -->
          <div>
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Hasta</label>
            <input type="date" id="filter-end-date"
                   class="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                          focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                          text-gray-700 dark:text-gray-200"
                   value="${endDateFilter}"
                   onchange="Views.directorAbsences.filterByEndDate(this.value)">
          </div>

          <!-- Buttons -->
          <div class="flex gap-2">
            <button class="flex-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300
                           border border-gray-200 dark:border-slate-600 rounded-lg
                           hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-center gap-1"
                    onclick="Views.directorAbsences.clearFilters()">
              Limpiar
            </button>
            <button class="flex-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300
                           border border-gray-200 dark:border-slate-600 rounded-lg
                           hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-center gap-1"
                    onclick="Views.directorAbsences.exportCSV()">
              Exportar
            </button>
          </div>
        </div>
      </div>

      <!-- Tabs + Table -->
      <div class="space-y-4">
        <!-- Tabs -->
        <div class="flex border-b border-gray-200 dark:border-slate-700">
          <button class="px-8 py-3 text-sm font-medium ${activeTab === 'PENDING' ? 'tab-active' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'} rounded-t-lg transition-colors"
                  onclick="Views.directorAbsences.switchTab('PENDING')">
            Pendientes (${counts.pending})
          </button>
          <button class="px-8 py-3 text-sm font-medium ${activeTab === 'APPROVED' ? 'tab-active' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'} rounded-t-lg transition-colors"
                  onclick="Views.directorAbsences.switchTab('APPROVED')">
            Aprobadas (${counts.approved})
          </button>
          <button class="px-8 py-3 text-sm font-medium ${activeTab === 'REJECTED' ? 'tab-active' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'} rounded-t-lg transition-colors"
                  onclick="Views.directorAbsences.switchTab('REJECTED')">
            Rechazadas (${counts.rejected})
          </button>
        </div>

        <!-- Table Card -->
        <div class="bg-white dark:bg-card-dark rounded-custom shadow-sm border border-gray-100 dark:border-border-dark overflow-hidden">
          ${renderAbsencesList()}

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-50 dark:border-slate-700 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Mostrando ${absences.length} de ${total} solicitudes</span>
            ${hasMore ? `
              <button class="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400
                             border border-indigo-200 dark:border-indigo-800 rounded-lg
                             hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                      onclick="Views.directorAbsences.loadMore()" ${isLoading ? 'disabled' : ''}>
                ${isLoading ? 'Cargando...' : 'Cargar mas'}
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // Render create form
  function renderCreateForm() {
    const courses = State.getCourses() || [];
    const today = new Date().toISOString().split('T')[0];

    return `
      <div class="bg-white dark:bg-card-dark rounded-custom p-6 shadow-sm border-2 border-indigo-200 dark:border-indigo-800">
        <div class="flex items-center gap-3 mb-4">
          <span class="material-icons-round text-indigo-600 dark:text-indigo-400">add_circle</span>
          <h4 class="font-semibold text-gray-800 dark:text-white">Nueva Solicitud de Ausencia</h4>
        </div>
        <form id="director-absence-form">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Curso filter -->
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Curso</label>
              <select id="create-course"
                      class="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                             focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                             text-gray-700 dark:text-gray-200"
                      onchange="Views.directorAbsences.filterStudentsByCourse(this.value)">
                <option value="">Todos los cursos</option>
                ${courses.map(c => `<option value="${c.id}">${Components.escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>

            <!-- Alumno -->
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Alumno *</label>
              <select id="create-student"
                      class="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                             focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                             text-gray-700 dark:text-gray-200"
                      required>
                <option value="">Seleccione un alumno...</option>
                ${renderStudentOptions('')}
              </select>
            </div>

            <!-- Tipo -->
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Tipo *</label>
              <select id="create-type"
                      class="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                             focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                             text-gray-700 dark:text-gray-200"
                      required>
                <option value="MEDICAL">Medica</option>
                <option value="FAMILY">Familiar</option>
                <option value="VACATION">Vacaciones</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <!-- Fecha Inicio -->
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Fecha Inicio *</label>
              <input type="date" id="create-start-date"
                     class="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                            focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                            text-gray-700 dark:text-gray-200"
                     required value="${today}">
            </div>

            <!-- Fecha Fin -->
            <div>
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Fecha Fin *</label>
              <input type="date" id="create-end-date"
                     class="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                            focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                            text-gray-700 dark:text-gray-200"
                     required value="${today}">
            </div>
          </div>

          <div class="mt-4">
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Comentario o Motivo</label>
            <textarea id="create-comment"
                      class="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                             focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                             text-gray-700 dark:text-gray-200"
                      placeholder="Describa brevemente el motivo de la ausencia (opcional)"
                      rows="2"></textarea>
          </div>

          <div class="flex gap-3 mt-4">
            <button type="button"
                    class="submit-btn bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700
                           text-white px-6 py-2 rounded-lg font-medium transition-all"
                    onclick="Views.directorAbsences.submitNewAbsence()">
              Crear Solicitud
            </button>
            <button type="button"
                    class="px-6 py-2 text-sm font-medium text-gray-600 dark:text-gray-300
                           border border-gray-200 dark:border-slate-600 rounded-lg
                           hover:bg-gray-50 dark:hover:bg-slate-700"
                    onclick="Views.directorAbsences.toggleCreateForm()">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    `;
  }

  // Render student options for select
  function renderStudentOptions(courseId) {
    let students = State.getStudents() || [];
    if (courseId) {
      students = students.filter(s => s.course_id === parseInt(courseId));
    }
    students.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

    return students.map(s => {
      const course = State.getCourse(s.course_id);
      const courseLabel = course ? ` (${course.name})` : '';
      return `<option value="${s.id}">${Components.escapeHtml(s.full_name)}${courseLabel}</option>`;
    }).join('');
  }

  // Render absences list (table)
  function renderAbsencesList() {
    if (isLoading && absences.length === 0) {
      return `
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span class="ml-3 text-gray-500 dark:text-gray-400">Cargando...</span>
        </div>
      `;
    }

    if (absences.length === 0) {
      const messages = {
        PENDING: 'No hay solicitudes pendientes',
        APPROVED: 'No hay solicitudes aprobadas',
        REJECTED: 'No hay solicitudes rechazadas',
      };
      return `
        <div class="text-center py-12">
          <span class="material-icons-round text-4xl text-gray-300 dark:text-gray-600">inbox</span>
          <p class="mt-2 text-gray-500 dark:text-gray-400">${messages[activeTab] || 'No hay solicitudes'}</p>
        </div>
      `;
    }

    return `
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
              <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Alumno</th>
              <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Curso</th>
              <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
              <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fechas</th>
              <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Dias</th>
              <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Adjunto</th>
              <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha Solicitud</th>
              <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50 dark:divide-slate-800">
            ${absences.map((absence, index) => renderAbsenceRow(absence, index)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Render single absence row
  function renderAbsenceRow(absence, index) {
    const studentName = absence.student_name || (State.getStudent(absence.student_id)?.full_name) || 'Alumno #' + absence.student_id;
    const courseName = absence.course_name || '-';

    // Get initials
    const nameParts = studentName.split(' ');
    const initials = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
      : studentName.substring(0, 2).toUpperCase();

    // Rotating avatar color
    const avatarColor = avatarColors[index % avatarColors.length];

    // Type badges
    const typeBadges = {
      'VACATION': { label: 'Vacaciones', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
      'FAMILY': { label: 'Familiar', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
      'MEDICAL': { label: 'Medico', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
      'OTHER': { label: 'Otro', bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' },
    };
    const typeInfo = typeBadges[absence.type] || typeBadges.OTHER;

    // Calculate dates and days
    const startDate = absence.start_date || absence.start;
    const endDate = absence.end_date || absence.end;
    const days = startDate && endDate
      ? Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1
      : 0;

    const submittedDate = absence.ts_submitted
      ? Components.formatDate(absence.ts_submitted)
      : '-';

    // Format dates as DD-MM-YYYY
    const formatDateDMY = (dateStr) => {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    };

    // Attachment
    const hasAttachment = absence.attachment_ref || absence.attachment_url;

    return `
      <tr class="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full ${avatarColor.bg} flex items-center justify-center ${avatarColor.text} font-bold text-xs">
              ${initials}
            </div>
            <span class="font-semibold text-gray-800 dark:text-white text-sm">${Components.escapeHtml(studentName)}</span>
          </div>
        </td>
        <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">${Components.escapeHtml(courseName)}</td>
        <td class="px-6 py-4">
          <span class="px-3 py-1 rounded-full text-[11px] font-bold ${typeInfo.bg} ${typeInfo.text} uppercase">${typeInfo.label}</span>
        </td>
        <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">${formatDateDMY(startDate)} - ${formatDateDMY(endDate)}</td>
        <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 text-center">${days} <span class="text-[10px] text-gray-400 dark:text-gray-500 block">dias</span></td>
        <td class="px-6 py-4 text-center">
          ${hasAttachment ? `
            <span class="material-icons-round text-gray-400 dark:text-gray-500 text-xl cursor-pointer hover:text-indigo-500 dark:hover:text-indigo-400"
                  onclick="Views.directorAbsences.downloadAttachment('${absence.attachment_ref || ''}', '${Components.escapeHtml((absence.attachment_ref || '').split('/').pop())}')">
              attachment
            </span>
          ` : `
            <span class="text-gray-300 dark:text-gray-600">-</span>
          `}
        </td>
        <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">${submittedDate}</td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-2">
            <!-- Ver detalles -->
            <button class="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded transition-colors"
                    title="Ver" onclick="Views.directorAbsences.showDetail(${absence.id})">
              <span class="material-icons-round text-[20px]">visibility</span>
            </button>
            ${activeTab === 'PENDING' ? `
              <!-- Aprobar -->
              <button class="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-colors"
                      title="Aprobar" onclick="Views.directorAbsences.approve(${absence.id})">
                <span class="material-icons-round text-[20px]">check_circle</span>
              </button>
              <!-- Rechazar -->
              <button class="p-1.5 text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded transition-colors"
                      title="Rechazar" onclick="Views.directorAbsences.showRejectModal(${absence.id})">
                <span class="material-icons-round text-[20px]">cancel</span>
              </button>
              <!-- Eliminar -->
              <button class="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded transition-colors"
                      title="Eliminar" onclick="Views.directorAbsences.confirmDelete(${absence.id})">
                <span class="material-icons-round text-[20px]">delete</span>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  // Load absences from API
  async function loadAbsences(append = false) {
    if (isLoading) return;
    isLoading = true;

    if (!append) {
      currentOffset = 0;
      absences = [];
    }

    try {
      const filters = {
        status: activeTab,
        type: typeFilter || undefined,
        start_date: startDateFilter || undefined,
        end_date: endDateFilter || undefined,
      };

      const response = await API.getAbsencesPaginated(filters, currentOffset, PAGE_SIZE);

      if (append) {
        absences = absences.concat(response.items || []);
      } else {
        absences = response.items || [];
      }

      total = response.total || 0;
      hasMore = response.has_more || false;
      const responseCounts = response.counts || {};
      counts = {
        pending: responseCounts.pending || 0,
        approved: responseCounts.approved || 0,
        rejected: responseCounts.rejected || 0,
        total: (responseCounts.pending || 0) + (responseCounts.approved || 0) + (responseCounts.rejected || 0),
      };

      isLoading = false;
      renderAbsences();
    } catch (error) {
      console.error('Error loading absences:', error);
      Components.showToast('Error al cargar solicitudes: ' + error.message, 'error');
      isLoading = false;
      renderAbsences();
    }
  }

  // Load stats from API
  async function loadStats() {
    try {
      const stats = await API.getAbsenceStats();
      counts = {
        pending: stats.pending || 0,
        approved: stats.approved || 0,
        rejected: stats.rejected || 0,
        total: stats.total || 0,
      };
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  // Public methods
  Views.directorAbsences.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar && backdrop) {
      sidebar.classList.toggle('mobile-hidden');
      backdrop.classList.toggle('hidden');
    }
  };

  Views.directorAbsences.toggleDarkMode = function() {
    document.documentElement.classList.toggle('dark');
    renderLayout();
    renderAbsences();
  };

  Views.directorAbsences.switchTab = async function(tab) {
    activeTab = tab;
    currentOffset = 0;
    await loadAbsences();
  };

  Views.directorAbsences.search = function(term) {
    searchTerm = term;
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      if (term.length >= 2) {
        try {
          const results = await API.searchAbsences(term, 50);
          absences = results.filter(a => a.status === activeTab);
          total = absences.length;
          hasMore = false;
          renderAbsences();
        } catch (error) {
          Components.showToast('Error en busqueda: ' + error.message, 'error');
        }
      } else if (term.length === 0) {
        await loadAbsences();
      }
    }, 300);
  };

  Views.directorAbsences.filterByType = async function(type) {
    typeFilter = type;
    await loadAbsences();
  };

  Views.directorAbsences.filterByStartDate = async function(date) {
    startDateFilter = date;
    await loadAbsences();
  };

  Views.directorAbsences.filterByEndDate = async function(date) {
    endDateFilter = date;
    await loadAbsences();
  };

  Views.directorAbsences.clearFilters = async function() {
    searchTerm = '';
    typeFilter = '';
    startDateFilter = '';
    endDateFilter = '';
    await loadAbsences();
  };

  Views.directorAbsences.toggleCreateForm = function() {
    showCreateForm = !showCreateForm;
    renderAbsences();
  };

  Views.directorAbsences.filterStudentsByCourse = function(courseId) {
    const studentSelect = document.getElementById('create-student');
    if (studentSelect) {
      studentSelect.innerHTML = `
        <option value="">Seleccione un alumno...</option>
        ${renderStudentOptions(courseId)}
      `;
    }
  };

  Views.directorAbsences.submitNewAbsence = async function() {
    const form = document.getElementById('director-absence-form');
    const studentId = document.getElementById('create-student')?.value;
    const type = document.getElementById('create-type')?.value;
    const startDate = document.getElementById('create-start-date')?.value;
    const endDate = document.getElementById('create-end-date')?.value;
    const comment = document.getElementById('create-comment')?.value;

    if (!studentId) {
      Components.showToast('Seleccione un alumno', 'error');
      return;
    }
    if (!startDate || !endDate) {
      Components.showToast('Complete las fechas', 'error');
      return;
    }
    if (startDate > endDate) {
      Components.showToast('La fecha de inicio no puede ser mayor a la fecha fin', 'error');
      return;
    }

    const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
      Components.showToast('El rango maximo es de 30 dias', 'error');
      return;
    }

    const submitBtn = form?.querySelector('.submit-btn');
    const originalText = submitBtn ? submitBtn.textContent : 'Crear Solicitud';

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creando...';
      }

      const data = {
        student_id: parseInt(studentId),
        type: type,
        start: startDate,
        end: endDate,
        comment: comment || null,
      };

      await API.submitAbsence(data);
      Components.showToast('Solicitud creada exitosamente', 'success');

      showCreateForm = false;
      counts.pending += 1;
      counts.total += 1;

      if (activeTab !== 'PENDING') {
        activeTab = 'PENDING';
      }
      await loadAbsences();
    } catch (error) {
      Components.showToast('Error al crear solicitud: ' + error.message, 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  };

  Views.directorAbsences.loadMore = async function() {
    currentOffset += PAGE_SIZE;
    await loadAbsences(true);
  };

  Views.directorAbsences.approve = async function(absenceId) {
    try {
      await API.approveAbsence(absenceId);
      Components.showToast('Solicitud aprobada', 'success');

      counts.pending = Math.max(0, counts.pending - 1);
      counts.approved += 1;
      await loadAbsences();
    } catch (error) {
      Components.showToast('Error al aprobar: ' + error.message, 'error');
    }
  };

  Views.directorAbsences.showRejectModal = function(absenceId) {
    const absence = absences.find(a => a.id === absenceId);
    const studentName = absence?.student_name || 'el alumno';

    Components.showModal('Rechazar Solicitud', `
      <p style="margin-bottom: 1rem;">
        Rechazar la solicitud de ausencia de <strong>${Components.escapeHtml(studentName)}</strong>?
      </p>
      <div class="form-group">
        <label class="form-label">Razon del rechazo (opcional)</label>
        <textarea id="rejection-reason" class="form-input" rows="3"
          placeholder="Ingrese la razon del rechazo..."></textarea>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Rechazar', action: 'reject', className: 'btn-error', onClick: () => Views.directorAbsences.reject(absenceId) }
    ]);
  };

  Views.directorAbsences.reject = async function(absenceId) {
    const reasonInput = document.getElementById('rejection-reason');
    const reason = reasonInput ? reasonInput.value.trim() : null;

    const rejectBtn = document.querySelector('.modal .btn-error');
    const originalText = rejectBtn ? rejectBtn.textContent : 'Rechazar';

    try {
      if (rejectBtn) {
        rejectBtn.disabled = true;
        rejectBtn.textContent = 'Rechazando...';
      }

      await API.rejectAbsence(absenceId, reason || null);
      Components.showToast('Solicitud rechazada', 'success');

      document.querySelector('.modal-container')?.click();

      counts.pending = Math.max(0, counts.pending - 1);
      counts.rejected += 1;
      await loadAbsences();
    } catch (error) {
      Components.showToast('Error al rechazar: ' + error.message, 'error');
      if (rejectBtn) {
        rejectBtn.disabled = false;
        rejectBtn.textContent = originalText;
      }
    }
  };

  Views.directorAbsences.confirmDelete = function(absenceId) {
    const absence = absences.find(a => a.id === absenceId);
    const studentName = absence?.student_name || 'el alumno';

    Components.showModal('Confirmar Eliminacion', `
      <div style="text-align: center; padding: 1rem;">
        <span class="material-icons-round text-5xl text-amber-500">warning</span>
        <p style="font-size: 1.1rem; margin: 1rem 0 0.5rem;">Eliminar esta solicitud de ausencia?</p>
        <p style="font-weight: 600; color: var(--color-error);">Solicitud de ${Components.escapeHtml(studentName)}</p>
        <p style="font-size: 0.9rem; color: var(--color-gray-500); margin-top: 1rem;">
          Esta accion no se puede deshacer.
        </p>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Eliminar', action: 'delete', className: 'btn-error', onClick: () => Views.directorAbsences.delete(absenceId) }
    ]);
  };

  Views.directorAbsences.delete = async function(absenceId) {
    const deleteBtn = document.querySelector('.modal .btn-error');
    const originalText = deleteBtn ? deleteBtn.textContent : 'Eliminar';

    try {
      if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Eliminando...';
      }

      await API.deleteAbsence(absenceId);
      Components.showToast('Solicitud eliminada', 'success');

      document.querySelector('.modal-container')?.click();

      counts.pending = Math.max(0, counts.pending - 1);
      counts.total = Math.max(0, counts.total - 1);
      await loadAbsences();
    } catch (error) {
      Components.showToast('Error al eliminar: ' + error.message, 'error');
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = originalText;
      }
    }
  };

  Views.directorAbsences.exportCSV = async function() {
    try {
      const filters = {
        status: activeTab || undefined,
        start_date: startDateFilter || undefined,
        end_date: endDateFilter || undefined,
      };

      const blob = await API.exportAbsencesCSV(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ausencias_${activeTab.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Components.showToast('Exportacion completada', 'success');
    } catch (error) {
      Components.showToast('Error al exportar: ' + error.message, 'error');
      console.error('Export absences error:', error);
    }
  };

  Views.directorAbsences.refresh = async function() {
    await loadStats();
    await loadAbsences();
  };

  Views.directorAbsences.showDetail = function(absenceId) {
    const absence = absences.find(a => a.id === absenceId);
    if (!absence) {
      Components.showToast('Solicitud no encontrada', 'error');
      return;
    }

    const typeLabels = {
      'MEDICAL': { label: 'Medica', icon: 'local_hospital' },
      'FAMILY': { label: 'Familiar', icon: 'family_restroom' },
      'VACATION': { label: 'Vacaciones', icon: 'beach_access' },
      'OTHER': { label: 'Otro', icon: 'description' },
    };
    const typeInfo = typeLabels[absence.type] || { label: absence.type || 'Otro', icon: 'description' };

    const statusLabels = {
      'PENDING': { label: 'Pendiente', color: 'warning', icon: 'schedule' },
      'APPROVED': { label: 'Aprobada', color: 'success', icon: 'check_circle' },
      'REJECTED': { label: 'Rechazada', color: 'error', icon: 'cancel' },
    };
    const statusInfo = statusLabels[absence.status] || statusLabels.PENDING;

    const startDate = absence.start_date || absence.start;
    const endDate = absence.end_date || absence.end;
    const days = startDate && endDate
      ? Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1
      : 0;

    const studentName = absence.student_name || (State.getStudent(absence.student_id)?.full_name) || 'Alumno #' + absence.student_id;
    const courseName = absence.course_name || '-';

    let attachmentHtml = '<span style="color: var(--color-gray-400);">Sin adjunto</span>';
    if (absence.attachment_url || absence.attachment_ref) {
      const attachmentRef = absence.attachment_ref || '';
      const fileName = attachmentRef ? attachmentRef.split('/').pop() : 'archivo';
      attachmentHtml = `
        <button type="button" onclick="Views.directorAbsences.downloadAttachment('${attachmentRef}', '${Components.escapeHtml(fileName)}')"
           style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; background: var(--color-primary-light); border-radius: 8px; border: none; cursor: pointer; color: var(--color-primary);">
          <span class="material-icons-round" style="font-size: 1.5rem;">attachment</span>
          <span style="text-align: left;">
            <strong style="display: block;">Ver/Descargar Adjunto</strong>
            <span style="font-size: 0.85rem; color: var(--color-gray-600);">${Components.escapeHtml(fileName)}</span>
          </span>
        </button>
      `;
    }

    const modalContent = `
      <div style="display: grid; gap: 1.25rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label style="font-size: 0.85rem; color: var(--color-gray-500); display: block; margin-bottom: 0.25rem;">Alumno</label>
            <strong style="font-size: 1.1rem;">${Components.escapeHtml(studentName)}</strong>
          </div>
          <div>
            <label style="font-size: 0.85rem; color: var(--color-gray-500); display: block; margin-bottom: 0.25rem;">Curso</label>
            <span>${Components.escapeHtml(courseName)}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label style="font-size: 0.85rem; color: var(--color-gray-500); display: block; margin-bottom: 0.25rem;">Tipo de Ausencia</label>
            <span style="font-size: 1.1rem;"><span class="material-icons-round" style="vertical-align: middle; font-size: 1.2rem;">${typeInfo.icon}</span> ${typeInfo.label}</span>
          </div>
          <div>
            <label style="font-size: 0.85rem; color: var(--color-gray-500); display: block; margin-bottom: 0.25rem;">Estado</label>
            <span class="chip chip-${statusInfo.color}"><span class="material-icons-round" style="font-size: 1rem; vertical-align: middle;">${statusInfo.icon}</span> ${statusInfo.label}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
          <div>
            <label style="font-size: 0.85rem; color: var(--color-gray-500); display: block; margin-bottom: 0.25rem;">Fecha Inicio</label>
            <span>${Components.formatDate(startDate)}</span>
          </div>
          <div>
            <label style="font-size: 0.85rem; color: var(--color-gray-500); display: block; margin-bottom: 0.25rem;">Fecha Fin</label>
            <span>${Components.formatDate(endDate)}</span>
          </div>
          <div>
            <label style="font-size: 0.85rem; color: var(--color-gray-500); display: block; margin-bottom: 0.25rem;">Total Dias</label>
            <span style="font-weight: 600;">${days} dia${days !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div>
          <label style="font-size: 0.85rem; color: var(--color-gray-500); display: block; margin-bottom: 0.25rem;">Comentario / Motivo</label>
          <div style="background: var(--color-gray-50); padding: 0.75rem; border-radius: 8px; min-height: 60px;">
            ${absence.comment ? Components.escapeHtml(absence.comment) : '<span style="color: var(--color-gray-400);">Sin comentario</span>'}
          </div>
        </div>

        ${absence.status === 'REJECTED' && absence.rejection_reason ? `
          <div>
            <label style="font-size: 0.85rem; color: var(--color-error); display: block; margin-bottom: 0.25rem;">Razon del Rechazo</label>
            <div style="background: var(--color-error-light); padding: 0.75rem; border-radius: 8px; color: var(--color-error-dark);">
              ${Components.escapeHtml(absence.rejection_reason)}
            </div>
          </div>
        ` : ''}

        <div>
          <label style="font-size: 0.85rem; color: var(--color-gray-500); display: block; margin-bottom: 0.5rem;">Archivo Adjunto</label>
          ${attachmentHtml}
        </div>

        <div style="border-top: 1px solid var(--color-gray-200); padding-top: 1rem; margin-top: 0.5rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--color-gray-500);">
            <span>Fecha de solicitud: ${absence.ts_submitted ? Components.formatDate(absence.ts_submitted) : '-'}</span>
            ${absence.ts_resolved ? `<span>Fecha de resolucion: ${Components.formatDate(absence.ts_resolved)}</span>` : ''}
          </div>
        </div>
      </div>
    `;

    const buttons = [{ label: 'Cerrar', action: 'close', className: 'btn-secondary' }];

    if (absence.status === 'PENDING') {
      buttons.unshift(
        { label: 'Aprobar', action: 'approve', className: 'btn-success', onClick: () => {
          document.querySelector('.modal-container')?.click();
          Views.directorAbsences.approve(absenceId);
        }},
        { label: 'Rechazar', action: 'reject', className: 'btn-warning', onClick: () => {
          document.querySelector('.modal-container')?.click();
          Views.directorAbsences.showRejectModal(absenceId);
        }}
      );
    }

    Components.showModal(`Detalle de Solicitud #${absenceId}`, modalContent, buttons);
  };

  Views.directorAbsences.downloadAttachment = async function(attachmentRef, fileName) {
    if (!attachmentRef) {
      Components.showToast('No hay archivo adjunto', 'error');
      return;
    }

    try {
      Components.showToast('Descargando archivo...', 'info');

      const photoUrl = `/photos/${attachmentRef}`;

      const response = await fetch(API.baseUrl + photoUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API.accessToken}`,
          'X-Tenant': State.tenant || 'demo_local',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('pdf') || contentType.includes('image')) {
        window.open(blobUrl, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName || 'archivo';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      Components.showToast('Archivo descargado', 'success');
    } catch (error) {
      console.error('Error downloading attachment:', error);
      Components.showToast('Error al descargar: ' + error.message, 'error');
    }
  };

  // Initialize
  renderLayout();
  await loadStats();
  await loadAbsences();
};
