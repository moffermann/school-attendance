// Director Devices Management
Views.directorDevices = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Puertas y Dispositivos';

  const devices = State.getDevices();

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
      <div class="card-header">Dispositivos Registrados</div>
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
                : Components.createChip('En Cola', 'warning');

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

  Views.directorDevices.ping = function(deviceId) {
    const device = devices.find(d => d.id === deviceId);
    Components.showToast(`Ping a ${device.device_id}: OK (simulado)`, 'success');
  };

  Views.directorDevices.showLogs = function(deviceId) {
    const device = devices.find(d => d.id === deviceId);

    const mockLogs = `
[${new Date().toISOString()}] INFO: Dispositivo iniciado
[${new Date().toISOString()}] INFO: Conectado a servidor
[${new Date().toISOString()}] INFO: Batería: ${device.battery_pct}%
[${new Date().toISOString()}] INFO: Eventos pendientes: ${device.pending_count}
[${new Date().toISOString()}] INFO: Última sincronización exitosa
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
};
