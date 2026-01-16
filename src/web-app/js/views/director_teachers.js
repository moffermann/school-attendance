// Director Teachers Management (CRUD Profesores with API integration)
Views.directorTeachers = async function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Gestion de Profesores';

  // Show loading state while fetching from API
  content.innerHTML = Components.createLoader('Cargando profesores...');

  // Load fresh data from API
  let teachers = await State.refreshTeachers();
  const courses = State.getCourses();
  let searchTerm = '';
  let currentPage = 1;
  let statusFilter = ''; // Empty = all, or ACTIVE, INACTIVE, ON_LEAVE, DELETED
  let courseFilter = ''; // Empty = all, or course ID

  // Helper to get courses assigned to a teacher
  function getTeacherCourses(teacherId) {
    return courses.filter(c =>
      (c.teacher_ids && c.teacher_ids.includes(teacherId)) ||
      c.teacher_id === teacherId
    );
  }

  function getFilteredTeachers() {
    let filtered = teachers;

    // Filter by status if set
    if (statusFilter) {
      filtered = filtered.filter(t => (t.status || 'ACTIVE') === statusFilter);
    }

    // Filter by course if set
    if (courseFilter) {
      const courseId = parseInt(courseFilter);
      filtered = filtered.filter(t => {
        const teacherCourses = getTeacherCourses(t.id);
        return teacherCourses.some(c => c.id === courseId);
      });
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.full_name.toLowerCase().includes(term) ||
        (t.email && t.email.toLowerCase().includes(term))
      );
    }

    return filtered;
  }

  function renderTeachers() {
    const filtered = getFilteredTeachers();

    content.innerHTML = `
      <!-- Info card -->
      <div class="card" style="background: var(--color-info-light); border-left: 4px solid var(--color-info); margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
          <span style="font-size: 1.5rem;">👩‍🏫</span>
          <div>
            <strong style="color: var(--color-info-dark);">Gestion de Profesores</strong>
            <p style="margin: 0.25rem 0 0; font-size: 0.9rem; color: var(--color-gray-700);">
              Aqui puedes crear, editar y asignar cursos a los profesores. Cada profesor puede tener multiples cursos asignados.
            </p>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="margin: 0; font-size: 1.25rem; color: var(--color-gray-900);">Profesores del Establecimiento</h2>
          <p style="margin: 0.25rem 0 0 0; color: var(--color-gray-500); font-size: 0.9rem;">${teachers.length} profesor${teachers.length !== 1 ? 'es' : ''} registrado${teachers.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <!-- Filtros con estilo unificado -->
      <div class="filters" style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; margin-bottom: 1.5rem;">
        <div class="filter-group" style="flex: 1; min-width: 200px;">
          <label class="form-label">Buscar profesor</label>
          <input type="text" id="search-teacher" class="form-input" placeholder="Nombre, email..." value="${Components.escapeHtml(searchTerm)}"
            onkeyup="Views.directorTeachers.search(this.value)">
        </div>
        <div class="filter-group" style="flex: 1; min-width: 150px;">
          <label class="form-label">Curso</label>
          <select id="filter-course" class="form-select" onchange="Views.directorTeachers.filterByCourse(this.value)">
            <option value="">Todos los cursos</option>
            ${courses.map(c => `<option value="${c.id}" ${courseFilter === String(c.id) ? 'selected' : ''}>${Components.escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group" style="flex: 1; min-width: 120px;">
          <label class="form-label">Estado</label>
          <select id="filter-status" class="form-select" onchange="Views.directorTeachers.filterByStatus(this.value)">
            <option value="" ${!statusFilter ? 'selected' : ''}>Todos</option>
            <option value="ACTIVE" ${statusFilter === 'ACTIVE' ? 'selected' : ''}>Activos</option>
            <option value="INACTIVE" ${statusFilter === 'INACTIVE' ? 'selected' : ''}>Inactivos</option>
            <option value="ON_LEAVE" ${statusFilter === 'ON_LEAVE' ? 'selected' : ''}>Con licencia</option>
            <option value="DELETED" ${statusFilter === 'DELETED' ? 'selected' : ''}>Eliminados</option>
          </select>
        </div>
        <div class="filter-group" style="display: flex; gap: 0.5rem;">
          <button class="btn btn-outline" onclick="Views.directorTeachers.clearFilters()" title="Limpiar filtros">✕ Limpiar</button>
          <button class="btn btn-secondary" onclick="Views.directorTeachers.exportCSV()" title="Exportar a CSV">Exportar</button>
          <button class="btn btn-primary" onclick="Views.directorTeachers.showCreateForm()">+ Nuevo Profesor</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Lista de Profesores (${filtered.length})</div>
        <div class="card-body">
          ${filtered.length === 0 ? Components.createEmptyState(
            'Sin profesores',
            searchTerm
              ? 'No hay profesores que coincidan con la busqueda'
              : 'No hay profesores registrados. Haga clic en "Nuevo Profesor" para agregar uno.'
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
            <tbody id="teachers-tbody">
              ${renderTableRows(filtered)}
            </tbody>
          </table>
          <div id="teachers-pagination">
            ${renderPagination(filtered)}
          </div>
          `}
        </div>
      </div>
    `;
  }

  function updateTableContent() {
    const filtered = getFilteredTeachers();
    const tbody = document.getElementById('teachers-tbody');
    const pagination = document.getElementById('teachers-pagination');
    const cardBody = document.querySelector('.card-body');

    if (filtered.length === 0) {
      cardBody.innerHTML = Components.createEmptyState(
        'Sin profesores',
        searchTerm
          ? 'No hay profesores que coincidan con la busqueda'
          : 'No hay profesores registrados.'
      );
    } else if (tbody) {
      tbody.innerHTML = renderTableRows(filtered);
      if (pagination) {
        pagination.innerHTML = renderPagination(filtered);
      }
    } else {
      cardBody.innerHTML = `
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
          <tbody id="teachers-tbody">
            ${renderTableRows(filtered)}
          </tbody>
        </table>
        <div id="teachers-pagination">
          ${renderPagination(filtered)}
        </div>
      `;
    }
  }

  function renderTableRows(filtered) {
    const perPage = 15;
    const start = (currentPage - 1) * perPage;
    const paginated = filtered.slice(start, start + perPage);

    return paginated.map(teacher => {
      // Get courses assigned to this teacher using helper
      const teacherCourses = getTeacherCourses(teacher.id);

      const coursesChips = teacherCourses.length > 0
        ? teacherCourses.slice(0, 3).map(c => Components.createChip(c.name, 'info')).join(' ') +
          (teacherCourses.length > 3 ? ` <span style="color: var(--color-gray-500);">+${teacherCourses.length - 3} mas</span>` : '')
        : Components.createChip('Sin cursos', 'gray');

      const isDeleted = teacher.status === 'DELETED';
      const statusChip = teacher.status === 'ACTIVE'
        ? Components.createChip('Activo', 'success')
        : teacher.status === 'ON_LEAVE'
        ? Components.createChip('Con licencia', 'warning')
        : teacher.status === 'DELETED'
        ? Components.createChip('Eliminado', 'error')
        : Components.createChip('Inactivo', 'gray');

      // Actions: different buttons for deleted vs active teachers
      const actionButtons = isDeleted
        ? `
            <button class="btn btn-success btn-sm" onclick="Views.directorTeachers.confirmRestore(${teacher.id})" title="Restaurar">
              ↩ Restaurar
            </button>
          `
        : `
            <button class="btn btn-secondary btn-sm" onclick="Views.directorTeachers.viewProfile(${teacher.id})" title="Ver perfil">
              👁
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Views.directorTeachers.showEditForm(${teacher.id})" title="Editar">
              ✏
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Views.directorTeachers.assignCourses(${teacher.id})" title="Asignar cursos">
              📚
            </button>
            <button class="btn btn-error btn-sm" onclick="Views.directorTeachers.confirmDelete(${teacher.id})" title="Eliminar">
              🗑
            </button>
          `;

      return `
        <tr${isDeleted ? ' style="opacity: 0.7;"' : ''}>
          <td><strong>${Components.escapeHtml(teacher.full_name)}</strong></td>
          <td>${Components.escapeHtml(teacher.email || '-')}</td>
          <td>${coursesChips}</td>
          <td>${statusChip}</td>
          <td style="white-space: nowrap;">
            ${actionButtons}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderPagination(filtered) {
    const perPage = 15;
    const totalPages = Math.ceil(filtered.length / perPage);
    if (totalPages <= 1) return '';

    return `
      <div class="pagination" style="margin-top: 1rem;">
        <button class="btn btn-secondary btn-sm" ${currentPage === 1 ? 'disabled' : ''}
          onclick="Views.directorTeachers.changePage(${currentPage - 1})">Anterior</button>
        <span style="margin: 0 1rem;">Pagina ${currentPage} de ${totalPages}</span>
        <button class="btn btn-secondary btn-sm" ${currentPage === totalPages ? 'disabled' : ''}
          onclick="Views.directorTeachers.changePage(${currentPage + 1})">Siguiente</button>
      </div>
    `;
  }

  // Public methods
  Views.directorTeachers.search = function(term) {
    searchTerm = term;
    currentPage = 1;
    updateTableContent();
  };

  Views.directorTeachers.filterByCourse = function(course) {
    courseFilter = course;
    currentPage = 1;
    updateTableContent();
  };

  Views.directorTeachers.filterByStatus = async function(status) {
    statusFilter = status;
    currentPage = 1;
    // Reload teachers from API with filter
    teachers = await State.refreshTeachers({ status: status || undefined });
    renderTeachers();
  };

  Views.directorTeachers.clearFilters = async function() {
    // Reset all filters
    searchTerm = '';
    courseFilter = '';
    currentPage = 1;

    // If status filter was set, need to reload all teachers
    if (statusFilter) {
      statusFilter = '';
      teachers = await State.refreshTeachers();
      renderTeachers();
    } else {
      // Just re-render with cleared local filters
      renderTeachers();
    }
  };

  Views.directorTeachers.changePage = function(page) {
    currentPage = page;
    updateTableContent();
  };

  Views.directorTeachers.showCreateForm = function() {
    Components.showModal('Nuevo Profesor', `
      <form id="teacher-form">
        <div class="form-group">
          <label class="form-label">Nombre Completo *</label>
          <input type="text" id="teacher-name" class="form-input" required placeholder="Ej: Maria Gonzalez Lopez">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" id="teacher-email" class="form-input" placeholder="profesor@colegio.cl">
          <small style="color: var(--color-gray-500);">Opcional. Debe ser unico si se proporciona.</small>
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select id="teacher-status" class="form-input">
            <option value="ACTIVE" selected>Activo</option>
            <option value="ON_LEAVE">Con licencia</option>
            <option value="INACTIVE">Inactivo</option>
          </select>
        </div>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" id="teacher-biometric">
            <span>Puede enrolar biometrico</span>
          </label>
          <small style="color: var(--color-gray-500);">Permite al profesor registrar asistencia con huella/rostro.</small>
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorTeachers.saveTeacher() }
    ]);
  };

  Views.directorTeachers.showEditForm = function(teacherId) {
    const teacher = State.getTeacher(teacherId);
    if (!teacher) {
      Components.showToast('Profesor no encontrado', 'error');
      return;
    }

    Components.showModal('Editar Profesor', `
      <form id="teacher-form">
        <div class="form-group">
          <label class="form-label">Nombre Completo *</label>
          <input type="text" id="teacher-name" class="form-input" required value="${Components.escapeHtml(teacher.full_name)}">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" id="teacher-email" class="form-input" value="${Components.escapeHtml(teacher.email || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select id="teacher-status" class="form-input">
            <option value="ACTIVE" ${teacher.status === 'ACTIVE' ? 'selected' : ''}>Activo</option>
            <option value="ON_LEAVE" ${teacher.status === 'ON_LEAVE' ? 'selected' : ''}>Con licencia</option>
            <option value="INACTIVE" ${teacher.status === 'INACTIVE' ? 'selected' : ''}>Inactivo</option>
          </select>
        </div>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" id="teacher-biometric" ${teacher.can_enroll_biometric ? 'checked' : ''}>
            <span>Puede enrolar biometrico</span>
          </label>
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorTeachers.saveTeacher(teacherId) }
    ]);
  };

  Views.directorTeachers.saveTeacher = async function(teacherId = null) {
    const name = document.getElementById('teacher-name').value.trim();
    const email = document.getElementById('teacher-email').value.trim();
    const status = document.getElementById('teacher-status').value;
    const canEnrollBiometric = document.getElementById('teacher-biometric').checked;

    // Validation
    if (!name) {
      Components.showToast('El nombre es requerido', 'error');
      return;
    }

    if (name.length < 2) {
      Components.showToast('El nombre debe tener al menos 2 caracteres', 'error');
      return;
    }

    // Email validation if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        Components.showToast('Ingrese un email valido', 'error');
        return;
      }
    }

    const teacherData = {
      full_name: name,
      email: email || null,
      status: status,
      can_enroll_biometric: canEnrollBiometric
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

      if (teacherId) {
        await State.updateTeacher(teacherId, teacherData);
        Components.showToast('Profesor actualizado correctamente', 'success');
      } else {
        await State.addTeacher(teacherData);
        Components.showToast('Profesor creado correctamente', 'success');
      }

      // Close modal and refresh
      document.querySelector('.modal-container')?.click();
      teachers = State.getTeachers();
      renderTeachers();

    } catch (error) {
      Components.showToast(error.message || 'Error al guardar', 'error');
      console.error('Save teacher error:', error);

      // Re-enable button
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    }
  };

  Views.directorTeachers.assignCourses = function(teacherId) {
    const teacher = State.getTeacher(teacherId);
    if (!teacher) {
      Components.showToast('Profesor no encontrado', 'error');
      return;
    }

    // Get currently assigned courses using helper
    const assignedCourseIds = getTeacherCourses(teacherId).map(c => c.id);

    const coursesCheckboxes = courses.map(c => `
      <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem; border: 1px solid var(--color-gray-200); border-radius: 8px; cursor: pointer; margin-bottom: 0.5rem;">
        <input type="checkbox" class="course-checkbox" value="${c.id}" data-was-assigned="${assignedCourseIds.includes(c.id)}" ${assignedCourseIds.includes(c.id) ? 'checked' : ''}>
        <div>
          <strong>${Components.escapeHtml(c.name)}</strong>
          <div style="font-size: 0.85rem; color: var(--color-gray-500);">${Components.escapeHtml(c.grade || '')}</div>
        </div>
      </label>
    `).join('');

    Components.showModal(`Asignar Cursos - ${teacher.full_name}`, `
      <p style="margin-bottom: 1rem; color: var(--color-gray-600);">
        Seleccione los cursos que seran asignados a este profesor:
      </p>
      <div style="max-height: 300px; overflow-y: auto;">
        ${coursesCheckboxes || '<p style="color: var(--color-gray-500);">No hay cursos disponibles</p>'}
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorTeachers.saveCourseAssignments(teacherId) }
    ]);
  };

  Views.directorTeachers.saveCourseAssignments = async function(teacherId) {
    const checkboxes = document.querySelectorAll('.course-checkbox');

    // Get save button for loading state
    const saveBtn = document.querySelector('.modal .btn-primary');
    const originalText = saveBtn ? saveBtn.textContent : 'Guardar';

    try {
      // Disable button and show loading
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';
      }

      // Process each course
      for (const cb of checkboxes) {
        const courseId = parseInt(cb.value);
        const wasAssigned = cb.dataset.wasAssigned === 'true';
        const isNowAssigned = cb.checked;

        if (isNowAssigned && !wasAssigned) {
          // Assign course
          await State.assignCourseToTeacher(teacherId, courseId);
        } else if (!isNowAssigned && wasAssigned) {
          // Unassign course
          await State.unassignCourseFromTeacher(teacherId, courseId);
        }
      }

      Components.showToast('Cursos actualizados correctamente', 'success');

      // Close modal and refresh
      document.querySelector('.modal-container')?.click();
      teachers = State.getTeachers();
      renderTeachers();

    } catch (error) {
      Components.showToast(error.message || 'Error al actualizar cursos', 'error');
      console.error('Save course assignments error:', error);

      // Re-enable button
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    }
  };

  Views.directorTeachers.viewProfile = function(teacherId) {
    const teacher = State.getTeacher(teacherId);
    if (!teacher) {
      Components.showToast('Profesor no encontrado', 'error');
      return;
    }

    // Get courses assigned to this teacher using helper
    const teacherCourses = getTeacherCourses(teacherId);

    const coursesHTML = teacherCourses.length > 0
      ? teacherCourses.map(c => `
          <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--color-gray-100);">
            <strong>${Components.escapeHtml(c.name)}</strong>
            <span style="color: var(--color-gray-500);"> - ${Components.escapeHtml(c.grade || '')}</span>
          </li>
        `).join('')
      : '<li style="color: var(--color-gray-500);">Sin cursos asignados</li>';

    const statusChip = teacher.status === 'ACTIVE'
      ? Components.createChip('Activo', 'success')
      : teacher.status === 'ON_LEAVE'
      ? Components.createChip('Con licencia', 'warning')
      : Components.createChip('Inactivo', 'gray');

    const biometricChip = teacher.can_enroll_biometric
      ? Components.createChip('Si', 'success')
      : Components.createChip('No', 'gray');

    Components.showModal(`Perfil - ${teacher.full_name}`, `
      <div class="card mb-2">
        <div class="card-header">Informacion del Profesor</div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
            <div><strong>Nombre:</strong><br>${Components.escapeHtml(teacher.full_name)}</div>
            <div><strong>Email:</strong><br>${teacher.email || 'No registrado'}</div>
            <div><strong>Estado:</strong><br>${statusChip}</div>
            <div><strong>Biometrico:</strong><br>${biometricChip}</div>
            <div><strong>ID:</strong><br>${teacher.id}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Cursos Asignados (${teacherCourses.length})</div>
        <div class="card-body">
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${coursesHTML}
          </ul>
        </div>
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' },
      { label: 'Enrolar QR', action: 'qr', className: 'btn-secondary', onClick: () => {
        document.querySelector('.modal-container').click();
        if (typeof QREnrollment !== 'undefined') {
          QREnrollment.showTeacherEnrollmentModal(teacherId);
        } else {
          Components.showToast('Servicio QR no disponible', 'error');
        }
      }},
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
    if (!teacher) {
      Components.showToast('Profesor no encontrado', 'error');
      return;
    }

    // Count assigned courses using helper
    const assignedCourses = getTeacherCourses(teacherId);

    const warningMsg = assignedCourses.length > 0
      ? `<p style="color: var(--color-warning); margin-top: 0.5rem;"><strong>Advertencia:</strong> Este profesor tiene ${assignedCourses.length} curso${assignedCourses.length !== 1 ? 's' : ''} asignado${assignedCourses.length !== 1 ? 's' : ''}. Al eliminarlo, se desvinculara de todos los cursos.</p>`
      : '';

    Components.showModal('Confirmar Eliminacion', `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠</div>
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">¿Esta seguro de eliminar al profesor?</p>
        <p style="font-weight: 600; color: var(--color-error);">${Components.escapeHtml(teacher.full_name)}</p>
        ${warningMsg}
        <p style="font-size: 0.9rem; color: var(--color-gray-500); margin-top: 1rem;">
          Esta accion no se puede deshacer.
        </p>
      </div>
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

          await State.deleteTeacher(teacherId);
          Components.showToast('Profesor eliminado', 'success');

          // Close modal and refresh
          document.querySelector('.modal-container')?.click();
          teachers = State.getTeachers();
          renderTeachers();

        } catch (error) {
          Components.showToast(error.message || 'Error al eliminar', 'error');
          console.error('Delete teacher error:', error);

          // Re-enable button
          if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = originalText;
          }
        }
      }}
    ]);
  };

  Views.directorTeachers.confirmRestore = function(teacherId) {
    const teacher = State.getTeacher(teacherId);
    if (!teacher) {
      Components.showToast('Profesor no encontrado', 'error');
      return;
    }

    Components.showModal('Confirmar Restauracion', `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">↩</div>
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">¿Restaurar este profesor?</p>
        <p style="font-weight: 600; color: var(--color-success);">${Components.escapeHtml(teacher.full_name)}</p>
        <p style="font-size: 0.9rem; color: var(--color-gray-500); margin-top: 1rem;">
          El profesor volvera a estar activo en el sistema.
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

          await State.restoreTeacher(teacherId);
          Components.showToast('Profesor restaurado', 'success');

          document.querySelector('.modal-container')?.click();
          teachers = await State.refreshTeachers({ status: statusFilter || undefined });
          renderTeachers();

        } catch (error) {
          Components.showToast(error.message || 'Error al restaurar', 'error');
          console.error('Restore teacher error:', error);

          if (restoreBtn) {
            restoreBtn.disabled = false;
            restoreBtn.textContent = originalText;
          }
        }
      }}
    ]);
  };

  Views.directorTeachers.exportCSV = async function() {
    try {
      const blob = await State.exportTeachersCSV({ status: statusFilter || undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profesores_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Components.showToast('Exportacion completada', 'success');
    } catch (error) {
      Components.showToast(error.message || 'Error al exportar', 'error');
      console.error('Export teachers error:', error);
    }
  };

  renderTeachers();
};
