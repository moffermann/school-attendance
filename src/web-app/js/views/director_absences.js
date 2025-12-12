// Director Absences Management
Views.directorAbsences = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Solicitudes de Ausencia';

  let absences = [];
  let activeTab = 'PENDING';
  let isLoading = true;

  // Fetch absences from API on mount
  async function loadAbsences() {
    isLoading = true;
    renderAbsences();

    try {
      // Try API first, fallback to local State
      if (typeof API !== 'undefined' && API.getAbsences) {
        const response = await API.getAbsences();
        absences = response.items || response || [];
        // Also update local State for consistency
        if (State.setAbsences) {
          State.setAbsences(absences);
        }
      } else {
        absences = State.getAbsences();
      }
    } catch (error) {
      console.warn('Error fetching absences from API, using local state:', error);
      absences = State.getAbsences();
    }

    isLoading = false;
    renderAbsences();
  }

  function renderAbsences() {
    if (isLoading) {
      content.innerHTML = `
        <div class="card">
          <div class="card-body" style="text-align: center; padding: 3rem;">
            <div class="spinner"></div>
            <p style="margin-top: 1rem; color: var(--color-gray-500);">Cargando solicitudes...</p>
          </div>
        </div>
      `;
      return;
    }

    const pending = absences.filter(a => a.status === 'PENDING');
    const approved = absences.filter(a => a.status === 'APPROVED');
    const rejected = absences.filter(a => a.status === 'REJECTED');

    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div></div>
        <button class="btn btn-secondary btn-sm" onclick="Views.directorAbsences.refresh()" title="Actualizar lista">
          🔄 Actualizar
        </button>
      </div>

      <div class="cards-grid">
        ${Components.createStatCard('Pendientes', pending.length)}
        ${Components.createStatCard('Aprobadas', approved.length)}
        ${Components.createStatCard('Rechazadas', rejected.length)}
      </div>

      <div class="card">
        <div class="card-header">
          <div style="display: flex; gap: 1rem; border-bottom: 1px solid var(--color-gray-200); margin: -1rem -1.5rem 1rem; padding: 0 1.5rem;">
            <button class="btn btn-secondary ${activeTab === 'PENDING' ? 'active' : ''}" style="border-radius: 0; border-bottom: 2px solid ${activeTab === 'PENDING' ? 'var(--color-primary)' : 'transparent'};" onclick="Views.directorAbsences.switchTab('PENDING')">
              Pendientes (${pending.length})
            </button>
            <button class="btn btn-secondary ${activeTab === 'APPROVED' ? 'active' : ''}" style="border-radius: 0; border-bottom: 2px solid ${activeTab === 'APPROVED' ? 'var(--color-primary)' : 'transparent'};" onclick="Views.directorAbsences.switchTab('APPROVED')">
              Aprobadas (${approved.length})
            </button>
            <button class="btn btn-secondary ${activeTab === 'REJECTED' ? 'active' : ''}" style="border-radius: 0; border-bottom: 2px solid ${activeTab === 'REJECTED' ? 'var(--color-primary)' : 'transparent'};" onclick="Views.directorAbsences.switchTab('REJECTED')">
              Rechazadas (${rejected.length})
            </button>
          </div>
        </div>

        <div class="card-body" id="absences-list">
          ${renderAbsencesList()}
        </div>
      </div>
    `;
  }

  function renderAbsencesList() {
    const filtered = absences.filter(a => a.status === activeTab);

    if (filtered.length === 0) {
      return Components.createEmptyState('Sin solicitudes', `No hay solicitudes ${activeTab === 'PENDING' ? 'pendientes' : activeTab === 'APPROVED' ? 'aprobadas' : 'rechazadas'}`);
    }

    return `
      <table>
        <thead>
          <tr>
            <th>Alumno</th>
            <th>Curso</th>
            <th>Tipo</th>
            <th>Fechas</th>
            <th>Comentario</th>
            <th>Adjunto</th>
            ${activeTab === 'PENDING' ? '<th>Acciones</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${filtered.map(absence => {
            // TDD-R7-BUG2 fix: Validate student exists before accessing properties
            const student = State.getStudent(absence.student_id);
            const course = student ? State.getCourse(student.course_id) : null;
            const typeChip = absence.type === 'SICK'
              ? Components.createChip('Enfermedad', 'warning')
              : Components.createChip('Personal', 'info');

            return `
              <tr>
                <td>${student?.full_name || '-'}</td>
                <td>${course?.name || '-'}</td>
                <td>${typeChip}</td>
                <td>${Components.formatDate(absence.start)} - ${Components.formatDate(absence.end)}</td>
                <td>${absence.comment || '-'}</td>
                <td>${absence.attachment_name || '-'}</td>
                ${activeTab === 'PENDING' ? `
                  <td>
                    <button class="btn btn-success btn-sm" onclick="Views.directorAbsences.approve(${absence.id})">
                      Aprobar
                    </button>
                    <button class="btn btn-error btn-sm" onclick="Views.directorAbsences.reject(${absence.id})">
                      Rechazar
                    </button>
                  </td>
                ` : ''}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  Views.directorAbsences.switchTab = function(tab) {
    activeTab = tab;
    renderAbsences();
  };

  Views.directorAbsences.refresh = function() {
    loadAbsences();
  };

  Views.directorAbsences.approve = async function(absenceId) {
    try {
      // Try API first
      if (typeof API !== 'undefined' && API.updateAbsenceStatus) {
        await API.updateAbsenceStatus(absenceId, 'APPROVED');
      }
      // Update local state
      State.updateAbsence(absenceId, { status: 'APPROVED' });
      // Update local array
      const idx = absences.findIndex(a => a.id === absenceId);
      if (idx !== -1) absences[idx].status = 'APPROVED';

      Components.showToast('Solicitud aprobada', 'success');
      renderAbsences();
    } catch (error) {
      Components.showToast('Error al aprobar: ' + error.message, 'error');
    }
  };

  Views.directorAbsences.reject = async function(absenceId) {
    try {
      // Try API first
      if (typeof API !== 'undefined' && API.updateAbsenceStatus) {
        await API.updateAbsenceStatus(absenceId, 'REJECTED');
      }
      // Update local state
      State.updateAbsence(absenceId, { status: 'REJECTED' });
      // Update local array
      const idx = absences.findIndex(a => a.id === absenceId);
      if (idx !== -1) absences[idx].status = 'REJECTED';

      Components.showToast('Solicitud rechazada', 'success');
      renderAbsences();
    } catch (error) {
      Components.showToast('Error al rechazar: ' + error.message, 'error');
    }
  };

  // Load absences from API on mount
  loadAbsences();
};
