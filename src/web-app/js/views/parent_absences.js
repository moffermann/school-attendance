// Parent Absence Requests - Solicitudes de Ausencia
Views.parentAbsences = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout('parent');

  const content = document.getElementById('view-content');

  if (!State.currentGuardianId) {
    content.innerHTML = Components.createEmptyState('Error', 'No hay apoderado seleccionado');
    return;
  }

  const students = State.getGuardianStudents(State.currentGuardianId);
  const studentIds = students.map(s => s.id);
  const absences = State.getAbsences().filter(a => studentIds.includes(a.student_id));

  // Set default dates
  const today = new Date().toISOString().split('T')[0];

  content.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <a href="#/parent/home" class="btn btn-secondary btn-sm" style="margin-bottom: 1rem;">
        ← Volver al inicio
      </a>
      <h2 style="font-size: 1.75rem; font-weight: 700; color: var(--color-gray-900); margin-bottom: 0.5rem;">
        Solicitudes de Ausencia
      </h2>
      <p style="color: var(--color-gray-500);">Informe ausencias anticipadas o por enfermedad</p>
    </div>

    <!-- Nueva Solicitud -->
    <div class="card" style="margin-bottom: 1.5rem;">
      <div class="card-header" style="display: flex; align-items: center; gap: 0.75rem;">
        ${Components.icons.calendar}
        <span>Nueva Solicitud</span>
      </div>
      <div class="card-body">
        <form id="absence-form">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Alumno *</label>
              <select id="absence-student" class="form-select" required>
                <option value="">Seleccione un alumno...</option>
                ${students.map(s => {
                  const course = State.getCourse(s.course_id);
                  return `<option value="${s.id}">${s.full_name} - ${course ? course.name : ''}</option>`;
                }).join('')}
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Tipo de Ausencia *</label>
              <select id="absence-type" class="form-select" required>
                <option value="SICK">🏥 Enfermedad</option>
                <option value="PERSONAL">📋 Personal / Familiar</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Fecha Inicio *</label>
              <input type="date" id="absence-start" class="form-input" required value="${today}">
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Fecha Fin *</label>
              <input type="date" id="absence-end" class="form-input" required value="${today}">
            </div>
          </div>

          <div class="form-group" style="margin-top: 1rem;">
            <label class="form-label">Comentario o Motivo</label>
            <textarea id="absence-comment" class="form-textarea" placeholder="Describa brevemente el motivo de la ausencia (opcional)" rows="3"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Adjunto (certificado médico, justificativo, etc.)</label>
            <div style="border: 2px dashed var(--color-gray-300); border-radius: 12px; padding: 1.5rem; text-align: center; background: var(--color-gray-50);">
              <input type="file" id="absence-attachment" class="form-input" accept="image/*,.pdf" style="display: none;">
              <label for="absence-attachment" style="cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                <span style="font-size: 2rem;">📎</span>
                <span style="color: var(--color-gray-600);">Haga clic para adjuntar un archivo</span>
                <span style="font-size: 0.8rem; color: var(--color-gray-400);">PDF, JPG, PNG (máx. 5MB)</span>
              </label>
              <div id="file-name" style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--color-primary); display: none;"></div>
            </div>
            <div style="font-size: 0.8rem; color: var(--color-gray-400); margin-top: 0.5rem;">
              ℹ️ En modo demo, el archivo no se subirá realmente
            </div>
          </div>

          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary btn-lg" onclick="Views.parentAbsences.submitRequest()" style="flex: 1; min-width: 200px;">
              ${Components.icons.calendar}
              Enviar Solicitud
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Historial de Solicitudes -->
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          ${Components.icons.history}
          <span>Historial de Solicitudes</span>
        </div>
        <span style="font-size: 0.85rem; color: var(--color-gray-500);">${absences.length} solicitud${absences.length !== 1 ? 'es' : ''}</span>
      </div>
      <div class="card-body" id="absences-list" style="padding: 0;">
        ${absences.length === 0 ? `
          <div style="padding: 3rem; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">📋</div>
            <div style="font-size: 1.1rem; font-weight: 600; color: var(--color-gray-700); margin-bottom: 0.5rem;">Sin solicitudes previas</div>
            <div style="color: var(--color-gray-500);">Las solicitudes de ausencia que envíe aparecerán aquí</div>
          </div>
        ` : `
          <div style="display: flex; flex-direction: column;">
            ${absences.map((absence, index) => {
              const student = State.getStudent(absence.student_id);
              const isLast = index === absences.length - 1;

              const typeConfig = {
                SICK: { icon: '🏥', label: 'Enfermedad', color: 'warning' },
                PERSONAL: { icon: '📋', label: 'Personal', color: 'info' }
              };
              const type = typeConfig[absence.type] || typeConfig.PERSONAL;

              const statusConfig = {
                PENDING: { label: 'Pendiente', color: 'warning', icon: '⏳' },
                APPROVED: { label: 'Aprobada', color: 'success', icon: '✅' },
                REJECTED: { label: 'Rechazada', color: 'error', icon: '❌' }
              };
              const status = statusConfig[absence.status] || statusConfig.PENDING;

              return `
                <div style="display: flex; align-items: flex-start; padding: 1.25rem 1.5rem; ${!isLast ? 'border-bottom: 1px solid var(--color-gray-100);' : ''}">
                  <div style="width: 48px; height: 48px; background: var(--color-${type.color}-light); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-right: 1rem; flex-shrink: 0;">
                    ${type.icon}
                  </div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.25rem;">
                      <span style="font-weight: 600; color: var(--color-gray-900);">${student ? student.full_name : 'Alumno'}</span>
                      ${Components.createChip(type.label, type.color)}
                    </div>
                    <div style="font-size: 0.9rem; color: var(--color-gray-600); margin-bottom: 0.25rem;">
                      📅 ${Components.formatDate(absence.start)}${absence.start !== absence.end ? ` al ${Components.formatDate(absence.end)}` : ''}
                    </div>
                    ${absence.comment ? `
                      <div style="font-size: 0.85rem; color: var(--color-gray-500); font-style: italic;">
                        "${absence.comment}"
                      </div>
                    ` : ''}
                  </div>
                  <div style="flex-shrink: 0; text-align: right;">
                    <span class="chip chip-${status.color}" style="font-size: 0.8rem;">
                      ${status.icon} ${status.label}
                    </span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  // File input handler
  const fileInput = document.getElementById('absence-attachment');
  const fileNameDisplay = document.getElementById('file-name');

  fileInput?.addEventListener('change', function() {
    if (this.files && this.files[0]) {
      fileNameDisplay.textContent = `📄 ${this.files[0].name}`;
      fileNameDisplay.style.display = 'block';
    } else {
      fileNameDisplay.style.display = 'none';
    }
  });

  Views.parentAbsences.submitRequest = function() {
    const form = document.getElementById('absence-form');
    if (!Components.validateForm(form)) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    const startDate = document.getElementById('absence-start').value;
    const endDate = document.getElementById('absence-end').value;

    if (startDate > endDate) {
      Components.showToast('La fecha de inicio no puede ser mayor a la fecha de fin', 'error');
      return;
    }

    const fileInput = document.getElementById('absence-attachment');
    const fileName = fileInput.files[0]?.name || null;

    const absence = {
      student_id: parseInt(document.getElementById('absence-student').value),
      type: document.getElementById('absence-type').value,
      start: startDate,
      end: endDate,
      comment: document.getElementById('absence-comment').value,
      attachment_name: fileName
    };

    State.addAbsence(absence);
    Components.showToast('Solicitud enviada exitosamente', 'success');

    // Reset form
    form.reset();
    document.getElementById('file-name').style.display = 'none';

    // Refresh view
    setTimeout(() => Views.parentAbsences(), 500);
  };
};
