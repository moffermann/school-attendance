Views.queue = async function() {
  const app = document.getElementById('app');
  const queue = await IDB.getAll('queue');
  const students = await IDB.getAll('students');
  const pending = queue.filter(e => e.status === 'pending');
  const errors = queue.filter(e => e.status === 'error');

  app.innerHTML = `
    ${UI.createHeader('Cola de Sincronización')}
    <div class="container" style="padding-bottom:80px">
      <div class="grid grid-2">
        <div class="card">
          <div class="text-center">
            <div style="font-size:2rem;font-weight:700;color:var(--warning)">${pending.length}</div>
            <div>Pendientes</div>
          </div>
        </div>
        <div class="card">
          <div class="text-center">
            <div style="font-size:2rem;font-weight:700;color:var(--error)">${errors.length}</div>
            <div>Errores</div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">Eventos Pendientes/Errores</div>
        <table>
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Tipo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${[...pending, ...errors].map(e => {
              const student = students.find(s => s.id === e.student_id);
              // Security: escape student name to prevent XSS
              const safeName = UI.escapeHtml(student?.full_name || String(e.student_id));
              return `
                <tr>
                  <td>${safeName}</td>
                  <td>${UI.createChip(e.type, e.type === 'IN' ? 'success' : 'info')}</td>
                  <td>${UI.createChip(e.status, e.status === 'error' ? 'error' : 'warning')}</td>
                </tr>
              `;
            }).join('')}
            ${pending.length + errors.length === 0 ? '<tr><td colspan="3" class="text-center">No hay eventos pendientes</td></tr>' : ''}
          </tbody>
        </table>
      </div>
      <button class="btn btn-primary" onclick="Sync.syncNow()">Sincronizar Ahora</button>
    </div>
    ${UI.createBottomNav('/queue')}
  `;
};
