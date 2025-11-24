// Parent Home - Today's status
Views.parentHome = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout('parent');

  const content = document.getElementById('view-content');

  if (!State.currentGuardianId) {
    content.innerHTML = Components.createEmptyState('Error', 'No hay apoderado seleccionado');
    return;
  }

  const students = State.getGuardianStudents(State.currentGuardianId);
  const today = new Date().toISOString().split('T')[0];

  content.innerHTML = `
    <h2 class="mb-3">Estado de Hoy</h2>

    <div style="display: flex; gap: 1rem; flex-direction: column;">
      ${students.map(student => {
        const course = State.getCourse(student.course_id);
        const events = State.getAttendanceEvents({ studentId: student.id, date: today });
        const inEvent = events.find(e => e.type === 'IN');
        const outEvent = events.find(e => e.type === 'OUT');

        let statusHTML = '';
        let statusClass = '';

        if (outEvent) {
          statusHTML = `Salió a las ${Components.formatTime(outEvent.ts)} por ${outEvent.gate_id}`;
          statusClass = 'chip-info';
        } else if (inEvent) {
          const time = inEvent.ts.split('T')[1];
          const isLate = time > '08:30:00';
          statusHTML = `Ingresó a las ${Components.formatTime(inEvent.ts)} por ${inEvent.gate_id}`;
          statusClass = isLate ? 'chip-warning' : 'chip-success';
          if (isLate) statusHTML += ' (tarde)';
        } else {
          statusHTML = 'Aún no registra ingreso';
          statusClass = 'chip-error';
        }

        return `
          <div class="card">
            <div class="card-header flex justify-between items-center">
              <div>
                <strong>${student.full_name}</strong>
                <div style="font-size: 0.875rem; color: var(--color-gray-600);">${course.name} - ${course.grade}</div>
              </div>
              <a href="#/parent/history?student=${student.id}" class="btn btn-secondary btn-sm">Ver Historial</a>
            </div>
            <div class="card-body">
              <div style="display: flex; align-items: center; gap: 1rem;">
                <span class="chip ${statusClass}">${statusHTML}</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="mt-3" style="display: flex; gap: 1rem;">
      <a href="#/parent/prefs" class="btn btn-secondary">Preferencias de Notificación</a>
      <a href="#/parent/absences" class="btn btn-secondary">Solicitar Ausencia</a>
    </div>
  `;
};
