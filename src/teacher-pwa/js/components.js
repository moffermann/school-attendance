// UI components
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

  showToast(msg, type = 'info', duration = 3000) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg; // textContent is safe, auto-escapes
    c.appendChild(t);
    if (duration > 0) {
      setTimeout(() => t.remove(), duration);
    }
  },

  createHeader(title) {
    const safeTitle = this.escapeHtml(title);
    const onlineStatus = State.isOnline()
      ? '<span class="badge badge-success">Online</span>'
      : '<span class="badge badge-error">Offline</span>';
    return `
      <div class="header">
        <div class="header-title">${safeTitle}</div>
        <div class="flex gap-1">${onlineStatus}</div>
      </div>
    `;
  },

  createBottomNav(active) {
    const items = [
      { path: '/classes', icon: '📚', label: 'Cursos' },
      { path: '/roster', icon: '📋', label: 'Nómina' },
      { path: '/queue', icon: '⏳', label: 'Cola' },
      { path: '/history', icon: '📊', label: 'Historial' }
    ];
    return `
      <div class="bottom-nav">
        ${items.map(i => `
          <a href="#${i.path}" class="nav-item ${active === i.path ? 'active' : ''}">
            <div style="font-size:1.5rem">${i.icon}</div>
            <div>${i.label}</div>
          </a>
        `).join('')}
      </div>
    `;
  },

  createChip(label, type = 'gray') {
    return `<span class="chip chip-${this.escapeHtml(type)}">${this.escapeHtml(label)}</span>`;
  },

  formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  }
};
