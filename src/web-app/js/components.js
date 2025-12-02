// Reusable UI components
const Components = {
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

  // Toast notifications
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-message">${this.escapeHtml(message)}</div>
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
  // Note: 'content' parameter may contain pre-built HTML for complex modals
  // Callers should use escapeHtml() for user-provided text within content
  showModal(title, content, buttons = []) {
    const container = document.getElementById('modal-container');
    container.className = 'modal-container active';

    const buttonsHTML = buttons.map(btn => `
      <button class="btn ${btn.className || 'btn-secondary'}" data-action="${this.escapeHtml(btn.action || 'close')}">
        ${this.escapeHtml(btn.label)}
      </button>
    `).join('');

    container.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">${this.escapeHtml(title)}</h2>
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

  // SVG Icons
  icons: {
    dashboard: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
    reports: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
    metrics: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
    schedules: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    exceptions: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    broadcast: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>',
    devices: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>',
    students: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    teachers: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    absences: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="18" y1="8" x2="23" y2="13"></line><line x1="23" y1="8" x2="18" y2="13"></line></svg>',
    notifications: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    logout: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>',
    home: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
    history: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    settings: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    biometric: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10V21"></path><path d="M18.5 8a6.5 6.5 0 1 0-13 0c0 4.5 6.5 11 6.5 11s6.5-6.5 6.5-11Z"></path><circle cx="12" cy="8" r="2"></circle></svg>'
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
                <button class="btn btn-secondary btn-sm" onclick="State.logout(); Router.navigate('/auth')">
                  ${this.icons.logout}
                  Cerrar sesión
                </button>
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
              <img src="assets/logo.svg" alt="Logo">
              <h1>Control Escolar</h1>
            </div>
            <nav>
              <ul class="sidebar-nav" role="menu">
                <li><a href="#/director/dashboard" role="menuitem">${this.icons.dashboard}<span>Tablero</span></a></li>
                <li><a href="#/director/reports" role="menuitem">${this.icons.reports}<span>Reportes</span></a></li>
                <li><a href="#/director/metrics" role="menuitem">${this.icons.metrics}<span>Métricas</span></a></li>
                <li><a href="#/director/schedules" role="menuitem">${this.icons.schedules}<span>Horarios</span></a></li>
                <li><a href="#/director/exceptions" role="menuitem">${this.icons.exceptions}<span>Excepciones</span></a></li>
                <li><a href="#/director/broadcast" role="menuitem">${this.icons.broadcast}<span>Comunicados</span></a></li>
                <li><a href="#/director/devices" role="menuitem">${this.icons.devices}<span>Dispositivos</span></a></li>
                <li><a href="#/director/students" role="menuitem">${this.icons.students}<span>Alumnos</span></a></li>
                <li><a href="#/director/teachers" role="menuitem">${this.icons.teachers}<span>Profesores</span></a></li>
                <li><a href="#/director/absences" role="menuitem">${this.icons.absences}<span>Ausencias</span></a></li>
                <li><a href="#/director/notifications" role="menuitem">${this.icons.notifications}<span>Notificaciones</span></a></li>
                <li><a href="#/director/biometric" role="menuitem">${this.icons.biometric}<span>Biometría</span></a></li>
              </ul>
            </nav>
          </aside>
          <div class="main-content">
            <header class="header">
              <h1 class="header-title" id="page-title">Tablero</h1>
              <div class="header-actions">
                <span class="role-selector">${role === 'director' ? 'Director' : 'Inspector'}</span>
                <button class="btn btn-secondary btn-sm" onclick="State.logout(); Router.navigate('/auth')">
                  ${this.icons.logout}
                  Cerrar sesión
                </button>
              </div>
            </header>
            <div class="content" id="view-content"></div>
          </div>
        </div>
      `;
    }
  },

  // Table with pagination
  // Note: Cell content should be escaped by callers or use escapeHtml for user data
  createTable(headers, rows, options = {}) {
    const perPage = options.perPage || 20;
    const currentPage = options.currentPage || 1;
    const totalPages = Math.ceil(rows.length / perPage);
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const paginatedRows = rows.slice(start, end);

    const headerHTML = headers.map(h => `<th>${this.escapeHtml(h)}</th>`).join('');
    // Note: rows may contain pre-escaped HTML or safe content (e.g., chips, buttons)
    // For user-provided text, callers should use Components.escapeHtml()
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
    return `<span class="chip chip-${this.escapeHtml(type)}">${this.escapeHtml(label)}</span>`;
  },

  // Stat card
  createStatCard(label, value, type = 'info') {
    return `
      <div class="stat-card">
        <div class="stat-label">${this.escapeHtml(label)}</div>
        <div class="stat-value">${this.escapeHtml(value)}</div>
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
        <div class="empty-state-title">${this.escapeHtml(title)}</div>
        <div class="empty-state-message">${this.escapeHtml(message)}</div>
      </div>
    `;
  },

  // Loading skeleton
  createLoader(message = 'Cargando...') {
    return `
      <div class="loading-screen">
        <div class="spinner"></div>
        <p>${this.escapeHtml(message)}</p>
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

  // PDF Generation utilities
  generatePDF(title, content, options = {}) {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      this.showToast('Error: Librería PDF no disponible', 'error');
      return null;
    }

    const doc = new jsPDF({
      orientation: options.orientation || 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // Header
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(title, pageWidth / 2, 20, { align: 'center' });

    // Subtitle with date
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generado: ${this.formatDateTime(new Date().toISOString())}`, pageWidth / 2, 28, { align: 'center' });

    // Line separator
    doc.setDrawColor(200);
    doc.line(margin, 32, pageWidth - margin, 32);

    return doc;
  },

  addPDFTable(doc, headers, rows, startY = 40) {
    if (!doc.autoTable) {
      console.error('autoTable plugin not loaded');
      return startY;
    }

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: startY,
      margin: { left: 15, right: 15 },
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      }
    });

    return doc.lastAutoTable.finalY + 10;
  },

  addPDFSection(doc, title, y) {
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(title, 15, y);
    doc.setFont(undefined, 'normal');
    return y + 8;
  },

  addPDFText(doc, text, y, options = {}) {
    doc.setFontSize(options.fontSize || 10);
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;

    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, margin, y);

    return y + (lines.length * 5) + 5;
  },

  savePDF(doc, filename) {
    doc.save(filename);
    this.showToast('PDF descargado correctamente', 'success');
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
