const Views = window.Views || {};
window.Views = Views;

Views.auth = async function() {
  const app = document.getElementById('app');

  // Check if already authenticated
  if (API.isAuthenticated()) {
    Router.navigate('/classes');
    return;
  }

  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">👨‍🏫</div>
        <h1 class="auth-title">Portal Profesores</h1>
        <p class="auth-subtitle">Sistema de control de asistencia</p>

        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" id="login-email" class="form-input" placeholder="profesor@colegio.cl" required>
          </div>
          <div class="form-group">
            <label class="form-label">Contraseña</label>
            <input type="password" id="login-password" class="form-input" placeholder="••••••••" required>
          </div>
          <div id="login-error" class="error-message" style="display: none;"></div>
          <button type="submit" class="btn btn-primary btn-block" id="login-btn">
            Iniciar Sesión
          </button>
        </form>

        <div class="demo-section">
          <p class="demo-label">Modo Demostración</p>
          <div class="flex flex-col gap-1">
            <button type="button" class="btn btn-secondary btn-block" onclick="Views.auth.demoLogin(1)">
              👩‍🏫 María González López
            </button>
            <button type="button" class="btn btn-secondary btn-block" onclick="Views.auth.demoLogin(2)">
              👨‍🏫 Pedro Ramírez Castro
            </button>
            <button type="button" class="btn btn-secondary btn-block" onclick="Views.auth.demoLogin(3)">
              👩‍🏫 Carmen Silva Morales
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    errorDiv.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Iniciando sesión...';

    try {
      await API.login(email, password);

      // Fetch teacher profile and courses
      const profile = await API.getTeacherMe();

      // Store teacher info in State
      State.setTeacherProfile(profile.teacher, profile.courses);

      UI.showToast(`Bienvenido, ${profile.teacher.full_name}`, 'success');
      Router.navigate('/classes');
    } catch (error) {
      console.error('Login error:', error);
      errorDiv.textContent = error.message || 'Error al iniciar sesión';
      errorDiv.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Iniciar Sesión';
    }
  });

  // Demo login function
  Views.auth.demoLogin = async function(teacherId) {
    UI.showToast('Cargando modo demo...', 'info', 1500);

    try {
      // Load demo data from JSON files
      await State.loadFallbackData();

      // Get teacher from demo data
      const teachers = State.data.teachers || [];
      const teacher = teachers.find(t => t.id === teacherId);

      if (!teacher) {
        UI.showToast('Profesor no encontrado', 'error');
        return;
      }

      // Get courses for this teacher (courses have teacher_ids array)
      const allCourses = State.data.courses || [];
      const courses = allCourses.filter(c =>
        c.teacher_ids && c.teacher_ids.includes(teacherId)
      );

      // Set demo mode
      State.setDemoMode(true);
      State.setTeacherProfile(teacher, courses);

      // Cache students for each course in IDB for demo mode
      const rosters = State.data.rosters || [];
      const allStudents = State.data.students || [];
      for (const course of courses) {
        const roster = rosters.find(r => r.course_id === course.id);
        if (roster) {
          const courseStudents = allStudents.filter(s => roster.student_ids.includes(s.id));
          await State.cacheStudents(course.id, courseStudents);
        }
      }

      // Set fake token for demo (use API.accessToken to ensure consistency with api-base.js)
      API.accessToken = 'demo_token_' + teacherId;

      UI.showToast(`Bienvenido, ${teacher.full_name}`, 'success');
      Router.navigate('/classes');
    } catch (error) {
      console.error('Demo login error:', error);
      UI.showToast('Error al cargar modo demo', 'error');
    }
  };
};
