// Internationalization (i18n) module for Kiosk App
const I18n = {
  // Default language
  currentLang: 'es',

  // Available languages
  languages: {
    es: 'Español',
    en: 'English'
  },

  // Translation strings
  translations: {
    es: {
      // Home/Scanner
      'scanner.nfc_active': 'NFC Activo',
      'scanner.nfc_unavailable': 'NFC No disponible',
      'scanner.qr_active': 'QR Activo',
      'scanner.waiting_nfc': 'Esperando tarjeta NFC...',
      'scanner.reading_card': 'Leyendo tarjeta...',
      'scanner.card_detected': '¡Tarjeta detectada!',
      'scanner.read_error': 'Error de lectura',
      'scanner.retrying': 'Reintentando...',
      'scanner.instruction_both': 'Acerca tu tarjeta NFC o código QR',
      'scanner.instruction_qr': 'Acerca el código QR a la cámara',
      'scanner.invalid_code': 'Código no válido',
      'scanner.revoked_credential': 'Credencial revocada',
      'scanner.camera_error': 'No se pudo acceder a la cámara',

      // Welcome screen
      'welcome.greeting_in': '¡Bienvenido!',
      'welcome.greeting_out': '¡Hasta pronto!',
      'welcome.detected_by': 'Detectado por',
      'welcome.returning_in': 'Volviendo en',
      'welcome.scan_now': 'Escanear ahora',
      'welcome.scan_next': 'Escanear siguiente',

      // Manual input
      'manual.camera_unavailable': 'Cámara no disponible',
      'manual.enter_code': 'Ingresa el código manualmente para probar',
      'manual.scan': 'Escanear',
      'manual.generate_random': 'Generar Aleatorio',
      'manual.test_tokens': 'Tokens de prueba:',
      'manual.students': 'Alumnos',
      'manual.teachers': 'Profesores',
      'manual.enter_code_error': 'Ingresa un código',

      // Admin panel
      'admin.title': 'Panel de Administración',
      'admin.sync_queue': 'Cola de Sincronización',
      'admin.device_status': 'Estado del Dispositivo',
      'admin.settings': 'Configuración',
      'admin.help': 'Ayuda',
      'admin.back_to_scan': 'Volver al Escaneo',
      'admin.sync_desc': 'Ver eventos pendientes y reintentar',
      'admin.device_desc': 'Batería, conectividad, versión',
      'admin.settings_desc': 'Gate ID, captura foto, alto contraste',
      'admin.help_desc': 'Guía de uso y soporte',

      // Queue
      'queue.title': 'Cola de Sincronización',
      'queue.pending': 'Pendientes',
      'queue.synced': 'Sincronizados',
      'queue.errors': 'Errores',
      'queue.sync_now': 'Sincronizar Ahora',
      'queue.empty': 'No hay eventos en cola',
      'queue.student': 'Alumno',
      'queue.type': 'Tipo',
      'queue.time': 'Hora',
      'queue.status': 'Estado',

      // Device status
      'device.title': 'Estado del Dispositivo',
      'device.id': 'ID Dispositivo',
      'device.gate': 'Gate',
      'device.version': 'Versión',
      'device.battery': 'Batería',
      'device.connection': 'Conexión',
      'device.online': 'En línea',
      'device.offline': 'Sin conexión',

      // Settings
      'settings.title': 'Configuración',
      'settings.gate_id': 'Gate ID',
      'settings.device_id': 'Device ID',
      'settings.photo_capture': 'Captura de Foto',
      'settings.high_contrast': 'Alto Contraste',
      'settings.language': 'Idioma',
      'settings.save': 'Guardar',
      'settings.saved': 'Configuración guardada',

      // Help
      'help.title': 'Ayuda',
      'help.how_to_use': 'Cómo usar',
      'help.step1': 'Acerca tu tarjeta NFC o código QR al lector',
      'help.step2': 'Espera la confirmación visual y sonora',
      'help.step3': 'Tu asistencia ha sido registrada',
      'help.contact': 'Contacto soporte',

      // Common
      'common.back': 'Volver',
      'common.close': 'Cerrar',
      'common.loading': 'Cargando...',
      'common.error': 'Error',
      'common.success': 'Éxito',
      'common.in': 'Entrada',
      'common.out': 'Salida'
    },

    en: {
      // Home/Scanner
      'scanner.nfc_active': 'NFC Active',
      'scanner.nfc_unavailable': 'NFC Unavailable',
      'scanner.qr_active': 'QR Active',
      'scanner.waiting_nfc': 'Waiting for NFC card...',
      'scanner.reading_card': 'Reading card...',
      'scanner.card_detected': 'Card detected!',
      'scanner.read_error': 'Read error',
      'scanner.retrying': 'Retrying...',
      'scanner.instruction_both': 'Place your NFC card or QR code',
      'scanner.instruction_qr': 'Place QR code in front of camera',
      'scanner.invalid_code': 'Invalid code',
      'scanner.revoked_credential': 'Credential revoked',
      'scanner.camera_error': 'Could not access camera',

      // Welcome screen
      'welcome.greeting_in': 'Welcome!',
      'welcome.greeting_out': 'Goodbye!',
      'welcome.detected_by': 'Detected by',
      'welcome.returning_in': 'Returning in',
      'welcome.scan_now': 'Scan now',
      'welcome.scan_next': 'Scan next',

      // Manual input
      'manual.camera_unavailable': 'Camera unavailable',
      'manual.enter_code': 'Enter code manually to test',
      'manual.scan': 'Scan',
      'manual.generate_random': 'Generate Random',
      'manual.test_tokens': 'Test tokens:',
      'manual.students': 'Students',
      'manual.teachers': 'Teachers',
      'manual.enter_code_error': 'Enter a code',

      // Admin panel
      'admin.title': 'Admin Panel',
      'admin.sync_queue': 'Sync Queue',
      'admin.device_status': 'Device Status',
      'admin.settings': 'Settings',
      'admin.help': 'Help',
      'admin.back_to_scan': 'Back to Scan',
      'admin.sync_desc': 'View pending events and retry',
      'admin.device_desc': 'Battery, connectivity, version',
      'admin.settings_desc': 'Gate ID, photo capture, high contrast',
      'admin.help_desc': 'Usage guide and support',

      // Queue
      'queue.title': 'Sync Queue',
      'queue.pending': 'Pending',
      'queue.synced': 'Synced',
      'queue.errors': 'Errors',
      'queue.sync_now': 'Sync Now',
      'queue.empty': 'No events in queue',
      'queue.student': 'Student',
      'queue.type': 'Type',
      'queue.time': 'Time',
      'queue.status': 'Status',

      // Device status
      'device.title': 'Device Status',
      'device.id': 'Device ID',
      'device.gate': 'Gate',
      'device.version': 'Version',
      'device.battery': 'Battery',
      'device.connection': 'Connection',
      'device.online': 'Online',
      'device.offline': 'Offline',

      // Settings
      'settings.title': 'Settings',
      'settings.gate_id': 'Gate ID',
      'settings.device_id': 'Device ID',
      'settings.photo_capture': 'Photo Capture',
      'settings.high_contrast': 'High Contrast',
      'settings.language': 'Language',
      'settings.save': 'Save',
      'settings.saved': 'Settings saved',

      // Help
      'help.title': 'Help',
      'help.how_to_use': 'How to use',
      'help.step1': 'Place your NFC card or QR code near the reader',
      'help.step2': 'Wait for visual and audio confirmation',
      'help.step3': 'Your attendance has been recorded',
      'help.contact': 'Contact support',

      // Common
      'common.back': 'Back',
      'common.close': 'Close',
      'common.loading': 'Loading...',
      'common.error': 'Error',
      'common.success': 'Success',
      'common.in': 'Entry',
      'common.out': 'Exit'
    }
  },

  // Initialize from config or localStorage
  init() {
    const savedLang = localStorage.getItem('kiosk_language');
    const configLang = State.config?.language;

    if (savedLang && this.translations[savedLang]) {
      this.currentLang = savedLang;
    } else if (configLang && this.translations[configLang]) {
      this.currentLang = configLang;
    }

    console.log('I18n initialized with language:', this.currentLang);
  },

  // Get translation
  t(key, params = {}) {
    const translation = this.translations[this.currentLang]?.[key]
      || this.translations['es'][key]
      || key;

    // Replace parameters like {name} with actual values
    return translation.replace(/\{(\w+)\}/g, (match, param) => {
      return params[param] !== undefined ? params[param] : match;
    });
  },

  // Set language
  setLanguage(lang) {
    if (this.translations[lang]) {
      this.currentLang = lang;
      localStorage.setItem('kiosk_language', lang);

      // Update config if State is available
      if (typeof State !== 'undefined' && State.config) {
        State.config.language = lang;
        State.persist();
      }

      console.log('Language changed to:', lang);
      return true;
    }
    return false;
  },

  // Get current language
  getLanguage() {
    return this.currentLang;
  },

  // Get all available languages
  getAvailableLanguages() {
    return this.languages;
  }
};

// Initialize on load
if (typeof State !== 'undefined') {
  I18n.init();
}
