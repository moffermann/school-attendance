// Device status view
Views.deviceStatus = function() {
  const app = document.getElementById('app');

  app.innerHTML = `
    ${UI.createHeader()}
    <div class="container">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value" style="color: ${State.device.online ? 'var(--color-success)' : 'var(--color-error)'}">
            ${State.device.online ? 'Online' : 'Offline'}
          </div>
          <div class="stat-label">Conectividad</div>
        </div>

        <div class="stat-card">
          <div class="stat-value" style="color: ${State.device.battery_pct < 30 ? 'var(--color-error)' : State.device.battery_pct < 50 ? 'var(--color-warning)' : 'var(--color-success)'}">
            ${State.device.battery_pct}%
          </div>
          <div class="stat-label">Batería</div>
        </div>

        <div class="stat-card">
          <div class="stat-value">${State.getPendingCount()}</div>
          <div class="stat-label">Cola Pendiente</div>
        </div>

        <div class="stat-card">
          <div class="stat-value">${State.queue.filter(e => e.status === 'error').length}</div>
          <div class="stat-label">Errores</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Información del Dispositivo</div>
        <table>
          <tbody>
            <tr>
              <td><strong>Gate ID</strong></td>
              <td>${State.device.gate_id}</td>
            </tr>
            <tr>
              <td><strong>Device ID</strong></td>
              <td>${State.device.device_id}</td>
            </tr>
            <tr>
              <td><strong>Versión</strong></td>
              <td>${State.device.version}</td>
            </tr>
            <tr>
              <td><strong>Conectividad</strong></td>
              <td>
                ${UI.createChip(State.device.online ? 'Online' : 'Offline', State.device.online ? 'success' : 'error')}
                <button class="btn btn-secondary btn-sm ml-2" onclick="Views.deviceStatus.toggleOnline()">
                  Cambiar
                </button>
              </td>
            </tr>
            <tr>
              <td><strong>Batería</strong></td>
              <td>${State.device.battery_pct}% ${State.device.battery_pct < 30 ? '⚠️ Baja' : ''}</td>
            </tr>
            <tr>
              <td><strong>Eventos en Cola</strong></td>
              <td>${State.queue.length} total (${State.getPendingCount()} pendientes)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex gap-2 flex-wrap">
        <button class="btn btn-primary" onclick="Views.deviceStatus.ping()">
          🔔 Ping de Prueba
        </button>
        <button class="btn btn-secondary" onclick="Views.deviceStatus.heartbeat()">
          💓 Enviar Heartbeat
        </button>
        <button class="btn btn-secondary" onclick="Router.navigate('/home')">
          ← Volver
        </button>
      </div>
    </div>
  `;

  Views.deviceStatus.toggleOnline = function() {
    State.toggleOnline();
    UI.showToast(`Dispositivo ahora ${State.device.online ? 'Online' : 'Offline'}`, 'info');
    Views.deviceStatus();
  };

  Views.deviceStatus.ping = function() {
    if (State.device.online) {
      UI.showToast('Ping OK (simulado)', 'success');
    } else {
      UI.showToast('Error: Dispositivo offline', 'error');
    }
  };

  Views.deviceStatus.heartbeat = function() {
    UI.showToast('Heartbeat enviado (simulado)', 'info');
  };
};
