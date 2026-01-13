// Director Broadcast Messages (Comunicados Masivos)
Views.directorBroadcast = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Comunicados Masivos';

  const courses = State.getCourses();

  content.innerHTML = `
    <!-- Explicación de qué es Broadcast -->
    <div class="card" style="background: var(--color-info-light); border-left: 4px solid var(--color-info); margin-bottom: 1rem;">
      <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
        <span style="font-size: 1.5rem;">📢</span>
        <div>
          <strong style="color: var(--color-info-dark);">¿Qué es un Comunicado Masivo?</strong>
          <p style="margin: 0.25rem 0 0; font-size: 0.9rem; color: var(--color-gray-700);">
            Envía mensajes a todos los apoderados de un curso (o de todo el colegio) vía WhatsApp y/o Email.
            Útil para avisos de suspensiones, reuniones, cambios de horario, etc.
          </p>
        </div>
      </div>
    </div>

    <!-- Templates predefinidos -->
    <div class="card mb-3">
      <div class="card-header">📝 Templates Rápidos</div>
      <div class="card-body" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="Views.directorBroadcast.loadTemplate('suspension')">
          Suspensión de clases
        </button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="Views.directorBroadcast.loadTemplate('reunion')">
          Reunión de apoderados
        </button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="Views.directorBroadcast.loadTemplate('horario')">
          Cambio de horario
        </button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="Views.directorBroadcast.loadTemplate('actividad')">
          Actividad especial
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Enviar Mensaje Masivo</div>
      <div class="card-body">
        <form id="broadcast-form">
          <div class="form-group">
            <label class="form-label">Motivo del Mensaje *</label>
            <input type="text" id="broadcast-subject" class="form-input" required
              placeholder="Ej: Cambio de horario, suspensión de clases...">
          </div>

          <div class="form-group">
            <label class="form-label">Mensaje *</label>
            <textarea id="broadcast-message" class="form-textarea" required
              placeholder="Use {{curso}}, {{fecha}}, {{motivo}} como variables"
              rows="6">Estimado/a apoderado/a:

Le informamos que el curso {{curso}} tendrá un cambio de horario el día {{fecha}}.

Motivo: {{motivo}}

Saludos cordiales,
Dirección</textarea>
          </div>

          <div class="flex gap-2">
            <div class="form-group" style="flex: 1;">
              <label class="form-label">Curso Afectado</label>
              <select id="broadcast-course" class="form-select">
                <option value="">Todos</option>
                ${courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>

            <div class="form-group" style="flex: 1;">
              <label class="form-label">Fecha</label>
              <input type="date" id="broadcast-date" class="form-input">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Canal</label>
            <div class="flex gap-2">
              <label style="display: flex; align-items: center;">
                <input type="checkbox" id="channel-whatsapp" class="form-checkbox" checked>
                <span>WhatsApp</span>
              </label>
              <label style="display: flex; align-items: center;">
                <input type="checkbox" id="channel-email" class="form-checkbox" checked>
                <span>Email</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <button type="button" class="btn btn-secondary" onclick="Views.directorBroadcast.showPreview()">
              Vista Previa
            </button>
            <button type="button" id="btn-send-broadcast" class="btn btn-primary" onclick="Views.directorBroadcast.sendBroadcast()">
              📤 Enviar Comunicado
            </button>
          </div>
        </form>
      </div>
    </div>

    <div id="broadcast-results" class="mt-3"></div>
  `;

  // Templates predefinidos
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
    }
  };

  Views.directorBroadcast.loadTemplate = function(templateName) {
    const template = templates[templateName];
    if (template) {
      document.getElementById('broadcast-subject').value = template.subject;
      document.getElementById('broadcast-message').value = template.message;
      Components.showToast('Template cargado', 'success');
    }
  };

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

  // TDD-R8-BUG3 fix: Flag to prevent double-click during send
  let isSending = false;

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
      sendBtn.innerHTML = '⏳ Enviando...';
    }

    Components.showToast('Enviando comunicado...', 'info', 2000);

    try {
      const result = await API.sendBroadcast(payload);

      // Show success results
      const resultsDiv = document.getElementById('broadcast-results');
      resultsDiv.innerHTML = `
        <div class="card" style="border-left: 4px solid var(--color-success);">
          <div class="card-header" style="color: var(--color-success);">✅ Comunicado Enviado</div>
          <div class="card-body">
            <p><strong>Job ID:</strong> ${result.job_id || 'N/A'}</p>
            <p><strong>Destinatarios:</strong> ${result.recipients || 'Procesando...'}</p>
            <p><strong>Estado:</strong> ${Components.createChip('Encolado', 'info')}</p>
            <p class="mt-2" style="font-size: 0.9rem; color: var(--color-gray-600);">
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
        <div class="card" style="border-left: 4px solid var(--color-error);">
          <div class="card-header" style="color: var(--color-error);">❌ Error al Enviar</div>
          <div class="card-body">
            <p>${error.message || 'Error desconocido al enviar el comunicado'}</p>
            <p class="mt-2">Por favor intente nuevamente o contacte al administrador.</p>
          </div>
        </div>
      `;

      Components.showToast('Error al enviar comunicado', 'error');
    } finally {
      // Reset sending state
      isSending = false;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '📤 Enviar Comunicado';
      }
    }
  };
};
