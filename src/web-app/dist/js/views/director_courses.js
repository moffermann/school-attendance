// Uses centralized Components for sidebar - see components.js
// Director Courses Management - Tailwind Redesign
Views.directorCourses = function() {
  const app = document.getElementById('app');

  let filteredCourses = State.getCourses();
  let searchTerm = '';
  let selectedGrade = '';
  let isLoading = false;
  let isDarkMode = document.documentElement.classList.contains('dark');

  // Get unique grades for filter
  function getUniqueGrades() {
    const grades = new Set();
    State.getCourses().forEach(c => {
      if (c.grade) grades.add(c.grade);
    });
    return Array.from(grades).sort();
  }

  function setLoading(loading) {
    isLoading = loading;
    const table = document.querySelector('.courses-table');
    if (table) {
      table.style.opacity = loading ? '0.5' : '1';
      table.style.pointerEvents = loading ? 'none' : 'auto';
    }
  }

  // Current path for active state
  const currentPath = '/director/courses';

  function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('darkMode', isDarkMode ? 'true' : 'false');
    renderLayout();
  }

  function renderLayout() {
    const grades = getUniqueGrades();
    const userName = State.currentUser?.name || State.currentUser?.email?.split('@')[0] || 'Director';
    const userInitial = userName.charAt(0).toUpperCase();

    app.innerHTML = `
      <div class="h-screen flex overflow-hidden bg-gray-50 dark:bg-background-dark">
        <!-- Sidebar -->
        ${Components.directorSidebar(currentPath)}
        <div id="sidebar-backdrop" class="fixed inset-0 bg-black/50 z-40 hidden" onclick="Components.toggleDirectorSidebar()"></div>

        <!-- Main Content -->
        <main class="flex-1 flex flex-col overflow-hidden">
          <!-- Header -->
          <header class="h-20 bg-white dark:bg-card-dark border-b border-gray-200 dark:border-border-dark flex items-center justify-between px-4 md:px-8 shrink-0 shadow-sm z-10">
            <div class="flex items-center gap-4">
              <button onclick="Components.toggleDirectorSidebar()" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 desktop-hidden">
                <span class="material-icons-round text-gray-600 dark:text-gray-300">menu</span>
              </button>
              <h2 class="text-xl font-bold text-gray-800 dark:text-white">Gestion de Cursos</h2>
            </div>
            <div class="flex items-center gap-4">
              <div id="notification-bell-placeholder"></div>
              <button onclick="Views.directorCourses.toggleDarkMode()" class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-500 dark:text-gray-400">
                <span class="material-icons-round">${isDarkMode ? 'light_mode' : 'dark_mode'}</span>
              </button>
              <div class="h-8 w-px bg-gray-200 dark:bg-slate-600 mobile-hidden"></div>
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                  ${userInitial}
                </div>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mobile-hidden">${Components.escapeHtml(userName)}</span>
                <a href="#" onclick="Auth.logout(); return false;"
                   class="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                  <span class="material-icons-round text-lg">logout</span>
                  <span class="mobile-hidden">Salir</span>
                </a>
              </div>
            </div>
          </header>

          <!-- Content Area -->
          <div class="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
            ${renderContent()}
          </div>

          <!-- Footer -->
          <footer class="text-center text-xs text-gray-400 dark:text-gray-500 py-4 border-t border-gray-100 dark:border-slate-800">
            &copy; 2026 NEUVOX. Todos los derechos reservados.
          </footer>
        </main>
      </div>
    `;

    // Attach event listeners after render
    attachEventListeners();
  }

  function renderContent() {
    const grades = getUniqueGrades();
    const totalCourses = filteredCourses.length;

    return `
      <!-- Action Button -->
      ${State.currentRole === 'director' ? `
        <div class="flex justify-end">
          <button onclick="Views.directorCourses.showCreateForm()"
                  class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700
                         text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2
                         shadow-lg shadow-indigo-200 dark:shadow-none hover:opacity-90 transition-opacity">
            <span class="material-icons-round">add</span>
            Nuevo Curso
          </button>
        </div>
      ` : ''}

      <!-- Filters Card -->
      <div class="bg-white dark:bg-card-dark rounded-xl p-6 shadow-sm border border-gray-100 dark:border-border-dark">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <!-- Search -->
          <div class="md:col-span-4">
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Buscar curso</label>
            <div class="relative">
              <span class="absolute left-3 top-2.5 text-gray-400 material-icons-round text-xl">search</span>
              <input type="text" id="search-course"
                     class="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                            focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                            text-gray-700 dark:text-gray-200 placeholder-gray-400"
                     placeholder="Nombre del curso..." value="${Components.escapeHtml(searchTerm)}">
            </div>
          </div>

          <!-- Grade Filter -->
          <div class="md:col-span-3">
            <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Grado</label>
            <select id="filter-grade"
                    class="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg
                           focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-slate-800
                           text-gray-700 dark:text-gray-200">
              <option value="">Todos</option>
              ${grades.map(g => `<option value="${Components.escapeHtml(g)}" ${selectedGrade === g ? 'selected' : ''}>${Components.escapeHtml(g)}</option>`).join('')}
            </select>
          </div>

          <!-- Buttons -->
          <div class="md:col-span-5 flex gap-2">
            <button onclick="Views.directorCourses.applyFilters()"
                    class="flex-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300
                           border border-gray-200 dark:border-slate-600 rounded-lg
                           hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-center gap-2 transition-colors">
              <span class="material-icons-round text-lg">filter_list</span> Filtrar
            </button>
            <button onclick="Views.directorCourses.exportCSV()"
                    class="flex-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300
                           border border-gray-200 dark:border-slate-600 rounded-lg
                           hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-center gap-2 transition-colors">
              <span class="material-icons-round text-lg">download</span> Exportar
            </button>
          </div>
        </div>
      </div>

      <!-- Table Card -->
      <div class="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-gray-100 dark:border-border-dark overflow-hidden courses-table">
        <!-- Card Header -->
        <div class="px-6 py-4 border-b border-gray-50 dark:border-slate-700">
          <h4 class="font-bold text-gray-800 dark:text-white">Lista de Cursos (${totalCourses})</h4>
        </div>

        ${filteredCourses.length === 0 ? `
          <div class="p-12 text-center">
            <span class="material-icons-round text-6xl text-gray-300 dark:text-gray-600 mb-4">folder_off</span>
            <p class="text-gray-500 dark:text-gray-400 text-lg font-medium">Sin cursos</p>
            <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">
              ${searchTerm || selectedGrade
                ? 'No hay cursos que coincidan con los filtros seleccionados'
                : 'No hay cursos registrados en el sistema'}
            </p>
          </div>
        ` : `
          <!-- Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead>
                <tr class="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                  <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
                  <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Grado</th>
                  <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Alumnos</th>
                  <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Horarios</th>
                  <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                  <th class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50 dark:divide-slate-700">
                ${filteredCourses.map(course => renderCourseRow(course)).join('')}
              </tbody>
            </table>
          </div>

          <!-- Footer Pagination -->
          <div class="px-6 py-4 border-t border-gray-50 dark:border-slate-700 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Mostrando 1 a ${filteredCourses.length} de ${filteredCourses.length} registros</span>
            <div class="flex gap-2">
              <button class="p-1 rounded border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors" disabled>
                <span class="material-icons-round text-xl">chevron_left</span>
              </button>
              <button class="p-1 rounded border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors" disabled>
                <span class="material-icons-round text-xl">chevron_right</span>
              </button>
            </div>
          </div>
        `}
      </div>
    `;
  }

  function renderCourseRow(course) {
    const studentsCount = State.getStudents().filter(s => s.course_id === course.id).length;
    const schedulesCount = State.getSchedules ? State.getSchedules().filter(s => s.course_id === course.id).length : 0;

    // Status badge
    let statusBadge = '';
    if (course.status === 'ACTIVE' || !course.status) {
      statusBadge = `
        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                     bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
          Activo
        </span>`;
    } else if (course.status === 'ARCHIVED') {
      statusBadge = `
        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                     bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
          Archivado
        </span>`;
    } else {
      statusBadge = `
        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                     bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
          <span class="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
          Eliminado
        </span>`;
    }

    return `
      <tr class="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
        <td class="px-6 py-4">
          <span class="font-bold text-gray-800 dark:text-white">${Components.escapeHtml(course.name)}</span>
        </td>
        <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">${Components.escapeHtml(course.grade || '-')}</td>
        <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">${studentsCount}</td>
        <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">${schedulesCount}</td>
        <td class="px-6 py-4">${statusBadge}</td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-2">
            <!-- View Detail -->
            <button onclick="Router.navigate('/director/courses/${course.id}')"
                    class="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50
                           dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                    title="Ver Detalle">
              <span class="material-icons-round text-xl">visibility</span>
            </button>
            ${State.currentRole === 'director' ? `
              <!-- Edit -->
              <button onclick="Views.directorCourses.showEditForm(${course.id})"
                      class="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50
                             dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                      title="Editar">
                <span class="material-icons-round text-xl">edit</span>
              </button>
              <!-- Delete -->
              <button onclick="Views.directorCourses.confirmDelete(${course.id})"
                      class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50
                             dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Eliminar">
                <span class="material-icons-round text-xl">delete</span>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  function attachEventListeners() {
    // Search on enter
    const searchInput = document.getElementById('search-course');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          Views.directorCourses.applyFilters();
        }
      });
    }
  }

  Views.directorCourses.applyFilters = function() {
    searchTerm = document.getElementById('search-course')?.value.toLowerCase() || '';
    selectedGrade = document.getElementById('filter-grade')?.value || '';

    filteredCourses = State.getCourses().filter(course => {
      // Only show active courses by default
      if (course.status && course.status !== 'ACTIVE') {
        return false;
      }

      if (searchTerm && !course.name.toLowerCase().includes(searchTerm)) {
        return false;
      }

      if (selectedGrade && course.grade !== selectedGrade) {
        return false;
      }

      return true;
    });

    renderLayout();
  };

  Views.directorCourses.showCreateForm = function() {
    const allTeachers = State.getTeachers ? State.getTeachers() : [];

    Components.showModal('Nuevo Curso', `
      <form id="course-form">
        <div class="form-group">
          <label class="form-label">Nombre del Curso *</label>
          <input type="text" id="course-name" class="form-input" required placeholder="Ej: 1° Basico A" maxlength="128">
        </div>
        <div class="form-group">
          <label class="form-label">Grado *</label>
          <input type="text" id="course-grade" class="form-input" required placeholder="Ej: 1° Basico" maxlength="32">
          <small style="color: var(--color-gray-500); display: block; margin-top: 0.25rem;">
            Nivel educativo del curso (ej: Pre-Kinder, 1° Basico, 8° Basico, 4° Medio)
          </small>
        </div>
        <div class="form-group">
          <label class="form-label">Profesores (opcional)</label>
          ${allTeachers.length > 0 ? `
            <select id="course-teachers" class="form-select" multiple style="min-height: 100px;">
              ${allTeachers.map(t => `<option value="${t.id}">${Components.escapeHtml(t.full_name)}</option>`).join('')}
            </select>
            <small style="color: var(--color-gray-500); display: block; margin-top: 0.25rem;">
              Manten Ctrl/Cmd para seleccionar multiples profesores
            </small>
          ` : `
            <p style="color: var(--color-gray-500); font-size: 0.9rem; margin: 0;">
              No hay profesores registrados. Puedes asignarlos despues.
            </p>
          `}
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorCourses.saveCourse() }
    ]);
  };

  Views.directorCourses.saveCourse = async function(courseId = null) {
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

    setLoading(true);

    try {
      if (courseId) {
        await State.updateCourse(courseId, { name, grade, teacher_ids });
        Components.showToast('Curso actualizado correctamente', 'success');
      } else {
        await State.createCourse({ name, grade, teacher_ids });
        Components.showToast('Curso creado correctamente', 'success');
      }

      document.querySelector('.modal-container')?.click(); // Close modal
      filteredCourses = State.getCourses().filter(c => !c.status || c.status === 'ACTIVE');
      renderLayout();
    } catch (error) {
      Components.showToast(error.message || 'Error al guardar curso', 'error');
    } finally {
      setLoading(false);
    }
  };

  Views.directorCourses.showEditForm = function(courseId) {
    const course = State.getCourse(courseId);
    if (!course) return;

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
            Nivel educativo del curso (ej: Pre-Kinder, 1° Basico, 8° Basico, 4° Medio)
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
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorCourses.saveCourse(courseId) }
    ]);
  };

  Views.directorCourses.confirmDelete = function(courseId) {
    const course = State.getCourse(courseId);
    if (!course) return;

    const studentsCount = State.getStudents().filter(s => s.course_id === courseId).length;
    const schedulesCount = State.getSchedules ? State.getSchedules().filter(s => s.course_id === courseId).length : 0;

    let warningMessage = '';
    if (studentsCount > 0 || schedulesCount > 0) {
      warningMessage = `
        <div style="background: var(--color-warning-light); padding: 0.75rem; border-radius: 8px; margin-top: 1rem; text-align: left;">
          <strong style="color: var(--color-warning-dark);">⚠️ Atencion:</strong>
          <p style="margin: 0.5rem 0 0; font-size: 0.9rem;">
            Este curso tiene:
            ${studentsCount > 0 ? `<br>• ${studentsCount} alumno(s) asignado(s)` : ''}
            ${schedulesCount > 0 ? `<br>• ${schedulesCount} horario(s) configurado(s)` : ''}
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
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">¿Esta seguro de eliminar el curso?</p>
        <p style="font-weight: 600; color: var(--color-error);">${Components.escapeHtml(course.name)}</p>
        ${warningMessage}
      </div>
    `, canDelete ? [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Eliminar', action: 'delete', className: 'btn-error', onClick: () => Views.directorCourses.deleteCourse(courseId) }
    ] : [
      { label: 'Entendido', action: 'close', className: 'btn-secondary' }
    ]);
  };

  Views.directorCourses.deleteCourse = async function(courseId) {
    setLoading(true);

    try {
      await State.deleteCourse(courseId);
      document.querySelector('.modal-container')?.click();
      Components.showToast('Curso eliminado correctamente', 'success');
      filteredCourses = State.getCourses().filter(c => !c.status || c.status === 'ACTIVE');
      renderLayout();
    } catch (error) {
      Components.showToast(error.message || 'Error al eliminar curso', 'error');
    } finally {
      setLoading(false);
    }
  };

  Views.directorCourses.viewDetails = function(courseId) {
    const course = State.getCourse(courseId);
    if (!course) return;

    const students = State.getStudents().filter(s => s.course_id === courseId);
    const schedules = State.getSchedules ? State.getSchedules().filter(s => s.course_id === courseId) : [];

    const studentsHTML = students.length > 0 ? `
      <ul style="list-style: none; padding: 0; margin: 0; max-height: 200px; overflow-y: auto;">
        ${students.map(s => `
          <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--color-gray-100); display: flex; justify-content: space-between; align-items: center;">
            <span>${Components.escapeHtml(s.full_name)}</span>
            <button class="btn btn-secondary btn-sm" onclick="Components.showStudentProfile(${s.id})" title="Ver alumno">
              👁️
            </button>
          </li>
        `).join('')}
      </ul>
    ` : '<p style="color: var(--color-gray-500);">Sin alumnos asignados</p>';

    const schedulesHTML = schedules.length > 0 ? `
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${schedules.map(s => `
          <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--color-gray-100);">
            <strong>${Components.escapeHtml(s.name || 'Horario')}</strong>
            ${s.entry_time ? `<br><span style="font-size: 0.85rem; color: var(--color-gray-500);">Entrada: ${s.entry_time}</span>` : ''}
          </li>
        `).join('')}
      </ul>
    ` : '<p style="color: var(--color-gray-500);">Sin horarios configurados</p>';

    Components.showModal(`Detalle - ${course.name}`, `
      <div class="card mb-2">
        <div class="card-header">Informacion del Curso</div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
            <div><strong>Nombre:</strong><br>${Components.escapeHtml(course.name)}</div>
            <div><strong>Grado:</strong><br>${Components.escapeHtml(course.grade || '-')}</div>
            <div><strong>Estado:</strong><br>${course.status === 'ACTIVE' ? Components.createChip('Activo', 'success') : Components.createChip(course.status || 'N/A', 'gray')}</div>
            <div><strong>ID:</strong><br><span style="font-family: monospace; color: var(--color-gray-500);">#${course.id}</span></div>
          </div>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-header">
          <span>Alumnos (${students.length})</span>
        </div>
        <div class="card-body">
          ${studentsHTML}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span>Horarios (${schedules.length})</span>
        </div>
        <div class="card-body">
          ${schedulesHTML}
        </div>
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' },
      ...(State.currentRole === 'director' ? [
        { label: 'Editar', action: 'edit', className: 'btn-primary', onClick: () => {
          document.querySelector('.modal-container')?.click();
          Views.directorCourses.showEditForm(courseId);
        }}
      ] : [])
    ]);
  };

  Views.directorCourses.exportCSV = async function() {
    setLoading(true);

    try {
      // Try API export first if in API mode
      if (!State.isDemoMode()) {
        const blob = await State.exportCoursesCSV({ grade: selectedGrade });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cursos_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Components.showToast('Exportacion completada', 'success');
      } else {
        // Demo mode: generate CSV client-side
        const courses = filteredCourses;
        const headers = ['ID', 'Nombre', 'Grado', 'Alumnos', 'Horarios', 'Estado'];
        const rows = courses.map(c => {
          const studentsCount = State.getStudents().filter(s => s.course_id === c.id).length;
          const schedulesCount = State.getSchedules ? State.getSchedules().filter(s => s.course_id === c.id).length : 0;
          return [c.id, c.name, c.grade || '', studentsCount, schedulesCount, c.status || 'ACTIVE'];
        });

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
          csv += row.map(cell => {
            const val = String(cell);
            // Escape quotes and wrap in quotes if contains comma or quote
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
              return '"' + val.replace(/"/g, '""') + '"';
            }
            return val;
          }).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cursos_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Components.showToast('Exportacion completada', 'success');
      }
    } catch (error) {
      Components.showToast(error.message || 'Error al exportar', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Expose toggle functions
  Views.directorCourses.toggleDarkMode = toggleDarkMode;

  // Initial render
  filteredCourses = State.getCourses().filter(c => !c.status || c.status === 'ACTIVE');
  renderLayout();
};
