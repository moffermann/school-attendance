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

    <!-- Captura de Evidencia -->
    <div class="card" style="margin-bottom: 1.5rem;">
      <div class="card-header" style="display: flex; align-items: center; gap: 0.75rem;">
        📸
        <span>Tipo de Evidencia</span>
      </div>
      <div class="card-body">
        <div style="background: var(--color-gray-50); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
          <p style="color: var(--color-gray-600); font-size: 0.9rem; margin: 0;">
            Seleccione el tipo de evidencia que desea capturar durante el registro de asistencia.
            <br><strong>Retención:</strong> 60 días &nbsp;•&nbsp; <strong>Uso:</strong> Solo evidencia de asistencia
          </p>
        </div>

        ${students.length === 0 ? '<p style="color: var(--color-gray-500);">No hay estudiantes asociados.</p>' : `
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${students.map(student => {
              const evidencePref = photoConsents[String(student.id)] === true ? 'photo' :
                                   photoConsents[String(student.id)] === 'audio' ? 'audio' : 'none';
              const course = State.getCourse(student.course_id);
              const statusColors = { photo: 'var(--color-success)', audio: 'var(--color-primary)', none: 'var(--color-gray-400)' };
              const statusLabels = { photo: '📷 Foto', audio: '🎤 Audio', none: '⊘ Sin evidencia' };
              return `
                <div style="padding: 1rem; background: white; border: 2px solid ${statusColors[evidencePref]}; border-radius: 12px; transition: all 0.2s;" id="evidence-card-${student.id}">
                  <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                    <div style="width: 44px; height: 44px; background: var(--gradient-primary); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 1.1rem; margin-right: 1rem;">
                      ${Components.escapeHtml(student.full_name.charAt(0))}
                    </div>
                    <div style="flex: 1;">
                      <div style="font-weight: 600; color: var(--color-gray-900);">${Components.escapeHtml(student.full_name)}</div>
                      <div style="font-size: 0.85rem; color: var(--color-gray-500);">${course ? Components.escapeHtml(course.name) : ''}</div>
                    </div>
                    <span id="evidence-status-${student.id}" style="font-size: 0.85rem; font-weight: 500; color: ${statusColors[evidencePref]};">
                      ${statusLabels[evidencePref]}
                    </span>
                  </div>
                  <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <label style="flex: 1; min-width: 100px;">
                      <input type="radio" name="evidence_${student.id}" value="photo" ${evidencePref === 'photo' ? 'checked' : ''}
                        onchange="Views.parentPrefs.updateEvidencePreference(${student.id}, 'photo')" style="display: none;">
                      <div class="evidence-option ${evidencePref === 'photo' ? 'selected' : ''}" id="opt-photo-${student.id}"
                           onclick="document.querySelector('input[name=evidence_${student.id}][value=photo]').click()">
                        <span style="font-size: 1.5rem;">📷</span>
                        <span>Foto</span>
                      </div>
                    </label>
                    <label style="flex: 1; min-width: 100px;">
                      <input type="radio" name="evidence_${student.id}" value="audio" ${evidencePref === 'audio' ? 'checked' : ''}
                        onchange="Views.parentPrefs.updateEvidencePreference(${student.id}, 'audio')" style="display: none;">
                      <div class="evidence-option ${evidencePref === 'audio' ? 'selected' : ''}" id="opt-audio-${student.id}"
                           onclick="document.querySelector('input[name=evidence_${student.id}][value=audio]').click()">
                        <span style="font-size: 1.5rem;">🎤</span>
                        <span>Audio</span>
                      </div>
                    </label>
                    <label style="flex: 1; min-width: 100px;">
                      <input type="radio" name="evidence_${student.id}" value="none" ${evidencePref === 'none' ? 'checked' : ''}
                        onchange="Views.parentPrefs.updateEvidencePreference(${student.id}, 'none')" style="display: none;">
                      <div class="evidence-option ${evidencePref === 'none' ? 'selected' : ''}" id="opt-none-${student.id}"
                           onclick="document.querySelector('input[name=evidence_${student.id}][value=none]').click()">
                        <span style="font-size: 1.5rem;">⊘</span>
                        <span>Sin evidencia</span>
                      </div>
                    </label>
                  </div>
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

    <!-- Push Notifications -->
    <div class="card" style="margin-bottom: 1.5rem;" id="push-section">
      <div class="card-header" style="display: flex; align-items: center; gap: 0.75rem;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span>Notificaciones Push</span>
      </div>
      <div class="card-body" id="push-content">
        <div id="push-loading" style="text-align: center; padding: 2rem;">
          <div class="spinner"></div>
          <p style="color: var(--color-gray-500); margin-top: 1rem;">Cargando...</p>
        </div>
      </div>
    </div>

    <!-- Seguridad - Passkeys -->
    <div class="card" style="margin-bottom: 1.5rem;" id="passkey-section">
      <div class="card-header" style="display: flex; align-items: center; gap: 0.75rem;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"/>
        </svg>
        <span>Seguridad - Acceso Biometrico</span>
      </div>
      <div class="card-body" id="passkey-content">
        <div id="passkey-loading" style="text-align: center; padding: 2rem;">
          <div class="spinner"></div>
          <p style="color: var(--color-gray-500); margin-top: 1rem;">Cargando...</p>
        </div>
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

  // Dynamic evidence preference update
  Views.parentPrefs.updateEvidencePreference = function(studentId, preference) {
    const card = document.getElementById(`evidence-card-${studentId}`);
    const status = document.getElementById(`evidence-status-${studentId}`);
    const statusColors = { photo: 'var(--color-success)', audio: 'var(--color-primary)', none: 'var(--color-gray-400)' };
    const statusLabels = { photo: '📷 Foto', audio: '🎤 Audio', none: '⊘ Sin evidencia' };

    // Update card border
    if (card) {
      card.style.borderColor = statusColors[preference];
    }

    // Update status text
    if (status) {
      status.textContent = statusLabels[preference];
      status.style.color = statusColors[preference];
    }

    // Update option buttons
    ['photo', 'audio', 'none'].forEach(opt => {
      const optEl = document.getElementById(`opt-${opt}-${studentId}`);
      if (optEl) {
        optEl.classList.toggle('selected', opt === preference);
      }
    });
  };

  // Legacy support
  Views.parentPrefs.updatePhotoStatus = function(studentId, checked) {
    Views.parentPrefs.updateEvidencePreference(studentId, checked ? 'photo' : 'none');
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

    // Collect evidence preferences (stored in photo_consents for compatibility)
    // Values: true = photo, "audio" = audio, false = none
    students.forEach(student => {
      const photoRadio = document.querySelector(`input[name="evidence_${student.id}"][value="photo"]`);
      const audioRadio = document.querySelector(`input[name="evidence_${student.id}"][value="audio"]`);

      if (photoRadio?.checked) {
        newPrefs.photo_consents[String(student.id)] = true;
      } else if (audioRadio?.checked) {
        newPrefs.photo_consents[String(student.id)] = 'audio';
      } else {
        newPrefs.photo_consents[String(student.id)] = false;
      }
    });

    try {
      await API.updateGuardianPreferences(State.currentGuardianId, newPrefs);
      localStorage.setItem(`prefs_${State.currentGuardianId}`, JSON.stringify(newPrefs));
      Components.showToast('Preferencias guardadas exitosamente', 'success');
    } catch (error) {
      console.error('Error saving preferences:', error);
      // R4-F8 fix: Don't save to localStorage if API fails to prevent inconsistency
      // User must retry when online
      Components.showToast('Error al guardar. Verifique su conexión e intente de nuevo.', 'error');
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  };

  // Initialize push notification section
  initPushSection();

  async function initPushSection() {
    const content = document.getElementById('push-content');
    const section = document.getElementById('push-section');

    // Check if push notifications are supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      content.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--color-gray-500);">
          <p>Tu navegador no soporta notificaciones push.</p>
        </div>
      `;
      return;
    }

    // Check notification permission
    const permission = Notification.permission;

    if (permission === 'denied') {
      content.innerHTML = `
        <div style="background: var(--color-warning-50); border-radius: 12px; padding: 1rem; color: var(--color-warning-700);">
          <p style="margin: 0;"><strong>Notificaciones bloqueadas</strong></p>
          <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">
            Has bloqueado las notificaciones. Para activarlas, debes cambiar los permisos en la configuracion de tu navegador.
          </p>
        </div>
      `;
      return;
    }

    // Check if already subscribed
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        // Already subscribed
        content.innerHTML = `
          <div style="background: var(--color-success-50); border-radius: 12px; padding: 1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 32px; height: 32px; background: var(--color-success); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div>
              <div style="font-weight: 600; color: var(--color-success-700);">Notificaciones push activadas</div>
              <div style="font-size: 0.85rem; color: var(--color-success-600);">Recibiras alertas cuando tu hijo ingrese o salga del colegio</div>
            </div>
          </div>
          <button class="btn btn-secondary" id="btn-unsubscribe-push" style="width: 100%;">
            Desactivar notificaciones push
          </button>
        `;

        document.getElementById('btn-unsubscribe-push')?.addEventListener('click', handleUnsubscribePush);
      } else {
        // Not subscribed
        content.innerHTML = `
          <div style="background: var(--color-gray-50); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem;">
            <p style="color: var(--color-gray-600); font-size: 0.9rem; margin: 0;">
              Activa las notificaciones push para recibir alertas instantaneas cuando tu hijo ingrese o salga del colegio.
            </p>
          </div>
          <button class="btn btn-primary" id="btn-subscribe-push" style="width: 100%;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 0.5rem;">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            Activar notificaciones push
          </button>
        `;

        document.getElementById('btn-subscribe-push')?.addEventListener('click', handleSubscribePush);
      }
    } catch (error) {
      console.error('Error checking push subscription:', error);
      content.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--color-gray-500);">
          <p>Error al verificar el estado de notificaciones.</p>
          <button class="btn btn-secondary btn-sm" onclick="Views.parentPrefs.reloadPushSection()">Reintentar</button>
        </div>
      `;
    }
  }

  Views.parentPrefs.reloadPushSection = initPushSection;

  async function handleSubscribePush() {
    const btn = document.getElementById('btn-subscribe-push');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div> Activando...';

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        Components.showToast('Debes permitir las notificaciones', 'error');
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        return;
      }

      // Get VAPID public key from server
      const vapidResponse = await API.fetch('/push/vapid-public-key');
      if (!vapidResponse.ok) {
        throw new Error('No se pudo obtener la clave del servidor');
      }
      const { public_key: vapidPublicKey } = await vapidResponse.json();

      // Subscribe to push
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Get device name
      const deviceName = navigator.userAgent.includes('iPhone') ? 'iPhone' :
                        navigator.userAgent.includes('iPad') ? 'iPad' :
                        navigator.userAgent.includes('Android') ? 'Android' :
                        navigator.userAgent.includes('Mac') ? 'Mac' :
                        navigator.userAgent.includes('Windows') ? 'Windows' : 'Dispositivo';

      // Send subscription to server
      const subJson = subscription.toJSON();
      const response = await API.fetch('/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
          device_name: deviceName,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al registrar la suscripcion');
      }

      Components.showToast('Notificaciones push activadas', 'success');
      await initPushSection();
    } catch (error) {
      console.error('Error subscribing to push:', error);
      Components.showToast(error.message || 'Error al activar notificaciones', 'error');
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }

  async function handleUnsubscribePush() {
    const btn = document.getElementById('btn-unsubscribe-push');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div> Desactivando...';

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Notify server
        const subJson = subscription.toJSON();
        await API.fetch(`/push/unsubscribe?endpoint=${encodeURIComponent(subJson.endpoint)}`, {
          method: 'DELETE',
        });
      }

      Components.showToast('Notificaciones push desactivadas', 'success');
      await initPushSection();
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      Components.showToast(error.message || 'Error al desactivar notificaciones', 'error');
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }

  // Helper function to convert base64 URL to Uint8Array
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Initialize passkey section
  initPasskeySection();

  async function initPasskeySection() {
    const content = document.getElementById('passkey-content');
    const section = document.getElementById('passkey-section');

    // Check if WebAuthn is supported
    if (typeof WebAuthn === 'undefined' || !WebAuthn.isSupported()) {
      section.style.display = 'none';
      return;
    }

    const hasPlatformAuth = await WebAuthn.isPlatformAuthenticatorAvailable();
    if (!hasPlatformAuth) {
      content.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--color-gray-500);">
          <p>Tu dispositivo no soporta autenticacion biometrica.</p>
        </div>
      `;
      return;
    }

    // Load passkeys
    await loadPasskeys();
  }

  async function loadPasskeys() {
    const content = document.getElementById('passkey-content');

    try {
      const passkeys = await WebAuthn.listPasskeys();

      if (passkeys.length === 0) {
        content.innerHTML = `
          <div style="background: var(--color-gray-50); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem;">
            <p style="color: var(--color-gray-600); font-size: 0.9rem; margin: 0;">
              Registra tu huella digital o Face ID para iniciar sesion sin contraseña.
              <br>Es mas rapido y seguro.
            </p>
          </div>
          <button class="btn btn-primary" id="btn-add-passkey" style="width: 100%;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 0.5rem;">
              <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"/>
            </svg>
            Agregar huella / Face ID
          </button>
        `;
      } else {
        content.innerHTML = `
          <div style="background: var(--color-success-50); border-radius: 12px; padding: 1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 32px; height: 32px; background: var(--color-success); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div>
              <div style="font-weight: 600; color: var(--color-success-700);">Acceso biometrico activado</div>
              <div style="font-size: 0.85rem; color: var(--color-success-600);">Puedes iniciar sesion con tu huella o Face ID</div>
            </div>
          </div>

          <div style="margin-bottom: 1rem;">
            <div style="font-weight: 500; color: var(--color-gray-700); margin-bottom: 0.75rem;">Dispositivos registrados:</div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              ${passkeys.map(pk => `
                <div style="display: flex; align-items: center; padding: 0.875rem 1rem; background: var(--color-gray-50); border-radius: 10px;">
                  <div style="flex: 1;">
                    <div style="font-weight: 500; color: var(--color-gray-800);">${Components.escapeHtml(pk.device_name || 'Dispositivo')}</div>
                    <div style="font-size: 0.8rem; color: var(--color-gray-500);">
                      Registrado: ${new Date(pk.created_at).toLocaleDateString('es-CL')}
                      ${pk.last_used_at ? ` • Ultimo uso: ${new Date(pk.last_used_at).toLocaleDateString('es-CL')}` : ''}
                    </div>
                  </div>
                  <button class="btn btn-secondary btn-sm btn-delete-passkey" data-credential-id="${Components.escapeHtml(pk.credential_id)}" style="padding: 0.5rem 0.75rem;">
                    Eliminar
                  </button>
                </div>
              `).join('')}
            </div>
          </div>

          <button class="btn btn-secondary" id="btn-add-passkey" style="width: 100%;">
            + Agregar otro dispositivo
          </button>
        `;
      }

      // Bind event handlers
      const addBtn = document.getElementById('btn-add-passkey');
      if (addBtn) {
        addBtn.addEventListener('click', handleAddPasskey);
      }

      document.querySelectorAll('.btn-delete-passkey').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const credentialId = e.target.dataset.credentialId;
          handleDeletePasskey(credentialId);
        });
      });

    } catch (error) {
      console.error('Error loading passkeys:', error);
      content.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--color-gray-500);">
          <p>Error al cargar passkeys.</p>
          <button class="btn btn-secondary btn-sm" onclick="Views.parentPrefs.reloadPasskeys()">Reintentar</button>
        </div>
      `;
    }
  }

  Views.parentPrefs.reloadPasskeys = loadPasskeys;

  async function handleAddPasskey() {
    const btn = document.getElementById('btn-add-passkey');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div> Registrando...';

    try {
      // Get device name
      const deviceName = navigator.userAgent.includes('iPhone') ? 'iPhone' :
                        navigator.userAgent.includes('iPad') ? 'iPad' :
                        navigator.userAgent.includes('Android') ? 'Android' :
                        navigator.userAgent.includes('Mac') ? 'Mac' :
                        navigator.userAgent.includes('Windows') ? 'Windows' : 'Dispositivo';

      await WebAuthn.registerPasskey(deviceName);
      Components.showToast('Passkey registrado exitosamente', 'success');
      await loadPasskeys();
    } catch (error) {
      console.error('Error registering passkey:', error);
      Components.showToast(error.message || 'Error al registrar passkey', 'error');
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }

  async function handleDeletePasskey(credentialId) {
    const confirmed = await new Promise(resolve => {
      Components.showModal('Eliminar Passkey', `
        <p>¿Estas seguro de que deseas eliminar este passkey?</p>
        <p style="font-size: 0.9rem; color: var(--color-gray-500);">
          Ya no podras usar este dispositivo para iniciar sesion sin contraseña.
        </p>
      `, [
        { label: 'Cancelar', action: 'close', className: 'btn-secondary', onClick: () => resolve(false) },
        { label: 'Eliminar', action: 'submit', className: 'btn-danger', onClick: () => resolve(true) }
      ]);
    });

    if (!confirmed) return;

    try {
      await WebAuthn.deletePasskey(credentialId);
      Components.showToast('Passkey eliminado', 'success');
      await loadPasskeys();
    } catch (error) {
      console.error('Error deleting passkey:', error);
      Components.showToast(error.message || 'Error al eliminar passkey', 'error');
    }
  }
};
