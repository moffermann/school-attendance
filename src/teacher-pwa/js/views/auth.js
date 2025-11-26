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
    <div class="container" style="padding-top: 3rem">
      <div class="card">
        <div class="card-header">PWA Profesores - Asistencia</div>
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
          <button type="submit" class="btn btn-primary" id="login-btn">Iniciar Sesión</button>
        </form>
        <div class="help-text" style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
          Use sus credenciales de profesor para acceder.
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
};
