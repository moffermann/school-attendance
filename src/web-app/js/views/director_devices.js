// Director Devices Management
Views.directorDevices = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Puertas y Dispositivos';

  let devices = State.getDevices();

  function renderDevices() {
    const activeDevices = devices.filter(d => d.status === 'ACTIVE').length;
    const queueDevices = devices.filter(d => d.status === 'QUEUE').length;
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
          <div class="stat-value">${activeDevices}</div>
          <div class="stat-label">Activos</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid var(--color-warning);">
          <div class="stat-value">${queueDevices}</div>
          <div class="stat-label">En Cola</div>
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
                const statusChip = device.status === 'ACTIVE'
                  ? Components.createChip('Activo', 'success')
                  : Components.createChip('En Cola', 'warning');

                const batteryClass = device.battery_pct < 30 ? 'error' : device.battery_pct < 50 ? 'warning' : 'success';

                return `
                  <tr>
                    <td><strong>${Components.escapeHtml(device.gate_id)}</strong></td>
                    <td><code style="background: var(--color-gray-100); padding: 0.25rem 0.5rem; border-radius: 4px;">${Components.escapeHtml(device.device_id)}</code></td>
                    <td>${device.version || '1.0'}</td>
                    <td>${Components.formatDateTime(device.last_sync)}</td>
                    <td>${Components.createChip(device.pending_count, device.pending_count > 0 ? 'warning' : 'gray')}</td>
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
          <label class="form-label">Version</label>
          <input type="text" id="device-version" class="form-input" value="1.0" placeholder="Ej: 1.0">
        </div>
        <div class="form-group">
          <label class="form-label">Estado Inicial</label>
          <select id="device-status" class="form-select">
            <option value="QUEUE">En Cola (pendiente de activacion)</option>
            <option value="ACTIVE">Activo</option>
          </select>
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => Views.directorDevices.saveDevice() }
    ]);
  };

  Views.directorDevices.saveDevice = function(deviceId = null) {
    const gateId = document.getElementById('device-gate').value.trim();
    const deviceIdVal = document.getElementById('device-id').value.trim();
    const version = document.getElementById('device-version')?.value.trim() || '1.0';
    const status = document.getElementById('device-status').value;

    if (!gateId || !deviceIdVal) {
      Components.showToast('Complete los campos requeridos', 'error');
      return;
    }

    const deviceData = {
      gate_id: gateId,
      device_id: deviceIdVal,
      version: version,
      status: status
    };

    if (deviceId) {
      State.updateDevice(deviceId, deviceData);
      Components.showToast('Dispositivo actualizado correctamente', 'success');
    } else {
      State.addDevice(deviceData);
      Components.showToast('Dispositivo creado correctamente', 'success');
    }

    // TDD-R8-BUG1 fix: Use optional chaining in case modal was already closed
    document.querySelector('.modal-container')?.click();
    devices = State.getDevices();
    renderDevices();
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
          <label class="form-label">Version</label>
          <input type="text" id="device-version" class="form-input" value="${Components.escapeHtml(device.version || '1.0')}">
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select id="device-status" class="form-select">
            <option value="QUEUE" ${device.status === 'QUEUE' ? 'selected' : ''}>En Cola</option>
            <option value="ACTIVE" ${device.status === 'ACTIVE' ? 'selected' : ''}>Activo</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Nivel de Bateria (%)</label>
          <input type="number" id="device-battery" class="form-input" value="${device.battery_pct}" min="0" max="100">
        </div>
      </form>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      { label: 'Guardar', action: 'save', className: 'btn-primary', onClick: () => {
        const battery = parseInt(document.getElementById('device-battery').value) || 100;
        Views.directorDevices.saveDevice(deviceId);
        State.updateDevice(deviceId, { battery_pct: battery });
      }}
    ]);
  };

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
      { label: 'Eliminar', action: 'delete', className: 'btn-error', onClick: () => {
        State.deleteDevice(deviceId);
        // TDD-R8-BUG1 fix: Use optional chaining in case modal was already closed
    document.querySelector('.modal-container')?.click();
        Components.showToast('Dispositivo eliminado', 'success');
        devices = State.getDevices();
        renderDevices();
      }}
    ]);
  };

  Views.directorDevices.ping = function(deviceId) {
    const device = devices.find(d => d.id === deviceId);
    Components.showToast(`Ping a ${device.device_id}: OK (simulado)`, 'success');
  };

  Views.directorDevices.showLogs = function(deviceId) {
    const device = devices.find(d => d.id === deviceId);

    const mockLogs = `
[${new Date().toISOString()}] INFO: Dispositivo iniciado
[${new Date().toISOString()}] INFO: Conectado a servidor
[${new Date().toISOString()}] INFO: Bateria: ${device.battery_pct}%
[${new Date().toISOString()}] INFO: Eventos pendientes: ${device.pending_count}
[${new Date().toISOString()}] INFO: Ultima sincronizacion exitosa
    `.trim();

    Components.showModal(`Logs - ${device.device_id}`, `
      <div class="card">
        <div class="card-body">
          <pre style="background: var(--color-gray-900); color: var(--color-gray-100); padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.8125rem;">${mockLogs}</pre>
        </div>
      </div>
    `, [
      { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
    ]);
  };

  renderDevices();
};
