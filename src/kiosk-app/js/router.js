// Hash router for kiosk - V2.1
const Router = {
  routes: {},
  isOperatorMode: false,
  operatorPin: '1234', // Default PIN, should be in config

  init() {
    this.addRoute('/', Views.main);
    
    // Lazy load other views when in operator mode
    this.addRoute('/settings', () => this.loadView('settings'));
    this.addRoute('/queue', () => this.loadView('queue'));
    this.addRoute('/device', () => this.loadView('device_status'));
    this.addRoute('/menu', () => this.showOperatorMenu());


    window.addEventListener('hashchange', () => this.handleRoute());
    
    // Always start at the main view
    this.navigate('/');
    this.handleRoute();
  },

  loadView(viewName) {
    if (!Views[viewName]) {
      const script = document.createElement('script');
      script.src = `js/views/${viewName}.js`;
      script.onload = () => {
        if(Views[viewName]) {
            Views[viewName]();
        }
      };
      document.body.appendChild(script);
    } else {
      Views[viewName]();
    }
  },

  addRoute(path, handler) {
    this.routes[path] = handler;
  },

  handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, query] = hash.split('?');
    
    if (!State.device.gate_id && path !== '/settings') {
      this.isOperatorMode = true; // Allow initial settings access
      this.navigate('/settings');
      return;
    }

    const route = this.routes[path];
    if (route) {
      if (this.isProtected(path) && !this.isOperatorMode) {
        this.navigate('/');
        UI.showToast('Acceso denegado.', 'error');
        return;
      }
      route();
    } else {
      this.navigate('/');
    }
  },

  isProtected(path) {
    const protectedRoutes = ['/settings', '/queue', '/device'];
    return protectedRoutes.includes(path);
  },

  navigate(path) {
    if (window.location.hash.slice(1) !== path) {
      window.location.hash = path;
    }
  },

  getQueryParams() {
    const hash = window.location.hash.slice(1);
    const [, query] = hash.split('?');
    if (!query) return {};
    return Object.fromEntries(new URLSearchParams(query));
  },

  promptPin() {
    if(this.isOperatorMode) {
      this.navigate('/menu');
      return;
    }

    const content = UI.createPinModal();
    UI.showModal('Modo Operador', content);

    const pinInput = document.getElementById('pin-input');
    
    document.getElementById('submit-pin-btn').addEventListener('click', () => {
      const pin = pinInput.value;
      if (this.login(pin)) {
        UI.hideModal();
        UI.showToast('Modo operador activado.', 'success');
        this.navigate('/menu');
      } else {
        UI.hideModal();
        UI.showToast('PIN incorrecto.', 'error');
      }
    });

    document.getElementById('cancel-pin-btn').addEventListener('click', UI.hideModal);
  },

  login(pin) {
    if (pin === this.operatorPin) {
      this.isOperatorMode = true;
      return true;
    }
    return false;
  },

  logout() {
    this.isOperatorMode = false;
    this.navigate('/');
    UI.showToast('Modo operador desactivado.', 'info');
  },
  
  showOperatorMenu() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="main-container">
            <div class="header"><h1>Menú Operador</h1></div>
            <div class="nav-buttons-grid">
                <button class="btn btn-secondary" onclick="Router.navigate('/queue')">📋 Cola de Sincronización</button>
                <button class="btn btn-secondary" onclick="Router.navigate('/device')">📊 Estado del Dispositivo</button>
                <button class="btn btn-secondary" onclick="Router.navigate('/settings')">⚙️ Configuración</button>
                <button class="btn btn-danger" onclick="Router.logout()">🔒 Salir de Modo Operador</button>
            </div>
            <div class="footer">
                <button class="btn btn-primary" onclick="Router.navigate('/')">← Volver al Kiosco</button>
            </div>
        </div>
    `;
  }
};
