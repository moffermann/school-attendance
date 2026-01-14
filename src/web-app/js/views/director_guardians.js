// Director Guardians Management (CRUD Apoderados)
Views.directorGuardians = async function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Gestión de Apoderados';

  // Show loading state while fetching from API
  content.innerHTML = Components.createLoader('Cargando apoderados...');

  // Load fresh data from API (falls back to localStorage if not authenticated)
  let guardians = await State.refreshGuardians();
  const students = State.getStudents();
  let currentPage = 1;
  let searchTerm = '';

  function getFilteredGuardians() {
    if (!searchTerm) return guardians;
    const term = searchTerm.toLowerCase();
    return guardians.filter(g =>
      g.full_name.toLowerCase().includes(term) ||
      (g.contacts?.email && g.contacts.email.toLowerCase().includes(term)) ||
      (g.contacts?.phone && g.contacts.phone.includes(term))
    );
  }

  function renderGuardians() {
    const filtered = getFilteredGuardians();

    content.innerHTML = `
      <!-- Explicación de la vista -->
      <div class="card" style="background: var(--color-info-light); border-left: 4px solid var(--color-info); margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
          <span style="font-size: 1.5rem;">👨‍👩‍👧</span>
          <div>
            <strong style="color: var(--color-info-dark);">Gestión de Apoderados</strong>
            <p style="margin: 0.25rem 0 0; font-size: 0.9rem; color: var(--color-gray-700);">
              Aquí puedes crear, editar y asociar apoderados a los alumnos. Cada apoderado puede tener múltiples alumnos asociados y recibirá notificaciones de asistencia.
            </p>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="margin: 0; font-size: 1.25rem; color: var(--color-gray-900);">Apoderados del Establecimiento</h2>
          <p style="margin: 0.25rem 0 0 0; color: var(--color-gray-500); font-size: 0.9rem;">${guardians.length} apoderado${guardians.length !== 1 ? 's' : ''} registrado${guardians.length !== 1 ? 's' : ''}</p>
        </div>
        <button class="btn btn-primary" onclick="Views.directorGuardians.showCreateForm()">
          + Nuevo Apoderado
        </button>
      </div>

      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <span>Lista de Apoderados</span>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <input type="text" id="search-guardian" class="form-input" placeholder="Buscar por nombre, email..."
              style="width: 200px;" value="${Components.escapeHtml(searchTerm)}"
              onkeyup="Views.directorGuardians.search(this.value)">
          </div>
        </div>
        <div class="card-body">
          ${filtered.length === 0 ? Components.createEmptyState(
            'Sin apoderados',
            searchTerm
              ? 'No hay apoderados que coincidan con la búsqueda'
              : 'No hay apoderados registrados. Haga clic en "Nuevo Apoderado" para agregar uno.'
          ) : `
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Alumnos Asociados</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="guardians-tbody">
              ${renderTableRows(filtered)}
            </tbody>
          </table>
          <div id="guardians-pagination">
            ${renderPagination(filtered)}
          </div>
          `}
        </div>
      </div>
    `;
  }

  // Update only table content (for search without losing focus)
  function updateTableContent() {
    const filtered = getFilteredGuardians();
    const tbody = document.getElementById('guardians-tbody');
    const pagination = document.getElementById('guardians-pagination');
    const cardBody = document.querySelector('.card-body');

    if (filtered.length === 0) {
      // Show empty state
      cardBody.innerHTML = Components.createEmptyState(
        'Sin apoderados',
        searchTerm
          ? 'No hay apoderados que coincidan con la búsqueda'
          : 'No hay apoderados registrados. Haga clic en "Nuevo Apoderado" para agregar uno.'
      );
    } else if (tbody) {
      // Update existing table
      tbody.innerHTML = renderTableRows(filtered);
      if (pagination) {
        pagination.innerHTML = renderPagination(filtered);
      }
    } else {
      // Table doesn't exist, need to create it
      cardBody.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Alumnos Asociados</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="guardians-tbody">
            ${renderTableRows(filtered)}
          </tbody>
        </table>
        <div id="guardians-pagination">
          ${renderPagination(filtered)}
        </div>
      `;
    }
  }

  function renderTableRows(filtered) {
    const perPage = 15;
    const start = (currentPage - 1) * perPage;
    const paginated = filtered.slice(start, start + perPage);

    return paginated.map(guardian => {
      // Get associated students
      const associatedStudents = guardian.student_ids
        ? guardian.student_ids.map(id => students.find(s => s.id === id)).filter(Boolean)
        : [];

      const studentsChips = associatedStudents.length > 0
        ? associatedStudents.slice(0, 3).map(s => Components.createChip(s.full_name, 'info')).join(' ') +
          (associatedStudents.length > 3 ? ` <span style="color: var(--color-gray-500);">+${associatedStudents.length - 3} más</span>` : '')
        : Components.createChip('Sin alumnos', 'gray');

      return `
        <tr>
          <td><strong>${Components.escapeHtml(guardian.full_name)}</strong></td>
          <td>${Components.escapeHtml(guardian.contacts?.email || '-')}</td>
          <td>${Components.escapeHtml(guardian.contacts?.phone || '-')}</td>
          <td>${studentsChips}</td>
          <td style="white-space: nowrap;">
            <button class="btn btn-secondary btn-sm" onclick="Views.directorGuardians.viewProfile(${guardian.id})" title="Ver perfil">
              👁️
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Views.directorGuardians.showEditForm(${guardian.id})" title="Editar">
              ✏️
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Views.directorGuardians.manageStudents(${guardian.id})" title="Gestionar alumnos">
              👨‍👧
            </button>
            <button class="btn btn-error btn-sm" onclick="Views.directorGuardians.confirmDelete(${guardian.id})" title="Eliminar">
              🗑️
            </button>
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
          onclick="Views.directorGuardians.changePage(${currentPage - 1})">Anterior</button>
        <span style="margin: 0 1rem;">Página ${currentPage} de ${totalPages}</span>
        <button class="btn btn-secondary btn-sm" ${currentPage === totalPages ? 'disabled' : ''}
          onclick="Views.directorGuardians.changePage(${currentPage + 1})">Siguiente</button>
      </div>
    `;
  }

  // Public methods
  Views.directorGuardians.search = function(term) {
    searchTerm = term;
    currentPage = 1;
    updateTableContent();  // Only update table, keep input focused
  };

  Views.directorGuardians.changePage = function(page) {
    currentPage = page;
    updateTableContent();  // Only update table
  };

  Views.directorGuardians.showCreateForm = function() {
    Components.showModal('Nuevo Apoderado', `
      <form id="guardian-form">
        <div class="form-group">
          <label class="form-label">Nombre Completo *</label>
          <input type="text" id="guardian-name" class="form-input" required placeholder="Ej: María González López">
        </div>
        <div class="form-group">
          <label class="form-label">Email *</label>
          <input type="email" id="guardian-email" class="form-input" required placeholder="apoderado@email.com">
          <small style="color: var(--color-gray-500);">Se usará para enviar notificaciones por email</small>
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono WhatsApp</label>
          <input type="tel" id="guardian-phone" class="form-input" placeholder="+56 9 1234 5678">
          <small style="color: var(--color-gray-500);">Se usará para enviar notificaciones por WhatsApp</small>
        </div>
      </form>
      <div style="margin-top: 1rem; padding: 0.75rem; background: var(--color-warning-light); border-radius: 8px; font-size: 0.85rem;">
        <strong>💡 Nota:</strong> Después de crear el apoderado, podrá asociarlo a uno o más alumnos desde el botón "Gestionar alumnos" (👨‍👧).
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
          <label class="form-label">Teléfono WhatsApp</label>
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
      Components.showToast('Ingrese un email válido', 'error');
      return;
    }

    // Validate phone format (optional, if provided)
    if (phone && !/^\+?[0-9\s\-()]+$/.test(phone)) {
      Components.showToast('Formato de teléfono inválido', 'error');
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
              <button class="btn btn-secondary btn-sm" onclick="Router.navigate('/director/students?view=${s.id}')">Ver</button>
            </div>
          `;
        }).join('')
      : '<p style="color: var(--color-gray-500);">No hay alumnos asociados</p>';

    Components.showModal(`Perfil: ${guardian.full_name}`, `
      <div class="card" style="margin-bottom: 1rem;">
        <div class="card-header">Información de Contacto</div>
        <div class="card-body">
          <p><strong>Email:</strong> ${Components.escapeHtml(guardian.contacts?.email || 'No registrado')}</p>
          <p><strong>Teléfono:</strong> ${Components.escapeHtml(guardian.contacts?.phone || 'No registrado')}</p>
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
          Seleccione los alumnos que desea asociar a este apoderado. El apoderado recibirá notificaciones de asistencia de los alumnos seleccionados.
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
      ? `<p style="color: var(--color-warning); margin-top: 0.5rem;"><strong>⚠️ Advertencia:</strong> Este apoderado tiene ${studentCount} alumno${studentCount !== 1 ? 's' : ''} asociado${studentCount !== 1 ? 's' : ''}. Al eliminarlo, los alumnos quedarán sin este apoderado.</p>`
      : '';

    Components.showModal('Confirmar Eliminación', `
      <p>¿Está seguro que desea eliminar al apoderado <strong>${Components.escapeHtml(guardian.full_name)}</strong>?</p>
      ${warningMsg}
      <p style="color: var(--color-gray-500); margin-top: 0.5rem; font-size: 0.9rem;">Esta acción no se puede deshacer.</p>
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

  renderGuardians();
};
