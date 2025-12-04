// UI components for kiosk
const UI = {
  // Security: HTML escape function to prevent XSS
  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, char => map[char]);
  },

  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => toast.remove(), duration);
    }
  },

  createHeader() {
    const time = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const pendingCount = State.getPendingCount();

    return `
      <header class="kiosk-header">
        <div class="header-left">
          <img src="assets/logo.svg" alt="Logo" class="header-logo">
          <div>
            <div class="header-title">Kiosco ${State.device.gate_id}</div>
            <div style="font-size: 0.875rem; color: var(--color-gray-500);">${State.device.device_id}</div>
          </div>
        </div>
        <div class="header-time">${time}</div>
        <div class="header-badges">
          <div class="badge ${State.device.online ? 'badge-online' : 'badge-offline'}">
            ${State.device.online ? '🟢 Online' : '🔴 Offline'}
          </div>
          <div class="badge badge-battery">
            🔋 ${State.device.battery_pct}%
          </div>
          ${pendingCount > 0 ? `<div class="badge badge-queue">⏳ ${pendingCount}</div>` : ''}
        </div>
      </header>
    `;
  },

  updateHeaderTime() {
    const timeEl = document.querySelector('.header-time');
    if (timeEl) {
      timeEl.textContent = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    }

    const badges = document.querySelector('.header-badges');
    if (badges) {
      const pendingCount = State.getPendingCount();
      badges.innerHTML = `
        <div class="badge ${State.device.online ? 'badge-online' : 'badge-offline'}">
          ${State.device.online ? '🟢 Online' : '🔴 Offline'}
        </div>
        <div class="badge badge-battery">
          🔋 ${State.device.battery_pct}%
        </div>
        ${pendingCount > 0 ? `<div class="badge badge-queue">⏳ ${pendingCount}</div>` : ''}
      `;
    }
  },

  createChip(label, type = 'gray') {
    return `<span class="chip chip-${type}">${label}</span>`;
  },

  formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  }
};

// R4-F1 fix: Store interval reference for potential cleanup
UI._headerIntervalId = setInterval(() => UI.updateHeaderTime(), 1000);

// Method to stop header updates if needed
UI.stopHeaderUpdates = function() {
  if (this._headerIntervalId) {
    clearInterval(this._headerIntervalId);
    this._headerIntervalId = null;
  }
};
