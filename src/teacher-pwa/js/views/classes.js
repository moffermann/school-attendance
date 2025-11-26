Views.classes = async function() {
  const app = document.getElementById('app');

  // Check authentication
  if (!State.isAuthenticated()) {
    Router.navigate('/auth');
    return;
  }

  // Use courses from State (loaded from API) or fallback to IDB
  let myCourses = State.courses;

  if (!myCourses.length) {
    // Try to load from IDB (offline mode)
    myCourses = await IDB.getAll('courses');
  }

  const teacherName = State.teacher ? State.teacher.full_name : 'Profesor';

  app.innerHTML = `
    ${UI.createHeader('Mis Cursos')}
    <div class="container">
      <div class="welcome-msg" style="margin-bottom: 1rem; color: #666;">
        Bienvenido, ${UI.escapeHtml(teacherName)}
      </div>
      <div class="grid gap-2">
        ${myCourses.length ? myCourses.map(c => `
          <div class="card">
            <div class="card-header">${UI.escapeHtml(c.name)} - ${UI.escapeHtml(c.grade)}</div>
            <div class="flex gap-1">
              <button class="btn btn-primary" onclick="Views.classes.selectCourse(${c.id})">Abrir Nómina</button>
              <button class="btn btn-secondary" onclick="Views.classes.takeAttendance(${c.id})">Tomar Asistencia</button>
            </div>
          </div>
        `).join('') : `
          <div class="card">
            <div class="card-header">Sin cursos asignados</div>
            <p style="color: #666;">No tienes cursos asignados. Contacta al administrador.</p>
          </div>
        `}
      </div>
      <div class="mt-2">
        <button class="btn btn-secondary" onclick="Router.navigate('/settings')">Configuración</button>
        <button class="btn btn-secondary" onclick="Views.classes.logout()">Cerrar Sesión</button>
      </div>
    </div>
    ${UI.createBottomNav('/classes')}
  `;

  Views.classes.selectCourse = function(id) {
    State.setSession(State.currentTeacherId, id);
    Router.navigate('/roster');
  };

  Views.classes.takeAttendance = function(id) {
    State.setSession(State.currentTeacherId, id);
    Router.navigate('/take-attendance');
  };

  Views.classes.logout = function() {
    State.logout();
    Router.navigate('/auth');
  };
};
