const Views = window.Views || {};
window.Views = Views;

Views.auth = async function() {
  const app = document.getElementById('app');
  const teachers = await IDB.getAll('teachers');

  app.innerHTML = `
    <div class="container" style="padding-top: 3rem">
      <div class="card">
        <div class="card-header">PWA de Emergencia - Profesores</div>
        <div class="form-group">
          <label class="form-label">Seleccionar Profesor</label>
          <select id="teacher-select" class="form-select">
            ${teachers.map(t => `<option value="${t.id}">${t.full_name}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" onclick="Views.auth.login()">Continuar</button>
      </div>
    </div>
  `;

  Views.auth.login = async function() {
    const teacherId = parseInt(document.getElementById('teacher-select').value);
    State.setSession(teacherId, null);
    Router.navigate('/classes');
  };
};
