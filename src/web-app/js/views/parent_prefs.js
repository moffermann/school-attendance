// Parent Notification Preferences
Views.parentPrefs = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout('parent');

  const content = document.getElementById('view-content');

  if (!State.currentGuardianId) {
    content.innerHTML = Components.createEmptyState('Error', 'No hay apoderado seleccionado');
    return;
  }

  const guardian = State.getGuardian(State.currentGuardianId);
  const students = State.getGuardianStudents(State.currentGuardianId);

  // Load preferences from localStorage
  const prefsKey = `prefs_${State.currentGuardianId}`;
  let prefs = JSON.parse(localStorage.getItem(prefsKey) || '{}');

  // Default preferences
  prefs = {
    notify_in: { whatsapp: true, email: true, ...prefs.notify_in },
    notify_out: { whatsapp: true, email: false, ...prefs.notify_out },
    notify_no_in: { whatsapp: true, email: true, ...prefs.notify_no_in },
    notify_schedule: { whatsapp: true, email: true, ...prefs.notify_schedule },
    photo_opt_in: prefs.photo_opt_in || {}
  };

  content.innerHTML = `
    <h2 class="mb-3">Preferencias de Notificación</h2>

    <div class="card mb-3">
      <div class="card-header">Canales de Notificación</div>
      <div class="card-body">
        <p class="mb-2" style="color: var(--color-gray-600);">
          Seleccione cómo desea recibir notificaciones para cada tipo de evento:
        </p>

        <table>
          <thead>
            <tr>
              <th>Tipo de Evento</th>
              <th>WhatsApp</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Ingreso registrado</td>
              <td>
                <input type="checkbox" id="notify_in_whatsapp" class="form-checkbox"
                  ${prefs.notify_in.whatsapp ? 'checked' : ''}>
              </td>
              <td>
                <input type="checkbox" id="notify_in_email" class="form-checkbox"
                  ${prefs.notify_in.email ? 'checked' : ''}>
              </td>
            </tr>
            <tr>
              <td>Salida registrada</td>
              <td>
                <input type="checkbox" id="notify_out_whatsapp" class="form-checkbox"
                  ${prefs.notify_out.whatsapp ? 'checked' : ''}>
              </td>
              <td>
                <input type="checkbox" id="notify_out_email" class="form-checkbox"
                  ${prefs.notify_out.email ? 'checked' : ''}>
              </td>
            </tr>
            <tr>
              <td>No registró ingreso antes de horario</td>
              <td>
                <input type="checkbox" id="notify_no_in_whatsapp" class="form-checkbox"
                  ${prefs.notify_no_in.whatsapp ? 'checked' : ''}>
              </td>
              <td>
                <input type="checkbox" id="notify_no_in_email" class="form-checkbox"
                  ${prefs.notify_no_in.email ? 'checked' : ''}>
              </td>
            </tr>
            <tr>
              <td>Cambios de horario</td>
              <td>
                <input type="checkbox" id="notify_schedule_whatsapp" class="form-checkbox"
                  ${prefs.notify_schedule.whatsapp ? 'checked' : ''}>
              </td>
              <td>
                <input type="checkbox" id="notify_schedule_email" class="form-checkbox"
                  ${prefs.notify_schedule.email ? 'checked' : ''}>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-header">Captura de Foto (Opt-in)</div>
      <div class="card-body">
        <p class="mb-2" style="color: var(--color-gray-600);">
          La foto solo se usa como evidencia del registro. Retención: 60 días.
        </p>

        ${students.map(student => {
          const checked = prefs.photo_opt_in[student.id] !== false; // default true
          return `
            <div class="mb-2">
              <label style="display: flex; align-items: center;">
                <input type="checkbox" id="photo_${student.id}" class="form-checkbox" ${checked ? 'checked' : ''}>
                <span><strong>${student.full_name}</strong> - Autorizar captura de foto</span>
              </label>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-header">Contactos Registrados</div>
      <div class="card-body">
        <ul style="list-style: none; padding: 0;">
          ${guardian.contacts.map(c => `
            <li class="mb-1">
              <strong>${c.type.toUpperCase()}:</strong> ${c.value}
              ${c.verified ? Components.createChip('Verificado', 'success') : Components.createChip('No verificado', 'warning')}
            </li>
          `).join('')}
        </ul>
      </div>
    </div>

    <div>
      <button class="btn btn-primary" onclick="Views.parentPrefs.savePreferences()">
        Guardar Preferencias
      </button>
      <a href="#/parent/home" class="btn btn-secondary">Volver</a>
    </div>
  `;

  Views.parentPrefs.savePreferences = function() {
    const newPrefs = {
      notify_in: {
        whatsapp: document.getElementById('notify_in_whatsapp').checked,
        email: document.getElementById('notify_in_email').checked
      },
      notify_out: {
        whatsapp: document.getElementById('notify_out_whatsapp').checked,
        email: document.getElementById('notify_out_email').checked
      },
      notify_no_in: {
        whatsapp: document.getElementById('notify_no_in_whatsapp').checked,
        email: document.getElementById('notify_no_in_email').checked
      },
      notify_schedule: {
        whatsapp: document.getElementById('notify_schedule_whatsapp').checked,
        email: document.getElementById('notify_schedule_email').checked
      },
      photo_opt_in: {}
    };

    students.forEach(student => {
      newPrefs.photo_opt_in[student.id] = document.getElementById(`photo_${student.id}`).checked;
    });

    localStorage.setItem(prefsKey, JSON.stringify(newPrefs));
    Components.showToast('Preferencias guardadas exitosamente', 'success');
  };
};
