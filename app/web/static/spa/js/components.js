// Reusable UI components
const Components = {
  // Toast notifications
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" aria-label="Cerrar">&times;</button>
    `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      toast.remove();
    });

    if (duration > 0) {
      setTimeout(() => {
        toast.remove();
      }, duration);
    }
  },

  // Modal
  showModal(title, content, buttons = []) {
    const container = document.getElementById('modal-container');
    container.className = 'modal-container active';

    const buttonsHTML = buttons.map(btn => `
      <button class="btn ${btn.className || 'btn-secondary'}" data-action="${btn.action || 'close'}">
        ${btn.label}
      </button>
    `).join('');

    container.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="modal-close" aria-label="Cerrar">&times;</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        ${buttons.length > 0 ? `
          <div class="modal-footer">
            ${buttonsHTML}
          </div>
        ` : ''}
      </div>
    `;

    const modal = container.querySelector('.modal');
    const closeBtn = container.querySelector('.modal-close');

    const close = () => {
      container.className = 'modal-container';
      container.innerHTML = '';
    };

    closeBtn.addEventListener('click', close);
    container.addEventListener('click', (e) => {
      if (e.target === container) close();
    });

    // Handle button actions
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action === 'close') {
          close();
        }
        // Custom actions can be handled by returning a promise
        const btnConfig = buttons.find(b => b.action === action);
        if (btnConfig && btnConfig.onClick) {
          btnConfig.onClick();
        }
      });
    });

    return { close };
  },

  // Layout
  createLayout(role) {
    if (role === 'parent') {
      return `
        <div class="app-layout">
          <div class="main-content no-sidebar">
            <header class="header">
              <h1 class="header-title">Portal de Apoderados</h1>
              <div class="header-actions">
                <button class="btn btn-secondary btn-sm" onclick="State.logout(); Router.navigate('/auth')">Cerrar sesión</button>
              </div>
            </header>
            <div class="content" id="view-content"></div>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="app-layout">
          <aside class="sidebar">
            <div class="sidebar-logo">
              <img src="/static/spa/assets/logo.svg" alt="Logo">
              <h1>Control Escolar</h1>
            </div>
            <nav>
              <ul class="sidebar-nav" role="menu">
                <li><a href="#/director/dashboard" role="menuitem">Tablero</a></li>
                <li><a href="#/director/reports" role="menuitem">Reportes</a></li>
                <li><a href="#/director/schedules" role="menuitem">Horarios</a></li>
                <li><a href="#/director/exceptions" role="menuitem">Excepciones</a></li>
                <li><a href="#/director/broadcast" role="menuitem">Broadcast</a></li>
                <li><a href="#/director/devices" role="menuitem">Dispositivos</a></li>
                <li><a href="#/director/students" role="menuitem">Alumnos</a></li>
                <li><a href="#/director/absences" role="menuitem">Ausencias</a></li>
              </ul>
            </nav>
          </aside>
          <div class="main-content">
            <header class="header">
              <h1 class="header-title" id="page-title">Dashboard</h1>
              <div class="header-actions">
                <span class="role-selector">${role === 'director' ? 'Director' : 'Inspector'}</span>
                <button class="btn btn-secondary btn-sm" onclick="State.logout(); Router.navigate('/auth')">Cerrar sesión</button>
              </div>
            </header>
            <div class="content" id="view-content"></div>
          </div>
        </div>
      `;
    }
  },

  // Table with pagination
  createTable(headers, rows, options = {}) {
    const perPage = options.perPage || 20;
    const currentPage = options.currentPage || 1;
    const totalPages = Math.ceil(rows.length / perPage);
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const paginatedRows = rows.slice(start, end);

    const headerHTML = headers.map(h => `<th>${h}</th>`).join('');
    const rowsHTML = paginatedRows.map(row => `
      <tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>
    `).join('');

    let paginationHTML = '';
    if (totalPages > 1) {
      paginationHTML = `
        <div class="pagination">
          <button ${currentPage === 1 ? 'disabled' : ''} onclick="${options.onPageChange}(${currentPage - 1})">Anterior</button>
          <span>Página ${currentPage} de ${totalPages}</span>
          <button ${currentPage === totalPages ? 'disabled' : ''} onclick="${options.onPageChange}(${currentPage + 1})">Siguiente</button>
        </div>
      `;
    }

    return `
      <div class="table-container">
        <table>
          <thead>
            <tr>${headerHTML}</tr>
          </thead>
          <tbody>
            ${rowsHTML.length > 0 ? rowsHTML : '<tr><td colspan="' + headers.length + '" class="empty-state">No hay datos para mostrar</td></tr>'}
          </tbody>
        </table>
      </div>
      ${paginationHTML}
    `;
  },

  // Status chip
  createChip(label, type = 'gray') {
    return `<span class="chip chip-${type}">${label}</span>`;
  },

  // Stat card
  createStatCard(label, value, type = 'info') {
    return `
      <div class="stat-card">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}</div>
      </div>
    `;
  },

  // Date/time formatters
  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL');
  },

  formatTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  },

  formatDateTime(dateString) {
    if (!dateString) return '-';
    return `${this.formatDate(dateString)} ${this.formatTime(dateString)}`;
  },

  // Empty state
  createEmptyState(title, message) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-title">${title}</div>
        <div class="empty-state-message">${message}</div>
      </div>
    `;
  },

  // Loading skeleton
  createLoader(message = 'Cargando...') {
    return `
      <div class="loading-screen">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    `;
  },

  // Form validation
  validateForm(formElement) {
    const inputs = formElement.querySelectorAll('[required]');
    let isValid = true;

    inputs.forEach(input => {
      const errorEl = input.parentElement.querySelector('.form-error');
      if (errorEl) errorEl.remove();

      if (!input.value.trim()) {
        isValid = false;
        const error = document.createElement('div');
        error.className = 'form-error';
        error.textContent = 'Este campo es requerido';
        input.parentElement.appendChild(error);
      }
    });

    return isValid;
  },

  // Simple canvas chart for reports
  drawBarChart(canvas, data, labels) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const maxValue = Math.max(...data);
    const barWidth = (width - padding * 2) / data.length;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw bars
    data.forEach((value, index) => {
      const barHeight = (value / maxValue) * (height - padding * 2);
      const x = padding + index * barWidth;
      const y = height - padding - barHeight;

      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(x + 5, y, barWidth - 10, barHeight);

      // Draw value
      ctx.fillStyle = '#374151';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(value, x + barWidth / 2, y - 5);

      // Draw label
      ctx.fillText(labels[index], x + barWidth / 2, height - padding + 20);
    });

    // Draw axes
    ctx.strokeStyle = '#d1d5db';
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
  },

  drawLineChart(canvas, data, labels) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const maxValue = Math.max(...data);
    const stepX = (width - padding * 2) / (data.length - 1);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((value, index) => {
      const x = padding + index * stepX;
      const y = height - padding - (value / maxValue) * (height - padding * 2);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      // Draw point
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw label
      ctx.fillStyle = '#374151';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[index], x, height - padding + 20);
    });

    ctx.stroke();

    // Draw axes
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
  }
};
