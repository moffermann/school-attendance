// Director Devices Management (datos reales)
Views.directorDevices = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Puertas y Dispositivos';

  let devices = [];

  async function loadDevices(showToast = false) {
    content.innerHTML = Components.createLoader('Cargando dispositivos...');
    try {
      devices = await State.fetchDevices();
      renderDevices();
      if (showToast) Components.showToast('Dispositivos actualizados', 'success');
    } catch (error) {
      console.error('No se pudieron cargar dispositivos', error);
      content.innerHTML = Components.createEmptyState('No disponible', 'No se pudo cargar la lista de dispositivos.');
    }
  }

  function renderDevices() {
    const activeDevices = devices.filter(d => d.status === 'ACTIVE').length;
    const queueDevices = devices.filter(d => d.status === 'QUEUE').length;
    const lowBattery = devices.filter(d => d.battery_pct < 50).length;

    content.innerHTML = `
      <div class="cards-grid">
        ${Components.createStatCard('Dispositivos Activos', activeDevices)}
        ${Components.createStatCard('En Cola', queueDevices)}
        ${Components.createStatCard('Batería Baja', lowBattery)}
      </div>

      <div class="card">
        <div class="card-header flex justify-between items-center">
          <span>Dispositivos Registrados</span>
          <button class="btn btn-primary btn-sm" onclick="Views.directorDevices.refresh()">Refrescar</button>
        </div>
        <div class="card-body">
          <table>
            <thead>
              <tr>
                <th>Puerta</th>
                <th>Device ID</th>
                <th>Versión</th>
                <th>Última Sincronización</th>
                <th>Pendientes</th>
                <th>Batería</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${devices.map(device => {
                const statusChip = device.status === 'ACTIVE'
                  ? Components.createChip('Activo', 'success')
                  : Components.createChip('Offline', 'warning');

                const batteryClass = device.battery_pct < 30 ? 'error' : device.battery_pct < 50 ? 'warning' : 'success';

                return `
                  <tr>
                    <td>${device.gate_id}</td>
                    <td>${device.device_id}</td>
                    <td>${device.version}</td>
                    <td>${Components.formatDateTime(device.last_sync)}</td>
                    <td>${Components.createChip(device.pending_count, device.pending_count > 0 ? 'warning' : 'gray')}</td>
                    <td>${Components.createChip(device.battery_pct + '%', batteryClass)}</td>
                    <td>${statusChip}</td>
                    <td>
                      <button class="btn btn-secondary btn-sm" onclick="Views.directorDevices.ping(${device.id})">
                        Ping
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="Views.directorDevices.showLogs(${device.id})">
                        Logs
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  Views.directorDevices.refresh = function() {
    loadDevices(true);
  };

  Views.directorDevices.ping = async function(deviceId) {
    try {
      await State.apiFetch(`/devices/${deviceId}/ping`, { method: 'POST' });
      Components.showToast('Ping enviado', 'success');
      await loadDevices();
    } catch (error) {
      console.error('Ping falló', error);
      Components.showToast('No se pudo pingear el dispositivo', 'error');
    }
  };

  Views.directorDevices.showLogs = async function(deviceId) {
    try {
      const logs = await State.apiFetch(`/devices/${deviceId}/logs`);
      Components.showModal(`Logs - ${deviceId}`, `
        <div class="card">
          <div class="card-body">
            <pre style="background: var(--color-gray-900); color: var(--color-gray-100); padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.8125rem;">${logs.join('\n')}</pre>
          </div>
        </div>
      `, [
        { label: 'Cerrar', action: 'close', className: 'btn-secondary' }
      ]);
    } catch (error) {
      console.error('No se pudieron obtener logs', error);
      Components.showToast('No se pudieron cargar logs', 'error');
    }
  };

  loadDevices();
};
