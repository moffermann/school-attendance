// Director Course Detail Page
Views.directorCourseDetail = function(courseId) {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');

  const course = State.getCourse(courseId);

  if (!course) {
    if (pageTitle) pageTitle.textContent = 'Curso no encontrado';
    content.innerHTML = `
      <div class="card">
        <div class="card-body" style="text-align: center; padding: 3rem;">
          <div style="font-size: 4rem; margin-bottom: 1rem;">📚</div>
          <h2 style="margin-bottom: 1rem;">Curso no encontrado</h2>
          <p style="color: var(--color-gray-500); margin-bottom: 1.5rem;">El curso solicitado no existe o fue eliminado.</p>
          <button class="btn btn-primary" onclick="Router.navigate('/director/courses')">
            ← Volver a Cursos
          </button>
        </div>
      </div>
    `;
    return;
  }

  if (pageTitle) pageTitle.textContent = `Curso: ${course.name}`;

  const students = State.getStudents().filter(s => s.course_id === courseId);
  const schedules = State.getSchedules ? State.getSchedules().filter(s => s.course_id === courseId) : [];
  const teachers = State.getTeachers ? State.getTeachers().filter(t => (course.teacher_ids || []).includes(t.id)) : [];

  function render() {
    const statusChip = course.status === 'ACTIVE'
      ? Components.createChip('Activo', 'success')
      : course.status === 'ARCHIVED'
        ? Components.createChip('Archivado', 'warning')
        : Components.createChip('Eliminado', 'error');

    content.innerHTML = `
      <!-- Header with back button -->
      <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <button class="btn btn-secondary" onclick="Router.navigate('/director/courses')">
          ← Volver a Cursos
        </button>
        ${State.currentRole === 'director' ? `
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary" onclick="Views.directorCourseDetail.showEditForm()">
              ✏️ Editar Curso
            </button>
            <button class="btn btn-error" onclick="Views.directorCourseDetail.confirmDelete()">
              🗑️ Eliminar
            </button>
          </div>
        ` : ''}
      </div>

      <!-- Course Info Card -->
      <div class="card mb-2">
        <div class="card-header">
          <span>Información del Curso</span>
          ${statusChip}
        </div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
            <div>
              <label style="font-size: 0.85rem; color: var(--color-gray-500); display: block;">Nombre</label>
              <strong style="font-size: 1.1rem;">${Components.escapeHtml(course.name)}</strong>
            </div>
            <div>
              <label style="font-size: 0.85rem; color: var(--color-gray-500); display: block;">Grado</label>
              <strong style="font-size: 1.1rem;">${Components.escapeHtml(course.grade || '-')}</strong>
            </div>
            <div>
              <label style="font-size: 0.85rem; color: var(--color-gray-500); display: block;">ID Sistema</label>
              <span style="font-family: monospace; color: var(--color-gray-600);">#${course.id}</span>
            </div>
            <div>
              <label style="font-size: 0.85rem; color: var(--color-gray-500); display: block;">Profesor(es)</label>
              <span>${teachers.length > 0 ? teachers.map(t => Components.escapeHtml(t.full_name)).join(', ') : '<span style="color: var(--color-gray-400);">Sin asignar</span>'}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Row -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="card" style="text-align: center;">
          <div class="card-body">
            <div style="font-size: 2rem; font-weight: 700; color: var(--color-primary);">${students.length}</div>
            <div style="font-size: 0.85rem; color: var(--color-gray-500);">Alumnos</div>
          </div>
        </div>
        <div class="card" style="text-align: center;">
          <div class="card-body">
            <div style="font-size: 2rem; font-weight: 700; color: var(--color-success);">${schedules.length}</div>
            <div style="font-size: 0.85rem; color: var(--color-gray-500);">Horarios</div>
          </div>
        </div>
        <div class="card" style="text-align: center;">
          <div class="card-body">
            <div style="font-size: 2rem; font-weight: 700; color: var(--color-warning);">${teachers.length}</div>
            <div style="font-size: 0.85rem; color: var(--color-gray-500);">Profesores</div>
          </div>
        </div>
      </div>

      <!-- Students Section -->
      <div class="card mb-2">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <span>Alumnos (${students.length})</span>
          ${State.currentRole === 'director' ? `
            <button class="btn btn-secondary btn-sm" onclick="Router.navigate('/director/students')">
              + Gestionar Alumnos
            </button>
          ` : ''}
        </div>
        <div class="card-body">
          ${students.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>RUT/Matrícula</th>
                  <th style="text-align: center;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${students.map(s => `
                  <tr>
                    <td><strong>${Components.escapeHtml(s.full_name)}</strong></td>
                    <td>${s.national_id || '<span style="color: var(--color-gray-400);">-</span>'}</td>
                    <td style="text-align: center;">
                      <button class="btn btn-secondary btn-sm" onclick="Components.showStudentProfile(${s.id})" title="Ver perfil">
                        👁️ Ver Perfil
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div style="text-align: center; padding: 2rem; color: var(--color-gray-500);">
              <div style="font-size: 2rem; margin-bottom: 0.5rem;">👥</div>
              <p>No hay alumnos asignados a este curso</p>
              ${State.currentRole === 'director' ? `
                <button class="btn btn-primary btn-sm" onclick="Router.navigate('/director/students')" style="margin-top: 1rem;">
                  Ir a Gestión de Alumnos
                </button>
              ` : ''}
            </div>
          `}
        </div>
      </div>

      <!-- Schedules Section -->
      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <span>Horarios (${schedules.length})</span>
          ${State.currentRole === 'director' ? `
            <button class="btn btn-secondary btn-sm" onclick="Router.navigate('/director/schedules')">
              + Gestionar Horarios
            </button>
          ` : ''}
        </div>
        <div class="card-body">
          ${schedules.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                </tr>
              </thead>
              <tbody>
                ${schedules.map(s => {
                  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                  return `
                    <tr>
                      <td><strong>${days[s.weekday] || s.weekday}</strong></td>
                      <td>${s.in_time || '-'}</td>
                      <td>${s.out_time || '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          ` : `
            <div style="text-align: center; padding: 2rem; color: var(--color-gray-500);">
              <div style="font-size: 2rem; margin-bottom: 0.5rem;">📅</div>
              <p>No hay horarios configurados para este curso</p>
              ${State.currentRole === 'director' ? `
                <button class="btn btn-primary btn-sm" onclick="Router.navigate('/director/schedules')" style="margin-top: 1rem;">
                  Ir a Gestión de Horarios
                </button>
              ` : ''}
            </div>
          `}
        </div>
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
            Nivel educativo del curso (ej: Pre-Kinder, 1° Básico, 8° Básico, 4° Medio)
          </small>
        </div>
        <div class="form-group">
          <label class="form-label">Profesores</label>
          ${allTeachers.length > 0 ? `
            <select id="course-teachers" class="form-select" multiple style="min-height: 100px;">
              ${allTeachers.map(t => `<option value="${t.id}" ${currentTeacherIds.includes(t.id) ? 'selected' : ''}>${Components.escapeHtml(t.full_name)}</option>`).join('')}
            </select>
            <small style="color: var(--color-gray-500); display: block; margin-top: 0.25rem;">
              Mantén Ctrl/Cmd para seleccionar múltiples profesores
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
      if (pageTitle) pageTitle.textContent = `Curso: ${name}`;
      render();
    } catch (error) {
      Components.showToast(error.message || 'Error al guardar curso', 'error');
    }
  };

  // Delete course
  Views.directorCourseDetail.confirmDelete = function() {
    const studentsCount = students.length;
    const schedulesCount = schedules.length;

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

  // Initial render
  render();
};
