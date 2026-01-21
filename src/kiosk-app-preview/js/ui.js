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
  },

  // =====================================================
  // KIOSK REDESIGN 2026 - New Reusable Components
  // =====================================================

  /**
   * Creates a glass panel button with blur effect
   * @param {string} content - Inner HTML content
   * @param {string} onClick - onclick handler as string
   * @returns {string} HTML string
   */
  createGlassPanel(content, onClick = '') {
    const onClickAttr = onClick ? `onclick="${this.escapeHtml(onClick)}"` : '';
    return `<button class="glass-panel px-6 py-3 rounded-xl flex items-center gap-2
                           text-slate-400 hover:text-white transition-all text-sm font-medium"
                    ${onClickAttr}>
      ${content}
    </button>`;
  },

  /**
   * Creates a status badge showing online/offline state
   * @param {boolean} isOnline - Current online status
   * @returns {string} HTML string
   */
  createStatusBadge(isOnline) {
    const colorClass = isOnline ? 'bg-green' : 'bg-red';
    const pingColor = isOnline ? 'green' : 'red';
    const text = isOnline ? 'Sistema Online' : 'Sistema Offline';
    return `<div class="glass-panel px-4 py-2 rounded-full flex items-center gap-3">
      <span class="flex h-3 w-3 relative">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style="background-color: ${isOnline ? '#22C55E' : '#EF4444'};"></span>
        <span class="relative inline-flex rounded-full h-3 w-3"
              style="background-color: ${isOnline ? '#22C55E' : '#EF4444'};"></span>
      </span>
      <span class="text-xs font-bold tracking-widest text-slate-300 uppercase">${text}</span>
    </div>`;
  },

  /**
   * Creates animated QR corner markers for the scanner
   * @returns {string} HTML string with 4 corner elements
   */
  createQRCorners() {
    return `
      <div class="qr-corner qr-corner-tl animate-pulse"></div>
      <div class="qr-corner qr-corner-tr animate-pulse"></div>
      <div class="qr-corner qr-corner-bl animate-pulse"></div>
      <div class="qr-corner qr-corner-br animate-pulse"></div>
    `;
  },

  /**
   * Creates a circular countdown SVG with animated progress
   * @param {number} seconds - Current seconds remaining
   * @param {number} total - Total seconds for the countdown
   * @returns {string} HTML string with SVG and seconds display
   */
  createCountdownCircle(seconds, total) {
    const circumference = 2 * Math.PI * 28;
    const offset = circumference - (seconds / total) * circumference;
    return `
      <svg class="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" stroke-width="4" fill="none"
                class="countdown-bg-circle" />
        <circle cx="32" cy="32" r="28" stroke-width="4" fill="none"
                class="countdown-progress-circle"
                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" />
      </svg>
      <span class="countdown-seconds">${seconds}</span>
    `;
  },

  /**
   * Creates a navigation button for the kiosk footer
   * @param {string} icon - Material Symbols icon name
   * @param {string} label - Button label text
   * @param {string} route - Route to navigate to
   * @returns {string} HTML string
   */
  createNavButton(icon, label, route) {
    return `<button class="glass-panel px-6 py-3 rounded-xl flex items-center gap-2
                           text-slate-400 hover:text-white transition-all text-sm font-medium"
                    onclick="Router.navigate('${this.escapeHtml(route)}')">
      <span class="material-symbols-rounded text-lg">${this.escapeHtml(icon)}</span>
      ${label ? `<span>${this.escapeHtml(label)}</span>` : ''}
    </button>`;
  },

  /**
   * Creates a large action button for confirmation screens
   * @param {string} icon - Material Symbols icon name
   * @param {string} label - Button label text
   * @param {string} type - 'success' or 'warning' for color
   * @param {string} onClick - onclick handler as string
   * @returns {string} HTML string
   */
  createActionButton(icon, label, type, onClick) {
    const bgClass = type === 'success'
      ? 'bg-kiosk-success hover:bg-emerald-600'
      : 'bg-kiosk-warning hover:bg-orange-600';
    return `<button class="${bgClass} text-white rounded-3xl p-8
                           flex flex-col items-center justify-center gap-3
                           transition-all active:scale-95 shadow-lg group"
                    onclick="${this.escapeHtml(onClick)}">
      <span class="material-symbols-rounded text-5xl sm:text-6xl group-hover:scale-110 transition-transform">${this.escapeHtml(icon)}</span>
      <span class="text-xl sm:text-2xl font-bold">${this.escapeHtml(label)}</span>
    </button>`;
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
