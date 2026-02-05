// Director Schedule Exceptions - NEUVOX Design
// Uses centralized Components.directorSidebar()
// Redesigned with Tailwind CSS following approved design

Views.directorExceptions = function() {
  const app = document.getElementById('app');

  // Get data from State
  const courses = State.getCourses();
  const user = State.getCurrentUser();
  const userName = user?.full_name || 'Director General';
  const currentPath = '/director/exceptions';

  // Pagination state
  let currentPage = 1;
  const exceptionsPerPage = 10;

  // Render main layout
  app.innerHTML = `
    <div class="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-900">
      ${Components.directorSidebar(currentPath)}

      <!-- Main Content -->
      <main class="flex-1 flex flex-col overflow-hidden relative">
        <!-- Header -->
        <header class="h-20 bg-white dark:bg-card-dark border-b border-border-light dark:border-border-dark flex items-center justify-between px-8 z-10 shadow-sm">
          <div class="flex items-center gap-4">
            <button class="desktop-hidden text-muted-light dark:text-muted-dark hover:text-primary transition-colors" onclick="Components.toggleDirectorSidebar()">
              <span class="material-icons-round text-2xl">menu</span>
            </button>
            <h2 class="text-xl font-bold text-gray-800 dark:text-text-dark">Excepciones de Calendario</h2>
          </div>
          <div class="flex items-center gap-2 md:gap-4 flex-1 justify-end">
            <div class="flex items-center gap-2 md:gap-3">
              <div id="notification-bell-placeholder"></div>
              <button class="p-2 rounded-full hover:bg-background-light dark:hover:bg-white/5 transition-colors text-muted-light dark:text-muted-dark" onclick="Views.directorExceptions.toggleDarkMode()">
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
        <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f8fafc] dark:bg-slate-900">
          <div id="exceptions-content" class="space-y-6">
            <!-- Content rendered by renderExceptions() -->
          </div>

          <!-- Footer -->
          <footer class="text-center text-[10px] text-slate-400 pt-8 pb-4 uppercase tracking-widest font-bold">
            &copy; 2026 NEUVOX. Todos los derechos reservados.
          </footer>
        </div>
      </main>
    </div>
  `;

  // Update dark mode icon on load
  updateDarkModeIcon();

  function renderExceptions() {
    const exceptions = State.getScheduleExceptions();
    const content = document.getElementById('exceptions-content');

    // Pagination
    const totalPages = Math.ceil(exceptions.length / exceptionsPerPage);
    const startIndex = (currentPage - 1) * exceptionsPerPage;
    const endIndex = startIndex + exceptionsPerPage;
    const paginatedExceptions = exceptions.slice(startIndex, endIndex);

    content.innerHTML = `
      <!-- Header with Button -->
      <div class="flex items-center justify-between mb-6">
        <div></div>
        <button onclick="Views.directorExceptions.showCreateForm()"
                class="bg-gradient-to-r from-indigo-600 to-cyan-500 text-white px-6 py-2.5 rounded-lg
                       font-semibold text-sm shadow-lg shadow-indigo-200 dark:shadow-none
                       flex items-center gap-2 hover:opacity-90 transition-opacity">
          <span class="material-icons-round text-lg">add</span>
          Nueva Excepción
        </button>
      </div>

      <!-- Table Card -->
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 overflow-hidden">
        <!-- Table Header -->
        <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-700">
          <h3 class="text-lg font-bold text-slate-800 dark:text-white">Excepciones Registradas</h3>
        </div>

        ${exceptions.length === 0 ? `
          <!-- Empty State -->
          <div class="px-6 py-16 text-center">
            <span class="material-icons-round text-6xl text-slate-300 dark:text-slate-600 mb-4">event_busy</span>
            <p class="text-slate-500 dark:text-slate-400 font-medium">No hay excepciones de horario registradas</p>
            <p class="text-slate-400 dark:text-slate-500 text-sm mt-1">Crea una nueva excepción para modificar los horarios de ingreso o salida</p>
          </div>
        ` : `
          <!-- Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50/50 dark:bg-white/5">
                  <th class="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fecha</th>
                  <th class="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Alcance</th>
                  <th class="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Curso</th>
                  <th class="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Horario</th>
                  <th class="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Motivo</th>
                  <th class="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
                ${paginatedExceptions.map(exc => {
                  const course = exc.course_id ? State.getCourse(exc.course_id) : null;
                  const isGlobal = exc.scope === 'GLOBAL';
                  const timeDisplay = (exc.in_time || exc.out_time)
                    ? `${exc.in_time || '-'} a ${exc.out_time || '-'}`
                    : '- a -';

                  return `
                    <tr class="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                      <td class="px-6 py-5 text-sm text-slate-700 dark:text-slate-300 font-medium">
                        ${Components.formatDate(exc.date)}
                      </td>
                      <td class="px-6 py-5">
                        ${isGlobal ? `
                          <span class="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full border border-indigo-100
                                       dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800">
                            Global
                          </span>
                        ` : `
                          <span class="px-3 py-1 bg-orange-50 text-orange-600 text-xs font-bold rounded-full border border-orange-100
                                       dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800">
                            Curso
                          </span>
                        `}
                      </td>
                      <td class="px-6 py-5 text-sm ${course ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-400 dark:text-slate-500'}">
                        ${course ? course.name : '-'}
                      </td>
                      <td class="px-6 py-5 text-sm text-slate-600 dark:text-slate-400 font-medium">
                        ${timeDisplay}
                      </td>
                      <td class="px-6 py-5 text-sm text-slate-600 dark:text-slate-400 font-medium max-w-xs truncate">
                        ${Components.escapeHtml(exc.reason)}
                      </td>
                      <td class="px-6 py-5 text-right">
                        <button onclick="Views.directorExceptions.deleteException(${exc.id})"
                                class="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400
                                       transition-colors flex items-center gap-1 ml-auto">
                          <span class="material-icons-round text-lg">delete</span>
                          <span class="text-xs font-semibold uppercase">Eliminar</span>
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/30 dark:bg-white/5">
            <span class="text-xs text-slate-500 font-medium">
              Mostrando ${startIndex + 1} a ${Math.min(endIndex, exceptions.length)} de ${exceptions.length} excepciones registradas
            </span>
            <div class="flex gap-2">
              <button onclick="Views.directorExceptions.prevPage()"
                      class="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400
                             hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                      ${currentPage === 1 ? 'disabled' : ''}>
                <span class="material-icons-round text-lg">chevron_left</span>
              </button>
              <button onclick="Views.directorExceptions.nextPage()"
                      class="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400
                             hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                      ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}>
                <span class="material-icons-round text-lg">chevron_right</span>
              </button>
            </div>
          </div>
        `}
      </div>
    `;
  }

  // Pagination controls
  Views.directorExceptions.prevPage = function() {
    if (currentPage > 1) {
      currentPage--;
      renderExceptions();
    }
  };

  Views.directorExceptions.nextPage = function() {
    const exceptions = State.getScheduleExceptions();
    const totalPages = Math.ceil(exceptions.length / exceptionsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderExceptions();
    }
  };

  // toggleMobileSidebar now uses centralized Components.toggleDirectorSidebar()

  // Toggle dark mode
  Views.directorExceptions.toggleDarkMode = function() {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', document.documentElement.classList.contains('dark'));
    updateDarkModeIcon();
  };

  function updateDarkModeIcon() {
    const icon = document.getElementById('dark-mode-icon');
    if (icon) {
      icon.textContent = document.documentElement.classList.contains('dark') ? 'light_mode' : 'dark_mode';
    }
  }

  // Show create form modal with Tailwind styling
  Views.directorExceptions.showCreateForm = function() {
    const coursesOptions = courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'exception-modal-overlay';
    modalOverlay.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
    modalOverlay.onclick = (e) => {
      if (e.target === modalOverlay) closeModal();
    };

    modalOverlay.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <!-- Modal Header -->
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 class="text-lg font-bold text-slate-800 dark:text-white">Nueva Excepción de Horario</h3>
          <button onclick="Views.directorExceptions.closeModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <span class="material-icons-round">close</span>
          </button>
        </div>

        <!-- Modal Body -->
        <div class="px-6 py-5 space-y-5">
          <form id="exception-form" class="space-y-5">
            <!-- Alcance -->
            <div>
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Alcance <span class="text-red-500">*</span>
              </label>
              <select id="exc-scope" required
                      class="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600
                             bg-white dark:bg-slate-700 text-slate-800 dark:text-white
                             focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
                <option value="GLOBAL">Global (todos los cursos)</option>
                <option value="COURSE">Curso específico</option>
              </select>
            </div>

            <!-- Curso (conditional) -->
            <div id="course-group" class="hidden">
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Curso
              </label>
              <select id="exc-course"
                      class="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600
                             bg-white dark:bg-slate-700 text-slate-800 dark:text-white
                             focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
                <option value="">Seleccionar...</option>
                ${coursesOptions}
              </select>
            </div>

            <!-- Fecha -->
            <div>
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Fecha <span class="text-red-500">*</span>
              </label>
              <input type="date" id="exc-date" required
                     class="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600
                            bg-white dark:bg-slate-700 text-slate-800 dark:text-white
                            focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
            </div>

            <!-- Horarios -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Hora Ingreso
                </label>
                <input type="time" id="exc-in-time"
                       class="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600
                              bg-white dark:bg-slate-700 text-slate-800 dark:text-white
                              focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Hora Salida
                </label>
                <input type="time" id="exc-out-time"
                       class="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600
                              bg-white dark:bg-slate-700 text-slate-800 dark:text-white
                              focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
              </div>
            </div>

            <!-- Motivo -->
            <div>
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Motivo <span class="text-red-500">*</span>
              </label>
              <textarea id="exc-reason" required rows="3"
                        placeholder="Ej: Reunión de apoderados, actividad especial, etc."
                        class="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600
                               bg-white dark:bg-slate-700 text-slate-800 dark:text-white
                               focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all
                               placeholder:text-slate-400 resize-none"></textarea>
            </div>

            <!-- Notificar -->
            <div class="flex items-center gap-3">
              <input type="checkbox" id="exc-notify"
                     class="w-5 h-5 rounded border-slate-300 dark:border-slate-600
                            text-indigo-600 focus:ring-indigo-500 dark:bg-slate-700">
              <label for="exc-notify" class="text-sm font-medium text-slate-700 dark:text-slate-300">
                Notificar a padres/apoderados
              </label>
            </div>
          </form>
        </div>

        <!-- Modal Footer -->
        <div class="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-3 justify-end bg-slate-50/50 dark:bg-white/5">
          <button onclick="Views.directorExceptions.closeModal()"
                  class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600
                         text-slate-600 dark:text-slate-400 font-medium text-sm
                         hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            Cancelar
          </button>
          <button onclick="Views.directorExceptions.previewRecipients()"
                  class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600
                         text-slate-600 dark:text-slate-400 font-medium text-sm
                         hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            Vista Previa Destinatarios
          </button>
          <button onclick="Views.directorExceptions.createException()"
                  class="px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-500
                         text-white font-semibold text-sm shadow-lg shadow-indigo-200 dark:shadow-none
                         hover:opacity-90 transition-opacity">
            Crear Excepción
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    // Show/hide course selector based on scope
    document.getElementById('exc-scope').addEventListener('change', (e) => {
      const courseGroup = document.getElementById('course-group');
      if (e.target.value === 'COURSE') {
        courseGroup.classList.remove('hidden');
      } else {
        courseGroup.classList.add('hidden');
      }
    });
  };

  // Close modal
  Views.directorExceptions.closeModal = function() {
    const modal = document.getElementById('exception-modal-overlay');
    if (modal) {
      modal.remove();
    }
  };

  function closeModal() {
    Views.directorExceptions.closeModal();
  }

  // Preview recipients
  Views.directorExceptions.previewRecipients = function() {
    const scope = document.getElementById('exc-scope').value;
    const courseId = document.getElementById('exc-course').value;

    let guardians = [];
    if (scope === 'GLOBAL') {
      guardians = State.getGuardians();
    } else if (courseId) {
      const students = State.getStudentsByCourse(parseInt(courseId));
      const studentIds = students.map(s => s.id);
      guardians = State.getGuardians().filter(g =>
        g.student_ids.some(sid => studentIds.includes(sid))
      );
    }

    const preview = guardians.slice(0, 10).map(g =>
      `<li class="py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
        <span class="font-medium text-slate-700 dark:text-slate-300">${g.full_name}</span>
        <span class="text-slate-500 dark:text-slate-400 text-sm"> - ${g.contacts.find(c => c.type === 'whatsapp')?.value || g.contacts[0]?.value || 'Sin contacto'}</span>
      </li>`
    ).join('');

    // Create preview modal
    const previewOverlay = document.createElement('div');
    previewOverlay.id = 'preview-modal-overlay';
    previewOverlay.className = 'fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4';
    previewOverlay.onclick = (e) => {
      if (e.target === previewOverlay) previewOverlay.remove();
    };

    previewOverlay.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 class="text-lg font-bold text-slate-800 dark:text-white">Vista Previa de Destinatarios</h3>
          <button onclick="this.closest('#preview-modal-overlay').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <span class="material-icons-round">close</span>
          </button>
        </div>
        <div class="px-6 py-5">
          <p class="text-slate-600 dark:text-slate-400 mb-4">
            <strong class="text-slate-800 dark:text-white">Total de apoderados:</strong> ${guardians.length}
          </p>
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Primeros 10 destinatarios:</p>
          <ul class="max-h-64 overflow-y-auto">
            ${preview || '<li class="py-2 text-slate-500">No hay destinatarios</li>'}
          </ul>
        </div>
        <div class="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end bg-slate-50/50 dark:bg-white/5">
          <button onclick="this.closest('#preview-modal-overlay').remove()"
                  class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600
                         text-slate-600 dark:text-slate-400 font-medium text-sm
                         hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(previewOverlay);
  };

  // Create exception (PRESERVED backend logic)
  Views.directorExceptions.createException = async function() {
    const form = document.getElementById('exception-form');

    // Simple validation
    const scope = document.getElementById('exc-scope').value;
    const date = document.getElementById('exc-date').value;
    const reason = document.getElementById('exc-reason').value;

    if (!date || !reason) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    if (scope === 'COURSE' && !document.getElementById('exc-course').value) {
      Components.showToast('Seleccione un curso', 'error');
      return;
    }

    const exception = {
      scope: scope,
      course_id: document.getElementById('exc-course').value ? parseInt(document.getElementById('exc-course').value) : null,
      date: date,
      in_time: document.getElementById('exc-in-time').value || null,
      out_time: document.getElementById('exc-out-time').value || null,
      reason: reason
    };

    // Read notify checkbox before closing modal
    const notify = document.getElementById('exc-notify').checked;

    try {
      // Call backend API
      const created = await API.createScheduleException(exception);
      // Update local state with the response (includes server-assigned ID)
      State.data.schedule_exceptions.push(created);
      State.persist();

      // Close modal
      closeModal();

      Components.showToast('Excepción creada exitosamente', 'success');

      if (notify) {
        Components.showToast('Notificaciones enviadas (simulado)', 'info');
      }

      // Reset page to 1 and re-render
      currentPage = 1;
      renderExceptions();
    } catch (error) {
      console.error('Error creating exception:', error);
      Components.showToast(error.message || 'Error al crear excepción', 'error');
    }
  };

  // Delete exception (PRESERVED backend logic)
  Views.directorExceptions.deleteException = async function(id) {
    if (confirm('¿Está seguro de eliminar esta excepción?')) {
      try {
        // Call backend API
        await API.deleteScheduleException(id);
        // Update local state
        State.deleteScheduleException(id);
        Components.showToast('Excepción eliminada', 'success');
        renderExceptions();
      } catch (error) {
        console.error('Error deleting exception:', error);
        Components.showToast(error.message || 'Error al eliminar excepción', 'error');
      }
    }
  };

  // Initial render
  renderExceptions();
};
