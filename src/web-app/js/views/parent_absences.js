// Parent Absence Requests
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

  content.innerHTML = `
    <h2 class="mb-3">Solicitudes de Ausencia</h2>

    <div class="card mb-3">
      <div class="card-header">Nueva Solicitud</div>
      <div class="card-body">
        <form id="absence-form">
          <div class="form-group">
            <label class="form-label">Alumno *</label>
            <select id="absence-student" class="form-select" required>
              <option value="">Seleccione...</option>
              ${students.map(s => {
                const course = State.getCourse(s.course_id);
                return `<option value="${s.id}">${s.full_name} - ${course.name}</option>`;
              }).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Tipo *</label>
            <select id="absence-type" class="form-select" required>
              <option value="SICK">Enfermedad</option>
              <option value="PERSONAL">Personal</option>
            </select>
          </div>

          <div class="flex gap-2">
            <div class="form-group" style="flex: 1;">
              <label class="form-label">Fecha Inicio *</label>
              <input type="date" id="absence-start" class="form-input" required>
            </div>

            <div class="form-group" style="flex: 1;">
              <label class="form-label">Fecha Fin *</label>
              <input type="date" id="absence-end" class="form-input" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Comentario</label>
            <textarea id="absence-comment" class="form-textarea" placeholder="Opcional"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Adjunto (certificado, receta, etc.)</label>
            <input type="file" id="absence-attachment" class="form-input" accept="image/*,.pdf">
            <div class="form-error" style="color: var(--color-gray-500); margin-top: 0.25rem;">
              Nota: El archivo no se subirá realmente (esta es una maqueta)
            </div>
          </div>

          <button type="button" class="btn btn-primary" onclick="Views.parentAbsences.submitRequest()">
            Enviar Solicitud
          </button>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Historial de Solicitudes</div>
      <div class="card-body">
        ${absences.length === 0
          ? Components.createEmptyState('Sin solicitudes', 'No ha realizado solicitudes de ausencia')
          : `
            <table>
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Tipo</th>
                  <th>Fechas</th>
                  <th>Estado</th>
                  <th>Comentario</th>
                </tr>
              </thead>
              <tbody>
                ${absences.map(absence => {
                  const student = State.getStudent(absence.student_id);
                  const typeChip = absence.type === 'SICK'
                    ? Components.createChip('Enfermedad', 'warning')
                    : Components.createChip('Personal', 'info');

                  const statusChip = absence.status === 'PENDING'
                    ? Components.createChip('Pendiente', 'warning')
                    : absence.status === 'APPROVED'
                    ? Components.createChip('Aprobada', 'success')
                    : Components.createChip('Rechazada', 'error');

                  return `
                    <tr>
                      <td>${student.full_name}</td>
                      <td>${typeChip}</td>
                      <td>${Components.formatDate(absence.start)} - ${Components.formatDate(absence.end)}</td>
                      <td>${statusChip}</td>
                      <td>${absence.comment || '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `
        }
      </div>
    </div>

    <div class="mt-3">
      <a href="#/parent/home" class="btn btn-secondary">Volver</a>
    </div>
  `;

  Views.parentAbsences.submitRequest = function() {
    const form = document.getElementById('absence-form');
    if (!Components.validateForm(form)) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    const fileInput = document.getElementById('absence-attachment');
    const fileName = fileInput.files[0]?.name || null;

    const absence = {
      student_id: parseInt(document.getElementById('absence-student').value),
      type: document.getElementById('absence-type').value,
      start: document.getElementById('absence-start').value,
      end: document.getElementById('absence-end').value,
      comment: document.getElementById('absence-comment').value,
      attachment_name: fileName
    };

    State.addAbsence(absence);
    Components.showToast('Solicitud enviada exitosamente', 'success');

    // Reset form
    form.reset();

    // Refresh view
    setTimeout(() => Views.parentAbsences(), 500);
  };
};
