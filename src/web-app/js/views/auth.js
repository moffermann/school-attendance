// Auth view - Login with JWT
const Views = window.Views || {};
window.Views = Views;

Views.auth = function() {
  const app = document.getElementById('app');

  // Check if already authenticated
  if (API.isAuthenticated() && State.isSessionValid()) {
    const redirectPath = State.currentRole === 'parent' ? '/parent/home' : '/director/dashboard';
    Router.navigate(redirectPath);
    return;
  }

  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">
          <img src="assets/logo.svg" alt="Logo">
        </div>
        <h1 class="auth-title">Control de Asistencia Escolar</h1>
        <p style="color: var(--color-gray-500); margin-bottom: 2rem; font-size: 0.95rem;">Sistema de registro de ingreso y salida</p>

        <div id="auth-mode-select">
          <p class="mb-3" style="font-weight: 500; color: var(--color-gray-700);">Selecciona tu perfil para continuar:</p>
          <div class="role-buttons">
            <button class="role-button" id="btn-staff">
              <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">🏫</div>
              <div style="font-size: 1.1rem;">Dirección / Inspectoría</div>
              <div style="font-size: 0.8rem; color: var(--color-gray-500); margin-top: 0.5rem;">Gestión administrativa del colegio</div>
            </button>

            <button class="role-button" id="btn-parent">
              <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">👨‍👩‍👧</div>
              <div style="font-size: 1.1rem;">Apoderado</div>
              <div style="font-size: 0.8rem; color: var(--color-gray-500); margin-top: 0.5rem;">Consulta de asistencia de sus hijos</div>
            </button>
          </div>
        </div>

        <div id="auth-login-form" style="display: none;">
          <p class="mb-3" id="login-title">Iniciar sesión</p>
          <form id="login-form">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" id="login-email" class="form-input" placeholder="usuario@colegio.cl" required>
            </div>
            <div class="form-group">
              <label class="form-label">Contraseña</label>
              <input type="password" id="login-password" class="form-input" placeholder="••••••••" required>
            </div>
            <div id="login-error" class="error-message" style="display: none; color: var(--color-error); margin-bottom: 1rem;"></div>
            <div class="flex gap-2">
              <button type="button" class="btn btn-secondary" id="btn-back">Volver</button>
              <button type="submit" class="btn btn-primary" id="login-btn">Iniciar Sesión</button>
            </div>
          </form>
        </div>

        <!-- Demo mode: hidden by default, triple-click on logo to show -->
        <div id="auth-demo-mode" style="display: none; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--color-gray-200);">
          <p style="font-size: 0.8rem; color: var(--color-gray-400); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Modo demostración (emergencia)</p>
          <div class="flex gap-2 flex-wrap" style="justify-content: center;">
            <button class="btn btn-secondary btn-sm" onclick="Views.auth.demoLogin('director')" style="min-width: 100px;">Director</button>
            <button class="btn btn-secondary btn-sm" onclick="Views.auth.demoLogin('inspector')" style="min-width: 100px;">Inspector</button>
            <button class="btn btn-secondary btn-sm" onclick="Views.auth.demoLogin('parent')" style="min-width: 100px;">Apoderado</button>
          </div>
        </div>
      </div>
    </div>
  `;

  let selectedRole = null;

  // Triple-click on logo to reveal demo mode (emergency access)
  let clickCount = 0;
  let clickTimer = null;
  const logo = document.querySelector('.auth-logo');
  if (logo) {
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', () => {
      clickCount++;
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => { clickCount = 0; }, 500);
      if (clickCount >= 3) {
        const demoSection = document.getElementById('auth-demo-mode');
        if (demoSection) {
          demoSection.style.display = demoSection.style.display === 'none' ? 'block' : 'none';
        }
        clickCount = 0;
      }
    });
  }

  // R13-FE1 fix: Use event delegation to prevent listener duplication on re-render
  app.addEventListener('click', (e) => {
    // Staff button
    if (e.target.closest('#btn-staff')) {
      selectedRole = 'staff';
      showLoginForm('Dirección / Inspectoría');
    }
    // Parent button
    if (e.target.closest('#btn-parent')) {
      selectedRole = 'parent';
      showLoginForm('Apoderado');
    }
    // Back button
    if (e.target.closest('#btn-back')) {
      showModeSelect();
    }
  });

  // Login form submission - use delegation via form container
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
      // Login via API
      await API.login(email, password);

      // Get bootstrap data (user info, courses, students, etc.)
      const bootstrap = await API.getBootstrap();

      // Set up state with API data
      State.setFromBootstrap(bootstrap);

      // API returns current_user, fallback to user for backwards compatibility
      const user = bootstrap.current_user || bootstrap.user;
      Components.showToast(`Bienvenido, ${user.full_name}`, 'success');

      // Navigate based on role
      const redirectPath = user.role === 'PARENT' ? '/parent/home' : '/director/dashboard';
      Router.navigate(redirectPath);
    } catch (error) {
      console.error('Login error:', error);
      errorDiv.textContent = error.message || 'Error al iniciar sesión';
      errorDiv.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Iniciar Sesión';
    }
  });

  function showLoginForm(title) {
    document.getElementById('auth-mode-select').style.display = 'none';
    document.getElementById('auth-login-form').style.display = 'block';
    document.getElementById('login-title').textContent = `Iniciar sesión - ${title}`;
    document.getElementById('login-email').focus();
  }

  function showModeSelect() {
    document.getElementById('auth-mode-select').style.display = 'block';
    document.getElementById('auth-login-form').style.display = 'none';
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').style.display = 'none';
  }

  // Demo login (for testing without backend)
  Views.auth.demoLogin = function(role) {
    if (role === 'parent') {
      // Show guardian selector for demo mode
      const guardians = State.getGuardians();
      if (guardians.length === 0) {
        Components.showToast('No hay datos de demo cargados', 'error');
        return;
      }

      const options = guardians.map(g => `
        <option value="${g.id}">${Components.escapeHtml(g.full_name)}</option>
      `).join('');

      const modal = Components.showModal('Seleccionar Apoderado (Demo)', `
        <div class="form-group">
          <label class="form-label">Apoderado</label>
          <select id="guardian-select" class="form-select">
            <option value="">Seleccione...</option>
            ${options}
          </select>
        </div>
        <div id="students-preview" class="mt-2"></div>
      `, [
        { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
        {
          label: 'Continuar',
          action: 'submit',
          className: 'btn-primary',
          onClick: () => {
            const guardianId = parseInt(document.getElementById('guardian-select').value);
            if (!guardianId) {
              Components.showToast('Debe seleccionar un apoderado', 'error');
              return;
            }
            modal.close();
            State.setRole('parent', guardianId);
            Components.showToast('Modo demo activado', 'info');
            Router.navigate('/parent/home');
          }
        }
      ]);

      // Show students preview when guardian is selected
      setTimeout(() => {
        const select = document.getElementById('guardian-select');
        if (select) {
          select.addEventListener('change', (e) => {
            const guardianId = parseInt(e.target.value);
            const preview = document.getElementById('students-preview');

            if (!guardianId) {
              preview.innerHTML = '';
              return;
            }

            const students = State.getGuardianStudents(guardianId);
            preview.innerHTML = `
              <div class="card">
                <div class="card-header">Alumnos vinculados</div>
                <div class="card-body">
                  <ul style="list-style: none; padding: 0;">
                    ${students.map(s => {
                      const course = State.getCourse(s.course_id);
                      return `<li>• ${Components.escapeHtml(s.full_name)} - ${course ? Components.escapeHtml(course.name) : '-'}</li>`;
                    }).join('')}
                  </ul>
                </div>
              </div>
            `;
          });
        }
      }, 100);
    } else {
      // Staff demo login
      State.setRole(role);
      Components.showToast('Modo demo activado', 'info');
      Router.navigate('/director/dashboard');
    }
  };
};
