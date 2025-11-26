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
      <div class="filters">
        <div class="filter-group">
          <label class="form-label">Buscar alumno</label>
          <input type="text" id="search-student" class="form-input" placeholder="Nombre..." value="${searchTerm}">
        </div>

        <div class="filter-group">
          <label class="form-label">Curso</label>
          <select id="filter-course" class="form-select">
            <option value="">Todos</option>
            ${courses.map(c => `<option value="${c.id}" ${selectedCourse == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>

        <div class="filter-group">
          <label class="form-label">&nbsp;</label>
          <button class="btn btn-primary" onclick="Views.directorStudents.applyFilters()">Filtrar</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Lista de Alumnos (${filteredStudents.length})</div>
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
                <th>Foto (Opt-in)</th>
                <th>Credenciales</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${filteredStudents.map(student => {
                const course = State.getCourse(student.course_id);
                const photoChip = student.photo_pref_opt_in
                  ? Components.createChip('Sí', 'success')
                  : Components.createChip('No', 'gray');

                return `
                  <tr>
                    <td>${Components.escapeHtml(student.full_name)}</td>
                    <td>${course ? Components.escapeHtml(course.name) : '-'}</td>
                    <td>${photoChip}</td>
                    <td>${Components.createChip('NFC/QR', 'info')}</td>
                    <td>
                      <button class="btn btn-secondary btn-sm" onclick="Views.directorStudents.viewProfile(${student.id})">
                        Ver Perfil
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
    Components.showToast('Filtros aplicados', 'success');
  };

  Views.directorStudents.viewProfile = function(studentId) {
    const student = State.getStudent(studentId);
    const course = State.getCourse(student.course_id);
    const guardians = State.getGuardians().filter(g => g.student_ids.includes(studentId));

    const guardiansHTML = guardians.map(g => `
      <li>
        <strong>${g.full_name}</strong><br>
        ${g.contacts.map(c => `${c.type}: ${c.value} ${c.verified ? '✓' : ''}`).join('<br>')}
      </li>
    `).join('');

    Components.showModal(`Perfil - ${student.full_name}`, `
      <div class="card mb-2">
        <div class="card-header">Información Básica</div>
        <div class="card-body">
          <p><strong>Nombre:</strong> ${student.full_name}</p>
          <p><strong>Curso:</strong> ${course.name} - ${course.grade}</p>
          <p><strong>ID:</strong> ${student.id}</p>
          <p><strong>Captura de Foto:</strong> ${student.photo_pref_opt_in ? 'Autorizada' : 'No autorizada'}</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Apoderados Vinculados</div>
        <div class="card-body">
          <ul style="list-style: none; padding: 0;">
            ${guardiansHTML || '<li>Sin apoderados registrados</li>'}
          </ul>
        </div>
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);
  };

  renderStudents();
};
