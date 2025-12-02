// Hash-based router
const Router = {
  routes: {},
  currentRoute: null,

  init() {
    // Register all routes
    this.addRoute('/auth', Views.auth);
    this.addRoute('/director/dashboard', Views.directorDashboard, ['director', 'inspector']);
    this.addRoute('/director/reports', Views.directorReports, ['director', 'inspector']);
    this.addRoute('/director/metrics', Views.directorMetrics, ['director', 'inspector']);
    this.addRoute('/director/schedules', Views.directorSchedules, ['director', 'inspector']);
    this.addRoute('/director/exceptions', Views.directorExceptions, ['director', 'inspector']);
    this.addRoute('/director/broadcast', Views.directorBroadcast, ['director', 'inspector']);
    this.addRoute('/director/devices', Views.directorDevices, ['director', 'inspector']);
    this.addRoute('/director/students', Views.directorStudents, ['director', 'inspector']);
    this.addRoute('/director/teachers', Views.directorTeachers, ['director']);
    this.addRoute('/director/absences', Views.directorAbsences, ['director', 'inspector']);
    this.addRoute('/director/notifications', Views.directorNotifications, ['director', 'inspector']);
    this.addRoute('/director/biometric', Views.directorBiometric, ['director', 'inspector']);
    this.addRoute('/parent/home', Views.parentHome, ['parent']);
    this.addRoute('/parent/history', Views.parentHistory, ['parent']);
    this.addRoute('/parent/prefs', Views.parentPrefs, ['parent']);
    this.addRoute('/parent/absences', Views.parentAbsences, ['parent']);

    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRoute());

    // Handle initial route
    this.handleRoute();
  },

  addRoute(path, handler, allowedRoles = null) {
    this.routes[path] = { handler, allowedRoles };
  },

  handleRoute() {
    const hash = window.location.hash.slice(1) || '/auth';
    this.currentRoute = hash;

    const route = this.routes[hash];
    if (!route) {
      this.navigate('/auth');
      return;
    }

    // Security: Validate session integrity before checking roles
    if (route.allowedRoles) {
      // Use State's validation method which checks role validity
      if (!State.isSessionValid()) {
        console.warn('Invalid session detected, redirecting to auth');
        State.logout(); // Clear potentially tampered data
        this.navigate('/auth');
        return;
      }

      // Check if user has required role
      if (!route.allowedRoles.includes(State.currentRole)) {
        Components.showToast('No tienes permiso para acceder a esta página', 'error');
        this.navigate(State.currentRole === 'parent' ? '/parent/home' : '/director/dashboard');
        return;
      }
    }

    // Render the view
    this.render(route.handler);

    // Update active nav link
    this.updateActiveNavLink(hash);
  },

  render(handler) {
    const app = document.getElementById('app');

    // Show loading
    app.innerHTML = Components.createLoader();

    // Small delay to show loading state
    setTimeout(() => {
      if (typeof handler === 'function') {
        handler();
      } else {
        app.innerHTML = '<div class="empty-state"><h2>Página no encontrada</h2></div>';
      }
    }, 100);
  },

  navigate(path) {
    window.location.hash = path;
  },

  updateActiveNavLink(currentPath) {
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
      const href = link.getAttribute('href');
      if (href === `#${currentPath}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }
};
