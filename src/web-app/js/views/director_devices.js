// Director Devices Management
Views.directorDevices = async function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Puertas y Dispositivos';

  let devices = [];
  let isLoading = true;

  // Show loading state
  content.innerHTML = Components.createLoader('Cargando dispositivos...');

  // Load devices from API
  try {
    devices = await API.getDevices();
    // Also update State for consistency
    State.data.devices = devices.map(d => ({
      ...d,
      // Map backend fields to frontend display names for compatibility
      status: d.online ? 'ACTIVE' : 'QUEUE',
      version: d.firmware_version,
      pending_count: d.pending_events
    }));
    State.persist();
    isLoading = false;
    renderDevices();
  } catch (error) {
    console.error('Error loading devices:', error);
    isLoading = false;
    content.innerHTML = Components.createEmptyState(
      'Error al cargar',
      'No se pudieron cargar los dispositivos. ' + (error.message || '')
    );
  }

  function renderDevices() {
    // Use backend field names: online (boolean) instead of status
    const onlineDevices = devices.filter(d => d.online).length;
    const offlineDevices = devices.filter(d => !d.online).length;
    const lowBattery = devices.filter(d => d.battery_pct < 50).length;

    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="margin: 0; font-size: 1.25rem; color: var(--color-gray-900);">Kioscos y Dispositivos</h2>
          <p style="margin: 0.25rem 0 0 0; color: var(--color-gray-500); font-size: 0.9rem;">${devices.length} dispositivo${devices.length !== 1 ? 's' : ''} registrado${devices.length !== 1 ? 's' : ''}</p>
        </div>
        <button class="btn btn-primary" onclick="Views.directorDevices.showCreateForm()">
          + Nuevo Dispositivo
        </button>
      </div>

      <div class="cards-grid" style="margin-bottom: 1.5rem;">
        <div class="stat-card" style="border-left: 4px solid var(--color-success);">
          <div class="stat-value">${onlineDevices}</div>
          <div class="stat-label">En Linea</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid var(--color-warning);">
          <div class="stat-value">${offlineDevices}</div>
          <div class="stat-label">Desconectados</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid var(--color-error);">
          <div class="stat-value">${lowBattery}</div>
          <div class="stat-label">Bateria Baja</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Dispositivos Registrados</div>
        <div class="card-body">
          ${devices.length === 0 ? Components.createEmptyState('Sin dispositivos', 'No hay dispositivos registrados. Haga clic en "Nuevo Dispositivo" para agregar uno.') : `
          <table>
            <thead>
              <tr>
                <th>Puerta</th>
                <th>Device ID</th>
                <th>Version</th>
                <th>Ultima Sync</th>
                <th>Pendientes</th>
                <th>Bateria</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${devices.map(device => {
                // Use backend field: online (boolean)
                const statusChip = device.online
                  ? Components.createChip('En Linea', 'success')
                  : Components.createChip('Desconectado', 'warning');

                const batteryClass = device.battery_pct < 30 ? 'error' : device.battery_pct < 50 ? 'warning' : 'success';

                return `
                  <tr>
                    <td><strong>${Components.escapeHtml(device.gate_id)}</strong></td>
                    <td><code style="background: var(--color-gray-100); padding: 0.25rem 0.5rem; border-radius: 4px;">${Components.escapeHtml(device.device_id)}</code></td>
                    <td>${device.firmware_version || '1.0.0'}</td>
                    <td>${device.last_sync ? Components.formatDateTime(device.last_sync) : 'Nunca'}</td>
                    <td>${Components.createChip(device.pending_events || 0, (device.pending_events || 0) > 0 ? 'warning' : 'gray')}</td>
                    <td>${Components.createChip(device.battery_pct + '%', batteryClass)}</td>
                    <td>${statusChip}</td>
                    <td style="white-space: nowrap;">
                      <button class="btn btn-secondary btn-sm" onclick="Views.directorDevices.ping(${device.id})" title="Ping">
                        📡
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="Views.directorDevices.showLogs(${device.id})" title="Ver logs">
                        📋
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="Views.directorDevices.showEditForm(${device.id})" title="Editar">
                        ✏️
                      </button>
                      <button class="btn btn-error btn-sm" onclick="Views.directorDevices.confirmDelete(${device.id})" title="Eliminar">
                        🗑️
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          `}
        </div>
      </div>
    `;
  }

  Views.directorDevices.showCreateForm = function() {
    Components.showModal('Nuevo Dispositivo', `
      <form id="device-form">
        <div class="form-group">
          <label class="form-label">Identificador de Puerta *</label>
          <input type="text" id="device-gate" class="form-input" required placeholder="Ej: PUERTA-PRINCIPAL, ENTRADA-A">
        </div>
        <div class="form-group">
          <label class="form-label">Device ID *</label>
          <input type="text" id="device-id" class="form-input" required placeholder="Ej: KIOSK-001">
        </div>
        <div class="form-group">
          <label class="form-label">Version Firmware</label>
          <input type="text" id="device-version" class="form-input" value="1.0.0" placeholder="Ej: 1.0.0">
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorDevices.saveDevice() }
    ]);
  };

  // Flag to prevent double-click
  let isSaving = false;

  Views.directorDevices.saveDevice = async function(deviceId = null) {
    if (isSaving) return;

    const gateId = document.getElementById('device-gate').value.trim();
    const deviceIdVal = document.getElementById('device-id').value.trim();
    const firmwareVersion = document.getElementById('device-version')?.value.trim() || '1.0.0';

    if (!gateId || !deviceIdVal) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    // Build payload with backend field names
    const payload = {
      gate_id: gateId,
      device_id: deviceIdVal,
      firmware_version: firmwareVersion,
    };

    // For edit, include additional fields if present
    if (deviceId) {
      const batteryInput = document.getElementById('device-battery');
      const onlineSelect = document.getElementById('device-online');
      if (batteryInput) {
        payload.battery_pct = parseInt(batteryInput.value) || 100;
      }
      if (onlineSelect) {
        payload.online = onlineSelect.value === 'true';
      }
    }

    isSaving = true;
    Components.showToast(deviceId ? 'Actualizando...' : 'Creando...', 'info', 2000);

    try {
      let result;
      if (deviceId) {
        result = await API.updateDevice(deviceId, payload);
        // Update local array
        const index = devices.findIndex(d => d.id === deviceId);
        if (index !== -1) {
          devices[index] = result;
        }
        Components.showToast('Dispositivo actualizado correctamente', 'success');
      } else {
        result = await API.createDevice(payload);
        devices.push(result);
        Components.showToast('Dispositivo creado correctamente', 'success');
      }

      document.querySelector('.modal-container')?.click();
      renderDevices();

    } catch (error) {
      console.error('Error saving device:', error);
      Components.showToast(error.message || 'Error al guardar dispositivo', 'error');
    } finally {
      isSaving = false;
    }
  };

  Views.directorDevices.showEditForm = function(deviceId) {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    Components.showModal('Editar Dispositivo', `
      <form id="device-form">
        <div class="form-group">
          <label class="form-label">Identificador de Puerta *</label>
          <input type="text" id="device-gate" class="form-input" required value="${Components.escapeHtml(device.gate_id)}">
        </div>
        <div class="form-group">
          <label class="form-label">Device ID *</label>
          <input type="text" id="device-id" class="form-input" required value="${Components.escapeHtml(device.device_id)}">
        </div>
        <div class="form-group">
          <label class="form-label">Version Firmware</label>
          <input type="text" id="device-version" class="form-input" value="${Components.escapeHtml(device.firmware_version || '1.0.0')}">
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select id="device-online" class="form-select">
            <option value="false" ${!device.online ? 'selected' : ''}>Desconectado</option>
            <option value="true" ${device.online ? 'selected' : ''}>En Linea</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Nivel de Bateria (%)</label>
          <input type="number" id="device-battery" class="form-input" value="${device.battery_pct}" min="0" max="100">
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorDevices.saveDevice(deviceId) }
    ]);
  };

  // Flag to prevent double-click on delete
  let isDeleting = false;

  Views.directorDevices.confirmDelete = function(deviceId) {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    Components.showModal('Confirmar Eliminacion', `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">¿Esta seguro de eliminar el dispositivo?</p>
        <p style="font-weight: 600; color: var(--color-error);">${Components.escapeHtml(device.gate_id)} (${Components.escapeHtml(device.device_id)})</p>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Eliminar', action: 'delete', className: 'btn-error', onClick: async () => {
        if (isDeleting) return;
        isDeleting = true;

        try {
          await API.deleteDevice(deviceId);
          devices = devices.filter(d => d.id !== deviceId);
          document.querySelector('.modal-container')?.click();
          Components.showToast('Dispositivo eliminado', 'success');
          renderDevices();
        } catch (error) {
          console.error('Error deleting device:', error);
          Components.showToast(error.message || 'Error al eliminar dispositivo', 'error');
        } finally {
          isDeleting = false;
        }
      }}
    ]);
  };

  Views.directorDevices.ping = async function(deviceId) {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    Components.showToast(`Enviando ping a ${device.device_id}...`, 'info', 2000);

    try {
      const result = await API.pingDevice(deviceId);
      // Update local device data
      const index = devices.findIndex(d => d.id === deviceId);
      if (index !== -1) {
        devices[index] = result;
      }
      Components.showToast(`Ping a ${device.device_id}: OK`, 'success');
      renderDevices();
    } catch (error) {
      console.error('Error pinging device:', error);
      Components.showToast(`Ping a ${device.device_id}: Error - ${error.message}`, 'error');
    }
  };

  Views.directorDevices.showLogs = async function(deviceId) {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    // Show loading state in modal
    Components.showModal(`Logs - ${device.device_id}`, `
      <div class="card">
        <div class="card-body" style="text-align: center; padding: 2rem;">
          ${Components.createLoader('Cargando logs...')}
        </div>
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);

    try {
      const logs = await API.getDeviceLogs(deviceId);
      const logsText = logs.join('\n');

      // Update modal content with actual logs
      const modalBody = document.querySelector('.modal-body');
      if (modalBody) {
        modalBody.innerHTML = `
          <div class="card">
            <div class="card-body">
              <pre style="background: var(--color-gray-900); color: var(--color-gray-100); padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.8125rem; max-height: 400px; overflow-y: auto;">${Components.escapeHtml(logsText)}</pre>
            </div>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading logs:', error);
      const modalBody = document.querySelector('.modal-body');
      if (modalBody) {
        modalBody.innerHTML = `
          <div class="card" style="border-left: 4px solid var(--color-error);">
            <div class="card-body">
              <p style="color: var(--color-error);">Error al cargar logs: ${error.message}</p>
            </div>
          </div>
        `;
      }
    }
  };
};
