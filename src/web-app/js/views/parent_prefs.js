// Parent Notification Preferences - Preferencias de Notificación
Views.parentPrefs = async function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout('parent', { activeView: 'prefs' });

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
    { key: 'INGRESO_OK', label: 'Ingreso registrado', desc: 'Cuando su hijo/a ingresa al colegio', icon: 'login', color: 'green' },
    { key: 'SALIDA_OK', label: 'Salida registrada', desc: 'Cuando su hijo/a sale del colegio', icon: 'logout', color: 'indigo' },
    { key: 'NO_INGRESO_UMBRAL', label: 'Alerta de no ingreso', desc: 'Si no registra ingreso antes del horario límite', icon: 'warning', color: 'red' },
    { key: 'CAMBIO_HORARIO', label: 'Cambios de horario', desc: 'Modificaciones en el horario de clases', icon: 'schedule', color: 'blue' }
  ];

  // Helper: Create toggle switch with Tailwind peer-checked
  function createToggle(id, checked, onChange) {
    return `
      <label class="inline-flex items-center cursor-pointer">
        <input type="checkbox" class="sr-only peer" id="${id}"
               ${checked ? 'checked' : ''} onchange="${onChange}">
        <div class="relative w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer
                    peer-checked:bg-indigo-600
                    after:content-[''] after:absolute after:top-[2px] after:start-[2px]
                    after:bg-white after:rounded-full after:h-4 after:w-4
                    after:transition-all peer-checked:after:translate-x-full
                    rtl:peer-checked:after:-translate-x-full"></div>
      </label>
    `;
  }

  // Helper: Create evidence option buttons
  function createEvidenceOptions(studentId, currentOption) {
    const options = [
      { value: 'photo', icon: 'photo_camera', label: 'Foto' },
      { value: 'audio', icon: 'mic', label: 'Audio' },
      { value: 'none', icon: 'block', label: 'Sin evidencia' }
    ];

    return `
      <div class="grid grid-cols-3 gap-2" id="evidence-options-${studentId}">
        ${options.map(opt => `
          <button type="button"
                  class="evidence-option-btn ${currentOption === opt.value ? 'active' : ''}"
                  data-student="${studentId}" data-option="${opt.value}"
                  onclick="Views.parentPrefs.selectEvidenceOption(${studentId}, '${opt.value}')">
            <span class="material-symbols-outlined text-xl mb-1">${opt.icon}</span>
            <span class="text-xs font-medium">${opt.label}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  const colorMap = {
    green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
    indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400' },
    red: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
    blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' }
  };

  content.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Preferencias</h2>
      <p class="text-gray-500 dark:text-gray-400 text-sm">Configure cómo y cuándo desea recibir notificaciones</p>
    </div>

    <!-- Notification Channels -->
    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 mb-4">
      <div class="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <span class="material-symbols-outlined text-lg text-indigo-600 dark:text-indigo-400">notifications_active</span>
        </div>
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">Canales de Notificación</h3>
      </div>
      <div class="divide-y divide-gray-50 dark:divide-gray-800">
        ${notificationTypes.map(type => {
          const colors = colorMap[type.color] || colorMap.indigo;
          return `
            <div class="p-4 flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0">
                <span class="material-symbols-outlined text-lg ${colors.text}">${type.icon}</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-900 dark:text-white">${type.label}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">${type.desc}</p>
              </div>
              <div class="flex items-center gap-4 flex-shrink-0">
                <div class="flex flex-col items-center gap-1">
                  ${createToggle(`pref_${type.key}_whatsapp`, prefs[type.key]?.whatsapp, '')}
                  <span class="text-[10px] text-gray-400 font-medium">WhatsApp</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                  ${createToggle(`pref_${type.key}_email`, prefs[type.key]?.email, '')}
                  <span class="text-[10px] text-gray-400 font-medium">Email</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Evidence Type -->
    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 mb-4">
      <div class="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <span class="material-symbols-outlined text-lg text-purple-600 dark:text-purple-400">photo_camera</span>
        </div>
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">Tipo de Evidencia</h3>
      </div>
      <div class="p-4">
        <div class="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 mb-4">
          <p class="text-xs text-gray-600 dark:text-gray-400">
            Seleccione el tipo de evidencia durante el registro de asistencia.
            <span class="font-medium">Retención:</span> 60 días &bull; <span class="font-medium">Uso:</span> Solo evidencia de asistencia
          </p>
        </div>

        ${students.length === 0 ? '<p class="text-sm text-gray-500">No hay estudiantes asociados.</p>' : `
          <div class="flex flex-col gap-4">
            ${students.map(student => {
              const evidencePref = photoConsents[String(student.id)] === true ? 'photo' :
                                   photoConsents[String(student.id)] === 'audio' ? 'audio' : 'none';
              const course = State.getCourse(student.course_id);

              const avatarColors = [
                { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400' },
                { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
                { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
                { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400' }
              ];
              const avatarColor = avatarColors[student.id % avatarColors.length];

              return `
                <div class="border border-gray-100 dark:border-slate-700 rounded-xl p-4" id="evidence-card-${student.id}">
                  <div class="flex items-center gap-3 mb-3">
                    <div class="w-10 h-10 rounded-full ${avatarColor.bg} ${avatarColor.text} flex items-center justify-center text-base font-bold">
                      ${Components.escapeHtml(student.full_name.charAt(0))}
                    </div>
                    <div class="flex-1">
                      <p class="text-sm font-semibold text-gray-900 dark:text-white">${Components.escapeHtml(student.full_name)}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">${course ? Components.escapeHtml(course.name) : ''}</p>
                    </div>
                  </div>
                  ${createEvidenceOptions(student.id, evidencePref)}
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>

    <!-- Contacts -->
    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 mb-4">
      <div class="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <span class="material-symbols-outlined text-lg text-green-600 dark:text-green-400">contacts</span>
        </div>
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">Contactos Registrados</h3>
      </div>
      <div class="p-4">
        ${guardian.contacts && guardian.contacts.length > 0 ? `
          <div class="flex flex-col gap-3">
            ${guardian.contacts.map(c => `
              <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                            ${c.type === 'whatsapp' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}">
                  <span class="material-symbols-outlined text-lg
                               ${c.type === 'whatsapp' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}">
                    ${c.type === 'whatsapp' ? 'chat' : c.type === 'phone' || c.type === 'sms' ? 'sms' : 'mail'}
                  </span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-white truncate">${c.value}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 capitalize">${c.type}</p>
                </div>
                ${c.verified
                  ? `<span class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium">
                      <span class="material-symbols-outlined text-xs">verified</span> Verificado
                    </span>`
                  : `<span class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 font-medium">
                      <span class="material-symbols-outlined text-xs">pending</span> Pendiente
                    </span>`}
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="text-center py-6">
            <span class="material-symbols-outlined text-3xl text-gray-300 dark:text-gray-600 mb-2 block">contact_mail</span>
            <p class="text-sm text-gray-500 dark:text-gray-400">No hay contactos registrados.</p>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Contacte al colegio para actualizar sus datos.</p>
          </div>
        `}
      </div>
    </div>

    <!-- Push Notifications -->
    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 mb-4" id="push-section">
      <div class="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <span class="material-symbols-outlined text-lg text-orange-600 dark:text-orange-400">notifications</span>
        </div>
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">Notificaciones Push</h3>
      </div>
      <div class="p-4" id="push-content">
        <div class="flex items-center justify-center py-4">
          <div class="animate-spin w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full"></div>
        </div>
      </div>
    </div>

    <!-- Passkeys / Biometric -->
    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 mb-6" id="passkey-section">
      <div class="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
          <span class="material-symbols-outlined text-lg text-pink-600 dark:text-pink-400">fingerprint</span>
        </div>
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">Acceso Biométrico</h3>
      </div>
      <div class="p-4" id="passkey-content">
        <div class="flex items-center justify-center py-4">
          <div class="animate-spin w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full"></div>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex flex-col sm:flex-row gap-3">
      <button class="btn-gradient flex-1" id="btn-save-prefs" onclick="Views.parentPrefs.savePreferences()">
        <span class="material-symbols-outlined">save</span>
        Guardar Preferencias
      </button>
      <a href="#/parent/home"
         class="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-semibold text-gray-700 dark:text-gray-300 text-center">
        <span class="material-symbols-outlined">close</span>
        Cancelar
      </a>
    </div>
  `;

  // Evidence option handler
  Views.parentPrefs.selectEvidenceOption = function(studentId, option) {
    const container = document.getElementById(`evidence-options-${studentId}`);
    if (container) {
      container.querySelectorAll('.evidence-option-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.option === option);
      });
    }
  };

  // Dynamic evidence preference update (legacy compatibility)
  Views.parentPrefs.updateEvidencePreference = function(studentId, preference) {
    Views.parentPrefs.selectEvidenceOption(studentId, preference);
  };

  // Legacy support
  Views.parentPrefs.updatePhotoStatus = function(studentId, checked) {
    Views.parentPrefs.selectEvidenceOption(studentId, checked ? 'photo' : 'none');
  };

  Views.parentPrefs.savePreferences = async function() {
    const btn = document.getElementById('btn-save-prefs');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Guardando...';
    btn.disabled = true;
    btn.classList.add('opacity-60');

    const newPrefs = {
      preferences: {},
      photo_consents: {}
    };

    // Collect notification preferences from toggles
    notificationTypes.forEach(type => {
      newPrefs.preferences[type.key] = {
        whatsapp: document.getElementById(`pref_${type.key}_whatsapp`)?.checked || false,
        email: document.getElementById(`pref_${type.key}_email`)?.checked || false
      };
    });

    // Collect evidence preferences from active buttons
    students.forEach(student => {
      const container = document.getElementById(`evidence-options-${student.id}`);
      if (container) {
        const activeBtn = container.querySelector('.evidence-option-btn.active');
        const option = activeBtn ? activeBtn.dataset.option : 'none';
        if (option === 'photo') {
          newPrefs.photo_consents[String(student.id)] = true;
        } else if (option === 'audio') {
          newPrefs.photo_consents[String(student.id)] = 'audio';
        } else {
          newPrefs.photo_consents[String(student.id)] = false;
        }
      }
    });

    try {
      await API.updateGuardianPreferences(State.currentGuardianId, newPrefs);
      localStorage.setItem(`prefs_${State.currentGuardianId}`, JSON.stringify(newPrefs));
      Components.showToast('Preferencias guardadas exitosamente', 'success');
    } catch (error) {
      console.error('Error saving preferences:', error);
      Components.showToast('Error al guardar. Verifique su conexión e intente de nuevo.', 'error');
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
      btn.classList.remove('opacity-60');
    }
  };

  // Initialize push notification section
  initPushSection();

  async function initPushSection() {
    const pushContent = document.getElementById('push-content');
    const section = document.getElementById('push-section');

    // Check if push notifications are supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      pushContent.innerHTML = `
        <div class="text-center py-4 text-gray-500 dark:text-gray-400">
          <span class="material-symbols-outlined text-2xl mb-1 block">notifications_off</span>
          <p class="text-sm">Tu navegador no soporta notificaciones push.</p>
        </div>
      `;
      return;
    }

    // Check notification permission
    const permission = Notification.permission;

    if (permission === 'denied') {
      pushContent.innerHTML = `
        <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
          <p class="text-sm font-medium text-yellow-700 dark:text-yellow-400">Notificaciones bloqueadas</p>
          <p class="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
            Has bloqueado las notificaciones. Para activarlas, cambia los permisos en la configuración de tu navegador.
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
        pushContent.innerHTML = `
          <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-3 flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <span class="material-symbols-outlined text-base text-white">check</span>
            </div>
            <div>
              <p class="text-sm font-medium text-green-700 dark:text-green-400">Notificaciones push activadas</p>
              <p class="text-xs text-green-600 dark:text-green-500">Recibirás alertas cuando tu hijo ingrese o salga del colegio</p>
            </div>
          </div>
          <button class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700
                         hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-medium text-gray-700 dark:text-gray-300"
                  id="btn-unsubscribe-push">
            <span class="material-symbols-outlined text-lg">notifications_off</span>
            Desactivar notificaciones push
          </button>
        `;

        document.getElementById('btn-unsubscribe-push')?.addEventListener('click', handleUnsubscribePush);
      } else {
        pushContent.innerHTML = `
          <div class="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 mb-3">
            <p class="text-xs text-gray-600 dark:text-gray-400">
              Activa las notificaciones push para recibir alertas instantáneas cuando tu hijo ingrese o salga del colegio.
            </p>
          </div>
          <button class="btn-gradient w-full" id="btn-subscribe-push">
            <span class="material-symbols-outlined">notifications_active</span>
            Activar notificaciones push
          </button>
        `;

        document.getElementById('btn-subscribe-push')?.addEventListener('click', handleSubscribePush);
      }
    } catch (error) {
      console.error('Error checking push subscription:', error);
      pushContent.innerHTML = `
        <div class="text-center py-4 text-gray-500 dark:text-gray-400">
          <span class="material-symbols-outlined text-2xl mb-1 block">error</span>
          <p class="text-sm">Error al verificar el estado de notificaciones.</p>
          <button class="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                  onclick="Views.parentPrefs.reloadPushSection()">Reintentar</button>
        </div>
      `;
    }
  }

  Views.parentPrefs.reloadPushSection = initPushSection;

  async function handleSubscribePush() {
    const btn = document.getElementById('btn-subscribe-push');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('opacity-60');
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Activando...';

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        Components.showToast('Debes permitir las notificaciones', 'error');
        btn.disabled = false;
        btn.classList.remove('opacity-60');
        btn.innerHTML = originalHTML;
        return;
      }

      const vapidResponse = await API.fetch('/push/vapid-public-key');
      if (!vapidResponse.ok) {
        throw new Error('No se pudo obtener la clave del servidor');
      }
      const { public_key: vapidPublicKey } = await vapidResponse.json();

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const deviceName = navigator.userAgent.includes('iPhone') ? 'iPhone' :
                        navigator.userAgent.includes('iPad') ? 'iPad' :
                        navigator.userAgent.includes('Android') ? 'Android' :
                        navigator.userAgent.includes('Mac') ? 'Mac' :
                        navigator.userAgent.includes('Windows') ? 'Windows' : 'Dispositivo';

      const subJson = subscription.toJSON();
      const response = await API.fetch('/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
          device_name: deviceName,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al registrar la suscripción');
      }

      Components.showToast('Notificaciones push activadas', 'success');
      await initPushSection();
    } catch (error) {
      console.error('Error subscribing to push:', error);
      Components.showToast(error.message || 'Error al activar notificaciones', 'error');
      btn.disabled = false;
      btn.classList.remove('opacity-60');
      btn.innerHTML = originalHTML;
    }
  }

  async function handleUnsubscribePush() {
    const btn = document.getElementById('btn-unsubscribe-push');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('opacity-60');
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Desactivando...';

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
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
      btn.classList.remove('opacity-60');
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
    const passkeyContent = document.getElementById('passkey-content');
    const section = document.getElementById('passkey-section');

    // Check if WebAuthn is supported
    if (typeof WebAuthn === 'undefined' || !WebAuthn.isSupported()) {
      section.style.display = 'none';
      return;
    }

    const hasPlatformAuth = await WebAuthn.isPlatformAuthenticatorAvailable();
    if (!hasPlatformAuth) {
      passkeyContent.innerHTML = `
        <div class="text-center py-4 text-gray-500 dark:text-gray-400">
          <span class="material-symbols-outlined text-2xl mb-1 block">no_encryption</span>
          <p class="text-sm">Tu dispositivo no soporta autenticación biométrica.</p>
        </div>
      `;
      return;
    }

    await loadPasskeys();
  }

  async function loadPasskeys() {
    const passkeyContent = document.getElementById('passkey-content');

    try {
      const passkeys = await WebAuthn.listPasskeys();

      if (passkeys.length === 0) {
        passkeyContent.innerHTML = `
          <div class="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 mb-3">
            <p class="text-xs text-gray-600 dark:text-gray-400">
              Registra tu huella digital o Face ID para iniciar sesión sin contraseña. Es más rápido y seguro.
            </p>
          </div>
          <button class="btn-gradient w-full" id="btn-add-passkey">
            <span class="material-symbols-outlined">fingerprint</span>
            Agregar huella / Face ID
          </button>
        `;
      } else {
        passkeyContent.innerHTML = `
          <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-3 flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <span class="material-symbols-outlined text-base text-white">check</span>
            </div>
            <div>
              <p class="text-sm font-medium text-green-700 dark:text-green-400">Acceso biométrico activado</p>
              <p class="text-xs text-green-600 dark:text-green-500">Puedes iniciar sesión con tu huella o Face ID</p>
            </div>
          </div>

          <div class="mb-3">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Dispositivos registrados</p>
            <div class="flex flex-col gap-2">
              ${passkeys.map(pk => `
                <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <span class="material-symbols-outlined text-lg text-gray-400">devices</span>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">${Components.escapeHtml(pk.device_name || 'Dispositivo')}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      Registrado: ${new Date(pk.created_at).toLocaleDateString('es-CL')}
                      ${pk.last_used_at ? ` &bull; Último uso: ${new Date(pk.last_used_at).toLocaleDateString('es-CL')}` : ''}
                    </p>
                  </div>
                  <button class="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 btn-delete-passkey"
                          data-credential-id="${Components.escapeHtml(pk.credential_id)}">
                    <span class="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>

          <button class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700
                         hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-medium text-gray-700 dark:text-gray-300"
                  id="btn-add-passkey">
            <span class="material-symbols-outlined text-lg">add</span>
            Agregar otro dispositivo
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
          const credentialId = e.currentTarget.dataset.credentialId;
          handleDeletePasskey(credentialId);
        });
      });

    } catch (error) {
      console.error('Error loading passkeys:', error);
      passkeyContent.innerHTML = `
        <div class="text-center py-4 text-gray-500 dark:text-gray-400">
          <span class="material-symbols-outlined text-2xl mb-1 block">error</span>
          <p class="text-sm">Error al cargar passkeys.</p>
          <button class="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                  onclick="Views.parentPrefs.reloadPasskeys()">Reintentar</button>
        </div>
      `;
    }
  }

  Views.parentPrefs.reloadPasskeys = loadPasskeys;

  async function handleAddPasskey() {
    const btn = document.getElementById('btn-add-passkey');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('opacity-60');
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Registrando...';

    try {
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
      btn.classList.remove('opacity-60');
      btn.innerHTML = originalHTML;
    }
  }

  async function handleDeletePasskey(credentialId) {
    const confirmed = await new Promise(resolve => {
      Components.showModal('Eliminar Passkey', `
        <p>¿Estás seguro de que deseas eliminar este passkey?</p>
        <p style="font-size: 0.9rem; color: var(--color-gray-500);">
          Ya no podrás usar este dispositivo para iniciar sesión sin contraseña.
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
