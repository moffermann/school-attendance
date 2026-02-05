// Director Broadcast Messages (Comunicados Masivos) - NEUVOX Design
// Redesigned with Tailwind CSS following approved design
// Uses centralized Components for sidebar and navigation

Views.directorBroadcast = function() {
  const app = document.getElementById('app');

  // Get data from State
  const courses = State.getCourses();
  const user = State.getCurrentUser();
  const userName = user?.full_name || 'Director General';
  const currentPath = '/director/broadcast';

  // Templates predefinidos (5 templates como en HTML aprobado)
  const templates = {
    suspension: {
      subject: 'Suspensión de clases',
      message: `Estimado/a apoderado/a:

Le informamos que las clases del curso {{curso}} se encuentran SUSPENDIDAS el día {{fecha}}.

Motivo: {{motivo}}

Los alumnos NO deben asistir al establecimiento en dicha fecha. Las clases se retomarán con normalidad al día siguiente.

Saludos cordiales,
Dirección`
    },
    reunion: {
      subject: 'Reunión de apoderados',
      message: `Estimado/a apoderado/a:

Se convoca a reunión de apoderados del curso {{curso}} para el día {{fecha}}.

Motivo: {{motivo}}

Es muy importante su asistencia. En caso de no poder asistir, favor comunicarse con el profesor jefe.

Saludos cordiales,
Dirección`
    },
    horario: {
      subject: 'Cambio de horario',
      message: `Estimado/a apoderado/a:

Le informamos que el curso {{curso}} tendrá un cambio de horario el día {{fecha}}.

Motivo: {{motivo}}

Por favor tome las precauciones necesarias para el traslado de su pupilo/a.

Saludos cordiales,
Dirección`
    },
    actividad: {
      subject: 'Actividad especial',
      message: `Estimado/a apoderado/a:

Le informamos que el curso {{curso}} participará en una actividad especial el día {{fecha}}.

Actividad: {{motivo}}

Los alumnos deben presentarse con [indique vestimenta o materiales requeridos].

Saludos cordiales,
Dirección`
    },
    urgente: {
      subject: 'Aviso urgente',
      message: `Estimado/a apoderado/a:

AVISO URGENTE

{{motivo}}

Fecha: {{fecha}}
Curso afectado: {{curso}}

Por favor tome las medidas necesarias de forma inmediata.

Saludos cordiales,
Dirección`
    }
  };

  // TDD-R8-BUG3 fix: Flag to prevent double-click during send
  let isSending = false;

  // Render main layout
  app.innerHTML = `
    <div class="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-900">
      ${Components.directorSidebar(currentPath)}

      <!-- Main Content -->
      <main class="flex-1 flex flex-col overflow-hidden relative">
        <!-- Header -->
        <header class="h-20 bg-white dark:bg-card-dark border-b border-border-light dark:border-border-dark flex items-center justify-between px-8 z-10 shadow-sm">
          <div class="flex items-center gap-4">
            <button class="desktop-hidden text-muted-light dark:text-muted-dark hover:text-primary transition-colors" onclick="Components.toggleDirectorSidebar()">
              <span class="material-icons-round text-2xl">menu</span>
            </button>
            <h2 class="text-xl font-bold text-gray-800 dark:text-text-dark">Comunicados Masivos</h2>
          </div>
          <div class="flex items-center gap-2 md:gap-4 flex-1 justify-end">
            <div class="flex items-center gap-2 md:gap-3">
              <div id="notification-bell-placeholder"></div>
              <button class="p-2 rounded-full hover:bg-background-light dark:hover:bg-white/5 transition-colors text-muted-light dark:text-muted-dark" onclick="Views.directorBroadcast.toggleDarkMode()">
                <span class="material-icons-round" id="dark-mode-icon">dark_mode</span>
              </button>
              <div class="flex items-center gap-2 cursor-pointer">
                <div class="w-9 h-9 rounded-full border border-gray-200 bg-indigo-600 flex items-center justify-center text-white font-semibold">
                  ${userName.charAt(0).toUpperCase()}
                </div>
                <div class="text-right mobile-hidden">
                  <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">${Components.escapeHtml(userName)}</p>
                </div>
              </div>
              <a class="ml-1 md:ml-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 border px-2 md:px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 dark:border-gray-600" href="#" onclick="event.preventDefault(); State.logout(); Router.navigate('/login')">
                <span class="material-icons-round text-lg">logout</span>
                <span class="mobile-hidden">Salir</span>
              </a>
            </div>
          </div>
        </header>

        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f8fafc] dark:bg-slate-900">
          <div class="space-y-6 max-w-4xl mx-auto">
            <!-- Info Card (Blue Theme) -->
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl p-4 flex items-start gap-4">
              <div class="bg-blue-100 dark:bg-blue-800 p-2 rounded-full text-blue-600 dark:text-blue-300 flex-shrink-0">
                <span class="material-icons-round">info</span>
              </div>
              <div>
                <h4 class="text-blue-900 dark:text-blue-200 font-bold">¿Qué es un Comunicado Masivo?</h4>
                <p class="text-sm text-blue-700 dark:text-blue-400">Envía mensajes a todos los apoderados de un curso (o de todo el colegio) vía WhatsApp y/o Email. Útil para avisos de suspensiones, reuniones, cambios de horario, etc.</p>
              </div>
            </div>

            <!-- Templates Rápidos Panel -->
            <div class="bg-white dark:bg-card-dark rounded-xl p-6 shadow-sm border border-border-light dark:border-border-dark">
              <div class="flex items-center gap-2 mb-4">
                <span class="material-icons-round text-indigo-500">auto_awesome</span>
                <h3 class="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Templates Rápidos</h3>
              </div>
              <div class="flex flex-wrap gap-3">
                <button onclick="Views.directorBroadcast.loadTemplate('suspension')"
                        class="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-full text-sm font-medium
                               hover:bg-indigo-50 hover:border-indigo-200 dark:hover:bg-indigo-900/30
                               transition-all text-gray-700 dark:text-gray-300">
                  Suspensión de clases
                </button>
                <button onclick="Views.directorBroadcast.loadTemplate('reunion')"
                        class="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-full text-sm font-medium
                               hover:bg-indigo-50 hover:border-indigo-200 dark:hover:bg-indigo-900/30
                               transition-all text-gray-700 dark:text-gray-300">
                  Reunión de apoderados
                </button>
                <button onclick="Views.directorBroadcast.loadTemplate('horario')"
                        class="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-full text-sm font-medium
                               hover:bg-indigo-50 hover:border-indigo-200 dark:hover:bg-indigo-900/30
                               transition-all text-gray-700 dark:text-gray-300">
                  Cambio de horario
                </button>
                <button onclick="Views.directorBroadcast.loadTemplate('actividad')"
                        class="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-full text-sm font-medium
                               hover:bg-indigo-50 hover:border-indigo-200 dark:hover:bg-indigo-900/30
                               transition-all text-gray-700 dark:text-gray-300">
                  Actividad especial
                </button>
                <button onclick="Views.directorBroadcast.loadTemplate('urgente')"
                        class="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-full text-sm font-medium
                               hover:bg-indigo-50 hover:border-indigo-200 dark:hover:bg-indigo-900/30
                               transition-all text-gray-700 dark:text-gray-300">
                  Aviso urgente
                </button>
              </div>
            </div>

            <!-- Form Card -->
            <div class="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
              <!-- Header -->
              <div class="p-6 border-b border-border-light dark:border-border-dark">
                <h3 class="text-lg font-bold text-gray-800 dark:text-text-dark">Enviar Mensaje Masivo</h3>
              </div>

              <!-- Form Body -->
              <form id="broadcast-form" class="p-6 space-y-6">
                <!-- Motivo del Mensaje -->
                <div>
                  <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Motivo del Mensaje *</label>
                  <input id="broadcast-subject" type="text" required
                         class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg
                                focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-card-dark
                                text-gray-700 dark:text-gray-200 shadow-sm"
                         placeholder="Ej: Cambio de horario, suspensión de clases..."/>
                </div>

                <!-- Mensaje -->
                <div>
                  <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Mensaje *</label>
                  <textarea id="broadcast-message" required rows="6"
                            class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg
                                   focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-card-dark
                                   text-gray-700 dark:text-gray-200 shadow-sm"
                            placeholder="Escriba su mensaje aquí. Puede usar variables como {{curso}} y {{fecha}}.">Estimado/a apoderado/a:

Le informamos que el curso {{curso}} tendrá un cambio de horario el día {{fecha}}.

Motivo: {{motivo}}

Saludos cordiales,
Dirección</textarea>
                  <p class="mt-2 text-xs text-gray-500">Sugerencia: "Estimado/a apoderado/a, le informamos que el curso {{curso}} tendrá un cambio de horario el día {{fecha}}."</p>
                </div>

                <!-- Grid: Curso + Fecha -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <!-- Curso Afectado -->
                  <div>
                    <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Curso Afectado</label>
                    <div class="relative">
                      <select id="broadcast-course"
                              class="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg
                                     focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-card-dark
                                     text-gray-700 dark:text-gray-200 shadow-sm appearance-none">
                        <option value="">Todos los cursos</option>
                        ${courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                      </select>
                      <span class="absolute left-3 top-2.5 text-gray-400 material-icons-round">groups</span>
                    </div>
                  </div>

                  <!-- Fecha del Evento -->
                  <div>
                    <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Fecha del Evento</label>
                    <div class="relative">
                      <input id="broadcast-date" type="date"
                             class="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg
                                    focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-card-dark
                                    text-gray-700 dark:text-gray-200 shadow-sm"/>
                      <span class="absolute left-3 top-2.5 text-gray-400 material-icons-round">calendar_today</span>
                    </div>
                  </div>
                </div>

                <!-- Canal de Envío -->
                <div class="border-t border-gray-100 dark:border-gray-700 pt-6">
                  <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Canal de Envío</label>
                  <div class="flex gap-8">
                    <!-- WhatsApp -->
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input id="channel-whatsapp" type="checkbox" checked
                             class="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                      <div class="flex items-center gap-2">
                        <span class="material-icons-round text-green-500">chat</span>
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 transition-colors">WhatsApp</span>
                      </div>
                    </label>
                    <!-- Email -->
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input id="channel-email" type="checkbox" checked
                             class="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                      <div class="flex items-center gap-2">
                        <span class="material-icons-round text-blue-500">mail</span>
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 transition-colors">Email</span>
                      </div>
                    </label>
                  </div>
                </div>
              </form>

              <!-- Footer with Buttons -->
              <div class="p-6 bg-gray-50 dark:bg-white/5 flex flex-col md:flex-row justify-end gap-3 border-t border-border-light dark:border-border-dark">
                <button onclick="Views.directorBroadcast.showPreview()"
                        class="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300
                               rounded-lg text-sm font-semibold hover:bg-gray-100 dark:hover:bg-gray-700
                               transition-colors flex items-center justify-center gap-2">
                  <span class="material-icons-round text-lg">visibility</span>
                  Vista Previa
                </button>
                <button id="btn-send-broadcast" onclick="Views.directorBroadcast.sendBroadcast()"
                        class="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700
                               text-white rounded-lg text-sm font-semibold shadow-md shadow-indigo-200 dark:shadow-none
                               transition-all flex items-center justify-center gap-2">
                  <span class="material-icons-round text-lg">send</span>
                  Enviar Comunicado
                </button>
              </div>
            </div>

            <!-- Results Area -->
            <div id="broadcast-results"></div>
          </div>

          <!-- Footer -->
          <footer class="text-center text-xs text-muted-light dark:text-muted-dark pt-8 pb-4">
            &copy; 2026 NEUVOX. Todos los derechos reservados.
          </footer>
        </div>
      </main>
    </div>
  `;

  // Update dark mode icon on load
  updateDarkModeIcon();

  // Load template function
  Views.directorBroadcast.loadTemplate = function(templateName) {
    const template = templates[templateName];
    if (template) {
      document.getElementById('broadcast-subject').value = template.subject;
      document.getElementById('broadcast-message').value = template.message;
      Components.showToast('Template cargado', 'success');
    }
  };

  // Show preview modal
  Views.directorBroadcast.showPreview = function() {
    const subject = document.getElementById('broadcast-subject').value || '[motivo]';
    const message = document.getElementById('broadcast-message').value;
    const courseId = document.getElementById('broadcast-course').value;
    const date = document.getElementById('broadcast-date').value || new Date().toISOString().split('T')[0];

    const courseName = courseId ? State.getCourse(parseInt(courseId)).name : 'Todos';

    const previewMessage = message
      .replace(/\{\{curso\}\}/g, courseName)
      .replace(/\{\{fecha\}\}/g, Components.formatDate(date))
      .replace(/\{\{motivo\}\}/g, subject);

    Components.showModal('Vista Previa del Mensaje', `
      <div class="card">
        <div class="card-header">Destinatarios</div>
        <div class="card-body">
          <p><strong>Curso:</strong> ${courseName}</p>
          <p><strong>Canales:</strong> ${[
            document.getElementById('channel-whatsapp').checked ? 'WhatsApp' : null,
            document.getElementById('channel-email').checked ? 'Email' : null
          ].filter(Boolean).join(', ')}</p>
        </div>
      </div>

      <div class="card mt-2">
        <div class="card-header">Mensaje</div>
        <div class="card-body">
          <pre style="white-space: pre-wrap; font-family: inherit;">${previewMessage}</pre>
        </div>
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);
  };

  // Send broadcast (PRESERVED backend logic)
  Views.directorBroadcast.sendBroadcast = async function() {
    // Prevent double-click during send
    if (isSending) return;

    const form = document.getElementById('broadcast-form');
    if (!Components.validateForm(form)) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    // Get form values
    const subject = document.getElementById('broadcast-subject').value.trim();
    const messageRaw = document.getElementById('broadcast-message').value;
    const courseId = document.getElementById('broadcast-course').value;
    const date = document.getElementById('broadcast-date').value || new Date().toISOString().split('T')[0];
    const whatsapp = document.getElementById('channel-whatsapp').checked;
    const email = document.getElementById('channel-email').checked;

    // Validate at least one channel selected
    if (!whatsapp && !email) {
      Components.showToast('Seleccione al menos un canal (WhatsApp o Email)', 'error');
      return;
    }

    // Replace template variables in message
    const courseName = courseId ? State.getCourse(parseInt(courseId))?.name || 'Curso' : 'Todos los cursos';
    const message = messageRaw
      .replace(/\{\{curso\}\}/g, courseName)
      .replace(/\{\{fecha\}\}/g, Components.formatDate(date))
      .replace(/\{\{motivo\}\}/g, subject);

    // Build audience based on course selection
    const audience = courseId
      ? { scope: 'course', course_ids: [parseInt(courseId)] }
      : { scope: 'global' };

    // Build request payload
    const payload = {
      subject,
      message,
      template: 'BROADCAST',
      audience,
      // channels not sent - backend sends to all configured channels
    };

    isSending = true;
    const sendBtn = document.getElementById('btn-send-broadcast');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<span class="material-icons-round text-lg animate-spin">sync</span> Enviando...';
    }

    Components.showToast('Enviando comunicado...', 'info', 2000);

    try {
      const result = await API.sendBroadcast(payload);

      // Show success results
      const resultsDiv = document.getElementById('broadcast-results');
      resultsDiv.innerHTML = `
        <div class="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-green-200 dark:border-green-800 overflow-hidden">
          <div class="px-6 py-4 border-b border-green-100 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <div class="flex items-center gap-2 text-green-700 dark:text-green-400">
              <span class="material-icons-round">check_circle</span>
              <h3 class="font-bold">Comunicado Enviado</h3>
            </div>
          </div>
          <div class="p-6 space-y-2">
            <p class="text-sm text-gray-600 dark:text-gray-400"><strong class="text-gray-800 dark:text-gray-200">Job ID:</strong> ${result.job_id || 'N/A'}</p>
            <p class="text-sm text-gray-600 dark:text-gray-400"><strong class="text-gray-800 dark:text-gray-200">Destinatarios:</strong> ${result.recipients || 'Procesando...'}</p>
            <p class="text-sm text-gray-600 dark:text-gray-400"><strong class="text-gray-800 dark:text-gray-200">Estado:</strong> ${Components.createChip('Encolado', 'info')}</p>
            <p class="mt-4 text-xs text-gray-500 dark:text-gray-500">
              Los mensajes se enviarán en segundo plano. El estado se actualizará en el historial de notificaciones.
            </p>
          </div>
        </div>
      `;

      Components.showToast('Comunicado enviado correctamente', 'success');

      // Clear form after successful send
      document.getElementById('broadcast-subject').value = '';
      document.getElementById('broadcast-message').value = '';
      document.getElementById('broadcast-date').value = '';

    } catch (error) {
      console.error('Error sending broadcast:', error);

      const resultsDiv = document.getElementById('broadcast-results');
      resultsDiv.innerHTML = `
        <div class="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-red-200 dark:border-red-800 overflow-hidden">
          <div class="px-6 py-4 border-b border-red-100 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <div class="flex items-center gap-2 text-red-700 dark:text-red-400">
              <span class="material-icons-round">error</span>
              <h3 class="font-bold">Error al Enviar</h3>
            </div>
          </div>
          <div class="p-6 space-y-2">
            <p class="text-sm text-gray-600 dark:text-gray-400">${error.message || 'Error desconocido al enviar el comunicado'}</p>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-500">Por favor intente nuevamente o contacte al administrador.</p>
          </div>
        </div>
      `;

      Components.showToast('Error al enviar comunicado', 'error');
    } finally {
      // Reset sending state
      isSending = false;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<span class="material-icons-round text-lg">send</span> Enviar Comunicado';
      }
    }
  };

  // Toggle dark mode
  Views.directorBroadcast.toggleDarkMode = function() {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', document.documentElement.classList.contains('dark'));
    updateDarkModeIcon();
  };

  function updateDarkModeIcon() {
    const icon = document.getElementById('dark-mode-icon');
    if (icon) {
      icon.textContent = document.documentElement.classList.contains('dark') ? 'light_mode' : 'dark_mode';
    }
  }
};
