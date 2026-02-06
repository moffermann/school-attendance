// Forgot Password view - Request password reset email
window.Views = window.Views || {};

Views.forgotPassword = function() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gradient-mesh overflow-hidden relative px-4">
      <div class="blur-decoration absolute -top-24 -left-24 w-96 h-96 bg-primary/20"></div>
      <div class="blur-decoration absolute top-1/2 -right-24 w-80 h-80 bg-purple-500/20"></div>

      <main class="relative z-10 w-full max-w-[480px]">
        <div class="auth-card-new p-8 md:p-12">
          <!-- Logo -->
          <div class="text-center mb-8">
            <div class="flex flex-col items-center mb-6">
              <div class="w-40 h-40 mb-3">
                <img src="assets/logo.png" alt="NEUVOX" class="w-full h-full object-contain">
              </div>
            </div>
            <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
              Recuperar Contraseña
            </h1>
            <p class="text-slate-500 dark:text-slate-400 text-sm">
              Ingrese su email para recibir un enlace de recuperación
            </p>
          </div>

          <!-- Form -->
          <div id="forgot-form-section">
            <form id="forgot-form" class="space-y-5">
              <div>
                <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Email
                </label>
                <input type="email" id="forgot-email"
                       class="auth-input"
                       placeholder="usuario@colegio.cl" required>
              </div>

              <div id="forgot-error" class="text-red-500 text-sm text-center" style="display: none;"></div>

              <button type="submit" id="forgot-btn"
                      class="w-full py-3 px-4 rounded-xl bg-brand-gradient text-white font-bold
                             shadow-lg shadow-indigo-500/30 hover:opacity-90 transition-all">
                Enviar Enlace
              </button>
            </form>

            <div class="mt-6 text-center">
              <a href="#/auth" class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                Volver al Login
              </a>
            </div>
          </div>

          <!-- Success message (hidden by default) -->
          <div id="forgot-success" style="display: none;" class="text-center">
            <div class="mb-6">
              <span class="material-symbols-outlined text-5xl text-green-400">mark_email_read</span>
            </div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-2">Enlace Enviado</h2>
            <p class="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Si el email está registrado en nuestro sistema, recibirás un enlace de recuperación en los próximos minutos.
            </p>
            <p class="text-slate-400 text-xs mb-6">
              Revisa tu bandeja de spam si no lo encuentras en la bandeja de entrada.
            </p>
            <a href="#/auth" class="inline-block px-6 py-3 bg-brand-gradient text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30">
              Volver al Login
            </a>
          </div>
        </div>
      </main>
    </div>
  `;

  // Form submission
  document.getElementById('forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const errorDiv = document.getElementById('forgot-error');
    const btn = document.getElementById('forgot-btn');

    errorDiv.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
      const response = await fetch(`${API.baseUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al enviar el enlace');
      }

      // Always show success (don't reveal if email exists)
      document.getElementById('forgot-form-section').style.display = 'none';
      document.getElementById('forgot-success').style.display = 'block';
    } catch (error) {
      console.error('Forgot password error:', error);
      // Still show success for security (don't reveal email existence)
      document.getElementById('forgot-form-section').style.display = 'none';
      document.getElementById('forgot-success').style.display = 'block';
    }
  });
};
