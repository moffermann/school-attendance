// Director Absences Management
Views.directorAbsences = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Solicitudes de Ausencia';

  let absences = [];
  let activeTab = 'PENDING';

  async function loadAbsences(showToast = false) {
    content.innerHTML = Components.createLoader('Cargando solicitudes...');
    try {
      absences = await State.fetchAbsences();
      renderAbsences();
      if (showToast) Components.showToast('Solicitudes actualizadas', 'success');
    } catch (error) {
      console.error('No se pudieron cargar solicitudes', error);
      content.innerHTML = Components.createEmptyState('No disponible', 'No se pudo cargar la bandeja de ausencias.');
    }
  }

  function renderAbsences() {
    const pending = absences.filter(a => a.status === 'PENDING');
    const approved = absences.filter(a => a.status === 'APPROVED');
    const rejected = absences.filter(a => a.status === 'REJECTED');

    content.innerHTML = `
      <div class="cards-grid">
        ${Components.createStatCard('Pendientes', pending.length)}
        ${Components.createStatCard('Aprobadas', approved.length)}
        ${Components.createStatCard('Rechazadas', rejected.length)}
      </div>

      <div class="card">
        <div class="card-header flex justify-between items-center">
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
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="Views.directorAbsences.export()">Exportar CSV</button>
            <button class="btn btn-primary btn-sm" onclick="Views.directorAbsences.refresh()">Refrescar</button>
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
            const student = State.getStudent(absence.student_id);
            const course = State.getCourse(student.course_id);
            const typeChip = absence.type === 'SICK'
              ? Components.createChip('Enfermedad', 'warning')
              : Components.createChip('Personal', 'info');

            return `
              <tr>
                <td>${student.full_name}</td>
                <td>${course.name}</td>
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
    loadAbsences(true);
  };

  Views.directorAbsences.export = async function() {
    try {
      const blob = await State.exportAbsences();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'absences.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      Components.showToast('Exportación lista', 'success');
    } catch (error) {
      console.error('No se pudo exportar ausencias', error);
      Components.showToast('Error al exportar', 'error');
    }
  };

  Views.directorAbsences.approve = async function(absenceId) {
    try {
      await State.updateAbsence(absenceId, 'APPROVED');
      Components.showToast('Solicitud aprobada', 'success');
      await loadAbsences();
    } catch (error) {
      console.error('No se pudo aprobar', error);
      Components.showToast('Error al aprobar la solicitud', 'error');
    }
  };

  Views.directorAbsences.reject = async function(absenceId) {
    try {
      await State.updateAbsence(absenceId, 'REJECTED');
      Components.showToast('Solicitud rechazada', 'error');
      await loadAbsences();
    } catch (error) {
      console.error('No se pudo rechazar', error);
      Components.showToast('Error al rechazar la solicitud', 'error');
    }
  };

  loadAbsences();
};
