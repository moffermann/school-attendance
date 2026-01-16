// Director Absences Management (Enterprise Pattern with API integration)
Views.directorAbsences = async function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Solicitudes de Ausencia';

  // Show loading state while fetching from API
  content.innerHTML = Components.createLoader('Cargando solicitudes...');

  // State variables
  let absences = [];
  let activeTab = 'PENDING';
  let searchTerm = '';
  let startDateFilter = '';
  let endDateFilter = '';
  let typeFilter = '';
  let currentOffset = 0;
  const PAGE_SIZE = 50;
  let total = 0;
  let hasMore = false;
  let counts = { pending: 0, approved: 0, rejected: 0, total: 0 };
  let isLoading = false;
  let searchTimeout = null;
  let showCreateForm = false;

  // Load absences from API
  async function loadAbsences(append = false) {
    if (isLoading) return;
    isLoading = true;

    if (!append) {
      currentOffset = 0;
      absences = [];
    }

    try {
      const filters = {
        status: activeTab,
        type: typeFilter || undefined,
        start_date: startDateFilter || undefined,
        end_date: endDateFilter || undefined,
      };

      const response = await API.getAbsencesPaginated(filters, currentOffset, PAGE_SIZE);

      if (append) {
        absences = absences.concat(response.items || []);
      } else {
        absences = response.items || [];
      }

      total = response.total || 0;
      hasMore = response.has_more || false;
      // Merge counts with defaults to ensure all keys exist
      const responseCounts = response.counts || {};
      counts = {
        pending: responseCounts.pending || 0,
        approved: responseCounts.approved || 0,
        rejected: responseCounts.rejected || 0,
        total: (responseCounts.pending || 0) + (responseCounts.approved || 0) + (responseCounts.rejected || 0),
      };

      isLoading = false;
      renderAbsences();
    } catch (error) {
      console.error('Error loading absences:', error);
      Components.showToast('Error al cargar solicitudes: ' + error.message, 'error');
      isLoading = false;
      renderAbsences();
    }
  }

  // Load stats from API
  async function loadStats() {
    try {
      const stats = await API.getAbsenceStats();
      counts = {
        pending: stats.pending || 0,
        approved: stats.approved || 0,
        rejected: stats.rejected || 0,
        total: stats.total || 0,
      };
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  function renderCreateForm() {
    if (!showCreateForm) return '';

    const courses = State.getCourses() || [];
    const today = new Date().toISOString().split('T')[0];

    return `
      <div class="card" style="margin-bottom: 1.5rem; border: 2px solid var(--color-primary-light);">
        <div class="card-header" style="display: flex; align-items: center; gap: 0.75rem; background: var(--color-primary-light);">
          <span style="font-size: 1.25rem;">+</span>
          <span style="font-weight: 600;">Nueva Solicitud de Ausencia</span>
        </div>
        <div class="card-body">
          <form id="director-absence-form">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
              <!-- Curso filter -->
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Curso</label>
                <select id="create-course" class="form-select" onchange="Views.directorAbsences.filterStudentsByCourse(this.value)">
                  <option value="">Todos los cursos</option>
                  ${courses.map(c => `<option value="${c.id}">${Components.escapeHtml(c.name)}</option>`).join('')}
                </select>
              </div>

              <!-- Alumno -->
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Alumno *</label>
                <select id="create-student" class="form-select" required>
                  <option value="">Seleccione un alumno...</option>
                  ${renderStudentOptions('')}
                </select>
              </div>

              <!-- Tipo -->
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Tipo *</label>
                <select id="create-type" class="form-select" required>
                  <option value="MEDICAL">Medica</option>
                  <option value="FAMILY">Familiar</option>
                  <option value="VACATION">Vacaciones</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-top: 1rem;">
              <!-- Fecha Inicio -->
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Fecha Inicio *</label>
                <input type="date" id="create-start-date" class="form-input" required value="${today}">
              </div>

              <!-- Fecha Fin -->
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Fecha Fin *</label>
                <input type="date" id="create-end-date" class="form-input" required value="${today}">
              </div>
            </div>

            <div class="form-group" style="margin-top: 1rem;">
              <label class="form-label">Comentario o Motivo</label>
              <textarea id="create-comment" class="form-textarea" placeholder="Describa brevemente el motivo de la ausencia (opcional)" rows="2"></textarea>
            </div>

            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
              <button type="button" class="btn btn-primary" onclick="Views.directorAbsences.submitNewAbsence()">
                Crear Solicitud
              </button>
              <button type="button" class="btn btn-secondary" onclick="Views.directorAbsences.toggleCreateForm()">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function renderStudentOptions(courseId) {
    let students = State.getStudents() || [];
    if (courseId) {
      students = students.filter(s => s.course_id === parseInt(courseId));
    }
    // Sort by name
    students.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

    return students.map(s => {
      const course = State.getCourse(s.course_id);
      const courseLabel = course ? ` (${course.name})` : '';
      return `<option value="${s.id}">${Components.escapeHtml(s.full_name)}${courseLabel}</option>`;
    }).join('');
  }

  function renderAbsences() {
    const typeOptions = [
      { value: '', label: 'Todos los tipos' },
      { value: 'MEDICAL', label: 'Medica' },
      { value: 'FAMILY', label: 'Familiar' },
      { value: 'VACATION', label: 'Vacaciones' },
      { value: 'OTHER', label: 'Otro' },
    ];

    content.innerHTML = `
      <!-- Header with create button -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <div>
          <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700; color: var(--color-gray-900);">Solicitudes de Ausencia</h2>
          <p style="margin: 0.25rem 0 0; color: var(--color-gray-500);">Gestione las solicitudes de ausencia de los alumnos</p>
        </div>
        <button class="btn ${showCreateForm ? 'btn-secondary' : 'btn-primary'}" onclick="Views.directorAbsences.toggleCreateForm()">
          ${showCreateForm ? 'Cerrar Formulario' : '+ Nueva Solicitud'}
        </button>
      </div>

      <!-- Create form (collapsible) -->
      ${renderCreateForm()}

      <!-- Stats cards -->
      <div class="cards-grid" style="margin-bottom: 1.5rem;">
        ${Components.createStatCard('Pendientes', counts.pending, 'warning')}
        ${Components.createStatCard('Aprobadas', counts.approved, 'success')}
        ${Components.createStatCard('Rechazadas', counts.rejected, 'error')}
      </div>

      <!-- Filters -->
      <div class="filters" style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; margin-bottom: 1.5rem;">
        <div class="filter-group" style="flex: 1; min-width: 200px;">
          <label class="form-label">Buscar</label>
          <input type="text" id="search-absence" class="form-input" placeholder="Nombre alumno, comentario..."
            value="${Components.escapeHtml(searchTerm)}"
            onkeyup="Views.directorAbsences.search(this.value)">
        </div>
        <div class="filter-group" style="flex: 1; min-width: 140px;">
          <label class="form-label">Tipo</label>
          <select id="filter-type" class="form-select" onchange="Views.directorAbsences.filterByType(this.value)">
            ${typeOptions.map(o => `<option value="${o.value}" ${typeFilter === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group" style="flex: 1; min-width: 140px;">
          <label class="form-label">Desde</label>
          <input type="date" id="filter-start-date" class="form-input" value="${startDateFilter}"
            onchange="Views.directorAbsences.filterByStartDate(this.value)">
        </div>
        <div class="filter-group" style="flex: 1; min-width: 140px;">
          <label class="form-label">Hasta</label>
          <input type="date" id="filter-end-date" class="form-input" value="${endDateFilter}"
            onchange="Views.directorAbsences.filterByEndDate(this.value)">
        </div>
        <div class="filter-group" style="display: flex; gap: 0.5rem;">
          <button class="btn btn-outline" onclick="Views.directorAbsences.clearFilters()" title="Limpiar filtros">✕ Limpiar</button>
          <button class="btn btn-secondary" onclick="Views.directorAbsences.exportCSV()" title="Exportar a CSV">Exportar</button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="card">
        <div class="card-header" style="padding: 0;">
          <div style="display: flex; gap: 0; border-bottom: 1px solid var(--color-gray-200);">
            <button class="btn ${activeTab === 'PENDING' ? 'btn-primary' : 'btn-secondary'}"
              style="border-radius: 0; border: none; border-bottom: 2px solid ${activeTab === 'PENDING' ? 'var(--color-primary)' : 'transparent'}; flex: 1;"
              onclick="Views.directorAbsences.switchTab('PENDING')">
              Pendientes (${counts.pending})
            </button>
            <button class="btn ${activeTab === 'APPROVED' ? 'btn-primary' : 'btn-secondary'}"
              style="border-radius: 0; border: none; border-bottom: 2px solid ${activeTab === 'APPROVED' ? 'var(--color-primary)' : 'transparent'}; flex: 1;"
              onclick="Views.directorAbsences.switchTab('APPROVED')">
              Aprobadas (${counts.approved})
            </button>
            <button class="btn ${activeTab === 'REJECTED' ? 'btn-primary' : 'btn-secondary'}"
              style="border-radius: 0; border: none; border-bottom: 2px solid ${activeTab === 'REJECTED' ? 'var(--color-primary)' : 'transparent'}; flex: 1;"
              onclick="Views.directorAbsences.switchTab('REJECTED')">
              Rechazadas (${counts.rejected})
            </button>
          </div>
        </div>

        <div class="card-body" id="absences-list">
          ${renderAbsencesList()}
        </div>

        ${hasMore ? `
          <div class="card-footer" style="text-align: center; padding: 1rem;">
            <button class="btn btn-secondary" onclick="Views.directorAbsences.loadMore()" ${isLoading ? 'disabled' : ''}>
              ${isLoading ? 'Cargando...' : 'Cargar mas'}
            </button>
            <span style="margin-left: 1rem; color: var(--color-gray-500);">
              Mostrando ${absences.length} de ${total}
            </span>
          </div>
        ` : (absences.length > 0 ? `
          <div class="card-footer" style="text-align: center; padding: 0.5rem; color: var(--color-gray-500);">
            Mostrando ${absences.length} de ${total} solicitudes
          </div>
        ` : '')}
      </div>
    `;
  }

  function renderAbsencesList() {
    if (isLoading && absences.length === 0) {
      return `
        <div style="text-align: center; padding: 2rem;">
          <div class="spinner"></div>
          <p style="margin-top: 1rem; color: var(--color-gray-500);">Cargando...</p>
        </div>
      `;
    }

    if (absences.length === 0) {
      const messages = {
        PENDING: 'No hay solicitudes pendientes',
        APPROVED: 'No hay solicitudes aprobadas',
        REJECTED: 'No hay solicitudes rechazadas',
      };
      return Components.createEmptyState('Sin solicitudes', messages[activeTab] || 'No hay solicitudes');
    }

    return `
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Curso</th>
              <th>Tipo</th>
              <th>Fechas</th>
              <th>Dias</th>
              <th>Comentario</th>
              ${activeTab === 'REJECTED' ? '<th>Razon Rechazo</th>' : ''}
              <th>Fecha Solicitud</th>
              ${activeTab === 'PENDING' ? '<th>Acciones</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${absences.map(absence => renderAbsenceRow(absence)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderAbsenceRow(absence) {
    const typeLabels = {
      'MEDICAL': { label: 'Médica', color: 'warning' },
      'FAMILY': { label: 'Familiar', color: 'info' },
      'VACATION': { label: 'Vacaciones', color: 'success' },
      'OTHER': { label: 'Otro', color: 'gray' },
    };
    const typeInfo = typeLabels[absence.type] || { label: absence.type || 'Otro', color: 'gray' };
    const typeChip = Components.createChip(typeInfo.label, typeInfo.color);

    const startDate = absence.start_date || absence.start;
    const endDate = absence.end_date || absence.end;
    const days = startDate && endDate
      ? Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1
      : 0;

    const submittedDate = absence.ts_submitted
      ? Components.formatDate(absence.ts_submitted)
      : '-';

    const studentName = absence.student_name || (State.getStudent(absence.student_id)?.full_name) || 'Alumno #' + absence.student_id;
    const courseName = absence.course_name || '-';

    return `
      <tr>
        <td><strong>${Components.escapeHtml(studentName)}</strong></td>
        <td>${Components.escapeHtml(courseName)}</td>
        <td>${typeChip}</td>
        <td>${Components.formatDate(startDate)} - ${Components.formatDate(endDate)}</td>
        <td>${days} dia${days !== 1 ? 's' : ''}</td>
        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${Components.escapeHtml(absence.comment || '')}">
          ${Components.escapeHtml(absence.comment) || '-'}
        </td>
        ${activeTab === 'REJECTED' ? `
          <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${Components.escapeHtml(absence.rejection_reason || '')}">
            ${Components.escapeHtml(absence.rejection_reason) || '-'}
          </td>
        ` : ''}
        <td>${submittedDate}</td>
        ${activeTab === 'PENDING' ? `
          <td style="white-space: nowrap;">
            <button class="btn btn-success btn-sm" onclick="Views.directorAbsences.approve(${absence.id})" title="Aprobar">
              ✓ Aprobar
            </button>
            <button class="btn btn-sm" style="background-color: #f59e0b; color: white; border: none;" onclick="Views.directorAbsences.showRejectModal(${absence.id})" title="Rechazar">
              ✕ Rechazar
            </button>
            <button class="btn btn-error btn-sm" onclick="Views.directorAbsences.confirmDelete(${absence.id})" title="Eliminar">
              🗑
            </button>
          </td>
        ` : ''}
      </tr>
    `;
  }

  // Public methods
  Views.directorAbsences.switchTab = async function(tab) {
    activeTab = tab;
    currentOffset = 0;
    await loadAbsences();
  };

  Views.directorAbsences.search = function(term) {
    searchTerm = term;
    // Debounce search
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      if (term.length >= 2) {
        try {
          const results = await API.searchAbsences(term, 50);
          absences = results.filter(a => a.status === activeTab);
          total = absences.length;
          hasMore = false;
          renderAbsences();
        } catch (error) {
          Components.showToast('Error en busqueda: ' + error.message, 'error');
        }
      } else if (term.length === 0) {
        await loadAbsences();
      }
    }, 300);
  };

  Views.directorAbsences.filterByType = async function(type) {
    typeFilter = type;
    await loadAbsences();
  };

  Views.directorAbsences.filterByStartDate = async function(date) {
    startDateFilter = date;
    await loadAbsences();
  };

  Views.directorAbsences.filterByEndDate = async function(date) {
    endDateFilter = date;
    await loadAbsences();
  };

  Views.directorAbsences.clearFilters = async function() {
    searchTerm = '';
    typeFilter = '';
    startDateFilter = '';
    endDateFilter = '';
    await loadAbsences();
  };

  // Create form methods
  Views.directorAbsences.toggleCreateForm = function() {
    showCreateForm = !showCreateForm;
    renderAbsences();
  };

  Views.directorAbsences.filterStudentsByCourse = function(courseId) {
    const studentSelect = document.getElementById('create-student');
    if (studentSelect) {
      studentSelect.innerHTML = `
        <option value="">Seleccione un alumno...</option>
        ${renderStudentOptions(courseId)}
      `;
    }
  };

  Views.directorAbsences.submitNewAbsence = async function() {
    const form = document.getElementById('director-absence-form');
    const studentId = document.getElementById('create-student')?.value;
    const type = document.getElementById('create-type')?.value;
    const startDate = document.getElementById('create-start-date')?.value;
    const endDate = document.getElementById('create-end-date')?.value;
    const comment = document.getElementById('create-comment')?.value;

    // Validation
    if (!studentId) {
      Components.showToast('Seleccione un alumno', 'error');
      return;
    }
    if (!startDate || !endDate) {
      Components.showToast('Complete las fechas', 'error');
      return;
    }
    if (startDate > endDate) {
      Components.showToast('La fecha de inicio no puede ser mayor a la fecha fin', 'error');
      return;
    }

    // Check max 30 days
    const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
      Components.showToast('El rango maximo es de 30 dias', 'error');
      return;
    }

    const submitBtn = form.querySelector('.btn-primary');
    const originalText = submitBtn ? submitBtn.textContent : 'Crear Solicitud';

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creando...';
      }

      const data = {
        student_id: parseInt(studentId),
        type: type,
        start: startDate,
        end: endDate,
        comment: comment || null,
      };

      await API.submitAbsence(data);
      Components.showToast('Solicitud creada exitosamente', 'success');

      // Hide form and reload
      showCreateForm = false;
      counts.pending += 1;
      counts.total += 1;

      // Switch to pending tab if not already there
      if (activeTab !== 'PENDING') {
        activeTab = 'PENDING';
      }
      await loadAbsences();
    } catch (error) {
      Components.showToast('Error al crear solicitud: ' + error.message, 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  };

  Views.directorAbsences.loadMore = async function() {
    currentOffset += PAGE_SIZE;
    await loadAbsences(true);
  };

  Views.directorAbsences.approve = async function(absenceId) {
    try {
      await API.approveAbsence(absenceId);
      Components.showToast('Solicitud aprobada', 'success');

      // Update counts and reload
      counts.pending = Math.max(0, counts.pending - 1);
      counts.approved += 1;
      await loadAbsences();
    } catch (error) {
      Components.showToast('Error al aprobar: ' + error.message, 'error');
    }
  };

  Views.directorAbsences.showRejectModal = function(absenceId) {
    const absence = absences.find(a => a.id === absenceId);
    const studentName = absence?.student_name || 'el alumno';

    Components.showModal('Rechazar Solicitud', `
      <p style="margin-bottom: 1rem;">
        ¿Rechazar la solicitud de ausencia de <strong>${Components.escapeHtml(studentName)}</strong>?
      </p>
      <div class="form-group">
        <label class="form-label">Razon del rechazo (opcional)</label>
        <textarea id="rejection-reason" class="form-input" rows="3"
          placeholder="Ingrese la razon del rechazo..."></textarea>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Rechazar', action: 'reject', className: 'btn-error', onClick: () => Views.directorAbsences.reject(absenceId) }
    ]);
  };

  Views.directorAbsences.reject = async function(absenceId) {
    const reasonInput = document.getElementById('rejection-reason');
    const reason = reasonInput ? reasonInput.value.trim() : null;

    // Get button for loading state
    const rejectBtn = document.querySelector('.modal .btn-error');
    const originalText = rejectBtn ? rejectBtn.textContent : 'Rechazar';

    try {
      if (rejectBtn) {
        rejectBtn.disabled = true;
        rejectBtn.textContent = 'Rechazando...';
      }

      await API.rejectAbsence(absenceId, reason || null);
      Components.showToast('Solicitud rechazada', 'success');

      // Close modal
      document.querySelector('.modal-container')?.click();

      // Update counts and reload
      counts.pending = Math.max(0, counts.pending - 1);
      counts.rejected += 1;
      await loadAbsences();
    } catch (error) {
      Components.showToast('Error al rechazar: ' + error.message, 'error');
      if (rejectBtn) {
        rejectBtn.disabled = false;
        rejectBtn.textContent = originalText;
      }
    }
  };

  Views.directorAbsences.confirmDelete = function(absenceId) {
    const absence = absences.find(a => a.id === absenceId);
    const studentName = absence?.student_name || 'el alumno';

    Components.showModal('Confirmar Eliminacion', `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠</div>
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">¿Eliminar esta solicitud de ausencia?</p>
        <p style="font-weight: 600; color: var(--color-error);">Solicitud de ${Components.escapeHtml(studentName)}</p>
        <p style="font-size: 0.9rem; color: var(--color-gray-500); margin-top: 1rem;">
          Esta accion no se puede deshacer.
        </p>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Eliminar', action: 'delete', className: 'btn-error', onClick: () => Views.directorAbsences.delete(absenceId) }
    ]);
  };

  Views.directorAbsences.delete = async function(absenceId) {
    const deleteBtn = document.querySelector('.modal .btn-error');
    const originalText = deleteBtn ? deleteBtn.textContent : 'Eliminar';

    try {
      if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Eliminando...';
      }

      await API.deleteAbsence(absenceId);
      Components.showToast('Solicitud eliminada', 'success');

      // Close modal
      document.querySelector('.modal-container')?.click();

      // Update counts and reload
      counts.pending = Math.max(0, counts.pending - 1);
      counts.total = Math.max(0, counts.total - 1);
      await loadAbsences();
    } catch (error) {
      Components.showToast('Error al eliminar: ' + error.message, 'error');
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = originalText;
      }
    }
  };

  Views.directorAbsences.exportCSV = async function() {
    try {
      const filters = {
        status: activeTab || undefined,
        start_date: startDateFilter || undefined,
        end_date: endDateFilter || undefined,
      };

      const blob = await API.exportAbsencesCSV(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ausencias_${activeTab.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Components.showToast('Exportacion completada', 'success');
    } catch (error) {
      Components.showToast('Error al exportar: ' + error.message, 'error');
      console.error('Export absences error:', error);
    }
  };

  Views.directorAbsences.refresh = async function() {
    await loadStats();
    await loadAbsences();
  };

  // Initial load
  await loadStats();
  await loadAbsences();
};
