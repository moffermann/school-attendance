// Director Courses Management
Views.directorCourses = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Gestión de Cursos';

  let filteredCourses = State.getCourses();
  let searchTerm = '';
  let selectedGrade = '';
  let isLoading = false;

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

  function renderCourses() {
    const grades = getUniqueGrades();

    content.innerHTML = `
      <div class="filters" style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; margin-bottom: 1.5rem;">
        <div class="filter-group" style="flex: 1; min-width: 200px;">
          <label class="form-label">Buscar curso</label>
          <input type="text" id="search-course" class="form-input" placeholder="Nombre del curso..." value="${Components.escapeHtml(searchTerm)}">
        </div>

        <div class="filter-group" style="flex: 1; min-width: 150px;">
          <label class="form-label">Grado</label>
          <select id="filter-grade" class="form-select">
            <option value="">Todos</option>
            ${grades.map(g => `<option value="${Components.escapeHtml(g)}" ${selectedGrade === g ? 'selected' : ''}>${Components.escapeHtml(g)}</option>`).join('')}
          </select>
        </div>

        <div class="filter-group" style="display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary" onclick="Views.directorCourses.applyFilters()">Filtrar</button>
          <button class="btn btn-secondary" onclick="Views.directorCourses.exportCSV()" title="Exportar a CSV">
            📥 Exportar
          </button>
          ${State.currentRole === 'director' ? `
            <button class="btn btn-primary" onclick="Views.directorCourses.showCreateForm()">+ Nuevo Curso</button>
          ` : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <span>Lista de Cursos (${filteredCourses.length})</span>
        </div>
        <div class="card-body courses-table">
          ${filteredCourses.length === 0 ? Components.createEmptyState(
            'Sin cursos',
            searchTerm || selectedGrade
              ? 'No hay cursos que coincidan con los filtros seleccionados'
              : 'No hay cursos registrados en el sistema'
          ) : `
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Grado</th>
                <th>Alumnos</th>
                <th>Horarios</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${filteredCourses.map(course => {
                const studentsCount = State.getStudents().filter(s => s.course_id === course.id).length;
                const schedulesCount = State.getSchedules ? State.getSchedules().filter(s => s.course_id === course.id).length : 0;
                const statusChip = course.status === 'ACTIVE'
                  ? Components.createChip('Activo', 'success')
                  : course.status === 'ARCHIVED'
                    ? Components.createChip('Archivado', 'warning')
                    : Components.createChip('Eliminado', 'error');

                return `
                  <tr>
                    <td><strong>${Components.escapeHtml(course.name)}</strong></td>
                    <td>${Components.escapeHtml(course.grade || '-')}</td>
                    <td>${studentsCount}</td>
                    <td>${schedulesCount}</td>
                    <td>${statusChip}</td>
                    <td style="white-space: nowrap;">
                      <button class="btn btn-secondary btn-sm" onclick="Router.navigate('/director/courses/${course.id}')" title="Ver detalle">
                        👁️
                      </button>
                      ${State.currentRole === 'director' ? `
                        <button class="btn btn-secondary btn-sm" onclick="Views.directorCourses.showEditForm(${course.id})" title="Editar">
                          ✏️
                        </button>
                        <button class="btn btn-error btn-sm" onclick="Views.directorCourses.confirmDelete(${course.id})" title="Eliminar">
                          🗑️
                        </button>
                      ` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          `}
        </div>
      </div>
    `;
  }

  Views.directorCourses.applyFilters = function() {
    searchTerm = document.getElementById('search-course').value.toLowerCase();
    selectedGrade = document.getElementById('filter-grade').value;

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

    renderCourses();
  };

  Views.directorCourses.showCreateForm = function() {
    Components.showModal('Nuevo Curso', `
      <form id="course-form">
        <div class="form-group">
          <label class="form-label">Nombre del Curso *</label>
          <input type="text" id="course-name" class="form-input" required placeholder="Ej: 1° Básico A" maxlength="128">
        </div>
        <div class="form-group">
          <label class="form-label">Grado *</label>
          <input type="text" id="course-grade" class="form-input" required placeholder="Ej: 1° Básico" maxlength="32">
          <small style="color: var(--color-gray-500); display: block; margin-top: 0.25rem;">
            Nivel educativo del curso (ej: Pre-Kinder, 1° Básico, 8° Básico, 4° Medio)
          </small>
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

    if (!name || !grade) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    setLoading(true);

    try {
      if (courseId) {
        await State.updateCourse(courseId, { name, grade });
        Components.showToast('Curso actualizado correctamente', 'success');
      } else {
        await State.createCourse({ name, grade });
        Components.showToast('Curso creado correctamente', 'success');
      }

      document.querySelector('.modal-container').click(); // Close modal
      filteredCourses = State.getCourses().filter(c => !c.status || c.status === 'ACTIVE');
      renderCourses();
    } catch (error) {
      Components.showToast(error.message || 'Error al guardar curso', 'error');
    } finally {
      setLoading(false);
    }
  };

  Views.directorCourses.showEditForm = function(courseId) {
    const course = State.getCourse(courseId);
    if (!course) return;

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
            Nivel educativo del curso (ej: Pre-Kinder, 1° Básico, 8° Básico, 4° Medio)
          </small>
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
          <strong style="color: var(--color-warning-dark);">⚠️ Atención:</strong>
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

    Components.showModal('Confirmar Eliminación', `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">¿Está seguro de eliminar el curso?</p>
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
      document.querySelector('.modal-container').click();
      Components.showToast('Curso eliminado correctamente', 'success');
      filteredCourses = State.getCourses().filter(c => !c.status || c.status === 'ACTIVE');
      renderCourses();
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
        <div class="card-header">Información del Curso</div>
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
          document.querySelector('.modal-container').click();
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
        Components.showToast('Exportación completada', 'success');
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
        Components.showToast('Exportación completada', 'success');
      }
    } catch (error) {
      Components.showToast(error.message || 'Error al exportar', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Initial render
  filteredCourses = State.getCourses().filter(c => !c.status || c.status === 'ACTIVE');
  renderCourses();
};
