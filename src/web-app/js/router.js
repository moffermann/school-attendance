// Hash-based router
const Router = {
  routes: {},
  currentRoute: null,
  _cleanupCallback: null,

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
    this.addRoute('/director/guardians', Views.directorGuardians, ['director', 'inspector']);
    this.addRoute('/director/teachers', Views.directorTeachers, ['director']);
    this.addRoute('/director/courses', Views.directorCourses, ['director', 'inspector']);
    this.addRoute('/director/absences', Views.directorAbsences, ['director', 'inspector']);
    this.addRoute('/director/withdrawals', Views.directorWithdrawals, ['director', 'inspector']);
    this.addRoute('/director/notifications', Views.directorNotifications, ['director', 'inspector']);
    this.addRoute('/director/biometric', Views.directorBiometric, ['director', 'inspector']);
    this.addRoute('/parent/home', Views.parentHome, ['parent']);
    this.addRoute('/parent/history', Views.parentHistory, ['parent']);
    this.addRoute('/parent/prefs', Views.parentPrefs, ['parent']);
    this.addRoute('/parent/absences', Views.parentAbsences, ['parent']);
    this.addRoute('/parent/pickups', Views.parentPickups, ['parent']);

    // Super Admin routes (handled separately with SuperAdminAPI auth)
    this.addRoute('/super-admin/auth', Views.superAdminAuth, null, true);
    this.addRoute('/super-admin/dashboard', Views.superAdminDashboard, null, true);
    this.addRoute('/super-admin/tenants', Views.superAdminTenants, null, true);

    // Tenant setup route (public - no auth required)
    this.addRoute('/setup', Views.tenantAdminSetup, null, false);

    // Parent registration & password recovery (public - no auth required)
    this.addRoute('/parent-setup', Views.parentSetup, null, false);
    this.addRoute('/forgot-password', Views.forgotPassword, null, false);
    this.addRoute('/reset-password', Views.resetPassword, null, false);

    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRoute());

    // Handle initial route
    this.handleRoute();
  },

  addRoute(path, handler, allowedRoles = null, isSuperAdmin = false) {
    this.routes[path] = { handler, allowedRoles, isSuperAdmin };
  },

  handleRoute() {
    let hash = window.location.hash.slice(1) || '/auth';
    const hashBase = hash.split('?')[0]; // Remove query params for matching
    this.currentRoute = hash;

    // Check for dynamic routes (e.g., /super-admin/tenant/123)
    let route = this.routes[hashBase];
    let params = {};

    // Handle dynamic tenant detail route
    if (!route && hashBase.startsWith('/super-admin/tenant/')) {
      const tenantId = hashBase.replace('/super-admin/tenant/', '');
      if (tenantId && !isNaN(parseInt(tenantId))) {
        params.tenantId = parseInt(tenantId);
        route = {
          handler: () => Views.superAdminTenantDetail(params.tenantId),
          isSuperAdmin: true
        };
      }
    }

    // Handle dynamic course detail route
    if (!route && hashBase.startsWith('/director/courses/')) {
      const courseId = hashBase.replace('/director/courses/', '');
      if (courseId && !isNaN(parseInt(courseId))) {
        params.courseId = parseInt(courseId);
        route = {
          handler: () => Views.directorCourseDetail(params.courseId),
          allowedRoles: ['director', 'inspector']
        };
      }
    }

    if (!route) {
      this.navigate('/auth');
      return;
    }

    // Super Admin routes - check SuperAdminAPI auth
    if (route.isSuperAdmin) {
      if (hashBase !== '/super-admin/auth' && !SuperAdminAPI.isAuthenticated()) {
        this.navigate('/super-admin/auth');
        return;
      }
      // Render super admin view
      this.render(route.handler);
      return;
    }

    // Public routes (like /setup) - no auth required
    if (route.allowedRoles === null && !route.isSuperAdmin) {
      this.render(route.handler);
      this.updateActiveNavLink(hashBase);
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
    this.updateActiveNavLink(hashBase);
  },

  _navCounter: 0,

  render(handler) {
    const app = document.getElementById('app');

    // R10-W10 fix: Validate app container exists before rendering
    if (!app) {
      console.error('Router: #app container not found in DOM');
      return;
    }

    // Call cleanup callback from previous view if exists
    if (this._cleanupCallback && typeof this._cleanupCallback === 'function') {
      try {
        this._cleanupCallback();
      } catch (e) {
        console.error('Error in view cleanup:', e);
      }
      this._cleanupCallback = null;
    }

    // Increment navigation counter to prevent stale renders from race conditions
    this._navCounter++;
    const thisNav = this._navCounter;

    // Show loading
    app.innerHTML = Components.createLoader();

    // Use requestAnimationFrame for minimal delay (one paint frame)
    // instead of setTimeout(100) which created a race-condition window
    requestAnimationFrame(() => {
      // Only render if this is still the latest navigation
      if (thisNav !== this._navCounter) return;

      if (typeof handler === 'function') {
        handler();
      } else {
        app.innerHTML = '<div class="empty-state"><h2>Página no encontrada</h2></div>';
      }
    });
  },

  navigate(path) {
    window.location.hash = path;
  },

  /**
   * Register a cleanup callback to be called when navigating away from current view.
   * Only one callback can be registered at a time (previous is replaced).
   * @param {Function} callback - Function to call on view change
   */
  onViewChange(callback) {
    this._cleanupCallback = callback;
  },

  /**
   * Clear the current cleanup callback
   */
  clearCleanup() {
    this._cleanupCallback = null;
  },

  updateActiveNavLink(currentPath) {
    // Update sidebar nav (director/inspector)
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
      const href = link.getAttribute('href');
      if (href === `#${currentPath}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update mobile bottom nav (parent portal)
    document.querySelectorAll('.mobile-bottom-nav-list a').forEach(link => {
      const href = link.getAttribute('href');
      if (href === `#${currentPath}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Initialize mobile menu events after layout render
    if (typeof Components !== 'undefined' && Components.initMobileMenu) {
      Components.initMobileMenu();
    }
  }
};
