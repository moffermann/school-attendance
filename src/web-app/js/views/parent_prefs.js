// Parent Notification Preferences - Preferencias de Notificación
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
      Object.keys(serverPrefs.preferences).forEach(key => {
        prefs[key] = { ...defaultPrefs[key], ...serverPrefs.preferences[key] };
      });
    }
    photoConsents = serverPrefs.photo_consents || {};
  } catch (error) {
    console.warn('Could not load preferences from server, using defaults:', error);
    const localPrefs = JSON.parse(localStorage.getItem(`prefs_${State.currentGuardianId}`) || '{}');
    if (localPrefs.preferences) {
      prefs = { ...prefs, ...localPrefs.preferences };
    }
    photoConsents = localPrefs.photo_consents || {};
  }

  const notificationTypes = [
    { key: 'INGRESO_OK', label: 'Ingreso registrado', desc: 'Cuando su hijo/a ingresa al colegio', icon: '📥' },
    { key: 'SALIDA_OK', label: 'Salida registrada', desc: 'Cuando su hijo/a sale del colegio', icon: '📤' },
    { key: 'NO_INGRESO_UMBRAL', label: 'Alerta de no ingreso', desc: 'Si no registra ingreso antes del horario límite', icon: '⚠️' },
    { key: 'CAMBIO_HORARIO', label: 'Cambios de horario', desc: 'Modificaciones en el horario de clases', icon: '📅' }
  ];

  content.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <a href="#/parent/home" class="btn btn-secondary btn-sm" style="margin-bottom: 1rem;">
        ← Volver al inicio
      </a>
      <h2 style="font-size: 1.75rem; font-weight: 700; color: var(--color-gray-900); margin-bottom: 0.5rem;">
        Preferencias de Notificación
      </h2>
      <p style="color: var(--color-gray-500);">Configure cómo y cuándo desea recibir notificaciones</p>
    </div>

    <!-- Canales de Notificación -->
    <div class="card" style="margin-bottom: 1.5rem;">
      <div class="card-header" style="display: flex; align-items: center; gap: 0.75rem;">
        ${Components.icons.notifications}
        <span>Canales de Notificación</span>
      </div>
      <div class="card-body" style="padding: 0;">
        ${notificationTypes.map((type, index) => `
          <div style="display: flex; align-items: center; padding: 1.25rem 1.5rem; ${index < notificationTypes.length - 1 ? 'border-bottom: 1px solid var(--color-gray-100);' : ''}">
            <div style="width: 48px; height: 48px; background: var(--color-primary-50); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-right: 1rem; flex-shrink: 0;">
              ${type.icon}
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; color: var(--color-gray-900);">${type.label}</div>
              <div style="font-size: 0.85rem; color: var(--color-gray-500);">${type.desc}</div>
            </div>
            <div style="display: flex; gap: 1.5rem; flex-shrink: 0;">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" id="pref_${type.key}_whatsapp" class="form-checkbox"
                  ${prefs[type.key]?.whatsapp ? 'checked' : ''}>
                <span style="font-size: 0.85rem; color: var(--color-gray-600);">WhatsApp</span>
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" id="pref_${type.key}_email" class="form-checkbox"
                  ${prefs[type.key]?.email ? 'checked' : ''}>
                <span style="font-size: 0.85rem; color: var(--color-gray-600);">Email</span>
              </label>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Captura de Foto -->
    <div class="card" style="margin-bottom: 1.5rem;">
      <div class="card-header" style="display: flex; align-items: center; gap: 0.75rem;">
        📷
        <span>Autorización de Foto</span>
      </div>
      <div class="card-body">
        <div style="background: var(--color-gray-50); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
          <p style="color: var(--color-gray-600); font-size: 0.9rem; margin: 0;">
            Las fotos se capturan como evidencia del registro de asistencia y se envían junto con las notificaciones.
            <br><strong>Retención:</strong> 60 días &nbsp;•&nbsp; <strong>Uso:</strong> Solo evidencia de asistencia
          </p>
        </div>

        ${students.length === 0 ? '<p style="color: var(--color-gray-500);">No hay estudiantes asociados.</p>' : `
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${students.map(student => {
              const checked = photoConsents[String(student.id)] !== false;
              const course = State.getCourse(student.course_id);
              return `
                <div style="display: flex; align-items: center; padding: 1rem; background: white; border: 2px solid ${checked ? 'var(--color-success)' : 'var(--color-gray-200)'}; border-radius: 12px; transition: all 0.2s;" id="photo-card-${student.id}">
                  <div style="width: 44px; height: 44px; background: var(--gradient-primary); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 1.1rem; margin-right: 1rem;">
                    ${Components.escapeHtml(student.full_name.charAt(0))}
                  </div>
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--color-gray-900);">${Components.escapeHtml(student.full_name)}</div>
                    <div style="font-size: 0.85rem; color: var(--color-gray-500);">${course ? Components.escapeHtml(course.name) : ''}</div>
                  </div>
                  <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
                    <span id="photo-status-${student.id}" style="font-size: 0.85rem; font-weight: 500; color: ${checked ? 'var(--color-success)' : 'var(--color-warning)'};">
                      ${checked ? '✓ Autorizada' : 'Sin autorizar'}
                    </span>
                    <input type="checkbox" id="photo_${student.id}" class="form-checkbox" ${checked ? 'checked' : ''}
                      onchange="Views.parentPrefs.updatePhotoStatus(${student.id}, this.checked)">
                  </label>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>

    <!-- Contactos Registrados -->
    <div class="card" style="margin-bottom: 1.5rem;">
      <div class="card-header" style="display: flex; align-items: center; gap: 0.75rem;">
        📱
        <span>Contactos Registrados</span>
      </div>
      <div class="card-body">
        ${guardian.contacts && guardian.contacts.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${guardian.contacts.map(c => `
              <div style="display: flex; align-items: center; padding: 1rem; background: var(--color-gray-50); border-radius: 12px;">
                <div style="width: 40px; height: 40px; background: ${c.type === 'whatsapp' ? '#25D366' : 'var(--color-primary)'}; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; margin-right: 1rem;">
                  ${c.type === 'whatsapp' ? '📱' : '✉️'}
                </div>
                <div style="flex: 1;">
                  <div style="font-weight: 500; color: var(--color-gray-900);">${c.value}</div>
                  <div style="font-size: 0.8rem; color: var(--color-gray-500); text-transform: capitalize;">${c.type}</div>
                </div>
                ${c.verified
                  ? '<span class="chip chip-success">Verificado</span>'
                  : '<span class="chip chip-warning">Pendiente</span>'}
              </div>
            `).join('')}
          </div>
        ` : `
          <div style="text-align: center; padding: 2rem; color: var(--color-gray-500);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📭</div>
            <p>No hay contactos registrados.</p>
            <p style="font-size: 0.9rem;">Contacte al colegio para actualizar sus datos.</p>
          </div>
        `}
      </div>
    </div>

    <!-- Botones de acción -->
    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
      <button class="btn btn-primary btn-lg" id="btn-save-prefs" onclick="Views.parentPrefs.savePreferences()" style="flex: 1; min-width: 200px;">
        ${Components.icons.settings}
        Guardar Preferencias
      </button>
      <a href="#/parent/home" class="btn btn-secondary btn-lg" style="flex: 1; min-width: 200px; justify-content: center;">
        Cancelar
      </a>
    </div>
  `;

  // Dynamic photo status update
  Views.parentPrefs.updatePhotoStatus = function(studentId, checked) {
    const card = document.getElementById(`photo-card-${studentId}`);
    const status = document.getElementById(`photo-status-${studentId}`);
    if (card) {
      card.style.borderColor = checked ? 'var(--color-success)' : 'var(--color-gray-200)';
    }
    if (status) {
      status.textContent = checked ? '✓ Autorizada' : 'Sin autorizar';
      status.style.color = checked ? 'var(--color-success)' : 'var(--color-warning)';
    }
  };

  Views.parentPrefs.savePreferences = async function() {
    const btn = document.getElementById('btn-save-prefs');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div> Guardando...';
    btn.disabled = true;

    const newPrefs = {
      preferences: {},
      photo_consents: {}
    };

    // Collect notification preferences
    notificationTypes.forEach(type => {
      newPrefs.preferences[type.key] = {
        whatsapp: document.getElementById(`pref_${type.key}_whatsapp`)?.checked || false,
        email: document.getElementById(`pref_${type.key}_email`)?.checked || false
      };
    });

    // Collect photo consents
    students.forEach(student => {
      const checkbox = document.getElementById(`photo_${student.id}`);
      newPrefs.photo_consents[String(student.id)] = checkbox ? checkbox.checked : false;
    });

    try {
      await API.updateGuardianPreferences(State.currentGuardianId, newPrefs);
      localStorage.setItem(`prefs_${State.currentGuardianId}`, JSON.stringify(newPrefs));
      Components.showToast('Preferencias guardadas exitosamente', 'success');
    } catch (error) {
      console.error('Error saving preferences:', error);
      localStorage.setItem(`prefs_${State.currentGuardianId}`, JSON.stringify(newPrefs));
      Components.showToast('Preferencias guardadas localmente', 'warning');
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  };
};
