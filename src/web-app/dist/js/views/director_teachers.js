// Uses centralized Components for sidebar - see components.js
// Director Teachers Management (CRUD Profesores with API integration) - Tailwind Redesign
Views.directorTeachers = async function() {
  const app = document.getElementById('app');
  const userName = State.currentUser?.name || State.currentUser?.full_name || 'Director';
  const userInitial = userName.charAt(0).toUpperCase();
  const isDark = document.documentElement.classList.contains('dark');

  // Avatar colors for rotating (indigo, purple, blue, teal)
  const avatarColors = [
    { bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400' },
    { bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
    { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
    { bg: 'bg-teal-50 dark:bg-teal-900/30', text: 'text-teal-600 dark:text-teal-400' },
  ];

  // Helper to get initials
  function getInitials(name) {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  // Current path for active state
  const currentPath = '/director/teachers';

  // Create main layout
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
            <button class="desktop-hidden text-muted-light dark:text-muted-dark hover:text-primary transition-colors" onclick="Components.toggleDirectorSidebar()">
              <span class="material-icons-round text-2xl">menu</span>
            </button>
            <h2 class="text-xl font-bold text-gray-800 dark:text-text-dark">Gestion de Profesores</h2>
          </div>
          <div class="flex items-center gap-2 md:gap-4 flex-1 justify-end">
            <div class="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1 md:mx-2 mobile-hidden"></div>
            <div class="flex items-center gap-2 md:gap-3">
              <button class="p-2 rounded-full hover:bg-background-light dark:hover:bg-white/5 transition-colors text-muted-light dark:text-muted-dark" onclick="Views.directorTeachers.toggleDarkMode()">
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
              <a class="ml-1 md:ml-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 border px-2 md:px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 dark:border-gray-600" href="#" onclick="event.preventDefault(); State.logout(); Router.navigate('/login')">
                <span class="material-icons-round text-lg">logout</span>
                <span class="mobile-hidden">Salir</span>
              </a>
            </div>
          </div>
        </header>

        <!-- Content area -->
        <div id="view-content" class="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          <div class="flex items-center justify-center h-32">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        </div>

        <!-- Footer -->
        <footer class="text-center text-xs text-gray-400 dark:text-gray-500 py-4 border-t border-gray-100 dark:border-gray-800">
          &copy; 2026 NEUVOX. Todos los derechos reservados.
        </footer>
      </main>
    </div>
  `;

  const content = document.getElementById('view-content');

  // Load fresh data from API
  let teachers = await State.refreshTeachers();
  const courses = State.getCourses();
  let searchTerm = '';
  let currentPage = 1;
  let statusFilter = ''; // Empty = all, or ACTIVE, INACTIVE, ON_LEAVE, DELETED
  let courseFilter = ''; // Empty = all, or course ID
  const PAGE_SIZE = 15;

  // Helper to get courses assigned to a teacher
  function getTeacherCourses(teacherId) {
    return courses.filter(c =>
      (c.teacher_ids && c.teacher_ids.includes(teacherId)) ||
      c.teacher_id === teacherId
    );
  }

  function getFilteredTeachers() {
    let filtered = teachers;

    // Filter by status if set
    if (statusFilter) {
      filtered = filtered.filter(t => (t.status || 'ACTIVE') === statusFilter);
    }

    // Filter by course if set
    if (courseFilter) {
      const courseId = parseInt(courseFilter);
      filtered = filtered.filter(t => {
        const teacherCourses = getTeacherCourses(t.id);
        return teacherCourses.some(c => c.id === courseId);
      });
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.full_name.toLowerCase().includes(term) ||
        (t.email && t.email.toLowerCase().includes(term))
      );
    }

    return filtered;
  }

  // Build course options for filter dropdown
  const courseOptions = courses.map(c =>
    `<option value="${c.id}" ${courseFilter === String(c.id) ? 'selected' : ''}>${Components.escapeHtml(c.name)}</option>`
  ).join('');

  function renderTeachers() {
    const filtered = getFilteredTeachers();
    const totalTeachers = teachers.length;

    content.innerHTML = `
      <!-- Info Card -->
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex items-center gap-4">
        <div class="w-12 h-12 bg-white dark:bg-blue-800 rounded-lg shadow-sm flex items-center justify-center flex-shrink-0">
          <span class="material-icons-round text-blue-600 dark:text-blue-400 text-2xl">badge</span>
        </div>
        <div>
          <h4 class="text-blue-900 dark:text-blue-200 font-bold">Gestion de Profesores</h4>
          <p class="text-sm text-blue-700 dark:text-blue-300">Aqui puedes crear, editar y asignar cursos a los profesores. Cada profesor puede tener multiples cursos asignados.</p>
        </div>
      </div>

      <!-- Title + New Button -->
      <div class="flex justify-between items-end">
        <div>
          <h3 class="text-xl font-bold text-slate-800 dark:text-white">
            Profesores del Establecimiento <span class="text-slate-400 font-normal ml-1">(${totalTeachers})</span>
          </h3>
          <p class="text-sm text-slate-500 dark:text-slate-400">${totalTeachers} profesor${totalTeachers !== 1 ? 'es' : ''} registrado${totalTeachers !== 1 ? 's' : ''}</p>
        </div>
        <button onclick="Views.directorTeachers.showCreateForm()"
                class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700
                       text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200
                       dark:shadow-none flex items-center gap-2 transition-all">
          <span class="material-icons-round text-lg">add</span>
          Nuevo Profesor
        </button>
      </div>

      <!-- Filters Card -->
      <div class="bg-white dark:bg-card-dark rounded-xl p-6 shadow-sm border border-slate-100 dark:border-border-dark">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <!-- Search input (col-span-4) -->
          <div class="md:col-span-4">
            <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Buscar profesor</label>
            <div class="relative">
              <span class="absolute left-3 top-2.5 text-slate-400 material-icons-round text-xl">search</span>
              <input type="text" id="search-teacher"
                     class="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg
                            focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                            text-slate-700 dark:text-slate-200 placeholder-slate-400"
                     placeholder="Nombre, email..."
                     value="${Components.escapeHtml(searchTerm)}"
                     onkeyup="Views.directorTeachers.search(this.value)">
            </div>
          </div>

          <!-- Course filter (col-span-3) -->
          <div class="md:col-span-3">
            <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Curso</label>
            <select id="filter-course"
                    class="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg
                           focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                           text-slate-700 dark:text-slate-200"
                    onchange="Views.directorTeachers.filterByCourse(this.value)">
              <option value="">Todos los cursos</option>
              ${courseOptions}
            </select>
          </div>

          <!-- Status filter (col-span-2) -->
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Estado</label>
            <select id="filter-status"
                    class="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg
                           focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                           text-slate-700 dark:text-slate-200"
                    onchange="Views.directorTeachers.filterByStatus(this.value)">
              <option value="" ${!statusFilter ? 'selected' : ''}>Todos</option>
              <option value="ACTIVE" ${statusFilter === 'ACTIVE' ? 'selected' : ''}>Activo</option>
              <option value="INACTIVE" ${statusFilter === 'INACTIVE' ? 'selected' : ''}>Inactivo</option>
              <option value="ON_LEAVE" ${statusFilter === 'ON_LEAVE' ? 'selected' : ''}>Con licencia</option>
              <option value="DELETED" ${statusFilter === 'DELETED' ? 'selected' : ''}>Eliminados</option>
            </select>
          </div>

          <!-- Buttons (col-span-3) -->
          <div class="md:col-span-3 flex gap-2">
            <button onclick="Views.directorTeachers.clearFilters()"
                    class="flex-1 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300
                           border border-slate-200 dark:border-slate-600 rounded-lg
                           hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-2 transition-colors">
              <span class="material-icons-round text-lg">close</span> Limpiar
            </button>
            <button onclick="Views.directorTeachers.exportCSV()"
                    class="flex-1 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300
                           border border-slate-200 dark:border-slate-600 rounded-lg
                           hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-2 transition-colors">
              <span class="material-icons-round text-lg">download</span> Exportar
            </button>
          </div>
        </div>
      </div>

      <!-- Teachers Table -->
      <div class="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-slate-100 dark:border-border-dark overflow-hidden">
        <!-- Table header -->
        <div class="px-6 py-4 border-b border-slate-50 dark:border-slate-700">
          <h4 class="font-bold text-slate-800 dark:text-white">Lista de Profesores (${filtered.length})</h4>
        </div>

        ${filtered.length === 0 ? `
          <div class="p-8 text-center">
            <span class="material-icons-round text-4xl text-slate-300 dark:text-slate-600 mb-2">person_off</span>
            <p class="text-slate-500 dark:text-slate-400">
              ${searchTerm || courseFilter || statusFilter
                ? 'No hay profesores que coincidan con los filtros'
                : 'No hay profesores registrados. Haz clic en "Nuevo Profesor" para agregar uno.'}
            </p>
          </div>
        ` : `
          <!-- Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead>
                <tr class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                  <th class="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre</th>
                  <th class="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</th>
                  <th class="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cursos Asignados</th>
                  <th class="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado</th>
                  <th class="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody id="teachers-tbody" class="divide-y divide-slate-50 dark:divide-slate-800">
                ${renderTableRows(filtered)}
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div id="teachers-pagination">
            ${renderPagination(filtered)}
          </div>
        `}
      </div>
    `;
  }

  function updateTableContent() {
    const filtered = getFilteredTeachers();
    const tbody = document.getElementById('teachers-tbody');
    const pagination = document.getElementById('teachers-pagination');
    const tableContainer = document.querySelector('.overflow-x-auto')?.parentElement;

    if (!tableContainer) {
      renderTeachers();
      return;
    }

    if (filtered.length === 0) {
      // Replace table with empty state
      const headerDiv = tableContainer.querySelector('.px-6.py-4');
      const emptyHTML = `
        <div class="px-6 py-4 border-b border-slate-50 dark:border-slate-700">
          <h4 class="font-bold text-slate-800 dark:text-white">Lista de Profesores (0)</h4>
        </div>
        <div class="p-8 text-center">
          <span class="material-icons-round text-4xl text-slate-300 dark:text-slate-600 mb-2">person_off</span>
          <p class="text-slate-500 dark:text-slate-400">
            ${searchTerm || courseFilter || statusFilter
              ? 'No hay profesores que coincidan con los filtros'
              : 'No hay profesores registrados.'}
          </p>
        </div>
      `;
      tableContainer.innerHTML = emptyHTML;
    } else {
      if (tbody) {
        tbody.innerHTML = renderTableRows(filtered);
        if (pagination) {
          pagination.innerHTML = renderPagination(filtered);
        }
        // Update header count
        const headerH4 = tableContainer.querySelector('h4');
        if (headerH4) {
          headerH4.textContent = `Lista de Profesores (${filtered.length})`;
        }
      } else {
        renderTeachers();
      }
    }
  }

  function renderTableRows(filtered) {
    const start = (currentPage - 1) * PAGE_SIZE;
    const paginated = filtered.slice(start, start + PAGE_SIZE);

    return paginated.map((teacher, index) => {
      // Get courses assigned to this teacher
      const teacherCourses = getTeacherCourses(teacher.id);
      const colorIndex = (start + index) % avatarColors.length;
      const avatarColor = avatarColors[colorIndex];
      const initials = getInitials(teacher.full_name);

      // Course badges
      const courseBadges = teacherCourses.length > 0
        ? `<div class="flex flex-wrap gap-1.5">
            ${teacherCourses.slice(0, 3).map(c =>
              `<span class="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">${Components.escapeHtml(c.name)}</span>`
            ).join('')}
            ${teacherCourses.length > 3 ? `<span class="text-xs text-slate-500 dark:text-slate-400 self-center">+${teacherCourses.length - 3} mas</span>` : ''}
           </div>`
        : `<span class="text-sm text-slate-400 dark:text-slate-500">Sin cursos</span>`;

      const isDeleted = teacher.status === 'DELETED';

      // Status badge with dot
      let statusBadge;
      if (teacher.status === 'ACTIVE' || !teacher.status) {
        statusBadge = `
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span> Activo
          </span>`;
      } else if (teacher.status === 'ON_LEAVE') {
        statusBadge = `
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span> Con licencia
          </span>`;
      } else if (teacher.status === 'DELETED') {
        statusBadge = `
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
            <span class="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span> Eliminado
          </span>`;
      } else {
        statusBadge = `
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            <span class="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span> Inactivo
          </span>`;
      }

      // Action buttons
      const actionButtons = isDeleted
        ? `
          <button onclick="Views.directorTeachers.confirmRestore(${teacher.id})"
                  class="px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400
                         bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50
                         rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-1.5 transition-colors">
            <span class="material-icons-round text-lg">restore</span>
            Restaurar
          </button>
        `
        : `
          <div class="flex items-center gap-2">
            <button onclick="Views.directorTeachers.viewProfile(${teacher.id})"
                    class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50
                           dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                    title="Ver Perfil">
              <span class="material-icons-round text-xl">visibility</span>
            </button>
            <button onclick="Views.directorTeachers.showEditForm(${teacher.id})"
                    class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50
                           dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                    title="Editar">
              <span class="material-icons-round text-xl">edit</span>
            </button>
            <button onclick="Views.directorTeachers.assignCourses(${teacher.id})"
                    class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50
                           dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                    title="Gestionar Cursos">
              <span class="material-icons-round text-xl">book</span>
            </button>
            <button onclick="Views.directorTeachers.confirmDelete(${teacher.id})"
                    class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50
                           dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Eliminar">
              <span class="material-icons-round text-xl">delete</span>
            </button>
          </div>
        `;

      return `
        <tr class="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors${isDeleted ? ' opacity-70' : ''}">
          <td class="px-6 py-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full ${avatarColor.bg} flex items-center justify-center ${avatarColor.text} font-bold text-sm">
                ${initials}
              </div>
              <span class="font-bold text-slate-800 dark:text-white">${Components.escapeHtml(teacher.full_name)}</span>
            </div>
          </td>
          <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">${Components.escapeHtml(teacher.email || '-')}</td>
          <td class="px-6 py-4">${courseBadges}</td>
          <td class="px-6 py-4">${statusBadge}</td>
          <td class="px-6 py-4">${actionButtons}</td>
        </tr>
      `;
    }).join('');
  }

  function renderPagination(filtered) {
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (totalPages <= 1) return '';

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, filtered.length);

    return `
      <div class="px-6 py-4 border-t border-slate-50 dark:border-slate-700 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>Mostrando ${start} a ${end} de ${filtered.length} registros</span>
        <div class="flex gap-2">
          <button onclick="Views.directorTeachers.changePage(${currentPage - 1})"
                  class="p-1 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  ${currentPage === 1 ? 'disabled' : ''}>
            <span class="material-icons-round text-xl">chevron_left</span>
          </button>
          <button onclick="Views.directorTeachers.changePage(${currentPage + 1})"
                  class="p-1 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  ${currentPage === totalPages ? 'disabled' : ''}>
            <span class="material-icons-round text-xl">chevron_right</span>
          </button>
        </div>
      </div>
    `;
  }

  // ==================== PUBLIC METHODS ====================

  Views.directorTeachers.toggleDarkMode = function() {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', document.documentElement.classList.contains('dark'));
    Views.directorTeachers();
  };

  Views.directorTeachers.search = function(term) {
    searchTerm = term;
    currentPage = 1;
    updateTableContent();
  };

  Views.directorTeachers.filterByCourse = function(course) {
    courseFilter = course;
    currentPage = 1;
    updateTableContent();
  };

  Views.directorTeachers.filterByStatus = async function(status) {
    statusFilter = status;
    currentPage = 1;
    // Reload teachers from API with filter
    teachers = await State.refreshTeachers({ status: status || undefined });
    renderTeachers();
  };

  Views.directorTeachers.clearFilters = async function() {
    searchTerm = '';
    courseFilter = '';
    currentPage = 1;

    // If status filter was set, need to reload all teachers
    if (statusFilter) {
      statusFilter = '';
      teachers = await State.refreshTeachers();
      renderTeachers();
    } else {
      renderTeachers();
    }
  };

  Views.directorTeachers.changePage = function(page) {
    currentPage = page;
    updateTableContent();
  };

  Views.directorTeachers.showCreateForm = function() {
    Components.showModal('Nuevo Profesor', `
      <form id="teacher-form">
        <div class="form-group">
          <label class="form-label">Nombre Completo *</label>
          <input type="text" id="teacher-name" class="form-input" required placeholder="Ej: Maria Gonzalez Lopez">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" id="teacher-email" class="form-input" placeholder="profesor@colegio.cl">
          <small style="color: var(--color-gray-500);">Opcional. Debe ser unico si se proporciona.</small>
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select id="teacher-status" class="form-input">
            <option value="ACTIVE" selected>Activo</option>
            <option value="ON_LEAVE">Con licencia</option>
            <option value="INACTIVE">Inactivo</option>
          </select>
        </div>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" id="teacher-biometric">
            <span>Puede enrolar biometrico</span>
          </label>
          <small style="color: var(--color-gray-500);">Permite al profesor registrar asistencia con huella/rostro.</small>
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorTeachers.saveTeacher() }
    ]);
  };

  Views.directorTeachers.showEditForm = function(teacherId) {
    const teacher = State.getTeacher(teacherId);
    if (!teacher) {
      Components.showToast('Profesor no encontrado', 'error');
      return;
    }

    Components.showModal('Editar Profesor', `
      <form id="teacher-form">
        <div class="form-group">
          <label class="form-label">Nombre Completo *</label>
          <input type="text" id="teacher-name" class="form-input" required value="${Components.escapeHtml(teacher.full_name)}">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" id="teacher-email" class="form-input" value="${Components.escapeHtml(teacher.email || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select id="teacher-status" class="form-input">
            <option value="ACTIVE" ${teacher.status === 'ACTIVE' ? 'selected' : ''}>Activo</option>
            <option value="ON_LEAVE" ${teacher.status === 'ON_LEAVE' ? 'selected' : ''}>Con licencia</option>
            <option value="INACTIVE" ${teacher.status === 'INACTIVE' ? 'selected' : ''}>Inactivo</option>
          </select>
        </div>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" id="teacher-biometric" ${teacher.can_enroll_biometric ? 'checked' : ''}>
            <span>Puede enrolar biometrico</span>
          </label>
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorTeachers.saveTeacher(teacherId) }
    ]);
  };

  Views.directorTeachers.saveTeacher = async function(teacherId = null) {
    const name = document.getElementById('teacher-name').value.trim();
    const email = document.getElementById('teacher-email').value.trim();
    const status = document.getElementById('teacher-status').value;
    const canEnrollBiometric = document.getElementById('teacher-biometric').checked;

    // Validation
    if (!name) {
      Components.showToast('El nombre es requerido', 'error');
      return;
    }

    if (name.length < 2) {
      Components.showToast('El nombre debe tener al menos 2 caracteres', 'error');
      return;
    }

    // Email validation if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        Components.showToast('Ingrese un email valido', 'error');
        return;
      }
    }

    const teacherData = {
      full_name: name,
      email: email || null,
      status: status,
      can_enroll_biometric: canEnrollBiometric
    };

    // Get save button for loading state
    const saveBtn = document.querySelector('.modal .btn-primary');
    const originalText = saveBtn ? saveBtn.textContent : 'Guardar';

    try {
      // Disable button and show loading
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';
      }

      if (teacherId) {
        await State.updateTeacher(teacherId, teacherData);
        Components.showToast('Profesor actualizado correctamente', 'success');
      } else {
        await State.addTeacher(teacherData);
        Components.showToast('Profesor creado correctamente', 'success');
      }

      // Close modal and refresh
      document.querySelector('.modal-container')?.click();
      teachers = State.getTeachers();
      renderTeachers();

    } catch (error) {
      Components.showToast(error.message || 'Error al guardar', 'error');
      console.error('Save teacher error:', error);

      // Re-enable button
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    }
  };

  Views.directorTeachers.assignCourses = function(teacherId) {
    const teacher = State.getTeacher(teacherId);
    if (!teacher) {
      Components.showToast('Profesor no encontrado', 'error');
      return;
    }

    // Get currently assigned courses using helper
    const assignedCourseIds = getTeacherCourses(teacherId).map(c => c.id);

    const coursesCheckboxes = courses.map(c => `
      <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem; border: 1px solid var(--color-gray-200); border-radius: 8px; cursor: pointer; margin-bottom: 0.5rem;">
        <input type="checkbox" class="course-checkbox" value="${c.id}" data-was-assigned="${assignedCourseIds.includes(c.id)}" ${assignedCourseIds.includes(c.id) ? 'checked' : ''}>
        <div>
          <strong>${Components.escapeHtml(c.name)}</strong>
          <div style="font-size: 0.85rem; color: var(--color-gray-500);">${Components.escapeHtml(c.grade || '')}</div>
        </div>
      </label>
    `).join('');

    Components.showModal(`Asignar Cursos - ${teacher.full_name}`, `
      <p style="margin-bottom: 1rem; color: var(--color-gray-600);">
        Seleccione los cursos que seran asignados a este profesor:
      </p>
      <div style="max-height: 300px; overflow-y: auto;">
        ${coursesCheckboxes || '<p style="color: var(--color-gray-500);">No hay cursos disponibles</p>'}
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorTeachers.saveCourseAssignments(teacherId) }
    ]);
  };

  Views.directorTeachers.saveCourseAssignments = async function(teacherId) {
    const checkboxes = document.querySelectorAll('.course-checkbox');

    // Get save button for loading state
    const saveBtn = document.querySelector('.modal .btn-primary');
    const originalText = saveBtn ? saveBtn.textContent : 'Guardar';

    try {
      // Disable button and show loading
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';
      }

      // Process each course
      for (const cb of checkboxes) {
        const courseId = parseInt(cb.value);
        const wasAssigned = cb.dataset.wasAssigned === 'true';
        const isNowAssigned = cb.checked;

        if (isNowAssigned && !wasAssigned) {
          // Assign course
          await State.assignCourseToTeacher(teacherId, courseId);
        } else if (!isNowAssigned && wasAssigned) {
          // Unassign course
          await State.unassignCourseFromTeacher(teacherId, courseId);
        }
      }

      Components.showToast('Cursos actualizados correctamente', 'success');

      // Close modal and refresh
      document.querySelector('.modal-container')?.click();
      teachers = State.getTeachers();
      renderTeachers();

    } catch (error) {
      Components.showToast(error.message || 'Error al actualizar cursos', 'error');
      console.error('Save course assignments error:', error);

      // Re-enable button
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    }
  };

  Views.directorTeachers.viewProfile = function(teacherId) {
    const teacher = State.getTeacher(teacherId);
    if (!teacher) {
      Components.showToast('Profesor no encontrado', 'error');
      return;
    }

    // Get courses assigned to this teacher using helper
    const teacherCourses = getTeacherCourses(teacherId);

    const coursesHTML = teacherCourses.length > 0
      ? teacherCourses.map(c => `
          <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--color-gray-100);">
            <strong>${Components.escapeHtml(c.name)}</strong>
            <span style="color: var(--color-gray-500);"> - ${Components.escapeHtml(c.grade || '')}</span>
          </li>
        `).join('')
      : '<li style="color: var(--color-gray-500);">Sin cursos asignados</li>';

    const statusChip = teacher.status === 'ACTIVE'
      ? Components.createChip('Activo', 'success')
      : teacher.status === 'ON_LEAVE'
      ? Components.createChip('Con licencia', 'warning')
      : Components.createChip('Inactivo', 'gray');

    const biometricChip = teacher.can_enroll_biometric
      ? Components.createChip('Si', 'success')
      : Components.createChip('No', 'gray');

    Components.showModal(`Perfil - ${teacher.full_name}`, `
      <div class="card mb-2">
        <div class="card-header">Informacion del Profesor</div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
            <div><strong>Nombre:</strong><br>${Components.escapeHtml(teacher.full_name)}</div>
            <div><strong>Email:</strong><br>${teacher.email || 'No registrado'}</div>
            <div><strong>Estado:</strong><br>${statusChip}</div>
            <div><strong>Biometrico:</strong><br>${biometricChip}</div>
            <div><strong>ID:</strong><br>${teacher.id}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Cursos Asignados (${teacherCourses.length})</div>
        <div class="card-body">
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${coursesHTML}
          </ul>
        </div>
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' },
      { label: 'Enrolar QR', action: 'qr', className: 'btn-secondary', onClick: () => {
        document.querySelector('.modal-container').click();
        if (typeof QREnrollment !== 'undefined') {
          QREnrollment.showTeacherEnrollmentModal(teacherId);
        } else {
          Components.showToast('Servicio QR no disponible', 'error');
        }
      }},
      { label: 'Enrolar NFC', action: 'nfc', className: 'btn-secondary', onClick: () => {
        document.querySelector('.modal-container').click();
        if (typeof NFCEnrollment !== 'undefined') {
          NFCEnrollment.showTeacherEnrollmentModal(teacherId);
        } else {
          Components.showToast('Servicio NFC no disponible', 'error');
        }
      }},
      { label: 'Editar', action: 'edit', className: 'btn-primary', onClick: () => {
        document.querySelector('.modal-container').click();
        Views.directorTeachers.showEditForm(teacherId);
      }}
    ]);
  };

  Views.directorTeachers.confirmDelete = function(teacherId) {
    const teacher = State.getTeacher(teacherId);
    if (!teacher) {
      Components.showToast('Profesor no encontrado', 'error');
      return;
    }

    // Count assigned courses using helper
    const assignedCourses = getTeacherCourses(teacherId);

    const warningMsg = assignedCourses.length > 0
      ? `<p style="color: var(--color-warning); margin-top: 0.5rem;"><strong>Advertencia:</strong> Este profesor tiene ${assignedCourses.length} curso${assignedCourses.length !== 1 ? 's' : ''} asignado${assignedCourses.length !== 1 ? 's' : ''}. Al eliminarlo, se desvinculara de todos los cursos.</p>`
      : '';

    Components.showModal('Confirmar Eliminacion', `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠</div>
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">¿Esta seguro de eliminar al profesor?</p>
        <p style="font-weight: 600; color: var(--color-error);">${Components.escapeHtml(teacher.full_name)}</p>
        ${warningMsg}
        <p style="font-size: 0.9rem; color: var(--color-gray-500); margin-top: 1rem;">
          Esta accion no se puede deshacer.
        </p>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Eliminar', action: 'delete', className: 'btn-error', onClick: async () => {
        // Get delete button for loading state
        const deleteBtn = document.querySelector('.modal .btn-error');
        const originalText = deleteBtn ? deleteBtn.textContent : 'Eliminar';

        try {
          // Disable button and show loading
          if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Eliminando...';
          }

          await State.deleteTeacher(teacherId);
          Components.showToast('Profesor eliminado', 'success');

          // Close modal and refresh
          document.querySelector('.modal-container')?.click();
          teachers = State.getTeachers();
          renderTeachers();

        } catch (error) {
          Components.showToast(error.message || 'Error al eliminar', 'error');
          console.error('Delete teacher error:', error);

          // Re-enable button
          if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = originalText;
          }
        }
      }}
    ]);
  };

  Views.directorTeachers.confirmRestore = function(teacherId) {
    const teacher = State.getTeacher(teacherId);
    if (!teacher) {
      Components.showToast('Profesor no encontrado', 'error');
      return;
    }

    Components.showModal('Confirmar Restauracion', `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">↩</div>
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">¿Restaurar este profesor?</p>
        <p style="font-weight: 600; color: var(--color-success);">${Components.escapeHtml(teacher.full_name)}</p>
        <p style="font-size: 0.9rem; color: var(--color-gray-500); margin-top: 1rem;">
          El profesor volvera a estar activo en el sistema.
        </p>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Restaurar', action: 'restore', className: 'btn-success', onClick: async () => {
        const restoreBtn = document.querySelector('.modal .btn-success');
        const originalText = restoreBtn ? restoreBtn.textContent : 'Restaurar';

        try {
          if (restoreBtn) {
            restoreBtn.disabled = true;
            restoreBtn.textContent = 'Restaurando...';
          }

          await State.restoreTeacher(teacherId);
          Components.showToast('Profesor restaurado', 'success');

          document.querySelector('.modal-container')?.click();
          teachers = await State.refreshTeachers({ status: statusFilter || undefined });
          renderTeachers();

        } catch (error) {
          Components.showToast(error.message || 'Error al restaurar', 'error');
          console.error('Restore teacher error:', error);

          if (restoreBtn) {
            restoreBtn.disabled = false;
            restoreBtn.textContent = originalText;
          }
        }
      }}
    ]);
  };

  Views.directorTeachers.exportCSV = async function() {
    try {
      const blob = await State.exportTeachersCSV({ status: statusFilter || undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profesores_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Components.showToast('Exportacion completada', 'success');
    } catch (error) {
      Components.showToast(error.message || 'Error al exportar', 'error');
      console.error('Export teachers error:', error);
    }
  };

  // Initial render
  renderTeachers();
};
