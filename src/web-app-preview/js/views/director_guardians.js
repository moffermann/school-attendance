// Director Guardians Management (CRUD Apoderados)
// Redesign: Tailwind layout siguiendo patron de otros modulos

Views.directorGuardians = async function() {
  const app = document.getElementById('app');

  // Current path for active state
  const currentPath = '/director/guardians';

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

  // Load fresh data from API
  let guardians = await State.refreshGuardians();
  const students = State.getStudents();
  let currentPage = 1;
  let searchTerm = '';
  let statusFilter = ''; // Empty = all, or ACTIVE, DELETED
  let studentFilter = ''; // Empty = all, or student ID

  // Pagination
  const PAGE_SIZE = 15;

  // Helper to get current dark mode state
  const isDarkMode = () => document.documentElement.classList.contains('dark');

  // Toggle dark mode
  window.toggleDarkMode = function() {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDarkMode() ? 'enabled' : 'disabled');
    renderGuardians();
  };

  // Toggle mobile sidebar
  window.toggleMobileSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar && backdrop) {
      sidebar.classList.toggle('mobile-hidden');
      backdrop.classList.toggle('hidden');
    }
  };

  // Helper to get students associated with a guardian
  function getGuardianStudents(guardianId) {
    const guardian = guardians.find(g => g.id === guardianId);
    if (!guardian || !guardian.student_ids) return [];
    return guardian.student_ids.map(id => students.find(s => s.id === id)).filter(Boolean);
  }

  function getFilteredGuardians() {
    let filtered = guardians;

    // Filter by status if set
    if (statusFilter) {
      filtered = filtered.filter(g => (g.status || 'ACTIVE') === statusFilter);
    }

    // Filter by student if set
    if (studentFilter) {
      const studentId = parseInt(studentFilter);
      filtered = filtered.filter(g =>
        g.student_ids && g.student_ids.includes(studentId)
      );
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(g =>
        g.full_name.toLowerCase().includes(term) ||
        (g.contacts?.email && g.contacts.email.toLowerCase().includes(term)) ||
        (g.contacts?.phone && g.contacts.phone.includes(term))
      );
    }

    return filtered;
  }

  function renderGuardians() {
    const filtered = getFilteredGuardians();
    const totalGuardians = guardians.length;
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, filtered.length);
    const paginated = filtered.slice(start, end);

    // Student options for filter dropdown
    const studentOptions = students.map(s =>
      `<option value="${s.id}" ${studentFilter === String(s.id) ? 'selected' : ''}>${Components.escapeHtml(s.full_name)}</option>`
    ).join('');

    app.innerHTML = `
      <div class="flex h-screen bg-[#f8fafc] dark:bg-slate-900">
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
        <div id="sidebar-backdrop" class="fixed inset-0 bg-black/50 z-40 hidden desktop-hidden" onclick="toggleMobileSidebar()"></div>

        <!-- Main Content -->
        <main class="flex-1 flex flex-col overflow-hidden">
          <!-- Header -->
          <header class="h-20 bg-white dark:bg-card-dark border-b border-slate-200 dark:border-border-dark flex items-center justify-between px-8 z-10">
            <div class="flex items-center gap-4">
              <button class="desktop-hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg" onclick="toggleMobileSidebar()">
                <span class="material-icons-round text-2xl text-slate-600 dark:text-slate-300">menu</span>
              </button>
              <h2 class="text-xl font-bold text-slate-800 dark:text-white">Gestion de Apoderados</h2>
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
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <!-- Info Card -->
            <div class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 flex items-start gap-4">
              <div class="p-2 bg-indigo-100 dark:bg-indigo-800 rounded-lg">
                <span class="material-icons-round text-indigo-600 dark:text-indigo-400">family_restroom</span>
              </div>
              <div>
                <h3 class="text-indigo-900 dark:text-indigo-200 font-semibold text-sm">Gestion de Apoderados</h3>
                <p class="text-indigo-700/80 dark:text-indigo-300/80 text-xs mt-0.5">Aqui puedes crear, editar y asociar apoderados a los alumnos. Cada apoderado puede tener multiples alumnos asociados y recibira notificaciones de asistencia.</p>
              </div>
            </div>

            <!-- Title + New Button -->
            <div class="flex justify-between items-end">
              <div>
                <h1 class="text-2xl font-bold text-slate-800 dark:text-white">
                  Apoderados del Establecimiento <span class="text-slate-400 font-medium ml-1">(${totalGuardians})</span>
                </h1>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">${totalGuardians} apoderado${totalGuardians !== 1 ? 's' : ''} registrado${totalGuardians !== 1 ? 's' : ''}</p>
              </div>
              <button class="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700
                             text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-indigo-200
                             dark:shadow-none flex items-center gap-2 transition-all"
                      onclick="Views.directorGuardians.showCreateForm()">
                <span class="material-icons-round text-[20px]">add</span>
                Nuevo Apoderado
              </button>
            </div>

            <!-- Filters Card -->
            <div class="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-slate-200 dark:border-border-dark p-6">
              <div class="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-6 items-end">
                <!-- Search -->
                <div class="lg:col-span-4">
                  <label class="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Buscar apoderado</label>
                  <input class="w-full px-4 py-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg
                                focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800
                                text-slate-700 dark:text-slate-200 placeholder-slate-400"
                         placeholder="Nombre, email, telefono..." type="text" id="search-guardian"
                         value="${Components.escapeHtml(searchTerm)}"
                         onkeyup="Views.directorGuardians.search(this.value)">
                </div>

                <!-- Student dropdown -->
                <div class="lg:col-span-3">
                  <label class="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Alumno</label>
                  <select class="w-full px-4 py-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg
                                 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800
                                 text-slate-700 dark:text-slate-200" id="filter-student"
                          onchange="Views.directorGuardians.filterByStudent(this.value)">
                    <option value="">Todos los alumnos</option>
                    ${studentOptions}
                  </select>
                </div>

                <!-- Status dropdown -->
                <div class="lg:col-span-2">
                  <label class="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Estado</label>
                  <select class="w-full px-4 py-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg
                                 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-800
                                 text-slate-700 dark:text-slate-200" id="filter-status"
                          onchange="Views.directorGuardians.filterByStatus(this.value)">
                    <option value="" ${!statusFilter ? 'selected' : ''}>Todos</option>
                    <option value="ACTIVE" ${statusFilter === 'ACTIVE' ? 'selected' : ''}>Activo</option>
                    <option value="DELETED" ${statusFilter === 'DELETED' ? 'selected' : ''}>Eliminados</option>
                  </select>
                </div>

                <!-- Buttons -->
                <div class="lg:col-span-3 flex gap-2">
                  <button class="flex-1 py-2.5 px-4 text-sm font-medium text-slate-600 dark:text-slate-300
                                 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600
                                 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center gap-2"
                          onclick="Views.directorGuardians.clearFilters()">
                    <span class="material-icons-round text-[18px]">close</span>
                    Limpiar
                  </button>
                  <button class="flex-1 py-2.5 px-4 text-sm font-medium text-slate-600 dark:text-slate-300
                                 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600
                                 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center gap-2"
                          onclick="Views.directorGuardians.exportCSV()">
                    <span class="material-icons-round text-[18px]">ios_share</span>
                    Exportar
                  </button>
                </div>
              </div>
            </div>

            <!-- Table Card -->
            <div class="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-slate-200 dark:border-border-dark overflow-hidden">
              <!-- Table Header -->
              <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 class="font-bold text-slate-800 dark:text-white">Lista de Apoderados (${filtered.length})</h3>
              </div>

              ${filtered.length === 0 ? `
                <div class="p-12 text-center">
                  <div class="inline-flex items-center justify-center w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
                    <span class="material-icons-round text-3xl text-slate-400">family_restroom</span>
                  </div>
                  <p class="text-slate-600 dark:text-slate-400 font-medium mb-2">Sin apoderados</p>
                  <p class="text-sm text-slate-500">${searchTerm || studentFilter ? 'No hay apoderados que coincidan con los filtros' : 'No hay apoderados registrados. Haga clic en "Nuevo Apoderado" para agregar uno.'}</p>
                </div>
              ` : `
                <div class="overflow-x-auto">
                  <table class="w-full text-left border-collapse">
                    <thead>
                      <tr class="bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        <th class="px-6 py-4">Nombre</th>
                        <th class="px-6 py-4">Email</th>
                        <th class="px-6 py-4">Telefono</th>
                        <th class="px-6 py-4">Alumnos Asociados</th>
                        <th class="px-6 py-4">Estado</th>
                        <th class="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody id="guardians-tbody" class="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                      ${renderTableRows(paginated)}
                    </tbody>
                  </table>
                </div>

                <!-- Pagination -->
                ${totalPages > 1 ? `
                  <div class="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div class="text-sm text-slate-500 dark:text-slate-400">
                      Mostrando ${start + 1} a ${end} de ${filtered.length} resultados
                    </div>
                    <div class="flex items-center gap-2">
                      <button class="px-3 py-1.5 text-sm font-medium ${currentPage === 1 ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}
                                     border border-slate-200 dark:border-slate-600 rounded-md disabled:opacity-50"
                              ${currentPage === 1 ? 'disabled' : ''}
                              onclick="Views.directorGuardians.changePage(${currentPage - 1})">
                        Anterior
                      </button>
                      <div class="text-sm text-slate-600 dark:text-slate-300 font-medium px-4">
                        Pagina ${currentPage} de ${totalPages}
                      </div>
                      <button class="px-3 py-1.5 text-sm font-medium ${currentPage === totalPages ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}
                                     border border-slate-200 dark:border-slate-600 rounded-md disabled:opacity-50"
                              ${currentPage === totalPages ? 'disabled' : ''}
                              onclick="Views.directorGuardians.changePage(${currentPage + 1})">
                        Siguiente
                      </button>
                    </div>
                  </div>
                ` : ''}
              `}
            </div>

            <!-- Footer -->
            <footer class="text-center text-xs text-slate-400 dark:text-slate-500 pt-4 pb-8">
              &copy; 2026 NEUVOX. Todos los derechos reservados.
            </footer>
          </div>
        </main>
      </div>
    `;
  }

  function renderTableRows(paginatedGuardians) {
    return paginatedGuardians.map(guardian => {
      // Get associated students
      const associatedStudents = guardian.student_ids
        ? guardian.student_ids.map(id => students.find(s => s.id === id)).filter(Boolean)
        : [];

      // Student badges
      const studentsBadges = associatedStudents.length > 0
        ? associatedStudents.slice(0, 3).map(s => `
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium
                         bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300
                         border border-indigo-100 dark:border-indigo-800 mr-1 mb-1">
              ${Components.escapeHtml(s.full_name)}
            </span>
          `).join('') +
          (associatedStudents.length > 3 ? `<span class="text-slate-500 text-xs">+${associatedStudents.length - 3} mas</span>` : '')
        : `<span class="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium
                        bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
             Sin alumnos
           </span>`;

      // Status
      const isDeleted = guardian.status === 'DELETED';
      const statusBadge = isDeleted
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold
                        bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
             Eliminado
           </span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold
                        bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
             Activo
           </span>`;

      // Action buttons
      const actionButtons = isDeleted
        ? `
            <button onclick="Views.directorGuardians.confirmRestore(${guardian.id})"
                    class="px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400
                           bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50
                           rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-1.5">
              <span class="material-icons-round text-[18px]">restore</span>
              Restaurar
            </button>
          `
        : `
            <div class="flex items-center justify-end gap-1">
              <!-- Ver perfil -->
              <button onclick="Views.directorGuardians.viewProfile(${guardian.id})"
                      class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50
                             dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded transition-colors"
                      title="Ver perfil">
                <span class="material-icons-round text-[20px]">person</span>
              </button>

              <!-- Editar -->
              <button onclick="Views.directorGuardians.showEditForm(${guardian.id})"
                      class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50
                             dark:hover:text-blue-400 dark:hover:bg-blue-900/30 rounded transition-colors"
                      title="Editar">
                <span class="material-icons-round text-[20px]">edit</span>
              </button>

              <!-- Gestionar Alumnos -->
              <button onclick="Views.directorGuardians.manageStudents(${guardian.id})"
                      class="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50
                             dark:hover:text-purple-400 dark:hover:bg-purple-900/30 rounded transition-colors"
                      title="Gestionar Alumnos">
                <span class="material-icons-round text-[20px]">group</span>
              </button>

              <!-- Eliminar -->
              <button onclick="Views.directorGuardians.confirmDelete(${guardian.id})"
                      class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50
                             dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="Eliminar">
                <span class="material-icons-round text-[20px]">delete</span>
              </button>
            </div>
          `;

      return `
        <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${isDeleted ? 'opacity-70' : ''}">
          <td class="px-6 py-4 font-bold text-slate-900 dark:text-white">${Components.escapeHtml(guardian.full_name)}</td>
          <td class="px-6 py-4 text-slate-500 dark:text-slate-400">${Components.escapeHtml(guardian.contacts?.email || '-')}</td>
          <td class="px-6 py-4 text-slate-500 dark:text-slate-400">${Components.escapeHtml(guardian.contacts?.phone || '-')}</td>
          <td class="px-6 py-4">${studentsBadges}</td>
          <td class="px-6 py-4">${statusBadge}</td>
          <td class="px-6 py-4 text-right">${actionButtons}</td>
        </tr>
      `;
    }).join('');
  }

  // Update only table content (for search without losing focus)
  function updateTableContent() {
    const filtered = getFilteredGuardians();
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const start = (currentPage - 1) * PAGE_SIZE;
    const paginated = filtered.slice(start, start + PAGE_SIZE);

    const tbody = document.getElementById('guardians-tbody');
    if (tbody) {
      tbody.innerHTML = renderTableRows(paginated);
    } else {
      renderGuardians();
    }
  }

  // Public methods
  Views.directorGuardians.search = function(term) {
    searchTerm = term;
    currentPage = 1;
    updateTableContent();
  };

  Views.directorGuardians.filterByStatus = async function(status) {
    statusFilter = status;
    currentPage = 1;
    guardians = await State.refreshGuardians({ status: status || undefined });
    renderGuardians();
  };

  Views.directorGuardians.filterByStudent = function(student) {
    studentFilter = student;
    currentPage = 1;
    renderGuardians();
  };

  Views.directorGuardians.clearFilters = async function() {
    searchTerm = '';
    studentFilter = '';
    currentPage = 1;
    if (statusFilter) {
      statusFilter = '';
      guardians = await State.refreshGuardians();
    }
    renderGuardians();
  };

  Views.directorGuardians.changePage = function(page) {
    currentPage = page;
    renderGuardians();
  };

  Views.directorGuardians.showCreateForm = function() {
    Components.showModal('Nuevo Apoderado', `
      <form id="guardian-form">
        <div class="form-group">
          <label class="form-label">Nombre Completo *</label>
          <input type="text" id="guardian-name" class="form-input" required placeholder="Ej: Maria Gonzalez Lopez">
        </div>
        <div class="form-group">
          <label class="form-label">Email *</label>
          <input type="email" id="guardian-email" class="form-input" required placeholder="apoderado@email.com">
          <small style="color: var(--color-gray-500);">Se usara para enviar notificaciones por email</small>
        </div>
        <div class="form-group">
          <label class="form-label">Telefono WhatsApp</label>
          <input type="tel" id="guardian-phone" class="form-input" placeholder="+56 9 1234 5678">
          <small style="color: var(--color-gray-500);">Se usara para enviar notificaciones por WhatsApp</small>
        </div>
      </form>
      <div style="margin-top: 1rem; padding: 0.75rem; background: var(--color-warning-light); border-radius: 8px; font-size: 0.85rem;">
        <strong>Nota:</strong> Despues de crear el apoderado, podra asociarlo a uno o mas alumnos desde el boton "Gestionar alumnos".
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorGuardians.saveGuardian() }
    ]);
  };

  Views.directorGuardians.showEditForm = function(guardianId) {
    const guardian = State.getGuardian(guardianId);
    if (!guardian) {
      Components.showToast('Apoderado no encontrado', 'error');
      return;
    }

    Components.showModal('Editar Apoderado', `
      <form id="guardian-form">
        <div class="form-group">
          <label class="form-label">Nombre Completo *</label>
          <input type="text" id="guardian-name" class="form-input" required value="${Components.escapeHtml(guardian.full_name)}">
        </div>
        <div class="form-group">
          <label class="form-label">Email *</label>
          <input type="email" id="guardian-email" class="form-input" required value="${Components.escapeHtml(guardian.contacts?.email || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Telefono WhatsApp</label>
          <input type="tel" id="guardian-phone" class="form-input" value="${Components.escapeHtml(guardian.contacts?.phone || '')}">
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorGuardians.saveGuardian(guardianId) }
    ]);
  };

  Views.directorGuardians.saveGuardian = async function(guardianId = null) {
    const name = document.getElementById('guardian-name').value.trim();
    const email = document.getElementById('guardian-email').value.trim();
    const phone = document.getElementById('guardian-phone')?.value.trim() || '';

    // Validation
    if (!name || !email) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Components.showToast('Ingrese un email valido', 'error');
      return;
    }

    // Validate phone format (optional, if provided)
    if (phone && !/^\+?[0-9\s\-()]+$/.test(phone)) {
      Components.showToast('Formato de telefono invalido', 'error');
      return;
    }

    // Build guardian data with contacts structure
    const guardianData = {
      full_name: name,
      contacts: {
        email: email || null,
        phone: phone || null,
        whatsapp: phone || null,
      },
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

      if (guardianId) {
        await State.updateGuardian(guardianId, guardianData);
        Components.showToast('Apoderado actualizado correctamente', 'success');
      } else {
        await State.addGuardian(guardianData);
        Components.showToast('Apoderado creado correctamente', 'success');
      }

      // Close modal and refresh
      document.querySelector('.modal-container')?.click();
      guardians = State.getGuardians();
      renderGuardians();

    } catch (error) {
      Components.showToast(error.message || 'Error al guardar', 'error');
      console.error('Save guardian error:', error);

      // Re-enable button
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    }
  };

  Views.directorGuardians.viewProfile = function(guardianId) {
    const guardian = State.getGuardian(guardianId);
    if (!guardian) {
      Components.showToast('Apoderado no encontrado', 'error');
      return;
    }

    const associatedStudents = guardian.student_ids
      ? guardian.student_ids.map(id => students.find(s => s.id === id)).filter(Boolean)
      : [];

    const studentsHTML = associatedStudents.length > 0
      ? associatedStudents.map(s => {
          const course = State.getCourse(s.course_id);
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--color-gray-50); border-radius: 4px; margin-bottom: 0.5rem;">
              <div>
                <strong>${Components.escapeHtml(s.full_name)}</strong>
                <span style="color: var(--color-gray-500); font-size: 0.85rem;"> - ${course ? Components.escapeHtml(course.name) : 'Sin curso'}</span>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="Router.navigate('/director/students?viewProfile=${s.id}')">Ver</button>
            </div>
          `;
        }).join('')
      : '<p style="color: var(--color-gray-500);">No hay alumnos asociados</p>';

    Components.showModal(`Perfil: ${guardian.full_name}`, `
      <div class="card" style="margin-bottom: 1rem;">
        <div class="card-header">Informacion de Contacto</div>
        <div class="card-body">
          <p><strong>Email:</strong> ${Components.escapeHtml(guardian.contacts?.email || 'No registrado')}</p>
          <p><strong>Telefono:</strong> ${Components.escapeHtml(guardian.contacts?.phone || 'No registrado')}</p>
          <p><strong>ID Sistema:</strong> ${guardian.id}</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Alumnos Asociados (${associatedStudents.length})</div>
        <div class="card-body">
          ${studentsHTML}
        </div>
      </div>
    `, [
      { label: 'Editar', action: 'edit', className: 'btn-secondary', onClick: () => { document.querySelector('.modal-container').click(); Views.directorGuardians.showEditForm(guardianId); } },
      { label: 'Cerrar', action: 'close', className: 'btn-primary' }
    ]);
  };

  Views.directorGuardians.manageStudents = function(guardianId) {
    const guardian = State.getGuardian(guardianId);
    if (!guardian) {
      Components.showToast('Apoderado no encontrado', 'error');
      return;
    }

    const currentStudentIds = guardian.student_ids || [];

    const studentsCheckboxes = students.map(s => {
      const isAssociated = currentStudentIds.includes(s.id);
      const course = State.getCourse(s.course_id);
      return `
        <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border-bottom: 1px solid var(--color-gray-100); cursor: pointer;">
          <input type="checkbox" class="student-checkbox" data-student-id="${s.id}" ${isAssociated ? 'checked' : ''}>
          <span>${Components.escapeHtml(s.full_name)}</span>
          <span style="color: var(--color-gray-500); font-size: 0.85rem;">${course ? Components.escapeHtml(course.name) : ''}</span>
        </label>
      `;
    }).join('');

    Components.showModal(`Gestionar Alumnos de ${guardian.full_name}`, `
      <div style="margin-bottom: 1rem;">
        <p style="color: var(--color-gray-600); font-size: 0.9rem;">
          Seleccione los alumnos que desea asociar a este apoderado. El apoderado recibira notificaciones de asistencia de los alumnos seleccionados.
        </p>
      </div>

      <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--color-gray-200); border-radius: 8px;">
        ${students.length > 0 ? studentsCheckboxes : '<p style="padding: 1rem; color: var(--color-gray-500);">No hay alumnos registrados</p>'}
      </div>

      <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
        <button class="btn btn-secondary btn-sm" onclick="document.querySelectorAll('.student-checkbox').forEach(c => c.checked = true)">Seleccionar todos</button>
        <button class="btn btn-secondary btn-sm" onclick="document.querySelectorAll('.student-checkbox').forEach(c => c.checked = false)">Deseleccionar todos</button>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorGuardians.saveStudentAssociations(guardianId) }
    ]);
  };

  Views.directorGuardians.saveStudentAssociations = async function(guardianId) {
    const checkboxes = document.querySelectorAll('.student-checkbox');
    const selectedStudentIds = [];

    checkboxes.forEach(cb => {
      if (cb.checked) {
        selectedStudentIds.push(parseInt(cb.dataset.studentId));
      }
    });

    // Get save button for loading state
    const saveBtn = document.querySelector('.modal .btn-primary');
    const originalText = saveBtn ? saveBtn.textContent : 'Guardar';

    try {
      // Disable button and show loading
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';
      }

      await State.setGuardianStudents(guardianId, selectedStudentIds);
      Components.showToast('Alumnos asociados correctamente', 'success');

      // Close modal and refresh
      document.querySelector('.modal-container')?.click();
      guardians = State.getGuardians();
      renderGuardians();

    } catch (error) {
      Components.showToast(error.message || 'Error al asociar alumnos', 'error');
      console.error('Save student associations error:', error);

      // Re-enable button
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    }
  };

  Views.directorGuardians.confirmDelete = function(guardianId) {
    const guardian = State.getGuardian(guardianId);
    if (!guardian) {
      Components.showToast('Apoderado no encontrado', 'error');
      return;
    }

    const studentCount = guardian.student_ids ? guardian.student_ids.length : 0;
    const warningMsg = studentCount > 0
      ? `<p style="color: var(--color-warning); margin-top: 0.5rem;"><strong>Advertencia:</strong> Este apoderado tiene ${studentCount} alumno${studentCount !== 1 ? 's' : ''} asociado${studentCount !== 1 ? 's' : ''}. Al eliminarlo, los alumnos quedaran sin este apoderado.</p>`
      : '';

    Components.showModal('Confirmar Eliminacion', `
      <p>Esta seguro que desea eliminar al apoderado <strong>${Components.escapeHtml(guardian.full_name)}</strong>?</p>
      ${warningMsg}
      <p style="color: var(--color-gray-500); margin-top: 0.5rem; font-size: 0.9rem;">Esta accion no se puede deshacer.</p>
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

          await State.deleteGuardian(guardianId);
          Components.showToast('Apoderado eliminado', 'success');

          // Close modal and refresh
          document.querySelector('.modal-container')?.click();
          guardians = State.getGuardians();
          renderGuardians();

        } catch (error) {
          Components.showToast(error.message || 'Error al eliminar', 'error');
          console.error('Delete guardian error:', error);

          // Re-enable button
          if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = originalText;
          }
        }
      }}
    ]);
  };

  Views.directorGuardians.confirmRestore = function(guardianId) {
    const guardian = State.getGuardian(guardianId);
    if (!guardian) {
      Components.showToast('Apoderado no encontrado', 'error');
      return;
    }

    Components.showModal('Confirmar Restauracion', `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">
          <span class="material-icons-round" style="font-size: 48px; color: var(--color-success);">restore</span>
        </div>
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">Restaurar este apoderado?</p>
        <p style="font-weight: 600; color: var(--color-success);">${Components.escapeHtml(guardian.full_name)}</p>
        <p style="font-size: 0.9rem; color: var(--color-gray-500); margin-top: 1rem;">
          El apoderado volvera a estar activo en el sistema.
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

          await State.restoreGuardian(guardianId);
          Components.showToast('Apoderado restaurado', 'success');

          document.querySelector('.modal-container')?.click();
          guardians = await State.refreshGuardians({ status: statusFilter || undefined });
          renderGuardians();

        } catch (error) {
          Components.showToast(error.message || 'Error al restaurar', 'error');
          console.error('Restore guardian error:', error);

          if (restoreBtn) {
            restoreBtn.disabled = false;
            restoreBtn.textContent = originalText;
          }
        }
      }}
    ]);
  };

  Views.directorGuardians.exportCSV = async function() {
    try {
      const blob = await State.exportGuardiansCSV({ status: statusFilter || undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `apoderados_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Components.showToast('Exportacion completada', 'success');
    } catch (error) {
      Components.showToast(error.message || 'Error al exportar', 'error');
      console.error('Export guardians error:', error);
    }
  };

  // Initial render
  renderGuardians();
};
