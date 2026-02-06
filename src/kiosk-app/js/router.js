// Hash router for kiosk
const Router = {
  routes: {},
  // R13-FE5 fix: Track current route for cleanup
  currentRoute: null,
  cleanupFunctions: {},

  init() {
    console.log('[Router] init() starting...');
    this.addRoute('/home', Views.home);
    this.addRoute('/scan', Views.scan);
    this.addRoute('/scan-result', Views.scanResult);
    this.addRoute('/manual', Views.manualEntry);
    this.addRoute('/queue', Views.queue);
    this.addRoute('/device', Views.deviceStatus);
    this.addRoute('/settings', Views.settings);
    this.addRoute('/help', Views.help);
    this.addRoute('/admin-panel', Views.adminPanel);
    this.addRoute('/biometric-auth', Views.biometricAuth);
    this.addRoute('/biometric-enroll', Views.biometricEnroll);

    // Withdrawal routes
    console.log('[Router] Registering withdrawal routes...');
    console.log('[Router] Views.withdrawalScan:', typeof Views.withdrawalScan);
    this.addRoute('/withdrawal-scan', Views.withdrawalScan);
    this.addRoute('/withdrawal-select', Views.withdrawalSelect);
    this.addRoute('/withdrawal-verify', Views.withdrawalVerify);
    this.addRoute('/withdrawal-signature', Views.withdrawalSignature);
    this.addRoute('/withdrawal-confirm', Views.withdrawalConfirm);
    console.log('[Router] All routes registered:', Object.keys(this.routes));

    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  },

  addRoute(path, handler) {
    this.routes[path] = handler;
  },

  // R13-FE5 fix: Register cleanup function for a route
  registerCleanup(path, cleanupFn) {
    this.cleanupFunctions[path] = cleanupFn;
  },

  handleRoute() {
    const hash = window.location.hash.slice(1) || '/home';
    const [path] = hash.split('?');
    console.log('[Router] handleRoute called, path:', path);

    // R13-FE5 fix: Call cleanup for previous route
    if (this.currentRoute && this.cleanupFunctions[this.currentRoute]) {
      try {
        this.cleanupFunctions[this.currentRoute]();
      } catch (e) {
        console.error('Cleanup error for', this.currentRoute, e);
      }
    }

    // Guard: if no gate_id configured, go to settings
    if (!State.device.gate_id && path !== '/settings') {
      console.log('[Router] No gate_id, redirecting to settings');
      this.navigate('/settings');
      return;
    }

    const route = this.routes[path];
    console.log('[Router] Route found for path:', path, ':', typeof route);
    if (route) {
      this.currentRoute = path;
      try {
        route();
      } catch (e) {
        console.error('[Router] Error executing route handler for', path, e);
        this.navigate('/home');
      }
    } else {
      console.log('[Router] No route found, navigating to /home');
      this.navigate('/home');
    }
  },

  navigate(path) {
    window.location.hash = path;
  },

  getQueryParams() {
    const hash = window.location.hash.slice(1);
    const [, query] = hash.split('?');
    if (!query) return {};

    return Object.fromEntries(new URLSearchParams(query));
  }
};
