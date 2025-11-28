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

  // Show loading while fetching preferences from API
  content.innerHTML = Components.createLoader();

  // Default preferences structure
  const defaultPrefs = {
    INGRESO_OK: { whatsapp: true, email: false },
    SALIDA_OK: { whatsapp: true, email: false },
    NO_INGRESO_UMBRAL: { whatsapp: true, email: true },
    CAMBIO_HORARIO: { whatsapp: true, email: true }
  };

  let prefs = { ...defaultPrefs };
  let photoConsents = {};

  // Try to load preferences from API
  try {
    const serverPrefs = await API.getGuardianPreferences(State.currentGuardianId);
    if (serverPrefs.preferences) {
      // Merge server prefs with defaults
      Object.keys(serverPrefs.preferences).forEach(key => {
        prefs[key] = { ...defaultPrefs[key], ...serverPrefs.preferences[key] };
      });
    }
    photoConsents = serverPrefs.photo_consents || {};
  } catch (error) {
    console.warn('Could not load preferences from server, using defaults:', error);
    // Fall back to localStorage if API fails
    const localPrefs = JSON.parse(localStorage.getItem(`prefs_${State.currentGuardianId}`) || '{}');
    if (localPrefs.preferences) {
      prefs = { ...prefs, ...localPrefs.preferences };
    }
    photoConsents = localPrefs.photo_consents || {};
  }

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
                <input type="checkbox" id="pref_INGRESO_OK_whatsapp" class="form-checkbox"
                  ${prefs.INGRESO_OK?.whatsapp ? 'checked' : ''}>
              </td>
              <td>
                <input type="checkbox" id="pref_INGRESO_OK_email" class="form-checkbox"
                  ${prefs.INGRESO_OK?.email ? 'checked' : ''}>
              </td>
            </tr>
            <tr>
              <td>Salida registrada</td>
              <td>
                <input type="checkbox" id="pref_SALIDA_OK_whatsapp" class="form-checkbox"
                  ${prefs.SALIDA_OK?.whatsapp ? 'checked' : ''}>
              </td>
              <td>
                <input type="checkbox" id="pref_SALIDA_OK_email" class="form-checkbox"
                  ${prefs.SALIDA_OK?.email ? 'checked' : ''}>
              </td>
            </tr>
            <tr>
              <td>No registró ingreso antes de horario</td>
              <td>
                <input type="checkbox" id="pref_NO_INGRESO_UMBRAL_whatsapp" class="form-checkbox"
                  ${prefs.NO_INGRESO_UMBRAL?.whatsapp ? 'checked' : ''}>
              </td>
              <td>
                <input type="checkbox" id="pref_NO_INGRESO_UMBRAL_email" class="form-checkbox"
                  ${prefs.NO_INGRESO_UMBRAL?.email ? 'checked' : ''}>
              </td>
            </tr>
            <tr>
              <td>Cambios de horario</td>
              <td>
                <input type="checkbox" id="pref_CAMBIO_HORARIO_whatsapp" class="form-checkbox"
                  ${prefs.CAMBIO_HORARIO?.whatsapp ? 'checked' : ''}>
              </td>
              <td>
                <input type="checkbox" id="pref_CAMBIO_HORARIO_email" class="form-checkbox"
                  ${prefs.CAMBIO_HORARIO?.email ? 'checked' : ''}>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-header">Captura de Foto</div>
      <div class="card-body">
        <p class="mb-2" style="color: var(--color-gray-600);">
          Autorizar captura de foto como evidencia del registro de asistencia.
          Las fotos se enviarán junto con las notificaciones de ingreso/salida.
          <br><strong>Retención:</strong> 60 días. <strong>Uso:</strong> Solo evidencia de asistencia.
        </p>

        ${students.length === 0 ? '<p>No hay estudiantes asociados.</p>' : students.map(student => {
          // photoConsents keys are strings from the API
          const checked = photoConsents[String(student.id)] !== false;
          return `
            <div class="mb-2">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" id="photo_${student.id}" class="form-checkbox" ${checked ? 'checked' : ''}>
                <span><strong>${student.full_name}</strong></span>
                ${checked ?
                  '<span style="color: var(--color-success); font-size: 0.875rem;">Foto autorizada</span>' :
                  '<span style="color: var(--color-warning); font-size: 0.875rem;">Sin foto</span>'
                }
              </label>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-header">Contactos Registrados</div>
      <div class="card-body">
        ${guardian.contacts && guardian.contacts.length > 0 ? `
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${guardian.contacts.map(c => `
              <li class="mb-1">
                <strong>${c.type.toUpperCase()}:</strong> ${c.value}
                ${c.verified ? Components.createChip('Verificado', 'success') : Components.createChip('No verificado', 'warning')}
              </li>
            `).join('')}
          </ul>
        ` : `
          <p style="color: var(--color-gray-600);">
            No hay contactos registrados. Contacte al colegio para actualizar sus datos.
          </p>
        `}
      </div>
    </div>

    <div class="flex gap-2">
      <button class="btn btn-primary" id="btn-save-prefs" onclick="Views.parentPrefs.savePreferences()">
        Guardar Preferencias
      </button>
      <a href="#/parent/home" class="btn btn-secondary">Volver</a>
    </div>
  `;

  // Update checkbox labels dynamically
  students.forEach(student => {
    const checkbox = document.getElementById(`photo_${student.id}`);
    if (checkbox) {
      checkbox.addEventListener('change', function() {
        const label = this.closest('label');
        const statusSpan = label.querySelector('span:last-child');
        if (this.checked) {
          statusSpan.textContent = 'Foto autorizada';
          statusSpan.style.color = 'var(--color-success)';
        } else {
          statusSpan.textContent = 'Sin foto';
          statusSpan.style.color = 'var(--color-warning)';
        }
      });
    }
  });

  Views.parentPrefs.savePreferences = async function() {
    const btn = document.getElementById('btn-save-prefs');
    const originalText = btn.textContent;
    btn.textContent = 'Guardando...';
    btn.disabled = true;

    const notificationTypes = ['INGRESO_OK', 'SALIDA_OK', 'NO_INGRESO_UMBRAL', 'CAMBIO_HORARIO'];

    const newPrefs = {
      preferences: {},
      photo_consents: {}
    };

    // Collect notification preferences
    notificationTypes.forEach(type => {
      newPrefs.preferences[type] = {
        whatsapp: document.getElementById(`pref_${type}_whatsapp`)?.checked || false,
        email: document.getElementById(`pref_${type}_email`)?.checked || false
      };
    });

    // Collect photo consents
    students.forEach(student => {
      const checkbox = document.getElementById(`photo_${student.id}`);
      newPrefs.photo_consents[String(student.id)] = checkbox ? checkbox.checked : false;
    });

    try {
      // Save to API
      await API.updateGuardianPreferences(State.currentGuardianId, newPrefs);

      // Also save to localStorage as backup
      localStorage.setItem(`prefs_${State.currentGuardianId}`, JSON.stringify(newPrefs));

      Components.showToast('Preferencias guardadas exitosamente', 'success');
    } catch (error) {
      console.error('Error saving preferences:', error);
      // Save to localStorage if API fails
      localStorage.setItem(`prefs_${State.currentGuardianId}`, JSON.stringify(newPrefs));
      Components.showToast('Preferencias guardadas localmente (sincronización pendiente)', 'warning');
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  };
};
