// Director Biometric Management
// Allows directors and inspectors to enroll and manage student biometric credentials
Views.directorBiometric = function() {
  const app = document.getElementById('app');

  const courses = State.getCourses();
  let filteredStudents = State.getStudents();
  let searchTerm = '';
  let selectedCourse = '';
  let selectedStudent = null;
  let studentCredentials = [];

  // Get user info
  const user = State.getCurrentUser();
  const userName = user?.full_name || user?.email?.split('@')[0] || 'Director';
  const userInitial = userName.charAt(0).toUpperCase();
  const isDark = document.documentElement.classList.contains('dark');

  // Current path for active state
  const currentPath = '/director/biometric';

  // Navigation items for sidebar
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
    { path: '/director/biometric', icon: 'fingerprint', label: 'Biometría' }
  ];

  // Helper: check if nav item is active
  const isActive = (path) => currentPath === path;

  const navItemClass = (path) => isActive(path)
    ? 'flex items-center px-6 py-3 bg-indigo-800/50 text-white border-l-4 border-indigo-500 group transition-colors'
    : 'flex items-center px-6 py-3 hover:bg-white/5 hover:text-white group transition-colors border-l-4 border-transparent';

  const iconClass = (path) => isActive(path)
    ? 'material-icons-round mr-3'
    : 'material-icons-round mr-3 text-gray-400 group-hover:text-white transition-colors';

  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) {
      sidebar.classList.toggle('mobile-hidden');
    }
    if (backdrop) {
      backdrop.classList.toggle('hidden');
    }
  }

  function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    const isDarkNow = document.documentElement.classList.contains('dark');
    localStorage.setItem('darkMode', isDarkNow);
  }

  async function renderMain() {
    app.innerHTML = `
      <div class="h-screen flex overflow-hidden bg-background-light dark:bg-background-dark">
        <!-- Sidebar (único, con mobile-hidden) -->
        <aside id="sidebar" class="w-64 bg-sidebar-dark text-gray-300 flex-shrink-0 flex-col transition-all duration-300 mobile-hidden border-r border-indigo-900/50 shadow-2xl z-50">
          <div class="h-20 flex items-center justify-between px-6 border-b border-indigo-900/50">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg">
                <div class="w-4 h-4 bg-indigo-900 rounded-full"></div>
              </div>
              <h1 class="text-xl font-bold tracking-tight text-white">NEUVOX</h1>
            </div>
            <button class="desktop-hidden text-gray-400 hover:text-white p-1" onclick="Views.directorBiometric.toggleSidebar()">
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

        <!-- Backdrop para móvil -->
        <div id="sidebar-backdrop" class="fixed inset-0 bg-black/50 z-40 hidden desktop-hidden" onclick="Views.directorBiometric.toggleSidebar()"></div>

        <!-- Main Content -->
        <main class="flex-1 flex flex-col overflow-hidden">
          <!-- Header -->
          <header class="h-20 bg-white dark:bg-card-dark border-b border-border-light dark:border-border-dark flex items-center justify-between px-8 z-10 shadow-sm">
            <div class="flex items-center gap-4">
              <button class="desktop-hidden text-muted-light dark:text-muted-dark hover:text-primary transition-colors"
                      onclick="Views.directorBiometric.toggleSidebar()">
                <span class="material-icons-round text-2xl">menu</span>
              </button>
              <h2 class="text-xl font-bold text-gray-800 dark:text-text-dark">Gestión Biométrica</h2>
            </div>
            <div class="flex items-center gap-2 md:gap-4 flex-1 justify-end">
              <button class="p-2 rounded-full hover:bg-background-light dark:hover:bg-white/5 transition-colors text-muted-light dark:text-muted-dark"
                      onclick="Views.directorBiometric.toggleDarkMode()">
                <span class="material-icons-round">${isDark ? 'light_mode' : 'dark_mode'}</span>
              </button>
              <div class="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1 md:mx-2 mobile-hidden"></div>
              <div class="flex items-center gap-2 md:gap-3">
                <div class="w-9 h-9 rounded-full border border-gray-200 bg-indigo-600 flex items-center justify-center text-white font-semibold">
                  ${userInitial}
                </div>
                <div class="text-right mobile-hidden">
                  <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">${Components.escapeHtml(userName)}</p>
                </div>
                <a class="ml-1 md:ml-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 border px-2 md:px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 dark:border-gray-600"
                   href="#" onclick="event.preventDefault(); State.logout();">
                  <span class="material-icons-round text-lg">logout</span>
                  <span class="mobile-hidden">Salir</span>
                </a>
              </div>
            </div>
          </header>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
            <!-- Info Banner -->
            <div class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-6 rounded-xl flex items-center gap-4 shadow-sm">
              <div class="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl shadow-sm flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <span class="material-icons-round text-3xl">pan_tool</span>
              </div>
              <div>
                <h3 class="text-sm font-bold text-indigo-900 dark:text-indigo-300">Registro de Huellas Digitales</h3>
                <p class="text-sm text-indigo-700 dark:text-indigo-400">Registre las huellas digitales de los estudiantes para permitir la autenticación biométrica en los kioscos de asistencia.</p>
              </div>
            </div>

            <!-- Main Grid -->
            <div class="grid grid-cols-12 gap-6 items-start">
              <!-- Left Panel: Student Selection -->
              <div class="col-span-12 lg:col-span-4 space-y-4">
                <div class="bg-white dark:bg-card-dark rounded-xl p-6 shadow-sm border border-gray-100 dark:border-border-dark">
                  <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight mb-4">Seleccionar Alumno</h4>

                  <!-- Filters -->
                  <div class="space-y-3">
                    <input type="text" id="search-student"
                           class="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                                  focus:ring-indigo-500 focus:border-indigo-500 text-sm
                                  bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
                           placeholder="Buscar por nombre..."
                           value="${searchTerm}"
                           oninput="Views.directorBiometric.debouncedFilterStudents()">

                    <select id="filter-course"
                            class="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                                   focus:ring-indigo-500 focus:border-indigo-500 text-sm
                                   bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
                            onchange="Views.directorBiometric.filterStudents()">
                      <option value="">Todos los cursos</option>
                      ${courses.map(c => `<option value="${c.id}" ${selectedCourse === String(c.id) ? 'selected' : ''}>${Components.escapeHtml(c.name)}</option>`).join('')}
                    </select>
                  </div>

                  <!-- Student List -->
                  <div class="mt-6 space-y-1 h-[400px] overflow-y-auto custom-scrollbar pr-2" id="student-list">
                    ${renderStudentList()}
                  </div>
                </div>
              </div>

              <!-- Right Panel: Enrollment Area -->
              <div class="col-span-12 lg:col-span-8">
                <div class="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-gray-100 dark:border-border-dark overflow-hidden">
                  <!-- Header -->
                  <div class="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
                    <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">Registro Biométrico</h4>
                  </div>

                  <!-- Content -->
                  <div class="p-8" id="enrollment-area">
                    ${renderEnrollmentArea()}
                  </div>

                  <!-- Footer Info -->
                  <div class="px-8 py-4 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-700">
                    <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span class="material-icons-round text-sm">info</span>
                      <span>El dispositivo biométrico debe estar conectado y sincronizado para realizar nuevos registros.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <footer class="text-center text-[10px] text-gray-400 dark:text-gray-500 py-8">
              © 2026 NEUVOX. Todos los derechos reservados.
            </footer>
          </div>
        </main>
      </div>
    `;

    addStyles();
  }

  function renderStudentList() {
    if (filteredStudents.length === 0) {
      return `
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          <span class="material-icons-round text-4xl text-gray-300 dark:text-gray-600 mb-2">search_off</span>
          <p class="text-sm">No hay alumnos que coincidan con la búsqueda</p>
        </div>
      `;
    }

    return filteredStudents.map(student => {
      const course = State.getCourse(student.course_id);
      const isSelected = selectedStudent && selectedStudent.id === student.id;
      const hasBiometric = student.has_biometric || false;

      if (isSelected) {
        // Selected student (indigo background)
        return `
          <div class="flex items-center justify-between p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 cursor-pointer"
               onclick="Views.directorBiometric.selectStudent(${student.id})">
            <div class="flex flex-col">
              <span class="text-sm font-bold text-indigo-900 dark:text-indigo-300">${Components.escapeHtml(student.full_name)}</span>
              <span class="text-xs text-indigo-600 dark:text-indigo-400">${course ? Components.escapeHtml(course.name) : '-'}</span>
            </div>
            ${hasBiometric
              ? `<span class="material-icons-round text-indigo-500 dark:text-indigo-400 text-lg">fingerprint</span>`
              : `<div class="w-2 h-2 rounded-full bg-indigo-200 dark:bg-indigo-600"></div>`
            }
          </div>
        `;
      } else if (hasBiometric) {
        // Not selected, has biometric (emerald fingerprint icon)
        return `
          <div class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer transition-colors border border-transparent"
               onclick="Views.directorBiometric.selectStudent(${student.id})">
            <div class="flex flex-col">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${Components.escapeHtml(student.full_name)}</span>
              <span class="text-xs text-gray-400 dark:text-gray-500">${course ? Components.escapeHtml(course.name) : '-'}</span>
            </div>
            <span class="material-icons-round text-emerald-500 dark:text-emerald-400 text-lg">fingerprint</span>
          </div>
        `;
      } else {
        // Not selected, no biometric (gray dot)
        return `
          <div class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer transition-colors border border-transparent"
               onclick="Views.directorBiometric.selectStudent(${student.id})">
            <div class="flex flex-col">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${Components.escapeHtml(student.full_name)}</span>
              <span class="text-xs text-gray-400 dark:text-gray-500">${course ? Components.escapeHtml(course.name) : '-'}</span>
            </div>
            <div class="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-600"></div>
          </div>
        `;
      }
    }).join('');
  }

  function renderEnrollmentArea() {
    if (!selectedStudent) {
      return `
        <div class="text-center py-16">
          <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
            <span class="material-icons-round text-4xl text-gray-300 dark:text-gray-600">touch_app</span>
          </div>
          <p class="text-gray-500 dark:text-gray-400">Seleccione un alumno de la lista para gestionar su registro biométrico</p>
        </div>
      `;
    }

    const course = State.getCourse(selectedStudent.course_id);
    const hasBiometric = selectedStudent.has_biometric || false;

    return `
      <!-- Student Info -->
      <div class="flex items-center gap-6 mb-8 bg-gray-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-gray-100 dark:border-slate-700">
        <!-- Avatar -->
        <div class="w-20 h-20 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center border border-gray-200 dark:border-slate-600 shadow-sm overflow-hidden">
          ${selectedStudent.photo_ref
            ? `<img src="${selectedStudent.photo_ref}" alt="Foto" class="w-full h-full object-cover">`
            : `<span class="material-icons-round text-4xl text-gray-300 dark:text-gray-500">person</span>`
          }
        </div>

        <!-- Data -->
        <div>
          <h3 class="text-2xl font-bold text-gray-800 dark:text-white">${Components.escapeHtml(selectedStudent.full_name)}</h3>
          <div class="flex items-center gap-2 mt-1">
            <span class="px-2.5 py-1 rounded-md bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-xs font-semibold text-gray-600 dark:text-gray-300">${course ? Components.escapeHtml(course.name) : '-'}</span>
            ${selectedStudent.national_id ? `<span class="text-xs text-gray-400 dark:text-gray-500">ID: ${Components.escapeHtml(selectedStudent.national_id)}</span>` : ''}
          </div>
        </div>
      </div>

      <!-- Status Card -->
      ${hasBiometric ? `
        <div class="mb-8 p-5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl flex items-center gap-4">
          <div class="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white">
            <span class="material-icons-round">check_circle</span>
          </div>
          <div>
            <p class="text-emerald-900 dark:text-emerald-300 font-bold">Biometría Registrada</p>
            <p class="text-emerald-700 dark:text-emerald-400 text-sm">${studentCredentials.length} credencial(es) registrada(s) actualmente.</p>
          </div>
        </div>
      ` : `
        <div class="mb-8 p-5 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-xl flex items-center gap-4">
          <div class="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white">
            <span class="material-icons-round">pending</span>
          </div>
          <div>
            <p class="text-orange-900 dark:text-orange-300 font-bold">Sin Registro Biométrico</p>
            <p class="text-orange-700 dark:text-orange-400 text-sm">El alumno no tiene huellas digitales registradas.</p>
          </div>
        </div>
      `}

      <!-- Action Buttons -->
      <div class="flex flex-wrap gap-4">
        <!-- Primary Button (Gradient) -->
        <button class="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-opacity"
                id="start-enroll-btn"
                onclick="Views.directorBiometric.startEnrollment()">
          <span class="material-icons-round">fingerprint</span>
          ${hasBiometric ? 'Agregar Nueva Huella' : 'Registrar Huella Digital'}
        </button>

        ${hasBiometric ? `
          <!-- View Credentials Button -->
          <button class="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  onclick="Views.directorBiometric.viewCredentials()">
            <span class="material-icons-round">badge</span>
            Ver Credenciales (${studentCredentials.length})
          </button>

          <!-- Delete All Button -->
          <button class="flex items-center gap-2 px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors ml-auto border border-red-100 dark:border-red-800"
                  onclick="Views.directorBiometric.confirmDeleteAll()">
            <span class="material-icons-round">delete_forever</span>
            Eliminar Todas
          </button>
        ` : ''}
      </div>

      <!-- Enrollment Guide (hidden by default) -->
      <div id="enrollment-guide" class="hidden mt-8 text-center p-8 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-slate-700">
        <!-- Visual Sensor -->
        <div class="mb-6">
          <div id="fingerprint-sensor" class="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/50 dark:to-indigo-800/50 flex items-center justify-center relative">
            <span class="material-icons-round text-5xl text-indigo-600 dark:text-indigo-400 z-10">fingerprint</span>
            <div class="fingerprint-pulse absolute inset-0 rounded-full border-4 border-indigo-400/50"></div>
          </div>
        </div>

        <p id="guide-text" class="text-lg text-gray-600 dark:text-gray-400 mb-6">Coloque el dedo del alumno en el lector...</p>

        <button class="px-6 py-3 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                onclick="Views.directorBiometric.cancelEnrollment()">
          Cancelar
        </button>
      </div>
    `;
  }

  // R12-P7 fix: Add debounce for search input
  let filterTimeout = null;
  Views.directorBiometric.debouncedFilterStudents = function() {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
      Views.directorBiometric.filterStudents();
    }, 200);
  };

  Views.directorBiometric.filterStudents = function() {
    searchTerm = document.getElementById('search-student').value.toLowerCase();
    selectedCourse = document.getElementById('filter-course').value;

    filteredStudents = State.getStudents().filter(student => {
      if (searchTerm && !student.full_name.toLowerCase().includes(searchTerm)) {
        return false;
      }
      if (selectedCourse && student.course_id !== parseInt(selectedCourse)) {
        return false;
      }
      return true;
    });

    const listEl = document.getElementById('student-list');
    if (listEl) {
      listEl.innerHTML = renderStudentList();
    }
  };

  Views.directorBiometric.selectStudent = async function(studentId) {
    selectedStudent = State.getStudent(studentId);

    // Fetch credentials from API
    try {
      const response = await API.request(`/webauthn/admin/students/${studentId}/credentials`);
      if (response.ok) {
        const data = await response.json();
        studentCredentials = data.credentials || [];
        selectedStudent.has_biometric = studentCredentials.length > 0;
      } else {
        studentCredentials = [];
      }
    } catch (err) {
      console.error('Error fetching credentials:', err);
      studentCredentials = [];
    }

    // Re-render list to show selection
    const listEl = document.getElementById('student-list');
    if (listEl) {
      listEl.innerHTML = renderStudentList();
    }

    // Re-render enrollment area
    const enrollmentArea = document.getElementById('enrollment-area');
    if (enrollmentArea) {
      enrollmentArea.innerHTML = renderEnrollmentArea();
    }
  };

  Views.directorBiometric.startEnrollment = async function() {
    if (!selectedStudent) return;

    const btn = document.getElementById('start-enroll-btn');
    const guide = document.getElementById('enrollment-guide');

    if (btn) btn.style.display = 'none';
    if (guide) guide.classList.remove('hidden');

    updateEnrollState('waiting', 'Iniciando registro...');

    try {
      // Start enrollment via API
      const startResponse = await API.request(`/webauthn/admin/students/${selectedStudent.id}/register/start`, {
        method: 'POST',
        body: JSON.stringify({ device_name: 'Web Admin' }),
      });

      if (!startResponse.ok) {
        const error = await startResponse.json().catch(() => ({}));
        throw new Error(error.detail || 'Error al iniciar registro');
      }

      const { challenge_id, options } = await startResponse.json();

      updateEnrollState('waiting', 'Coloque el dedo del alumno en el lector biométrico...');

      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        throw new Error('Este navegador no soporta WebAuthn');
      }

      // Parse options and create credential
      const credential = await createCredential(options);

      if (!credential) {
        throw new Error('El usuario canceló el registro');
      }

      updateEnrollState('reading', 'Verificando huella...');

      // Complete enrollment
      const completeResponse = await API.request(`/webauthn/admin/students/${selectedStudent.id}/register/complete`, {
        method: 'POST',
        body: JSON.stringify({
          challenge_id: challenge_id,
          credential: credential,
        }),
      });

      if (!completeResponse.ok) {
        const error = await completeResponse.json().catch(() => ({}));
        throw new Error(error.detail || 'Error al completar registro');
      }

      updateEnrollState('success', '¡Huella registrada correctamente!');
      Components.showToast('Huella digital registrada exitosamente', 'success');

      // Refresh display
      setTimeout(() => {
        Views.directorBiometric.selectStudent(selectedStudent.id);
      }, 1500);

    } catch (err) {
      console.error('Enrollment error:', err);
      updateEnrollState('error', err.message);
      Components.showToast(err.message, 'error');

      // TDD-R8-BUG2 fix: Re-query DOM elements inside setTimeout to avoid stale references
      setTimeout(() => {
        const freshBtn = document.getElementById('start-enroll-btn');
        const freshGuide = document.getElementById('enrollment-guide');
        if (freshBtn) freshBtn.style.display = 'flex';
        if (freshGuide) freshGuide.classList.add('hidden');
      }, 2000);
    }
  };

  Views.directorBiometric.cancelEnrollment = function() {
    const btn = document.getElementById('start-enroll-btn');
    const guide = document.getElementById('enrollment-guide');

    if (btn) btn.style.display = 'flex';
    if (guide) guide.classList.add('hidden');
  };

  Views.directorBiometric.viewCredentials = function() {
    if (!selectedStudent || studentCredentials.length === 0) return;

    // R10-W2 fix: Use data-* attributes to prevent XSS via credential_id
    const credentialsHTML = studentCredentials.map(cred => `
      <tr class="border-b border-gray-100 dark:border-slate-700">
        <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">${Components.escapeHtml(cred.device_name || 'Sin nombre')}</td>
        <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">${Components.formatDate(cred.created_at)}</td>
        <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">${cred.last_used_at ? Components.formatDate(cred.last_used_at) : 'Nunca'}</td>
        <td class="px-4 py-3">
          <button class="delete-credential-btn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" data-credential-id="${Components.escapeHtml(cred.credential_id)}">
            <span class="material-icons-round text-lg">delete</span>
          </button>
        </td>
      </tr>
    `).join('');

    Components.showModal('Credenciales Biométricas', `
      <p class="mb-4 text-gray-600 dark:text-gray-400">Credenciales registradas para <strong class="text-gray-800 dark:text-white">${Components.escapeHtml(selectedStudent.full_name)}</strong>:</p>
      <div id="credentials-table-container" class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
              <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Dispositivo</th>
              <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Registrado</th>
              <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Último Uso</th>
              <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${credentialsHTML}
          </tbody>
        </table>
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);

    // R12-P6 fix: Use event delegation instead of per-button listeners
    setTimeout(() => {
      const container = document.getElementById('credentials-table-container');
      if (container) {
        container.addEventListener('click', function(e) {
          const btn = e.target.closest('.delete-credential-btn');
          if (btn) {
            const credId = btn.dataset.credentialId;
            Views.directorBiometric.deleteCredential(credId);
          }
        });
      }
    }, 0);
  };

  Views.directorBiometric.deleteCredential = async function(credentialId) {
    if (!selectedStudent) return;

    try {
      const response = await API.request(
        `/webauthn/admin/students/${selectedStudent.id}/credentials/${encodeURIComponent(credentialId)}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        Components.showToast('Credencial eliminada', 'success');
        document.querySelector('.modal-container')?.click();
        Views.directorBiometric.selectStudent(selectedStudent.id);
      } else {
        throw new Error('Error al eliminar credencial');
      }
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  };

  Views.directorBiometric.confirmDeleteAll = function() {
    if (!selectedStudent) return;

    Components.showModal('Confirmar Eliminación', `
      <div class="text-center py-4">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <span class="material-icons-round text-3xl text-red-500">warning</span>
        </div>
        <p class="text-lg mb-2 text-gray-700 dark:text-gray-300">¿Eliminar todas las huellas de?</p>
        <p class="font-bold text-red-600 dark:text-red-400">${Components.escapeHtml(selectedStudent.full_name)}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-4">
          El alumno deberá registrar sus huellas nuevamente para usar autenticación biométrica.
        </p>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Eliminar Todas', action: 'delete', className: 'btn-error', onClick: async () => {
        try {
          // Delete all credentials one by one
          for (const cred of studentCredentials) {
            await API.request(
              `/webauthn/admin/students/${selectedStudent.id}/credentials/${encodeURIComponent(cred.credential_id)}`,
              { method: 'DELETE' }
            );
          }
          document.querySelector('.modal-container')?.click();
          Components.showToast('Todas las credenciales eliminadas', 'success');
          Views.directorBiometric.selectStudent(selectedStudent.id);
        } catch {
          Components.showToast('Error al eliminar credenciales', 'error');
        }
      }}
    ]);
  };

  function updateEnrollState(state, message) {
    const sensor = document.getElementById('fingerprint-sensor');
    const guideText = document.getElementById('guide-text');

    if (sensor) {
      // Reset classes
      sensor.className = 'w-32 h-32 mx-auto rounded-full flex items-center justify-center relative';

      // Apply state-specific gradient
      switch (state) {
        case 'waiting':
          sensor.classList.add('bg-gradient-to-br', 'from-amber-100', 'to-amber-200', 'dark:from-amber-900/50', 'dark:to-amber-800/50');
          break;
        case 'reading':
          sensor.classList.add('bg-gradient-to-br', 'from-blue-100', 'to-blue-200', 'dark:from-blue-900/50', 'dark:to-blue-800/50');
          break;
        case 'success':
          sensor.classList.add('bg-gradient-to-br', 'from-emerald-100', 'to-emerald-200', 'dark:from-emerald-900/50', 'dark:to-emerald-800/50');
          break;
        case 'error':
          sensor.classList.add('bg-gradient-to-br', 'from-red-100', 'to-red-200', 'dark:from-red-900/50', 'dark:to-red-800/50');
          break;
        default:
          sensor.classList.add('bg-gradient-to-br', 'from-indigo-100', 'to-indigo-200', 'dark:from-indigo-900/50', 'dark:to-indigo-800/50');
      }

      sensor.classList.add(`sensor-${state}`);
    }

    if (guideText) {
      guideText.textContent = message;
    }
  }

  // WebAuthn helpers - DO NOT MODIFY
  async function createCredential(options) {
    const publicKeyCredentialCreationOptions = parseCreationOptions(options);

    try {
      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      });
      return credentialToJSON(credential);
    } catch (err) {
      console.error('Error creating credential:', err);
      throw err;
    }
  }

  function parseCreationOptions(options) {
    const parsed = { ...options };

    if (parsed.challenge) {
      parsed.challenge = base64urlToBuffer(parsed.challenge);
    }
    if (parsed.user && parsed.user.id) {
      parsed.user.id = base64urlToBuffer(parsed.user.id);
    }
    if (parsed.excludeCredentials) {
      parsed.excludeCredentials = parsed.excludeCredentials.map(cred => ({
        ...cred,
        id: base64urlToBuffer(cred.id)
      }));
    }

    return parsed;
  }

  function credentialToJSON(credential) {
    return {
      id: credential.id,
      rawId: bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
        attestationObject: bufferToBase64url(credential.response.attestationObject),
        transports: credential.response.getTransports ? credential.response.getTransports() : []
      }
    };
  }

  function base64urlToBuffer(base64url) {
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    if (padding) base64 += '='.repeat(4 - padding);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function addStyles() {
    if (document.getElementById('biometric-styles')) return;

    const style = document.createElement('style');
    style.id = 'biometric-styles';
    style.textContent = `
      /* Custom scrollbar */
      .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #e5e7eb;
        border-radius: 10px;
      }
      .dark .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #475569;
      }

      /* Fingerprint pulse animation */
      @keyframes fp-pulse {
        0% { transform: scale(1); opacity: 1; }
        100% { transform: scale(1.4); opacity: 0; }
      }

      .fingerprint-pulse {
        animation: fp-pulse 2s ease-out infinite;
      }

      .sensor-reading .fingerprint-pulse {
        animation-duration: 0.5s;
      }

      .sensor-success .fingerprint-pulse,
      .sensor-error .fingerprint-pulse {
        animation: none;
      }
    `;
    document.head.appendChild(style);
  }

  // Expose toggle functions
  Views.directorBiometric.toggleSidebar = toggleSidebar;
  Views.directorBiometric.toggleDarkMode = toggleDarkMode;

  renderMain();
};
