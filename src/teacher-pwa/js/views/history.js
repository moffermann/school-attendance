Views.history = async function() {
  if (!State.currentCourseId) {
    Router.navigate('/classes');
    return;
  }

  const app = document.getElementById('app');
  const queue = await IDB.getAll('queue');
  const students = await IDB.getAll('students');
  const courseEvents = queue.filter(e => e.course_id === State.currentCourseId);

  app.innerHTML = `
    ${UI.createHeader('Historial Local')}
    <div class="container" style="padding-bottom:80px">
      <div class="card">
        <div class="card-header">Eventos del Curso</div>
        <table>
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Tipo</th>
              <th>Hora</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${courseEvents.slice(-50).reverse().map(e => {
              const student = students.find(s => s.id === e.student_id);
              // Security: escape student name to prevent XSS
              const safeName = UI.escapeHtml(student?.full_name || String(e.student_id));
              return `
                <tr>
                  <td>${safeName}</td>
                  <td>${UI.createChip(e.type, e.type === 'IN' ? 'success' : 'info')}</td>
                  <td>${UI.formatTime(e.ts)}</td>
                  <td>${UI.createChip(e.status, e.status === 'synced' ? 'success' : e.status === 'error' ? 'error' : 'warning')}</td>
                </tr>
              `;
            }).join('')}
            ${courseEvents.length === 0 ? '<tr><td colspan="4" class="text-center">Sin eventos</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>
    ${UI.createBottomNav('/history')}
  `;
};
