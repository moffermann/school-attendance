// Director Students Management
Views.directorStudents = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Alumnos y Cursos';

  const courses = State.getCourses();
  let filteredStudents = State.getStudents();
  let searchTerm = '';
  let selectedCourse = '';

  function renderStudents() {
    content.innerHTML = `
      <div class="filters" style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; margin-bottom: 1.5rem;">
        <div class="filter-group" style="flex: 1; min-width: 200px;">
          <label class="form-label">Buscar alumno</label>
          <input type="text" id="search-student" class="form-input" placeholder="Nombre..." value="${searchTerm}">
        </div>

        <div class="filter-group" style="flex: 1; min-width: 150px;">
          <label class="form-label">Curso</label>
          <select id="filter-course" class="form-select">
            <option value="">Todos</option>
            ${courses.map(c => `<option value="${c.id}" ${selectedCourse == c.id ? 'selected' : ''}>${Components.escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>

        <div class="filter-group" style="display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary" onclick="Views.directorStudents.applyFilters()">Filtrar</button>
          <button class="btn btn-primary" onclick="Views.directorStudents.showCreateForm()">+ Nuevo Alumno</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <span>Lista de Alumnos (${filteredStudents.length})</span>
        </div>
        <div class="card-body">
          ${filteredStudents.length === 0 ? Components.createEmptyState(
            'Sin alumnos',
            searchTerm || selectedCourse
              ? 'No hay alumnos que coincidan con los filtros seleccionados'
              : 'No hay alumnos registrados en el sistema'
          ) : `
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Curso</th>
                <th>Asistencia</th>
                <th>Foto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${filteredStudents.map(student => {
                const course = State.getCourse(student.course_id);
                const photoChip = student.photo_pref_opt_in
                  ? Components.createChip('Sí', 'success')
                  : Components.createChip('No', 'gray');
                const stats = State.getStudentAttendanceStats(student.id);
                const attendanceChip = stats.percentage >= 90
                  ? Components.createChip(stats.percentage + '%', 'success')
                  : stats.percentage >= 75
                    ? Components.createChip(stats.percentage + '%', 'warning')
                    : Components.createChip(stats.percentage + '%', 'error');

                return `
                  <tr>
                    <td><strong>${Components.escapeHtml(student.full_name)}</strong></td>
                    <td>${course ? Components.escapeHtml(course.name) : '-'}</td>
                    <td>${attendanceChip}</td>
                    <td>${photoChip}</td>
                    <td style="white-space: nowrap;">
                      <button class="btn btn-secondary btn-sm" onclick="Views.directorStudents.viewProfile(${student.id})" title="Ver perfil">
                        👁️
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="Views.directorStudents.viewAttendance(${student.id})" title="Ver asistencia">
                        📊
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="Views.directorStudents.showEditForm(${student.id})" title="Editar">
                        ✏️
                      </button>
                      <button class="btn btn-error btn-sm" onclick="Views.directorStudents.confirmDelete(${student.id})" title="Eliminar">
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

  Views.directorStudents.applyFilters = function() {
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

    renderStudents();
  };

  Views.directorStudents.showCreateForm = function() {
    const coursesOptions = courses.map(c =>
      `<option value="${c.id}">${Components.escapeHtml(c.name)} - ${Components.escapeHtml(c.grade)}</option>`
    ).join('');

    Components.showModal('Nuevo Alumno', `
      <form id="student-form">
        <div class="form-group">
          <label class="form-label">Nombre Completo *</label>
          <input type="text" id="student-name" class="form-input" required placeholder="Ej: Juan Pérez García">
        </div>
        <div class="form-group">
          <label class="form-label">Curso *</label>
          <select id="student-course" class="form-select" required>
            <option value="">Seleccione un curso</option>
            ${coursesOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">RUT (opcional)</label>
          <input type="text" id="student-rut" class="form-input" placeholder="Ej: 12.345.678-9">
        </div>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" id="student-photo">
            <span>Autorizar captura de fotos</span>
          </label>
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorStudents.saveStudent() }
    ]);
  };

  Views.directorStudents.saveStudent = function(studentId = null) {
    const name = document.getElementById('student-name').value.trim();
    const courseId = parseInt(document.getElementById('student-course').value);
    const rut = document.getElementById('student-rut')?.value.trim() || '';
    const photoOptIn = document.getElementById('student-photo').checked;

    if (!name || !courseId) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    const studentData = {
      full_name: name,
      course_id: courseId,
      rut: rut,
      photo_pref_opt_in: photoOptIn
    };

    if (studentId) {
      State.updateStudent(studentId, studentData);
      Components.showToast('Alumno actualizado correctamente', 'success');
    } else {
      State.addStudent(studentData);
      Components.showToast('Alumno creado correctamente', 'success');
    }

    document.querySelector('.modal-container').click(); // Close modal
    filteredStudents = State.getStudents();
    renderStudents();
  };

  Views.directorStudents.showEditForm = function(studentId) {
    const student = State.getStudent(studentId);
    if (!student) return;

    const coursesOptions = courses.map(c =>
      `<option value="${c.id}" ${c.id === student.course_id ? 'selected' : ''}>${Components.escapeHtml(c.name)} - ${Components.escapeHtml(c.grade)}</option>`
    ).join('');

    Components.showModal('Editar Alumno', `
      <form id="student-form">
        <div class="form-group">
          <label class="form-label">Nombre Completo *</label>
          <input type="text" id="student-name" class="form-input" required value="${Components.escapeHtml(student.full_name)}">
        </div>
        <div class="form-group">
          <label class="form-label">Curso *</label>
          <select id="student-course" class="form-select" required>
            ${coursesOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">RUT</label>
          <input type="text" id="student-rut" class="form-input" value="${Components.escapeHtml(student.rut || '')}">
        </div>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" id="student-photo" ${student.photo_pref_opt_in ? 'checked' : ''}>
            <span>Autorizar captura de fotos</span>
          </label>
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorStudents.saveStudent(studentId) }
    ]);
  };

  Views.directorStudents.confirmDelete = function(studentId) {
    const student = State.getStudent(studentId);
    if (!student) return;

    Components.showModal('Confirmar Eliminación', `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">¿Está seguro de eliminar al alumno?</p>
        <p style="font-weight: 600; color: var(--color-error);">${Components.escapeHtml(student.full_name)}</p>
        <p style="font-size: 0.9rem; color: var(--color-gray-500); margin-top: 1rem;">
          Esta acción eliminará también todos los registros de asistencia del alumno.
        </p>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Eliminar', action: 'delete', className: 'btn-error', onClick: () => {
        State.deleteStudent(studentId);
        document.querySelector('.modal-container').click();
        Components.showToast('Alumno eliminado', 'success');
        filteredStudents = State.getStudents();
        renderStudents();
      }}
    ]);
  };

  Views.directorStudents.viewProfile = function(studentId) {
    const student = State.getStudent(studentId);
    const course = State.getCourse(student.course_id);
    const guardians = State.getGuardians().filter(g => g.student_ids.includes(studentId));
    const stats = State.getStudentAttendanceStats(studentId);

    const guardiansHTML = guardians.map(g => `
      <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--color-gray-100);">
        <strong>${Components.escapeHtml(g.full_name)}</strong><br>
        <span style="font-size: 0.85rem; color: var(--color-gray-500);">
          ${g.contacts.map(c => `${c.type}: ${c.value} ${c.verified ? '✅' : '⏳'}`).join(' | ')}
        </span>
      </li>
    `).join('');

    Components.showModal(`Perfil - ${student.full_name}`, `
      <div class="card mb-2">
        <div class="card-header">Información Básica</div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
            <div><strong>Nombre:</strong><br>${Components.escapeHtml(student.full_name)}</div>
            <div><strong>Curso:</strong><br>${course ? Components.escapeHtml(course.name + ' - ' + course.grade) : '-'}</div>
            <div><strong>RUT:</strong><br>${student.rut || 'No registrado'}</div>
            <div><strong>ID:</strong><br>${student.id}</div>
          </div>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-header">Estadísticas de Asistencia</div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
            <div style="background: var(--color-success-light); padding: 1rem; border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-success);">${stats.percentage}%</div>
              <div style="font-size: 0.8rem; color: var(--color-gray-600);">Asistencia</div>
            </div>
            <div style="background: var(--color-primary-light); padding: 1rem; border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-primary);">${stats.daysPresent}</div>
              <div style="font-size: 0.8rem; color: var(--color-gray-600);">Días Presente</div>
            </div>
            <div style="background: var(--color-warning-light); padding: 1rem; border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-warning);">${stats.lateArrivals}</div>
              <div style="font-size: 0.8rem; color: var(--color-gray-600);">Atrasos</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Apoderados Vinculados</div>
        <div class="card-body">
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${guardiansHTML || '<li style="color: var(--color-gray-500);">Sin apoderados registrados</li>'}
          </ul>
        </div>
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' },
      { label: 'Enrolar NFC', action: 'nfc', className: 'btn-secondary', onClick: () => {
        document.querySelector('.modal-container').click();
        if (typeof NFCEnrollment !== 'undefined') {
          NFCEnrollment.showStudentEnrollmentModal(studentId);
        } else {
          Components.showToast('Servicio NFC no disponible', 'error');
        }
      }},
      { label: 'Ver Asistencia', action: 'attendance', className: 'btn-primary', onClick: () => {
        document.querySelector('.modal-container').click();
        Views.directorStudents.viewAttendance(studentId);
      }}
    ]);
  };

  Views.directorStudents.viewAttendance = function(studentId) {
    const student = State.getStudent(studentId);
    if (!student) return;

    const course = State.getCourse(student.course_id);
    const stats = State.getStudentAttendanceStats(studentId);
    const events = State.getAttendanceEvents({ studentId }).slice(0, 20);

    const eventsHTML = events.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Tipo</th>
            <th>Fuente</th>
          </tr>
        </thead>
        <tbody>
          ${events.map(e => `
            <tr>
              <td>${Components.formatDate(e.ts)}</td>
              <td>${Components.formatTime(e.ts)}</td>
              <td>${e.type === 'IN' ? Components.createChip('Entrada', 'success') : Components.createChip('Salida', 'info')}</td>
              <td>${Components.createChip(e.source || 'QR', 'gray')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p style="color: var(--color-gray-500); text-align: center;">Sin registros de asistencia</p>';

    Components.showModal(`Asistencia - ${student.full_name}`, `
      <div style="margin-bottom: 1rem; padding: 1rem; background: var(--color-gray-50); border-radius: 8px;">
        <strong>${Components.escapeHtml(student.full_name)}</strong>
        <span style="color: var(--color-gray-500);">${course ? ' - ' + Components.escapeHtml(course.name) : ''}</span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 1.5rem;">
        <div style="text-align: center; padding: 0.75rem; background: ${stats.percentage >= 90 ? 'var(--color-success-light)' : stats.percentage >= 75 ? 'var(--color-warning-light)' : 'var(--color-error-light)'}; border-radius: 8px;">
          <div style="font-size: 1.25rem; font-weight: 700;">${stats.percentage}%</div>
          <div style="font-size: 0.7rem;">Asistencia</div>
        </div>
        <div style="text-align: center; padding: 0.75rem; background: var(--color-gray-100); border-radius: 8px;">
          <div style="font-size: 1.25rem; font-weight: 700;">${stats.daysPresent}</div>
          <div style="font-size: 0.7rem;">Presente</div>
        </div>
        <div style="text-align: center; padding: 0.75rem; background: var(--color-gray-100); border-radius: 8px;">
          <div style="font-size: 1.25rem; font-weight: 700;">${stats.totalSchoolDays - stats.daysPresent}</div>
          <div style="font-size: 0.7rem;">Ausente</div>
        </div>
        <div style="text-align: center; padding: 0.75rem; background: var(--color-gray-100); border-radius: 8px;">
          <div style="font-size: 1.25rem; font-weight: 700;">${stats.lateArrivals}</div>
          <div style="font-size: 0.7rem;">Atrasos</div>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <span>Registrar Asistencia Manual</span>
        </div>
        <div class="card-body">
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-success" onclick="Views.directorStudents.registerAttendance(${studentId}, 'IN')">
              ✓ Registrar Entrada
            </button>
            <button class="btn btn-secondary" onclick="Views.directorStudents.registerAttendance(${studentId}, 'OUT')">
              ↩ Registrar Salida
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Últimos 20 Registros</div>
        <div class="card-body" style="max-height: 300px; overflow-y: auto;">
          ${eventsHTML}
        </div>
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);
  };

  Views.directorStudents.registerAttendance = function(studentId, type) {
    State.addAttendanceEvent({
      student_id: studentId,
      type: type,
      source: 'MANUAL'
    });
    Components.showToast(`${type === 'IN' ? 'Entrada' : 'Salida'} registrada correctamente`, 'success');
    // Refresh the modal
    document.querySelector('.modal-container').click();
    Views.directorStudents.viewAttendance(studentId);
  };

  renderStudents();
};
