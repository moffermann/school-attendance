// Director Course Detail Page - Tailwind Redesign
Views.directorCourseDetail = function(courseId) {
  const app = document.getElementById('app');

  const course = State.getCourse(courseId);
  let sidebarOpen = false;
  let isDark = document.documentElement.classList.contains('dark');

  // Get user info
  const user = State.getCurrentUser();
  const userName = user?.full_name || user?.email?.split('@')[0] || 'Director';
  const userInitial = userName.charAt(0).toUpperCase();

  // Current path for active state
  const currentPath = '/director/courses';

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

  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar && backdrop) {
      sidebar.classList.toggle('mobile-hidden');
      backdrop.classList.toggle('hidden');
    }
  }

  function toggleDarkMode() {
    isDark = !isDark;
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('darkMode', isDark ? 'true' : 'false');
    renderLayout();
  }

  function renderLayout() {
    // Handle course not found
    if (!course) {
      app.innerHTML = `
        <div class="h-screen flex overflow-hidden bg-gray-50 dark:bg-background-dark">
          <!-- Sidebar -->
          <aside id="sidebar" class="w-64 bg-sidebar-dark text-gray-300 flex-shrink-0 flex-col transition-all duration-300 mobile-hidden border-r border-indigo-900/50 shadow-2xl z-50">
            <div class="h-20 flex items-center justify-between px-6 border-b border-indigo-900/50">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg">
                  <div class="w-4 h-4 bg-indigo-900 rounded-full"></div>
                </div>
                <h1 class="text-xl font-bold tracking-tight text-white">NEUVOX</h1>
              </div>
              <button class="desktop-hidden text-gray-400 hover:text-white p-1" onclick="Views.directorCourseDetail.toggleSidebar()">
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
          <div id="sidebar-backdrop" class="fixed inset-0 bg-black/50 z-40 hidden desktop-hidden" onclick="Views.directorCourseDetail.toggleSidebar()"></div>

          <!-- Main content -->
          <main class="flex-1 flex flex-col overflow-hidden">
            <!-- Header -->
            <header class="h-20 bg-white dark:bg-card-dark border-b border-gray-100 dark:border-border-dark flex items-center justify-between px-8 shadow-sm">
              <div class="flex items-center gap-4">
                <button class="desktop-hidden text-gray-500 hover:text-indigo-600" onclick="Views.directorCourseDetail.toggleSidebar()">
                  <span class="material-icons-round text-2xl">menu</span>
                </button>
                <h2 class="text-xl font-bold text-gray-800 dark:text-white">Curso no encontrado</h2>
              </div>
              <div class="flex items-center gap-4">
                <a href="#" onclick="event.preventDefault(); Router.navigate('/director/courses')"
                   class="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 border px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 dark:border-gray-600">
                  <span class="material-icons-round text-lg">arrow_back</span>
                  <span class="mobile-hidden">Volver</span>
                </a>
              </div>
            </header>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-8 flex items-center justify-center">
              <div class="bg-white dark:bg-card-dark rounded-custom p-12 shadow-sm text-center max-w-md">
                <span class="material-icons-round text-6xl text-gray-300 dark:text-gray-600">menu_book</span>
                <h3 class="text-xl font-bold text-gray-800 dark:text-white mt-4">Curso no encontrado</h3>
                <p class="text-gray-500 dark:text-gray-400 mt-2 mb-6">El curso solicitado no existe o fue eliminado.</p>
                <button class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700
                               text-white px-6 py-2.5 rounded-custom font-semibold flex items-center gap-2 mx-auto
                               shadow-lg shadow-indigo-200 dark:shadow-none"
                        onclick="Router.navigate('/director/courses')">
                  <span class="material-icons-round">arrow_back</span>
                  Volver a Cursos
                </button>
              </div>
            </div>

            <!-- Footer -->
            <footer class="text-center text-xs text-gray-400 dark:text-gray-500 py-4 border-t border-gray-100 dark:border-gray-800">
              &copy; 2026 NEUVOX. Todos los derechos reservados.
            </footer>
          </main>
        </div>
      `;
      return;
    }

    // Get related data
    const students = State.getStudents().filter(s => s.course_id === courseId);
    const schedules = State.getSchedules ? State.getSchedules().filter(s => s.course_id === courseId) : [];
    const teachers = State.getTeachers ? State.getTeachers().filter(t => (course.teacher_ids || []).includes(t.id)) : [];

    // Status badge helper
    const getStatusBadge = (status) => {
      const badges = {
        'ACTIVE': { label: 'Activo', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
        'ARCHIVED': { label: 'Archivado', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
        'DELETED': { label: 'Eliminado', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' }
      };
      return badges[status] || badges.ACTIVE;
    };

    const statusInfo = getStatusBadge(course.status);

    // Days translation
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

    app.innerHTML = `
      <div class="h-screen flex overflow-hidden bg-gray-50 dark:bg-background-dark">
        <!-- Sidebar -->
        <aside id="sidebar" class="w-64 bg-sidebar-dark text-gray-300 flex-shrink-0 flex-col transition-all duration-300 mobile-hidden border-r border-indigo-900/50 shadow-2xl z-50">
          <div class="h-20 flex items-center justify-between px-6 border-b border-indigo-900/50">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg">
                <div class="w-4 h-4 bg-indigo-900 rounded-full"></div>
              </div>
              <h1 class="text-xl font-bold tracking-tight text-white">NEUVOX</h1>
            </div>
            <button class="desktop-hidden text-gray-400 hover:text-white p-1" onclick="Views.directorCourseDetail.toggleSidebar()">
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
        <div id="sidebar-backdrop" class="fixed inset-0 bg-black/50 z-40 hidden desktop-hidden" onclick="Views.directorCourseDetail.toggleSidebar()"></div>

        <!-- Main content -->
        <main class="flex-1 flex flex-col overflow-hidden">
          <!-- Header -->
          <header class="h-20 bg-white dark:bg-card-dark border-b border-gray-100 dark:border-border-dark flex items-center justify-between px-8 shadow-sm">
            <div class="flex items-center gap-4">
              <button class="desktop-hidden text-gray-500 hover:text-indigo-600" onclick="Views.directorCourseDetail.toggleSidebar()">
                <span class="material-icons-round text-2xl">menu</span>
              </button>
              <h2 class="text-xl font-bold text-gray-800 dark:text-white">Detalle del Curso</h2>
            </div>
            <div class="flex items-center gap-2 md:gap-4">
              <div class="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1 mobile-hidden"></div>
              <button class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-gray-500 dark:text-gray-400"
                      onclick="Views.directorCourseDetail.toggleDarkMode()">
                <span class="material-icons-round">${isDark ? 'light_mode' : 'dark_mode'}</span>
              </button>
              <div class="flex items-center gap-2">
                <div class="w-9 h-9 rounded-full border border-gray-200 bg-indigo-600 flex items-center justify-center text-white font-semibold">
                  ${userInitial}
                </div>
                <div class="text-right mobile-hidden">
                  <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">${Components.escapeHtml(userName)}</p>
                </div>
              </div>
              <a class="ml-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 border px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 dark:border-gray-600"
                 href="#" onclick="event.preventDefault(); State.logout(); Router.navigate('/login')">
                <span class="material-icons-round text-lg">logout</span>
                <span class="mobile-hidden">Salir</span>
              </a>
            </div>
          </header>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-8 space-y-6">
            <!-- Back button + Actions -->
            <div class="flex items-center justify-between flex-wrap gap-4">
              <button class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300
                             border border-gray-200 dark:border-slate-600 rounded-lg
                             hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                      onclick="Router.navigate('/director/courses')">
                <span class="material-icons-round text-lg">arrow_back</span>
                Volver a Cursos
              </button>
              ${State.currentRole === 'director' ? `
                <div class="flex gap-2">
                  <button class="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400
                                 border border-indigo-200 dark:border-indigo-800 rounded-lg
                                 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center gap-2"
                          onclick="Views.directorCourseDetail.showEditForm()">
                    <span class="material-icons-round text-lg">edit</span>
                    Editar Curso
                  </button>
                  <button class="px-4 py-2 text-sm font-medium text-red-500 dark:text-red-400
                                 border border-red-200 dark:border-red-800 rounded-lg
                                 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                          onclick="Views.directorCourseDetail.confirmDelete()">
                    <span class="material-icons-round text-lg">delete</span>
                    Eliminar
                  </button>
                </div>
              ` : ''}
            </div>

            <!-- Course Info Card -->
            <div class="bg-white dark:bg-card-dark rounded-custom shadow-sm border border-gray-100 dark:border-border-dark overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-50 dark:border-slate-700 flex items-center justify-between">
                <h4 class="font-bold text-gray-800 dark:text-white">Informacion del Curso</h4>
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.bg} ${statusInfo.text}">
                  <span class="w-1.5 h-1.5 rounded-full ${statusInfo.dot} mr-1.5"></span>
                  ${statusInfo.label}
                </span>
              </div>
              <div class="p-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Nombre</label>
                    <p class="text-lg font-semibold text-gray-800 dark:text-white">${Components.escapeHtml(course.name)}</p>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Grado</label>
                    <p class="text-lg font-semibold text-gray-800 dark:text-white">${Components.escapeHtml(course.grade || '-')}</p>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">ID Sistema</label>
                    <p class="text-sm font-mono text-gray-600 dark:text-gray-400">#${course.id}</p>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Profesor(es)</label>
                    <p class="text-sm text-gray-700 dark:text-gray-300">
                      ${teachers.length > 0
                        ? teachers.map(t => Components.escapeHtml(t.full_name)).join(', ')
                        : '<span class="text-gray-400 dark:text-gray-500">Sin asignar</span>'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="bg-white dark:bg-card-dark p-6 rounded-custom shadow-sm border-l-4 border-indigo-500">
                <p class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">ALUMNOS</p>
                <p class="text-4xl font-bold text-indigo-600 dark:text-indigo-400">${students.length}</p>
              </div>
              <div class="bg-white dark:bg-card-dark p-6 rounded-custom shadow-sm border-l-4 border-emerald-500">
                <p class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">HORARIOS</p>
                <p class="text-4xl font-bold text-emerald-600 dark:text-emerald-400">${schedules.length}</p>
              </div>
              <div class="bg-white dark:bg-card-dark p-6 rounded-custom shadow-sm border-l-4 border-amber-500">
                <p class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">PROFESORES</p>
                <p class="text-4xl font-bold text-amber-600 dark:text-amber-400">${teachers.length}</p>
              </div>
            </div>

            <!-- Students Table -->
            <div class="bg-white dark:bg-card-dark rounded-custom shadow-sm border border-gray-100 dark:border-border-dark overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-50 dark:border-slate-700 flex items-center justify-between">
                <h4 class="font-bold text-gray-800 dark:text-white">Alumnos (${students.length})</h4>
                ${State.currentRole === 'director' ? `
                  <button class="px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400
                                 border border-indigo-200 dark:border-indigo-800 rounded-lg
                                 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center gap-1"
                          onclick="Router.navigate('/director/students')">
                    <span class="material-icons-round text-lg">settings</span>
                    Gestionar
                  </button>
                ` : ''}
              </div>
              ${students.length > 0 ? `
                <div class="overflow-x-auto">
                  <table class="w-full text-left">
                    <thead>
                      <tr class="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                        <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
                        <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">RUT/Matricula</th>
                        <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50 dark:divide-slate-700">
                      ${students.map(s => `
                        <tr class="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td class="px-6 py-4">
                            <span class="font-semibold text-gray-800 dark:text-white">${Components.escapeHtml(s.full_name)}</span>
                          </td>
                          <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            ${s.national_id || '<span class="text-gray-400 dark:text-gray-500">-</span>'}
                          </td>
                          <td class="px-6 py-4 text-center">
                            <button class="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50
                                           dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                    title="Ver perfil" onclick="Components.showStudentProfile(${s.id})">
                              <span class="material-icons-round text-xl">visibility</span>
                            </button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `
                <div class="text-center py-12">
                  <span class="material-icons-round text-4xl text-gray-300 dark:text-gray-600">group</span>
                  <p class="mt-2 text-gray-500 dark:text-gray-400">No hay alumnos asignados a este curso</p>
                  ${State.currentRole === 'director' ? `
                    <button class="mt-4 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400
                                   border border-indigo-200 dark:border-indigo-800 rounded-lg
                                   hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                            onclick="Router.navigate('/director/students')">
                      Ir a Gestion de Alumnos
                    </button>
                  ` : ''}
                </div>
              `}
            </div>

            <!-- Schedules Table -->
            <div class="bg-white dark:bg-card-dark rounded-custom shadow-sm border border-gray-100 dark:border-border-dark overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-50 dark:border-slate-700 flex items-center justify-between">
                <h4 class="font-bold text-gray-800 dark:text-white">Horarios (${schedules.length})</h4>
                ${State.currentRole === 'director' ? `
                  <button class="px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400
                                 border border-indigo-200 dark:border-indigo-800 rounded-lg
                                 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center gap-1"
                          onclick="Router.navigate('/director/schedules')">
                    <span class="material-icons-round text-lg">settings</span>
                    Gestionar
                  </button>
                ` : ''}
              </div>
              ${schedules.length > 0 ? `
                <div class="overflow-x-auto">
                  <table class="w-full text-left">
                    <thead>
                      <tr class="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                        <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dia</th>
                        <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entrada</th>
                        <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Salida</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50 dark:divide-slate-700">
                      ${schedules.map(s => `
                        <tr class="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td class="px-6 py-4">
                            <span class="font-semibold text-gray-800 dark:text-white">${dayNames[s.weekday] || s.weekday}</span>
                          </td>
                          <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">${s.in_time || '-'}</td>
                          <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">${s.out_time || '-'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `
                <div class="text-center py-12">
                  <span class="material-icons-round text-4xl text-gray-300 dark:text-gray-600">schedule</span>
                  <p class="mt-2 text-gray-500 dark:text-gray-400">No hay horarios configurados para este curso</p>
                  ${State.currentRole === 'director' ? `
                    <button class="mt-4 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400
                                   border border-indigo-200 dark:border-indigo-800 rounded-lg
                                   hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                            onclick="Router.navigate('/director/schedules')">
                      Ir a Gestion de Horarios
                    </button>
                  ` : ''}
                </div>
              `}
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

  // Edit course
  Views.directorCourseDetail.showEditForm = function() {
    const allTeachers = State.getTeachers ? State.getTeachers() : [];
    const currentTeacherIds = course.teacher_ids || [];

    Components.showModal('Editar Curso', `
      <form id="course-form">
        <div class="form-group">
          <label class="form-label">Nombre del Curso *</label>
          <input type="text" id="course-name" class="form-input" required value="${Components.escapeHtml(course.name)}" maxlength="128">
        </div>
        <div class="form-group">
          <label class="form-label">Grado *</label>
          <input type="text" id="course-grade" class="form-input" required value="${Components.escapeHtml(course.grade || '')}" maxlength="32">
          <small style="color: var(--color-gray-500); display: block; margin-top: 0.25rem;">
            Nivel educativo del curso (ej: Pre-Kinder, 1 Basico, 8 Basico, 4 Medio)
          </small>
        </div>
        <div class="form-group">
          <label class="form-label">Profesores</label>
          ${allTeachers.length > 0 ? `
            <select id="course-teachers" class="form-select" multiple style="min-height: 100px;">
              ${allTeachers.map(t => `<option value="${t.id}" ${currentTeacherIds.includes(t.id) ? 'selected' : ''}>${Components.escapeHtml(t.full_name)}</option>`).join('')}
            </select>
            <small style="color: var(--color-gray-500); display: block; margin-top: 0.25rem;">
              Manten Ctrl/Cmd para seleccionar multiples profesores
            </small>
          ` : `
            <p style="color: var(--color-gray-500); font-size: 0.9rem; margin: 0;">
              No hay profesores registrados.
            </p>
          `}
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorCourseDetail.saveCourse() }
    ]);
  };

  Views.directorCourseDetail.saveCourse = async function() {
    const name = document.getElementById('course-name').value.trim();
    const grade = document.getElementById('course-grade').value.trim();

    // Get selected teachers (if select exists)
    const teacherSelect = document.getElementById('course-teachers');
    const teacher_ids = teacherSelect
      ? Array.from(teacherSelect.selectedOptions).map(opt => parseInt(opt.value))
      : [];

    if (!name || !grade) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    try {
      await State.updateCourse(courseId, { name, grade, teacher_ids });
      Components.showToast('Curso actualizado correctamente', 'success');
      document.querySelector('.modal-container').click();
      // Update local reference and re-render
      Object.assign(course, { name, grade, teacher_ids });
      renderLayout();
    } catch (error) {
      Components.showToast(error.message || 'Error al guardar curso', 'error');
    }
  };

  // Delete course
  Views.directorCourseDetail.confirmDelete = function() {
    const students = State.getStudents().filter(s => s.course_id === courseId);
    const schedules = State.getSchedules ? State.getSchedules().filter(s => s.course_id === courseId) : [];
    const studentsCount = students.length;
    const schedulesCount = schedules.length;

    let warningMessage = '';
    if (studentsCount > 0 || schedulesCount > 0) {
      warningMessage = `
        <div style="background: var(--color-warning-light); padding: 0.75rem; border-radius: 8px; margin-top: 1rem; text-align: left;">
          <strong style="color: var(--color-warning-dark);">Atencion:</strong>
          <p style="margin: 0.5rem 0 0; font-size: 0.9rem;">
            Este curso tiene:
            ${studentsCount > 0 ? `<br>- ${studentsCount} alumno(s) asignado(s)` : ''}
            ${schedulesCount > 0 ? `<br>- ${schedulesCount} horario(s) configurado(s)` : ''}
          </p>
          <p style="margin: 0.5rem 0 0; font-size: 0.9rem; color: var(--color-error);">
            No se puede eliminar un curso con dependencias.
          </p>
        </div>
      `;
    }

    const canDelete = studentsCount === 0 && schedulesCount === 0;

    Components.showModal('Confirmar Eliminacion', `
      <div style="text-align: center; padding: 1rem;">
        <span class="material-icons-round text-5xl text-amber-500">warning</span>
        <p style="font-size: 1.1rem; margin: 1rem 0 0.5rem;">Esta seguro de eliminar el curso?</p>
        <p style="font-weight: 600; color: var(--color-error);">${Components.escapeHtml(course.name)}</p>
        ${warningMessage}
      </div>
    `, canDelete ? [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Eliminar', action: 'delete', className: 'btn-error', onClick: () => Views.directorCourseDetail.deleteCourse() }
    ] : [
      { label: 'Entendido', action: 'close', className: 'btn-secondary' }
    ]);
  };

  Views.directorCourseDetail.deleteCourse = async function() {
    try {
      await State.deleteCourse(courseId);
      document.querySelector('.modal-container').click();
      Components.showToast('Curso eliminado correctamente', 'success');
      Router.navigate('/director/courses');
    } catch (error) {
      Components.showToast(error.message || 'Error al eliminar curso', 'error');
    }
  };

  // Public methods
  Views.directorCourseDetail.toggleSidebar = toggleSidebar;
  Views.directorCourseDetail.toggleDarkMode = toggleDarkMode;

  // Initial render
  renderLayout();
};
