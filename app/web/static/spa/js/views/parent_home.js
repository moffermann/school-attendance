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
  const todayFormatted = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  content.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.75rem; font-weight: 700; color: var(--color-gray-900); margin-bottom: 0.5rem;">Estado de Hoy</h2>
      <p style="color: var(--color-gray-500); font-size: 0.95rem; text-transform: capitalize;">${todayFormatted}</p>
    </div>

    <div style="display: flex; gap: 1.5rem; flex-direction: column;">
      ${students.map(student => {
        const course = State.getCourse(student.course_id);
        const events = State.getAttendanceEvents({ studentId: student.id, date: today });
        const inEvent = events.find(e => e.type === 'IN');
        const outEvent = events.find(e => e.type === 'OUT');

        let statusHTML = '';
        let statusClass = '';
        let statusIcon = '';

        if (outEvent) {
          statusHTML = `Salió a las ${Components.formatTime(outEvent.ts)} por ${outEvent.gate_id}`;
          statusClass = 'chip-info';
          statusIcon = '🏠';
        } else if (inEvent) {
          const time = inEvent.ts.split('T')[1];
          const isLate = time > '08:30:00';
          statusHTML = `Ingresó a las ${Components.formatTime(inEvent.ts)} por ${inEvent.gate_id}`;
          statusClass = isLate ? 'chip-warning' : 'chip-success';
          statusIcon = isLate ? '⚠️' : '✅';
          if (isLate) statusHTML += ' (con atraso)';
        } else {
          statusHTML = 'Aún no registra ingreso';
          statusClass = 'chip-error';
          statusIcon = '❓';
        }

        return `
          <div class="card" style="overflow: visible;">
            <div class="card-header flex justify-between items-center" style="padding: 1.25rem 1.5rem;">
              <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 50px; height: 50px; background: var(--gradient-primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: white; font-weight: bold;">
                  ${student.full_name.charAt(0)}
                </div>
                <div>
                  <div style="font-size: 1.1rem; font-weight: 600; color: var(--color-gray-900);">${student.full_name}</div>
                  <div style="font-size: 0.85rem; color: var(--color-gray-500);">${course.name} - ${course.grade}</div>
                </div>
              </div>
              <a href="#/parent/history?student=${student.id}" class="btn btn-secondary btn-sm">
                ${Components.icons.history}
                Ver Historial
              </a>
            </div>
            <div class="card-body" style="padding: 1.25rem 1.5rem; background: var(--color-gray-50);">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1.25rem;">${statusIcon}</span>
                <span class="chip ${statusClass}" style="font-size: 0.85rem; padding: 0.5rem 1rem;">${statusHTML}</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="mt-4" style="display: flex; gap: 1rem; flex-wrap: wrap;">
      <a href="#/parent/prefs" class="btn btn-secondary" style="flex: 1; min-width: 200px; justify-content: center; padding: 1rem;">
        ${Components.icons.settings}
        Preferencias de Notificación
      </a>
      <a href="#/parent/absences" class="btn btn-primary" style="flex: 1; min-width: 200px; justify-content: center; padding: 1rem;">
        ${Components.icons.calendar}
        Solicitar Ausencia
      </a>
    </div>
  `;
};
