// Hash router for kiosk
const Router = {
  routes: {},
  // R13-FE5 fix: Track current route for cleanup
  currentRoute: null,
  cleanupFunctions: {},

  init() {
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
    const [path, query] = hash.split('?');

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
      this.navigate('/settings');
      return;
    }

    const route = this.routes[path];
    if (route) {
      this.currentRoute = path;
      route();
    } else {
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
