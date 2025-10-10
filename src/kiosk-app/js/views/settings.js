// Settings view
Views.settings = function() {
  const app = document.getElementById('app');

  app.innerHTML = `
    ${UI.createHeader()}
    <div class="container">
      <div class="card">
        <div class="card-header">Configuración Inicial</div>

        <div class="form-group">
          <label class="form-label">Gate ID *</label>
          <input type="text" id="gate-id" class="form-input" value="${State.device.gate_id || ''}" placeholder="Ej: GATE-1">
        </div>

        <div class="form-group">
          <label class="form-label">Device ID *</label>
          <input type="text" id="device-id" class="form-input" value="${State.device.device_id || ''}" placeholder="Ej: DEV-01">
          <button class="btn btn-secondary mt-1" onclick="Views.settings.generateDeviceId()">
            Generar Automáticamente
          </button>
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 1rem;">
            <input type="checkbox" id="photo-enabled" ${State.config.photoEnabled ? 'checked' : ''} style="width: 32px; height: 32px;">
            <span style="font-size: 1.125rem;">Captura de Foto Habilitada</span>
          </label>
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 1rem;">
            <input type="checkbox" id="high-contrast" ${State.config.highContrast ? 'checked' : ''} style="width: 32px; height: 32px;">
            <span style="font-size: 1.125rem;">Modo Alto Contraste</span>
          </label>
        </div>

        <div class="flex gap-2">
          <button class="btn btn-primary btn-lg" onclick="Views.settings.save()">
            💾 Guardar y Aplicar
          </button>
          ${State.device.gate_id ? `
            <button class="btn btn-secondary" onclick="Router.navigate('/home')">
              ← Volver
            </button>
          ` : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-header">Datos de Prueba</div>

        <div class="flex gap-2 flex-wrap">
          <button class="btn btn-secondary" onclick="Views.settings.loadTestData()">
            📥 Cargar Datos de Ejemplo
          </button>
          <button class="btn btn-error" onclick="Views.settings.clearQueue()">
            🗑️ Vaciar Cola
          </button>
          <button class="btn btn-warning" onclick="Views.settings.simulateLowBattery()">
            🔋 Simular Batería Baja
          </button>
        </div>
      </div>
    </div>
  `;

  Views.settings.generateDeviceId = function() {
    const id = 'DEV-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    document.getElementById('device-id').value = id;
  };

  Views.settings.save = function() {
    const gateId = document.getElementById('gate-id').value.trim();
    const deviceId = document.getElementById('device-id').value.trim();

    if (!gateId || !deviceId) {
      UI.showToast('Gate ID y Device ID son requeridos', 'error');
      return;
    }

    State.device.gate_id = gateId;
    State.device.device_id = deviceId;
    State.config.photoEnabled = document.getElementById('photo-enabled').checked;
    State.config.highContrast = document.getElementById('high-contrast').checked;

    State.persist();

    // Apply high contrast
    if (State.config.highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }

    UI.showToast('Configuración guardada', 'success');
    Router.navigate('/home');
  };

  Views.settings.loadTestData = function() {
    State.loadFromJSON();
    UI.showToast('Datos de ejemplo cargados', 'success');
  };

  Views.settings.clearQueue = function() {
    if (confirm('¿Vaciar toda la cola?')) {
      State.queue = [];
      State.persist();
      UI.showToast('Cola vaciada', 'success');
    }
  };

  Views.settings.simulateLowBattery = function() {
    State.device.battery_pct = 15;
    State.persist();
    UI.showToast('Batería simulada en 15%', 'warning');
    Views.settings();
  };
};
