// Director Broadcast Messages
Views.directorBroadcast = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Broadcast Masivo';

  const courses = State.getCourses();

  content.innerHTML = `
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
            <button type="button" class="btn btn-primary" onclick="Views.directorBroadcast.sendBroadcast()">
              Simular Envío
            </button>
          </div>
        </form>
      </div>
    </div>

    <div id="broadcast-results" class="mt-3"></div>
  `;

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

  Views.directorBroadcast.sendBroadcast = function() {
    const form = document.getElementById('broadcast-form');
    if (!Components.validateForm(form)) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    const courseId = document.getElementById('broadcast-course').value;
    const whatsapp = document.getElementById('channel-whatsapp').checked;
    const email = document.getElementById('channel-email').checked;

    // Simulate sending
    Components.showToast('Enviando mensajes...', 'info', 1000);

    setTimeout(() => {
      // Calculate recipients
      let guardians = [];
      if (courseId) {
        const students = State.getStudentsByCourse(parseInt(courseId));
        const studentIds = students.map(s => s.id);
        guardians = State.getGuardians().filter(g =>
          g.student_ids.some(sid => studentIds.includes(sid))
        );
      } else {
        guardians = State.getGuardians();
      }

      // Simulate results
      const totalRecipients = guardians.length;
      const delivered = Math.floor(totalRecipients * 0.85);
      const pending = Math.floor(totalRecipients * 0.10);
      const failed = totalRecipients - delivered - pending;

      const resultsDiv = document.getElementById('broadcast-results');
      resultsDiv.innerHTML = `
        <div class="card">
          <div class="card-header">Resultados del Envío</div>
          <div class="card-body">
            <div class="cards-grid">
              ${Components.createStatCard('Entregados', delivered)}
              ${Components.createStatCard('Pendientes', pending)}
              ${Components.createStatCard('Fallidos', failed)}
            </div>

            <table class="mt-3">
              <thead>
                <tr>
                  <th>Apoderado</th>
                  <th>Canal</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${guardians.slice(0, 10).map(g => {
                  const statuses = ['delivered', 'delivered', 'delivered', 'pending', 'failed'];
                  const status = statuses[Math.floor(Math.random() * statuses.length)];
                  const chipType = status === 'delivered' ? 'success' : status === 'pending' ? 'warning' : 'error';
                  const statusLabel = status === 'delivered' ? 'Entregado' : status === 'pending' ? 'Pendiente' : 'Fallido';

                  return `
                    <tr>
                      <td>${g.full_name}</td>
                      <td>${whatsapp ? 'WhatsApp' : 'Email'}</td>
                      <td>${Components.createChip(statusLabel, chipType)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            ${guardians.length > 10 ? `<p class="mt-2 text-center">... y ${guardians.length - 10} más</p>` : ''}
          </div>
        </div>
      `;

      Components.showToast(`Broadcast completado: ${delivered} entregados`, 'success');
    }, 2000);
  };
};
