// Director Teachers Management
Views.directorTeachers = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Gestión de Profesores';

  const courses = State.getCourses();
  let teachers = State.getTeachers();

  function renderTeachers() {
    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="margin: 0; font-size: 1.25rem; color: var(--color-gray-900);">Profesores del Establecimiento</h2>
          <p style="margin: 0.25rem 0 0 0; color: var(--color-gray-500); font-size: 0.9rem;">${teachers.length} profesor${teachers.length !== 1 ? 'es' : ''} registrado${teachers.length !== 1 ? 's' : ''}</p>
        </div>
        <button class="btn btn-primary" onclick="Views.directorTeachers.showCreateForm()">
          + Nuevo Profesor
        </button>
      </div>

      <div class="card">
        <div class="card-header">Lista de Profesores</div>
        <div class="card-body">
          ${teachers.length === 0 ? Components.createEmptyState(
            'Sin profesores',
            'No hay profesores registrados en el sistema. Haga clic en "Nuevo Profesor" para agregar uno.'
          ) : `
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Cursos Asignados</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${teachers.map(teacher => {
                // Get courses assigned to this teacher
                const teacherCourses = courses.filter(c =>
                  (c.teacher_ids && c.teacher_ids.includes(teacher.id)) ||
                  c.teacher_id === teacher.id
                );

                const coursesChips = teacherCourses.length > 0
                  ? teacherCourses.map(c => Components.createChip(c.name, 'info')).join(' ')
                  : Components.createChip('Sin cursos', 'gray');

                const statusChip = teacher.active !== false
                  ? Components.createChip('Activo', 'success')
                  : Components.createChip('Inactivo', 'gray');

                return `
                  <tr>
                    <td><strong>${Components.escapeHtml(teacher.full_name)}</strong></td>
                    <td>${Components.escapeHtml(teacher.email || '-')}</td>
                    <td>${coursesChips}</td>
                    <td>${statusChip}</td>
                    <td style="white-space: nowrap;">
                      <button class="btn btn-secondary btn-sm" onclick="Views.directorTeachers.viewProfile(${teacher.id})" title="Ver perfil">
                        👁️
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="Views.directorTeachers.showEditForm(${teacher.id})" title="Editar">
                        ✏️
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="Views.directorTeachers.assignCourses(${teacher.id})" title="Asignar cursos">
                        📚
                      </button>
                      <button class="btn btn-error btn-sm" onclick="Views.directorTeachers.confirmDelete(${teacher.id})" title="Eliminar">
                        🗑️
                      </button>
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

  Views.directorTeachers.showCreateForm = function() {
    Components.showModal('Nuevo Profesor', `
      <form id="teacher-form">
        <div class="form-group">
          <label class="form-label">Nombre Completo *</label>
          <input type="text" id="teacher-name" class="form-input" required placeholder="Ej: María González López">
        </div>
        <div class="form-group">
          <label class="form-label">Email *</label>
          <input type="email" id="teacher-email" class="form-input" required placeholder="profesor@colegio.cl">
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="tel" id="teacher-phone" class="form-input" placeholder="+56 9 1234 5678">
        </div>
        <div class="form-group">
          <label class="form-label">Especialidad</label>
          <input type="text" id="teacher-specialty" class="form-input" placeholder="Ej: Matemáticas, Lenguaje">
        </div>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" id="teacher-active" checked>
            <span>Profesor activo</span>
          </label>
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorTeachers.saveTeacher() }
    ]);
  };

  Views.directorTeachers.saveTeacher = function(teacherId = null) {
    const name = document.getElementById('teacher-name').value.trim();
    const email = document.getElementById('teacher-email').value.trim();
    const phone = document.getElementById('teacher-phone')?.value.trim() || '';
    const specialty = document.getElementById('teacher-specialty')?.value.trim() || '';
    const active = document.getElementById('teacher-active').checked;

    if (!name || !email) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    const teacherData = {
      full_name: name,
      email: email,
      phone: phone,
      specialty: specialty,
      active: active
    };

    if (teacherId) {
      State.updateTeacher(teacherId, teacherData);
      Components.showToast('Profesor actualizado correctamente', 'success');
    } else {
      State.addTeacher(teacherData);
      Components.showToast('Profesor creado correctamente', 'success');
    }

    document.querySelector('.modal-container').click();
    teachers = State.getTeachers();
    renderTeachers();
  };

  Views.directorTeachers.showEditForm = function(teacherId) {
    const teacher = State.getTeacher(teacherId);
    if (!teacher) return;

    Components.showModal('Editar Profesor', `
      <form id="teacher-form">
        <div class="form-group">
          <label class="form-label">Nombre Completo *</label>
          <input type="text" id="teacher-name" class="form-input" required value="${Components.escapeHtml(teacher.full_name)}">
        </div>
        <div class="form-group">
          <label class="form-label">Email *</label>
          <input type="email" id="teacher-email" class="form-input" required value="${Components.escapeHtml(teacher.email || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="tel" id="teacher-phone" class="form-input" value="${Components.escapeHtml(teacher.phone || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Especialidad</label>
          <input type="text" id="teacher-specialty" class="form-input" value="${Components.escapeHtml(teacher.specialty || '')}">
        </div>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" id="teacher-active" ${teacher.active !== false ? 'checked' : ''}>
            <span>Profesor activo</span>
          </label>
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorTeachers.saveTeacher(teacherId) }
    ]);
  };

  Views.directorTeachers.assignCourses = function(teacherId) {
    const teacher = State.getTeacher(teacherId);
    if (!teacher) return;

    // Get currently assigned courses
    const assignedCourseIds = courses
      .filter(c => (c.teacher_ids && c.teacher_ids.includes(teacherId)) || c.teacher_id === teacherId)
      .map(c => c.id);

    const coursesCheckboxes = courses.map(c => `
      <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem; border: 1px solid var(--color-gray-200); border-radius: 8px; cursor: pointer; margin-bottom: 0.5rem;">
        <input type="checkbox" class="course-checkbox" value="${c.id}" ${assignedCourseIds.includes(c.id) ? 'checked' : ''}>
        <div>
          <strong>${Components.escapeHtml(c.name)}</strong>
          <div style="font-size: 0.85rem; color: var(--color-gray-500);">${Components.escapeHtml(c.grade || '')}</div>
        </div>
      </label>
    `).join('');

    Components.showModal(`Asignar Cursos - ${teacher.full_name}`, `
      <p style="margin-bottom: 1rem; color: var(--color-gray-600);">
        Seleccione los cursos que serán asignados a este profesor:
      </p>
      <div style="max-height: 300px; overflow-y: auto;">
        ${coursesCheckboxes || '<p style="color: var(--color-gray-500);">No hay cursos disponibles</p>'}
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => {
        const selectedCourseIds = Array.from(document.querySelectorAll('.course-checkbox:checked'))
          .map(cb => parseInt(cb.value));

        // Update each course's teacher_ids
        courses.forEach(course => {
          if (!course.teacher_ids) course.teacher_ids = [];

          if (selectedCourseIds.includes(course.id)) {
            // Add teacher to course if not already assigned
            if (!course.teacher_ids.includes(teacherId)) {
              course.teacher_ids.push(teacherId);
            }
          } else {
            // Remove teacher from course
            course.teacher_ids = course.teacher_ids.filter(id => id !== teacherId);
          }

          // Also update legacy teacher_id field
          if (selectedCourseIds.includes(course.id) && !course.teacher_id) {
            course.teacher_id = teacherId;
          }
        });

        State.persist();
        document.querySelector('.modal-container').click();
        Components.showToast('Cursos actualizados correctamente', 'success');
        renderTeachers();
      }}
    ]);
  };

  Views.directorTeachers.viewProfile = function(teacherId) {
    const teacher = State.getTeacher(teacherId);
    if (!teacher) return;

    // Get courses assigned to this teacher
    const teacherCourses = courses.filter(c =>
      (c.teacher_ids && c.teacher_ids.includes(teacherId)) ||
      c.teacher_id === teacherId
    );

    const coursesHTML = teacherCourses.length > 0
      ? teacherCourses.map(c => `
          <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--color-gray-100);">
            <strong>${Components.escapeHtml(c.name)}</strong>
            <span style="color: var(--color-gray-500);"> - ${Components.escapeHtml(c.grade || '')}</span>
          </li>
        `).join('')
      : '<li style="color: var(--color-gray-500);">Sin cursos asignados</li>';

    Components.showModal(`Perfil - ${teacher.full_name}`, `
      <div class="card mb-2">
        <div class="card-header">Informacion del Profesor</div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
            <div><strong>Nombre:</strong><br>${Components.escapeHtml(teacher.full_name)}</div>
            <div><strong>Email:</strong><br>${teacher.email || 'No registrado'}</div>
            <div><strong>Telefono:</strong><br>${teacher.phone || 'No registrado'}</div>
            <div><strong>Especialidad:</strong><br>${teacher.specialty || 'No especificada'}</div>
            <div><strong>Estado:</strong><br>${teacher.active !== false ? Components.createChip('Activo', 'success') : Components.createChip('Inactivo', 'gray')}</div>
            <div><strong>ID:</strong><br>${teacher.id}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Cursos Asignados</div>
        <div class="card-body">
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${coursesHTML}
          </ul>
        </div>
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' },
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
    if (!teacher) return;

    Components.showModal('Confirmar Eliminación', `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">¿Está seguro de eliminar al profesor?</p>
        <p style="font-weight: 600; color: var(--color-error);">${Components.escapeHtml(teacher.full_name)}</p>
        <p style="font-size: 0.9rem; color: var(--color-gray-500); margin-top: 1rem;">
          El profesor será desvinculado de todos los cursos asignados.
        </p>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Eliminar', action: 'delete', className: 'btn-error', onClick: () => {
        State.deleteTeacher(teacherId);
        document.querySelector('.modal-container').click();
        Components.showToast('Profesor eliminado', 'success');
        teachers = State.getTeachers();
        renderTeachers();
      }}
    ]);
  };

  renderTeachers();
};
