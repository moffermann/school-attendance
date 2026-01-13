// Director Schedule Exceptions
Views.directorExceptions = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Excepciones de Calendario';

  const courses = State.getCourses();

  function renderExceptions() {
    const exceptions = State.getScheduleExceptions();

    content.innerHTML = `
      <div class="mb-3">
        <button class="btn btn-primary" onclick="Views.directorExceptions.showCreateForm()">
          + Nueva Excepción
        </button>
      </div>

      <div class="card">
        <div class="card-header">Excepciones Registradas</div>
        <div class="card-body">
          ${exceptions.length === 0
            ? Components.createEmptyState('Sin excepciones', 'No hay excepciones de horario registradas')
            : `
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Alcance</th>
                    <th>Curso</th>
                    <th>Horario</th>
                    <th>Motivo</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${exceptions.map(exc => {
                    const course = exc.course_id ? State.getCourse(exc.course_id) : null;
                    return `
                      <tr>
                        <td>${Components.formatDate(exc.date)}</td>
                        <td>${Components.createChip(exc.scope === 'GLOBAL' ? 'Global' : 'Curso', exc.scope === 'GLOBAL' ? 'info' : 'warning')}</td>
                        <td>${course ? course.name : '-'}</td>
                        <td>${exc.in_time || '-'} a ${exc.out_time || '-'}</td>
                        <td>${exc.reason}</td>
                        <td>
                          <button class="btn btn-error btn-sm"
                            onclick="Views.directorExceptions.deleteException(${exc.id})">
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `
          }
        </div>
      </div>
    `;
  }

  Views.directorExceptions.showCreateForm = function() {
    const coursesOptions = courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    Components.showModal('Nueva Excepción de Horario', `
      <form id="exception-form">
        <div class="form-group">
          <label class="form-label">Alcance *</label>
          <select id="exc-scope" class="form-select" required>
            <option value="GLOBAL">Global (todos los cursos)</option>
            <option value="COURSE">Curso específico</option>
          </select>
        </div>

        <div class="form-group" id="course-group" style="display:none;">
          <label class="form-label">Curso</label>
          <select id="exc-course" class="form-select">
            <option value="">Seleccionar...</option>
            ${coursesOptions}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Fecha *</label>
          <input type="date" id="exc-date" class="form-input" required>
        </div>

        <div class="flex gap-2">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">Hora Ingreso</label>
            <input type="time" id="exc-in-time" class="form-input">
          </div>

          <div class="form-group" style="flex: 1;">
            <label class="form-label">Hora Salida</label>
            <input type="time" id="exc-out-time" class="form-input">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Motivo *</label>
          <textarea id="exc-reason" class="form-textarea" required placeholder="Ej: Reunión de apoderados, actividad especial, etc."></textarea>
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center;">
            <input type="checkbox" id="exc-notify" class="form-checkbox">
            <span>Notificar a padres/apoderados</span>
          </label>
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Vista Previa Destinatarios', action: 'preview', className: 'btn-secondary',
        onClick: () => Views.directorExceptions.previewRecipients()
      },
      { label: 'Crear Excepción', action: 'create', className: 'btn-primary',
        onClick: () => Views.directorExceptions.createException()
      }
    ]);

    // Show/hide course selector based on scope
    document.getElementById('exc-scope').addEventListener('change', (e) => {
      const courseGroup = document.getElementById('course-group');
      courseGroup.style.display = e.target.value === 'COURSE' ? 'block' : 'none';
    });
  };

  Views.directorExceptions.previewRecipients = function() {
    const scope = document.getElementById('exc-scope').value;
    const courseId = document.getElementById('exc-course').value;

    let guardians = [];
    if (scope === 'GLOBAL') {
      guardians = State.getGuardians();
    } else if (courseId) {
      const students = State.getStudentsByCourse(parseInt(courseId));
      const studentIds = students.map(s => s.id);
      guardians = State.getGuardians().filter(g =>
        g.student_ids.some(sid => studentIds.includes(sid))
      );
    }

    const preview = guardians.slice(0, 10).map(g =>
      `<li>${g.full_name} - ${g.contacts.find(c => c.type === 'whatsapp')?.value || g.contacts[0]?.value || 'Sin contacto'}</li>`
    ).join('');

    Components.showModal('Vista Previa de Destinatarios', `
      <p><strong>Total de apoderados:</strong> ${guardians.length}</p>
      <p><strong>Primeros 10 destinatarios:</strong></p>
      <ul>${preview || '<li>No hay destinatarios</li>'}</ul>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);
  };

  Views.directorExceptions.createException = async function() {
    const form = document.getElementById('exception-form');
    if (!Components.validateForm(form)) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    const exception = {
      scope: document.getElementById('exc-scope').value,
      course_id: document.getElementById('exc-course').value ? parseInt(document.getElementById('exc-course').value) : null,
      date: document.getElementById('exc-date').value,
      in_time: document.getElementById('exc-in-time').value || null,
      out_time: document.getElementById('exc-out-time').value || null,
      reason: document.getElementById('exc-reason').value
    };

    // Read notify checkbox before closing modal
    const notify = document.getElementById('exc-notify').checked;

    try {
      // Call backend API
      const created = await API.createScheduleException(exception);
      // Update local state with the response (includes server-assigned ID)
      State.data.schedule_exceptions.push(created);
      State.persist();

      // Close modal by clicking the close button
      const closeBtn = document.querySelector('.modal-close');
      if (closeBtn) closeBtn.click();

      Components.showToast('Excepcion creada exitosamente', 'success');

      if (notify) {
        Components.showToast('Notificaciones enviadas (simulado)', 'info');
      }

      renderExceptions();
    } catch (error) {
      console.error('Error creating exception:', error);
      Components.showToast(error.message || 'Error al crear excepcion', 'error');
    }
  };

  Views.directorExceptions.deleteException = async function(id) {
    if (confirm('¿Esta seguro de eliminar esta excepcion?')) {
      try {
        // Call backend API
        await API.deleteScheduleException(id);
        // Update local state
        State.deleteScheduleException(id);
        Components.showToast('Excepcion eliminada', 'success');
        renderExceptions();
      } catch (error) {
        console.error('Error deleting exception:', error);
        Components.showToast(error.message || 'Error al eliminar excepcion', 'error');
      }
    }
  };

  renderExceptions();
};
