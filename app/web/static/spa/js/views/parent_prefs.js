// Parent notification preferences powered by backend APIs

const TEMPLATE_KEY_MAP = {
  notify_in: 'INGRESO_OK',
  notify_out: 'SALIDA_OK',
  notify_no_in: 'NO_INGRESO_UMBRAL',
  notify_schedule: 'CAMBIO_HORARIO'
};

const DEFAULT_CHANNEL_SELECTION = {
  INGRESO_OK: { whatsapp: true, email: true },
  SALIDA_OK: { whatsapp: true, email: false },
  NO_INGRESO_UMBRAL: { whatsapp: true, email: true },
  CAMBIO_HORARIO: { whatsapp: true, email: true }
};

const CHANNEL_CONTROL_IDS = {
  notify_in: { whatsapp: 'notify_in_whatsapp', email: 'notify_in_email' },
  notify_out: { whatsapp: 'notify_out_whatsapp', email: 'notify_out_email' },
  notify_no_in: { whatsapp: 'notify_no_in_whatsapp', email: 'notify_no_in_email' },
  notify_schedule: { whatsapp: 'notify_schedule_whatsapp', email: 'notify_schedule_email' }
};

// Parent Notification Preferences
Views.parentPrefs = async function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout('parent');

  const content = document.getElementById('view-content');

  if (!State.currentGuardianId) {
    content.innerHTML = Components.createEmptyState('Error', 'No hay apoderado seleccionado');
    return;
  }

  const guardian = State.getGuardian(State.currentGuardianId);
  const students = State.getGuardianStudents(State.currentGuardianId);

  if (!guardian) {
    content.innerHTML = Components.createEmptyState('Error', 'No fue posible cargar la información del apoderado.');
    return;
  }

  if (!students.length) {
    content.innerHTML = Components.createEmptyState('Sin alumnos', 'No hay estudiantes asociados a tu cuenta.');
    return;
  }

  content.innerHTML = Components.createLoader('Cargando preferencias...');

  function normalizeNotificationPrefs(rawPrefs) {
    const normalized = {};
    Object.entries(TEMPLATE_KEY_MAP).forEach(([localKey, templateKey]) => {
      const defaults = { ...DEFAULT_CHANNEL_SELECTION[templateKey] };
      const entries = rawPrefs[templateKey] || [];
      entries.forEach((entry) => {
        const channel = (entry?.channel || entry || '').toString().toUpperCase();
        const enabled = entry?.enabled !== undefined ? Boolean(entry.enabled) : true;
        if (channel === 'WHATSAPP') {
          defaults.whatsapp = enabled;
        } else if (channel === 'EMAIL') {
          defaults.email = enabled;
        }
      });
      normalized[localKey] = defaults;
    });
    return normalized;
  }

  function normalizePhotoConsents(rawConsents) {
    const map = {};
    Object.entries(rawConsents || {}).forEach(([key, value]) => {
      const studentId = Number.parseInt(key, 10);
      if (!Number.isNaN(studentId)) {
        map[studentId] = Boolean(value);
      }
    });
    students.forEach((student) => {
      if (!Object.prototype.hasOwnProperty.call(map, student.id)) {
        map[student.id] = Boolean(student.photo_pref_opt_in);
      }
    });
    return map;
  }

  function render(prefs, photoMap) {
    const notificationRows = [
      { label: 'Ingreso registrado', key: 'notify_in' },
      { label: 'Salida registrada', key: 'notify_out' },
      { label: 'No registró ingreso antes de horario', key: 'notify_no_in' },
      { label: 'Cambios de horario', key: 'notify_schedule' }
    ];

    content.innerHTML = `
      <h2 class="mb-3">Preferencias de Notificación</h2>

      <div class="card mb-3">
        <div class="card-header">Canales de Notificación</div>
        <div class="card-body">
          <p class="mb-2" style="color: var(--color-gray-600);">
            Ajusta cómo deseas recibir notificaciones para cada evento relevante.
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
              ${notificationRows.map(({ label, key }) => {
                const controls = CHANNEL_CONTROL_IDS[key];
                const values = prefs[key] || { whatsapp: true, email: true };
                return `
                  <tr>
                    <td>${label}</td>
                    <td>
                      <input type="checkbox" id="${controls.whatsapp}" class="form-checkbox"
                        ${values.whatsapp ? 'checked' : ''}>
                    </td>
                    <td>
                      <input type="checkbox" id="${controls.email}" class="form-checkbox"
                        ${values.email ? 'checked' : ''}>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header">Captura de Foto (Opt-in)</div>
        <div class="card-body">
          <p class="mb-2" style="color: var(--color-gray-600);">
            Las fotos se utilizan únicamente como respaldo de ingreso y se eliminan automáticamente tras 60 días.
          </p>
          ${students.map((student) => {
            const checked = photoMap[student.id] !== false;
            return `
              <div class="mb-2">
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                  <input type="checkbox" id="photo_${student.id}" class="form-checkbox" ${checked ? 'checked' : ''}>
                  <span><strong>${student.full_name}</strong> · Autorizar captura de foto</span>
                </label>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header">Contactos Registrados</div>
        <div class="card-body">
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${guardiansContacts()}
          </ul>
        </div>
      </div>

      <div id="prefs-status" class="form-message" aria-live="polite"></div>

      <div class="mt-3" style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <button class="btn btn-primary" id="save-prefs-button" onclick="Views.parentPrefs.savePreferences()">
          Guardar Preferencias
        </button>
        <a href="#/parent/home" class="btn btn-secondary">Volver</a>
      </div>
    `;
  }

  function guardiansContacts() {
    if (!guardian.contacts || !guardian.contacts.length) {
      return '<li>No hay contactos configurados.</li>';
    }
    return guardian.contacts.map((contact) => {
      const label = contact.type ? contact.type.toUpperCase() : 'CANAL';
      const chip = contact.verified
        ? Components.createChip('Verificado', 'success')
        : Components.createChip('No verificado', 'warning');
      return `
        <li class="mb-1">
          <strong>${label}:</strong> ${contact.value}
          ${chip}
        </li>
      `;
    }).join('');
  }

  function buildPreferencesPayload() {
    const payload = {};
    Object.entries(TEMPLATE_KEY_MAP).forEach(([localKey, templateKey]) => {
      const controls = CHANNEL_CONTROL_IDS[localKey];
      const channels = [];
      const whatsappEl = document.getElementById(controls.whatsapp);
      const emailEl = document.getElementById(controls.email);
      if (whatsappEl && whatsappEl.checked) {
        channels.push({ channel: 'WHATSAPP', enabled: true });
      }
      if (emailEl && emailEl.checked) {
        channels.push({ channel: 'EMAIL', enabled: true });
      }
      payload[templateKey] = channels;
    });
    return payload;
  }

  function buildPhotoPayload() {
    const payload = {};
    students.forEach((student) => {
      const checkbox = document.getElementById(`photo_${student.id}`);
      if (checkbox) {
        payload[student.id] = checkbox.checked;
      }
    });
    return payload;
  }

  let remotePrefs;
  try {
    remotePrefs = await State.apiFetch(`/parents/${State.currentGuardianId}/preferences`);
  } catch (error) {
    console.error('Error al cargar preferencias del apoderado', error);
    content.innerHTML = Components.createEmptyState(
      'Error',
      'No fue posible cargar tus preferencias. Intenta nuevamente más tarde.'
    );
    return;
  }

  const notificationPrefs = normalizeNotificationPrefs(remotePrefs?.preferences || {});
  const photoConsents = normalizePhotoConsents(remotePrefs?.photo_consents || {});

  render(notificationPrefs, photoConsents);

  Views.parentPrefs.savePreferences = async function() {
    const button = document.getElementById('save-prefs-button');
    const statusEl = document.getElementById('prefs-status');

    if (button) button.disabled = true;
    if (statusEl) {
      statusEl.textContent = 'Guardando...';
      statusEl.className = 'form-message';
    }

    const payload = {
      preferences: buildPreferencesPayload(),
      photo_consents: buildPhotoPayload()
    };

    try {
      const response = await State.apiFetch(`/parents/${State.currentGuardianId}/preferences`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      const updatedPhoto = normalizePhotoConsents(response?.photo_consents || {});
      State.data.students = State.data.students.map((student) => {
        if (Object.prototype.hasOwnProperty.call(updatedPhoto, student.id)) {
          return { ...student, photo_pref_opt_in: updatedPhoto[student.id] };
        }
        return student;
      });

      if (statusEl) {
        statusEl.textContent = 'Preferencias guardadas correctamente.';
        statusEl.className = 'form-message success';
      }
      Components.showToast('Preferencias actualizadas', 'success');
    } catch (error) {
      console.error('No se pudo guardar las preferencias', error);
      if (statusEl) {
        statusEl.textContent = error?.message || 'No fue posible guardar tus preferencias.';
        statusEl.className = 'form-message error';
      }
      Components.showToast('No se pudo guardar tus preferencias', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  };
};
