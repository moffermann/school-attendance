Views.takeAttendance = async function() {
  if (!State.currentCourseId) {
    UI.showToast('Selecciona un curso primero', 'warning');
    Router.navigate('/classes');
    return;
  }

  const app = document.getElementById('app');
  const rosters = await IDB.getAll('rosters');
  const students = await IDB.getAll('students');
  const roster = rosters.find(r => r.course_id === State.currentCourseId);
  const studentList = roster
    ? roster.student_ids.map(id => students.find(s => s.id === id)).filter(Boolean)
    : [];

  const selections = {};
  studentList.forEach(s => selections[s.id] = 'present');

  function render() {
    app.innerHTML = `
      ${UI.createHeader('Marcado en Lote')}
      <div class="container" style="padding-bottom:80px">
        ${studentList.map(s => {
          // Security: escape student name to prevent XSS
          const safeName = UI.escapeHtml(s.full_name);
          return `
            <div class="student-item">
              <div>${safeName}</div>
              <div class="status-selector">
                <button class="status-chip ${selections[s.id] === 'present' ? 'selected' : ''}" onclick="Views.takeAttendance.select(${s.id},'present')">Presente</button>
                <button class="status-chip ${selections[s.id] === 'late' ? 'selected' : ''}" onclick="Views.takeAttendance.select(${s.id},'late')">Tarde</button>
                <button class="status-chip ${selections[s.id] === 'absent' ? 'selected' : ''}" onclick="Views.takeAttendance.select(${s.id},'absent')">Ausente</button>
              </div>
            </div>
          `;
        }).join('')}
        <!-- Nota explicativa sobre sincronización -->
        <div style="background: var(--color-info-light); padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.85rem;">
          <strong>💡 Nota:</strong> Los registros se guardan localmente y se sincronizan automáticamente con el servidor cuando hay conexión.
        </div>

        <div class="flex gap-1 mt-2">
          <button class="btn btn-primary" onclick="Views.takeAttendance.submit()">✓ Guardar Asistencia</button>
          <button class="btn btn-secondary" onclick="Router.navigate('/roster')">← Volver</button>
        </div>
      </div>
      ${UI.createBottomNav('/roster')}
    `;
  }

  Views.takeAttendance.select = function(id, status) {
    selections[id] = status;
    render();
  };

  Views.takeAttendance.submit = async function() {
    const today = new Date().toISOString().split('T')[0];
    const queue = await IDB.getAll('queue');
    let count = 0;

    for (const s of studentList) {
      if (selections[s.id] === 'present' || selections[s.id] === 'late') {
        const hasIN = queue.some(e => e.student_id === s.id && e.type === 'IN' && e.ts.startsWith(today));
        if (!hasIN) {
          await State.enqueueEvent({
            student_id: s.id,
            type: 'IN',
            course_id: State.currentCourseId,
            source: 'BATCH',
            ts: new Date().toISOString()
          });
          count++;
        }
      }
    }

    UI.showToast(`${count} registros guardados. Se sincronizarán automáticamente.`, 'success');
    Router.navigate('/roster');
  };

  render();
};
