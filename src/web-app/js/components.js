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

    const closeBtn = container.querySelector('.modal-close');

    // F12 fix: Store listener references for cleanup
    const listeners = [];

    const close = () => {
      // F12 fix: Remove all event listeners before clearing
      listeners.forEach(({ element, type, handler }) => {
        element.removeEventListener(type, handler);
      });
      listeners.length = 0;
      container.className = 'modal-container';
      container.innerHTML = '';
    };

    // F12 fix: Track listeners for cleanup
    const closeBtnHandler = () => close();
    closeBtn.addEventListener('click', closeBtnHandler);
    listeners.push({ element: closeBtn, type: 'click', handler: closeBtnHandler });

    const containerHandler = (e) => {
      if (e.target === container) close();
    };
    container.addEventListener('click', containerHandler);
    listeners.push({ element: container, type: 'click', handler: containerHandler });

    // Handle button actions
    container.querySelectorAll('[data-action]').forEach(btn => {
      const btnHandler = (e) => {
        const action = e.target.dataset.action;
        if (action === 'close') {
          close();
        }
        // Custom actions can be handled by returning a promise
        const btnConfig = buttons.find(b => b.action === action);
        if (btnConfig && btnConfig.onClick) {
          btnConfig.onClick();
        }
      };
      btn.addEventListener('click', btnHandler);
      listeners.push({ element: btn, type: 'click', handler: btnHandler });
    });

    return { close };
  },

  // SVG Icons
  icons: {
    menu: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>',
    close: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
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
    biometric: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10V21"></path><path d="M18.5 8a6.5 6.5 0 1 0-13 0c0 4.5 6.5 11 6.5 11s6.5-6.5 6.5-11Z"></path><circle cx="12" cy="8" r="2"></circle></svg>',
    guardians: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path><circle cx="9" cy="7" r="2" fill="currentColor"></circle></svg>',
    courses: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>'
  },

  // Mobile menu toggle functions
  toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && overlay) {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
      document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
    }
  },

  closeMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && overlay) {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  // Navigate back to app selector
  switchApp() {
    const token = sessionStorage.getItem('accessToken');
    const refresh = sessionStorage.getItem('refreshToken');
    if (token && refresh) {
      window.location.href = `/#token=${token}&refresh=${refresh}`;
    } else {
      window.location.href = '/';
    }
  },

  // Toggle dark mode for parent portal
  toggleParentDarkMode() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('darkMode', isDark ? 'true' : 'false');
    const icon = document.getElementById('parent-dark-mode-icon');
    if (icon) {
      icon.textContent = isDark ? 'light_mode' : 'dark_mode';
    }
  },

  // Initialize mobile menu events
  initMobileMenu() {
    // Close menu when clicking a nav link
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
      link.addEventListener('click', () => this.closeMobileMenu());
    });

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeMobileMenu();
      }
    });
  },

  // Layout
  createLayout(role, options) {
    // Skip link for keyboard/screen reader users
    const skipLink = '<a href="#view-content" class="skip-link">Saltar al contenido principal</a>';

    if (role === 'parent') {
      // Initialize dark mode from saved preference
      if (localStorage.getItem('darkMode') === 'true') {
        document.documentElement.classList.add('dark');
      } else if (localStorage.getItem('darkMode') === 'false') {
        document.documentElement.classList.remove('dark');
      }

      const activeView = (options && options.activeView) || '';
      const navItems = [
        { id: 'home', href: '#/parent/home', icon: 'home', label: 'Inicio' },
        { id: 'history', href: '#/parent/history', icon: 'history', label: 'Historial' },
        { id: 'absences', href: '#/parent/absences', icon: 'event_busy', label: 'Ausencias' },
        { id: 'prefs', href: '#/parent/prefs', icon: 'settings', label: 'Ajustes' }
      ];

      const guardian = State.getGuardian(State.currentGuardianId);
      const guardianName = guardian ? guardian.full_name : 'Apoderado';
      const isDark = document.documentElement.classList.contains('dark');

      return `
        ${skipLink}
        <div class="h-screen flex flex-col md:flex-row overflow-hidden bg-[#f8fafc] dark:bg-slate-900">
          <!-- Desktop Sidebar -->
          <aside class="parent-sidebar">
            <div class="h-20 flex items-center justify-center px-4 border-b border-gray-100 dark:border-slate-800">
              <img src="assets/LOGO Neuvox 1000X1000.png" class="h-14" alt="NEUVOX">
            </div>
            <nav class="flex-1 overflow-y-auto py-6 space-y-1 px-3">
              ${navItems.map(item => `
                <a href="${item.href}" class="parent-nav-item ${activeView === item.id ? 'active' : ''}">
                  <span class="material-symbols-outlined mr-3">${item.icon}</span>
                  <span>${item.label}</span>
                </a>
              `).join('')}
            </nav>
          </aside>

          <!-- Main Content -->
          <main class="flex-1 flex flex-col overflow-hidden">
            <header class="h-auto py-4 md:h-20 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700
                           flex flex-col md:flex-row items-center justify-between px-4 md:px-8 z-10 shadow-sm gap-4 md:gap-0">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">Portal de Apoderados</h2>
              <div class="flex items-center gap-3">
                <span class="hidden md:flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 font-medium">
                  <span class="material-symbols-outlined text-lg text-indigo-500">person</span>
                  ${Components.escapeHtml(guardianName)}
                </span>
                <button class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                        onclick="Components.toggleParentDarkMode()" title="Cambiar tema">
                  <span class="material-symbols-outlined text-xl" id="parent-dark-mode-icon">${isDark ? 'light_mode' : 'dark_mode'}</span>
                </button>
                <a href="#/auth" class="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                                        hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-medium text-gray-700 dark:text-gray-300"
                   onclick="State.logout()">
                  <span class="material-symbols-outlined text-xl">logout</span>
                  <span class="hidden sm:inline">Salir</span>
                </a>
              </div>
            </header>
            <div id="view-content" class="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8" tabindex="-1"></div>
          </main>

          <!-- Mobile Bottom Nav -->
          <nav class="parent-bottom-nav" aria-label="Navegación móvil">
            ${navItems.map(item => `
              <a href="${item.href}" class="flex flex-col items-center gap-1 w-16
                                             ${activeView === item.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600'}">
                <span class="material-symbols-outlined text-2xl">${item.icon}</span>
                <span class="text-[10px] font-medium">${item.label}</span>
              </a>
            `).join('')}
          </nav>
        </div>
      `;
    } else {
      return `
        ${skipLink}
        <div class="app-layout">
          <!-- Mobile overlay -->
          <div class="sidebar-overlay" onclick="Components.closeMobileMenu()"></div>

          <aside class="sidebar" role="navigation" aria-label="Navegación principal">
            <!-- Mobile close button -->
            <button class="sidebar-close-btn" onclick="Components.closeMobileMenu()" aria-label="Cerrar menú">
              ${this.icons.close}
            </button>
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
                <li><a href="#/director/guardians" role="menuitem">${this.icons.guardians}<span>Apoderados</span></a></li>
                <li><a href="#/director/teachers" role="menuitem">${this.icons.teachers}<span>Profesores</span></a></li>
                <li><a href="#/director/courses" role="menuitem">${this.icons.courses}<span>Cursos</span></a></li>
                <li><a href="#/director/absences" role="menuitem">${this.icons.absences}<span>Ausencias</span></a></li>
                <li><a href="#/director/notifications" role="menuitem">${this.icons.notifications}<span>Notificaciones</span></a></li>
                <li><a href="#/director/biometric" role="menuitem">${this.icons.biometric}<span>Biometría</span></a></li>
              </ul>
            </nav>
          </aside>
          <div class="main-content">
            <header class="header">
              <!-- Mobile hamburger menu button -->
              <button class="mobile-menu-btn" onclick="Components.toggleMobileMenu()" aria-label="Abrir menú de navegación" aria-expanded="false">
                ${this.icons.menu}
              </button>
              <h1 class="header-title" id="page-title">Tablero</h1>
              <div class="header-actions">
                <span class="role-selector">${role === 'director' ? 'Director' : 'Inspector'}</span>
                <button class="btn btn-secondary btn-sm" onclick="Components.switchApp()" aria-label="Cambiar aplicación" title="Cambiar aplicación">
                  🔄
                </button>
                <button class="btn btn-secondary btn-sm" onclick="State.logout(); Router.navigate('/auth')" aria-label="Cerrar sesión">
                  ${this.icons.logout}
                  <span>Salir</span>
                </button>
              </div>
            </header>
            <main class="content" id="view-content" tabindex="-1"></main>
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
  createStatCard(label, value, _type = 'info') {
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
    // Para strings de solo fecha (YYYY-MM-DD), agregar T00:00:00 para evitar shift de timezone
    // Sin esto, new Date('2025-12-29') se interpreta como UTC y muestra día anterior en Chile
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const date = new Date(`${dateString}T00:00:00`);
      return date.toLocaleDateString('es-CL');
    }
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
  // Options: { grouped: [{ data: [], color: '#xxx', label: 'name' }, ...] }
  drawBarChart(canvas, data, labels, options = {}) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 50;
    const paddingBottom = 60; // Extra space for labels

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Grouped bars mode
    if (options.grouped && options.grouped.length > 0) {
      const groups = options.grouped;
      const allValues = groups.flatMap(g => g.data);
      const maxValue = Math.max(...allValues, 1);
      const groupWidth = (width - padding * 2) / labels.length;
      const barWidth = (groupWidth - 20) / groups.length;

      // Draw bars for each group
      labels.forEach((label, groupIndex) => {
        const groupX = padding + groupIndex * groupWidth;

        groups.forEach((group, barIndex) => {
          const value = group.data[groupIndex] || 0;
          const barHeight = (value / maxValue) * (height - padding - paddingBottom);
          const x = groupX + 10 + barIndex * barWidth;
          const y = height - paddingBottom - barHeight;

          // Draw bar
          ctx.fillStyle = group.color;
          ctx.fillRect(x, y, barWidth - 4, barHeight);

          // Draw value on top
          ctx.fillStyle = '#374151';
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(value, x + (barWidth - 4) / 2, y - 3);
        });

        // Draw group label (course name)
        ctx.fillStyle = '#374151';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, groupX + groupWidth / 2, height - paddingBottom + 18);
      });

      // Draw legend
      const legendY = 15;
      let legendX = width - padding - groups.length * 100;
      groups.forEach((group, i) => {
        ctx.fillStyle = group.color;
        ctx.fillRect(legendX, legendY, 14, 14);
        ctx.fillStyle = '#374151';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(group.label, legendX + 18, legendY + 11);
        legendX += 100;
      });

      // Draw Y-axis scale
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const yVal = Math.round((maxValue / steps) * i);
        const yPos = height - paddingBottom - (i / steps) * (height - padding - paddingBottom);
        ctx.fillText(yVal, padding - 5, yPos + 3);
        // Grid line
        ctx.strokeStyle = '#e5e7eb';
        ctx.beginPath();
        ctx.moveTo(padding, yPos);
        ctx.lineTo(width - padding, yPos);
        ctx.stroke();
      }
    } else {
      // Original single-bar mode
      const maxValue = Math.max(...data, 1);
      const barWidth = (width - padding * 2) / data.length;

      data.forEach((value, index) => {
        const barHeight = (value / maxValue) * (height - padding - paddingBottom);
        const x = padding + index * barWidth;
        const y = height - paddingBottom - barHeight;

        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(x + 5, y, barWidth - 10, barHeight);

        ctx.fillStyle = '#374151';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(value, x + barWidth / 2, y - 5);
        ctx.fillText(labels[index], x + barWidth / 2, height - paddingBottom + 20);
      });
    }

    // Draw axes
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding - 10);
    ctx.lineTo(padding, height - paddingBottom);
    ctx.lineTo(width - padding, height - paddingBottom);
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

// Super Admin Layout
  createSuperAdminLayout(activePage = 'dashboard') {
    const skipLink = '<a href="#view-content" class="skip-link">Saltar al contenido principal</a>';

    const navItems = [
      { id: 'dashboard', label: 'Panel', icon: this.icons.dashboard, href: '#/super-admin/dashboard' },
      { id: 'tenants', label: 'Tenants', icon: this.icons.students, href: '#/super-admin/tenants' },
    ];

    return `
      ${skipLink}
      <div class="app-layout super-admin">
        <!-- Mobile overlay -->
        <div class="sidebar-overlay" onclick="Components.closeMobileMenu()"></div>

        <aside class="sidebar" role="navigation" aria-label="Navegación super admin">
          <!-- Mobile close button -->
          <button class="sidebar-close-btn" onclick="Components.closeMobileMenu()" aria-label="Cerrar menú">
            ${this.icons.close}
          </button>
          <div class="sidebar-logo">
            <img src="assets/logo.svg" alt="Logo">
            <h1>Super Admin</h1>
          </div>
          <nav>
            <ul class="sidebar-nav" role="menu">
              ${navItems.map(item => `
                <li>
                  <a href="${item.href}" role="menuitem" class="${activePage === item.id ? 'active' : ''}">
                    ${item.icon}<span>${item.label}</span>
                  </a>
                </li>
              `).join('')}
            </ul>
          </nav>
          <div class="sidebar-footer">
            <button class="btn btn-outline-light btn-sm btn-block mb-2" onclick="window.location.href='/'">
              ${this.icons.home || '🏠'}
              <span>Selector de Apps</span>
            </button>
            <button class="btn btn-secondary btn-sm btn-block" onclick="SuperAdminAPI.clearToken(); Router.navigate('/super-admin/auth')">
              ${this.icons.logout}
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </aside>
        <div class="main-content">
          <header class="header">
            <!-- Mobile hamburger menu button -->
            <button class="mobile-menu-btn" onclick="Components.toggleMobileMenu()" aria-label="Abrir menú de navegación" aria-expanded="false">
              ${this.icons.menu}
            </button>
            <h1 class="header-title" id="page-title">Super Admin</h1>
            <div class="header-actions">
              <span class="role-badge">Plataforma</span>
            </div>
          </header>
          <main class="content" id="view-content" tabindex="-1"></main>
        </div>
      </div>
      <style>
        .super-admin .sidebar {
          background: linear-gradient(180deg, #1e1b4b 0%, #312e81 100%);
        }
        .super-admin .sidebar-logo h1 {
          color: white;
        }
        .super-admin .sidebar-nav a {
          color: rgba(255,255,255,0.8);
        }
        .super-admin .sidebar-nav a:hover,
        .super-admin .sidebar-nav a.active {
          background: rgba(255,255,255,0.1);
          color: white;
        }
        .super-admin .sidebar-footer {
          padding: 1rem;
          margin-top: auto;
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        .super-admin .sidebar-footer .btn {
          justify-content: center;
          gap: 0.5rem;
        }
        .role-badge {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
        }
      </style>
    `;
  },

  // Options: { yAxisLabel: 'Label text' }
  drawLineChart(canvas, data, labels, options = {}) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 60;
    const paddingBottom = 50;
    const maxValue = Math.max(...data, 1);
    const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw Y-axis label (rotated)
    if (options.yAxisLabel) {
      ctx.save();
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.translate(15, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(options.yAxisLabel, 0, 0);
      ctx.restore();
    }

    // Draw Y-axis scale
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const yVal = Math.round((maxValue / steps) * i);
      const yPos = height - paddingBottom - (i / steps) * (height - padding - paddingBottom + 20);
      ctx.fillText(yVal, padding - 8, yPos + 3);
      // Grid line
      ctx.strokeStyle = '#e5e7eb';
      ctx.beginPath();
      ctx.moveTo(padding, yPos);
      ctx.lineTo(width - padding + 20, yPos);
      ctx.stroke();
    }

    // Draw line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const points = [];
    data.forEach((value, index) => {
      const x = padding + index * stepX;
      const y = height - paddingBottom - (value / maxValue) * (height - padding - paddingBottom + 20);
      points.push({ x, y, value });

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points and labels after line (so they appear on top)
    points.forEach((point, index) => {
      // Draw point
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Draw value above point
      ctx.fillStyle = '#374151';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(point.value, point.x, point.y - 10);

      // Draw X-axis label
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px sans-serif';
      ctx.fillText(labels[index], point.x, height - paddingBottom + 18);
    });

    // Draw axes
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
  },

  // ============================================================================
  // DIRECTOR LAYOUT COMPONENTS - Centralized sidebar, header, and toggle
  // ============================================================================

  // Director navigation items - single source of truth
  directorNav: [
    { path: '/director/dashboard', icon: 'dashboard', label: 'Tablero' },
    { path: '/director/reports', icon: 'analytics', label: 'Reportes' },
    { path: '/director/metrics', icon: 'bar_chart', label: 'Métricas' },
    { path: '/director/schedules', icon: 'schedule', label: 'Horarios' },
    { path: '/director/exceptions', icon: 'event_busy', label: 'Excepciones' },
    { path: '/director/broadcast', icon: 'campaign', label: 'Comunicados' },
    { path: '/director/devices', icon: 'devices', label: 'Dispositivos' },
    { path: '/director/students', icon: 'school', label: 'Alumnos' },
    { path: '/director/guardians', icon: 'family_restroom', label: 'Apoderados' },
    { path: '/director/teachers', icon: 'badge', label: 'Profesores' },
    { path: '/director/courses', icon: 'class', label: 'Cursos' },
    { path: '/director/absences', icon: 'person_off', label: 'Ausencias' },
    { path: '/director/notifications', icon: 'notifications', label: 'Notificaciones' },
    { path: '/director/biometric', icon: 'fingerprint', label: 'Biometría' },
  ],

  // Toggle director sidebar (mobile) - centralized function
  toggleDirectorSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar && backdrop) {
      sidebar.classList.toggle('mobile-hidden');
      backdrop.classList.toggle('hidden');
    }
  },

  // Generate director sidebar HTML
  // currentPath: e.g., '/director/dashboard'
  directorSidebar(currentPath) {
    const isActive = (path) => currentPath === path;
    const navItemClass = (path) => isActive(path)
      ? 'flex items-center px-6 py-3 bg-indigo-800/50 text-white border-l-4 border-indigo-500 group transition-colors'
      : 'flex items-center px-6 py-3 hover:bg-white/5 hover:text-white group transition-colors border-l-4 border-transparent';
    const iconClass = (path) => isActive(path)
      ? 'material-icons-round mr-3'
      : 'material-icons-round mr-3 text-gray-400 group-hover:text-white transition-colors';

    return `
      <!-- Mobile Backdrop -->
      <div id="sidebar-backdrop" class="fixed inset-0 bg-black/50 z-40 hidden" onclick="Components.toggleDirectorSidebar()"></div>

      <!-- Sidebar -->
      <aside id="sidebar" class="w-64 bg-sidebar-dark text-gray-300 flex-shrink-0 flex flex-col h-full transition-all duration-300 mobile-hidden border-r border-indigo-900/50 shadow-2xl z-50">
        <div class="h-20 flex items-center justify-between px-6 border-b border-indigo-900/50">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg">
              <div class="w-4 h-4 bg-indigo-900 rounded-full"></div>
            </div>
            <h1 class="text-xl font-bold tracking-tight text-white">NEUVOX</h1>
          </div>
          <button class="desktop-hidden text-gray-400 hover:text-white p-1" onclick="Components.toggleDirectorSidebar()">
            <span class="material-icons-round">close</span>
          </button>
        </div>
        <nav class="flex-1 overflow-y-auto py-6 space-y-1">
          ${this.directorNav.map(item => `
            <a class="${navItemClass(item.path)}" href="#${item.path}">
              <span class="${iconClass(item.path)}">${item.icon}</span>
              <span class="font-medium text-sm">${item.label}</span>
            </a>
          `).join('')}
        </nav>
      </aside>
    `;
  },

  // Generate director header HTML
  // title: Header title text
  // userName: User's display name
  // options: { showLiveIndicator, showDarkMode, onToggleLive, onToggleDarkMode }
  directorHeader(title, userName, options = {}) {
    const userInitial = userName ? userName.charAt(0).toUpperCase() : 'D';
    const escapedName = this.escapeHtml(userName || 'Director');

    // Optional live indicator (for dashboard)
    const liveIndicatorHTML = options.showLiveIndicator ? `
      <div class="flex items-center gap-2">
        <span id="live-indicator" class="text-xs font-medium px-2 md:px-3 py-1 bg-green-100 text-green-700 rounded-full flex items-center gap-1 cursor-pointer" onclick="${options.onToggleLive || ''}">
          <span class="w-2 h-2 rounded-full bg-green-500" id="live-dot"></span>
          <span id="live-text" class="mobile-hidden">En vivo</span>
        </span>
      </div>
      <div class="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1 md:mx-2 mobile-hidden"></div>
    ` : '';

    // Optional dark mode toggle
    const darkModeHTML = options.showDarkMode ? `
      <button class="p-2 rounded-full hover:bg-background-light dark:hover:bg-white/5 transition-colors text-muted-light dark:text-muted-dark" onclick="${options.onToggleDarkMode || 'Components.toggleDirectorDarkMode()'}">
        <span class="material-icons-round" id="dark-mode-icon">dark_mode</span>
      </button>
    ` : '';

    return `
      <header class="h-20 bg-white dark:bg-card-dark border-b border-border-light dark:border-border-dark flex items-center justify-between px-8 z-10 shadow-sm">
        <div class="flex items-center gap-4">
          <button class="desktop-hidden text-muted-light dark:text-muted-dark hover:text-primary transition-colors" onclick="Components.toggleDirectorSidebar()">
            <span class="material-icons-round text-2xl">menu</span>
          </button>
          <h2 class="text-xl font-bold text-gray-800 dark:text-text-dark">${this.escapeHtml(title)}</h2>
        </div>
        <div class="flex items-center gap-2 md:gap-4 flex-1 justify-end">
          ${liveIndicatorHTML}
          <div class="flex items-center gap-2 md:gap-3">
            ${darkModeHTML}
            <div class="flex items-center gap-2 cursor-pointer">
              <div class="w-9 h-9 rounded-full border border-gray-200 bg-indigo-600 flex items-center justify-center text-white font-semibold">
                ${userInitial}
              </div>
              <div class="text-right mobile-hidden">
                <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">${escapedName}</p>
              </div>
            </div>
            <a class="ml-1 md:ml-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 border px-2 md:px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 dark:border-gray-600" href="#" onclick="event.preventDefault(); State.logout(); Router.navigate('/login')">
              <span class="material-icons-round text-lg">logout</span>
              <span class="mobile-hidden">Salir</span>
            </a>
          </div>
        </div>
      </header>
    `;
  },

  // Toggle dark mode for director views
  toggleDirectorDarkMode() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('directorDarkMode', isDark ? 'true' : 'false');
    const icon = document.getElementById('dark-mode-icon');
    if (icon) {
      icon.textContent = isDark ? 'light_mode' : 'dark_mode';
    }
  },

  // Initialize director dark mode from saved preference
  initDirectorDarkMode() {
    if (localStorage.getItem('directorDarkMode') === 'true') {
      document.documentElement.classList.add('dark');
      const icon = document.getElementById('dark-mode-icon');
      if (icon) icon.textContent = 'light_mode';
    }
  },

  // ============================================================================

  // Show student profile modal (reusable from any view)
  // Options: { onBack: Function, backLabel: String }
  showStudentProfile(studentId, options = {}) {
    const student = State.getStudent(studentId);
    if (!student) {
      this.showToast('Estudiante no encontrado', 'error');
      return;
    }

    const course = State.getCourse(student.course_id);
    const guardians = State.getGuardians().filter(g => g.student_ids.includes(studentId));
    const stats = State.getStudentAttendanceStats(studentId);

    const guardiansHTML = guardians.map(g => `
      <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--color-gray-100);">
        <strong>${this.escapeHtml(g.full_name)}</strong><br>
        <span style="font-size: 0.85rem; color: var(--color-gray-500);">
          ${g.contacts.map(c => `${c.type}: ${c.value} ${c.verified ? '✅' : '⏳'}`).join(' | ')}
        </span>
      </li>
    `).join('');

    // Build buttons array - add "Back" button if callback provided
    const buttons = [];
    if (options.onBack) {
      buttons.push({
        label: options.backLabel || '← Volver a la lista',
        action: 'back',
        className: 'btn-primary',
        onClick: options.onBack
      });
    }
    buttons.push({ label: 'Cerrar', action: 'close', className: 'btn-secondary' });

    this.showModal(`Perfil - ${student.full_name}`, `
      <div class="card mb-2">
        <div class="card-header">Información Básica</div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
            <div><strong>Nombre:</strong><br>${this.escapeHtml(student.full_name)}</div>
            <div><strong>Curso:</strong><br>${course ? this.escapeHtml(course.name + ' - ' + course.grade) : '-'}</div>
            <div><strong>RUT/Matrícula:</strong><br>${student.national_id || 'No registrado'}</div>
            <div><strong>ID Sistema:</strong><br><span style="font-family: monospace; color: var(--color-gray-500);">#${student.id}</span></div>
          </div>
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-header">Estadísticas de Asistencia</div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
            <div style="background: var(--color-success-light); padding: 1rem; border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-success);">${stats.percentage}%</div>
              <div style="font-size: 0.8rem; color: var(--color-gray-600);">Asistencia</div>
            </div>
            <div style="background: var(--color-primary-light); padding: 1rem; border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-primary);">${stats.daysPresent}</div>
              <div style="font-size: 0.8rem; color: var(--color-gray-600);">Días Presente</div>
            </div>
            <div style="background: var(--color-warning-light); padding: 1rem; border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-warning);">${stats.lateArrivals}</div>
              <div style="font-size: 0.8rem; color: var(--color-gray-600);">Atrasos</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Apoderados Vinculados</div>
        <div class="card-body">
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${guardiansHTML || '<li style="color: var(--color-gray-500);">Sin apoderados registrados</li>'}
          </ul>
        </div>
      </div>
    `, buttons);
  }
};
