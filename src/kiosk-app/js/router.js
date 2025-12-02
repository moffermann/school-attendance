// Hash router for kiosk
const Router = {
  routes: {},

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

  handleRoute() {
    const hash = window.location.hash.slice(1) || '/home';
    const [path, query] = hash.split('?');

    // Guard: if no gate_id configured, go to settings
    if (!State.device.gate_id && path !== '/settings') {
      this.navigate('/settings');
      return;
    }

    const route = this.routes[path];
    if (route) {
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
