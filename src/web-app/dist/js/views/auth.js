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
    <div class="min-h-screen flex items-center justify-center bg-gradient-mesh overflow-hidden relative px-4">
      <!-- Blur decorations -->
      <div class="blur-decoration absolute -top-24 -left-24 w-96 h-96 bg-primary/20"></div>
      <div class="blur-decoration absolute top-1/2 -right-24 w-80 h-80 bg-purple-500/20"></div>
      <div class="blur-decoration absolute -bottom-24 left-1/4 w-64 h-64 bg-indigo-500/20"></div>

      <main class="relative z-10 w-full max-w-[480px]">
        <div class="auth-card-new p-8 md:p-12">
          <!-- Logo NEUVOX -->
          <div class="text-center mb-10">
            <div class="flex flex-col items-center mb-8">
              <div class="w-24 h-24 mb-4" id="auth-logo" style="cursor: pointer;">
                <img src="assets/LOGO Neuvox 1000X1000.png" alt="NEUVOX.AI" class="w-full h-full object-contain">
              </div>
              <div class="flex items-center text-3xl font-black tracking-tighter uppercase">
                <span class="text-[#000080] dark:text-sky-500">NEUVOX</span>
                <span class="text-sky-500 dark:text-purple-500">.AI</span>
              </div>
            </div>
            <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
              Control de Asistencia Escolar
            </h1>
            <p class="text-slate-500 dark:text-slate-400 text-sm font-medium">
              Sistema de registro de ingreso y salida
            </p>

            <!-- Separador "Selecciona tu perfil" -->
            <div class="mt-8 flex items-center justify-center space-x-2">
              <span class="h-px w-8 bg-slate-200 dark:bg-slate-700"></span>
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Selecciona tu perfil
              </span>
              <span class="h-px w-8 bg-slate-200 dark:bg-slate-700"></span>
            </div>
          </div>

          <!-- Role Cards -->
          <div id="auth-mode-select" class="space-y-4">
            <button class="w-full flex items-center gap-5 p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-sky-500 hover:bg-white dark:hover:bg-slate-800 transition-all group text-left" id="btn-staff">
              <div class="flex-shrink-0 w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center group-hover:bg-indigo-500 transition-colors">
                <span class="material-symbols-outlined text-3xl text-indigo-600 dark:text-indigo-400 group-hover:text-white transition-colors">school</span>
              </div>
              <div class="flex-1">
                <h3 class="font-bold text-slate-900 dark:text-white text-lg mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  Dirección / Inspectoría
                </h3>
                <p class="text-slate-500 dark:text-slate-400 text-sm">
                  Gestión administrativa del colegio y control de registros.
                </p>
              </div>
              <span class="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors">chevron_right</span>
            </button>

            <button class="w-full flex items-center gap-5 p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-sky-500 hover:bg-white dark:hover:bg-slate-800 transition-all group text-left" id="btn-parent">
              <div class="flex-shrink-0 w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:bg-purple-500 transition-colors">
                <span class="material-symbols-outlined text-3xl text-purple-600 dark:text-purple-400 group-hover:text-white transition-colors">family_restroom</span>
              </div>
              <div class="flex-1">
                <h3 class="font-bold text-slate-900 dark:text-white text-lg mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  Apoderado
                </h3>
                <p class="text-slate-500 dark:text-slate-400 text-sm">
                  Consulta de asistencia de sus hijos en tiempo real.
                </p>
              </div>
              <span class="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-purple-500 transition-colors">chevron_right</span>
            </button>
          </div>

          <!-- Login Form (hidden by default) -->
          <div id="auth-login-form" style="display: none;">
            <p id="login-title" class="text-sm font-semibold text-slate-600 dark:text-slate-300 text-center mb-6">
              Iniciar sesión
            </p>

            <!-- Passkey login option -->
            <div id="passkey-login-section" style="display: none;">
              <button type="button" id="btn-passkey-login"
                      class="w-full h-14 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400
                             rounded-xl font-semibold flex items-center justify-center gap-3
                             border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-500/20 transition-colors mb-6">
                <span class="material-symbols-outlined">fingerprint</span>
                <span>Iniciar con huella / Face ID</span>
              </button>

              <div class="relative flex items-center mb-6">
                <div class="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                <span class="mx-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  o con contraseña
                </span>
                <div class="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
              </div>
            </div>

            <form id="login-form" class="space-y-5">
              <div>
                <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email</label>
                <input type="email" id="login-email"
                       class="auth-input"
                       placeholder="usuario@colegio.cl" required>
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Contraseña</label>
                <input type="password" id="login-password"
                       class="auth-input"
                       placeholder="••••••••" required>
              </div>

              <div class="text-right">
                <a href="#/forgot-password" class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              <div id="login-error" class="text-red-500 text-sm text-center" style="display: none;"></div>

              <div class="flex flex-col sm:flex-row gap-3 pt-2">
                <button type="button" id="btn-back"
                        class="w-full sm:w-1/3 py-3 px-4 rounded-xl border-2 border-slate-200
                               dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold
                               hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                  Volver
                </button>
                <button type="submit" id="login-btn"
                        class="w-full sm:flex-1 py-3 px-4 rounded-xl bg-brand-gradient text-white
                               font-bold shadow-lg shadow-indigo-500/30 hover:opacity-90 transition-all">
                  Iniciar Sesión
                </button>
              </div>
            </form>
          </div>

          <!-- Footer -->
          <div class="mt-10 text-center">
            <p class="text-slate-400 text-xs mb-4">Plataforma Educativa NEUVOX © 2024</p>
            <div class="flex justify-center gap-4">
              <button class="p-2 rounded-full bg-slate-100 dark:bg-slate-800
                             text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
                      id="theme-toggle" title="Cambiar tema">
                <span class="material-symbols-outlined text-lg" id="theme-icon">dark_mode</span>
              </button>
              <button class="p-2 rounded-full bg-slate-100 dark:bg-slate-800
                             text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
                      title="Ayuda">
                <span class="material-symbols-outlined text-lg">help_outline</span>
              </button>
            </div>
          </div>

          <!-- Demo mode: hidden by default, triple-click on logo to show -->
          <div id="auth-demo-mode" style="display: none; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--color-gray-200);">
            <p class="text-xs text-slate-400 mb-3 uppercase tracking-widest font-semibold text-center">Modo demostración (emergencia)</p>
            <div class="flex gap-2 flex-wrap justify-center">
              <button class="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onclick="Views.auth.demoLogin('director')">Director</button>
              <button class="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onclick="Views.auth.demoLogin('inspector')">Inspector</button>
              <button class="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onclick="Views.auth.demoLogin('parent')">Apoderado</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;

  // eslint-disable-next-line no-unused-vars -- Prepared for demo mode role selection
  let selectedRole = null;

  // Dark mode toggle handler
  function setupThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    const icon = document.getElementById('theme-icon');
    const html = document.documentElement;

    if (!toggle) return;

    // Initialize icon based on current theme
    if (html.classList.contains('dark')) {
      icon.textContent = 'light_mode';
    }

    toggle.addEventListener('click', () => {
      html.classList.toggle('dark');
      icon.textContent = html.classList.contains('dark') ? 'light_mode' : 'dark_mode';
      // Persist preference
      localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
    });
  }

  // Initialize theme from localStorage or system preference
  function initTheme() {
    const html = document.documentElement;
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || (!stored && window.matchMedia?.('(prefers-color-scheme: dark)').matches)) {
      html.classList.add('dark');
    }
  }

  initTheme();
  setupThemeToggle();

  // Triple-click on logo to reveal demo mode (emergency access)
  let clickCount = 0;
  let clickTimer = null;
  const logo = document.getElementById('auth-logo');
  if (logo) {
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

  // Check if WebAuthn/passkeys are available
  async function checkPasskeySupport() {
    if (typeof WebAuthn !== 'undefined' && WebAuthn.isSupported()) {
      const hasPlatformAuth = await WebAuthn.isPlatformAuthenticatorAvailable();
      if (hasPlatformAuth) {
        const passkeySection = document.getElementById('passkey-login-section');
        if (passkeySection) {
          passkeySection.style.display = 'block';
        }
      }
    }
  }

  // Handle passkey login
  async function handlePasskeyLogin() {
    const errorDiv = document.getElementById('login-error');
    const btn = document.getElementById('btn-passkey-login');

    errorDiv.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = `
      <div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
      Autenticando...
    `;

    try {
      const result = await WebAuthn.authenticateWithPasskey();

      // Get bootstrap data
      const bootstrap = await API.getBootstrap();
      State.setFromBootstrap(bootstrap);

      const user = bootstrap.current_user || bootstrap.user;
      Components.showToast(`Bienvenido, ${user.full_name}`, 'success');

      // Show pending items toast for staff
      const pendingCounts = State.getPendingCounts();
      if (pendingCounts) {
        const messages = [];
        if (pendingCounts.absences > 0) {
          messages.push(`${pendingCounts.absences} ausencia${pendingCounts.absences === 1 ? '' : 's'} por aprobar`);
        }
        if (pendingCounts.withdrawal_requests > 0) {
          messages.push(`${pendingCounts.withdrawal_requests} retiro${pendingCounts.withdrawal_requests === 1 ? '' : 's'} por aprobar`);
        }
        if (messages.length > 0) {
          setTimeout(() => {
            messages.forEach((msg, i) => {
              setTimeout(() => Components.showToast(msg, 'warning', 5000), i * 500);
            });
          }, 1500);
        }
      }

      // Navigate based on role
      const redirectPath = user.role === 'PARENT' ? '/parent/home' : '/director/dashboard';
      Router.navigate(redirectPath);
    } catch (error) {
      console.error('Passkey login error:', error);
      errorDiv.textContent = error.message || 'Error al autenticar con passkey';
      errorDiv.style.display = 'block';

      btn.disabled = false;
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"/>
        </svg>
        Iniciar con huella / Face ID
      `;
    }
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
    // Passkey login button
    if (e.target.closest('#btn-passkey-login')) {
      handlePasskeyLogin();
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

      // Show pending items toast for staff
      const pendingCounts = State.getPendingCounts();
      if (pendingCounts) {
        const messages = [];
        if (pendingCounts.absences > 0) {
          messages.push(`${pendingCounts.absences} ausencia${pendingCounts.absences === 1 ? '' : 's'} por aprobar`);
        }
        if (pendingCounts.withdrawal_requests > 0) {
          messages.push(`${pendingCounts.withdrawal_requests} retiro${pendingCounts.withdrawal_requests === 1 ? '' : 's'} por aprobar`);
        }
        if (messages.length > 0) {
          // Delay to show after welcome toast
          setTimeout(() => {
            messages.forEach((msg, i) => {
              setTimeout(() => Components.showToast(msg, 'warning', 5000), i * 500);
            });
          }, 1500);
        }
      }

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

    // Check for passkey support and show button if available
    checkPasskeySupport();
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
