// Withdrawal Scan View - QR scanning for authorized pickup
// Uses same patterns as home.js for consistent styling and camera handling
const Views = window.Views || {};
window.Views = Views;

Views.withdrawalScan = (function() {
  let video = null;
  let canvas = null;
  let canvasContext = null;
  let scanning = false;
  let animationFrame = null;

  // Detect mobile viewport
  function isMobileViewport() {
    return window.innerWidth <= 500;
  }

  // Main render function
  function render() {
    if (isMobileViewport()) {
      renderMobile();
    } else {
      renderTablet();
    }
  }

  // Mobile layout (similar to home.js mobile)
  function renderMobile() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="mobile-home-container">
        <!-- Background gradient glows -->
        <div class="mobile-home-glow-top"></div>
        <div class="mobile-home-glow-bottom"></div>

        <!-- Header -->
        <header class="mobile-home-header">
          <button id="back-btn" class="mobile-home-notification-btn">
            <span class="material-symbols-outlined text-white text-xl">arrow_back</span>
          </button>
          <div class="mobile-home-header-logo">
            <h2 class="mobile-home-header-logo-text" style="font-size: 1.25rem;">Retiro de Estudiante</h2>
          </div>
          <div style="width: 40px;"></div>
        </header>

        <!-- Main Content -->
        <main class="mobile-home-main">
          <!-- Headline -->
          <div class="mobile-home-headline">
            <h1>Escanea el QR</h1>
            <p>de la persona autorizada para retirar</p>
          </div>

          <!-- QR Scanner with neon corners -->
          <div class="mobile-scanner-frame">
            <div class="mobile-scanner-viewport">
              <video id="qr-video" autoplay playsinline></video>
              <canvas id="qr-canvas" hidden></canvas>
              <div class="mobile-scan-line"></div>
              <!-- QR icon overlay -->
              <div class="mobile-scanner-icon-overlay" id="scanner-overlay">
                <span class="material-symbols-outlined">qr_code_scanner</span>
              </div>
            </div>
            <!-- Neon corners -->
            <div class="mobile-scanner-corner top-left"></div>
            <div class="mobile-scanner-corner top-right"></div>
            <div class="mobile-scanner-corner bottom-left"></div>
            <div class="mobile-scanner-corner bottom-right"></div>
          </div>

          <!-- Help text -->
          <div class="mobile-scanner-help">
            <p>Asegurate de que el codigo QR este dentro del recuadro</p>
          </div>
        </main>

        <!-- Footer with manual search button -->
        <footer class="mobile-home-footer">
          <div class="mobile-home-buttons">
            <button id="manual-search-btn" class="mobile-home-btn-fingerprint">
              <span class="material-symbols-outlined">search</span>
              <span>BUSCAR POR NOMBRE</span>
            </button>
          </div>
        </footer>

        <!-- iOS-style home indicator -->
        <div class="mobile-home-indicator"></div>
      </div>

      <!-- Manual Search Modal -->
      <div id="manual-search-modal" class="withdrawal-modal hidden">
        <div class="withdrawal-modal-content">
          <div class="withdrawal-modal-header">
            <h3>Buscar Persona Autorizada</h3>
            <button id="close-modal-btn" class="withdrawal-modal-close">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="withdrawal-modal-body">
            <input type="text" id="search-input" placeholder="Nombre o RUT..."
                   class="withdrawal-search-input" autocomplete="off">
            <div id="search-results" class="withdrawal-search-results"></div>
          </div>
        </div>
      </div>
    `;

    initializeView();
  }

  // Tablet layout (similar to home.js tablet)
  function renderTablet() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="kiosk-home min-h-screen flex flex-col">
        <!-- Blur effects background -->
        <div class="blur-bg-blue"></div>
        <div class="blur-bg-purple"></div>

        <!-- Header -->
        <header class="pt-8 sm:pt-12 flex justify-between items-center px-8 relative z-10">
          <button id="back-btn" class="glass-panel px-4 py-3 rounded-xl flex items-center gap-2
                     text-slate-400 hover:text-white transition-all">
            <span class="material-symbols-rounded text-lg">arrow_back</span>
            <span class="font-medium">Volver</span>
          </button>
          <h1 class="text-2xl sm:text-3xl font-bold text-white">Retiro de Estudiante</h1>
          <div style="width: 120px;"></div>
        </header>

        <!-- Main: Scanner area -->
        <main class="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
          <!-- Instrucciones -->
          <div class="text-center mb-4 sm:mb-8 px-2">
            <h2 class="text-xl sm:text-2xl md:text-3xl font-semibold text-white mb-2">
              Escanea el codigo QR de la persona autorizada
            </h2>
            <p class="text-slate-400 text-sm sm:text-base md:text-lg">
              El adulto debe presentar su credencial QR para retirar al estudiante
            </p>
          </div>

          <!-- QR Scanner con esquinas animadas -->
          <div class="qr-scanner-container relative w-full max-w-xs sm:max-w-sm md:max-w-md aspect-square mb-6 sm:mb-10">
            <div class="absolute inset-0 rounded-3xl overflow-hidden bg-slate-900 border border-white/10">
              <video id="qr-video" autoplay playsinline class="w-full h-full object-cover"></video>
              <canvas id="qr-canvas" hidden></canvas>
              <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-900/80"></div>
            </div>
            <!-- Esquinas QR animadas -->
            <div class="absolute inset-8 pointer-events-none">
              ${UI.createQRCorners ? UI.createQRCorners() : ''}
              <!-- Linea de escaneo -->
              <div class="scanner-line absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent"></div>
            </div>
          </div>

          <!-- Boton busqueda manual -->
          <button id="manual-search-btn" class="w-full max-w-xs sm:max-w-sm md:max-w-md h-16 sm:h-20
                     bg-slate-800/50 border border-slate-600 text-white rounded-2xl
                     font-bold text-lg sm:text-xl shadow-xl flex items-center justify-center gap-3 sm:gap-4
                     transition-all hover:bg-slate-700/50 active:scale-95">
            <span class="material-symbols-rounded text-2xl sm:text-3xl">search</span>
            <span>BUSCAR POR NOMBRE</span>
          </button>
        </main>

        <!-- Footer -->
        <footer class="relative z-10 w-full px-8 pb-10 flex items-center justify-center">
          <p class="text-slate-500 text-sm">
            <span class="material-symbols-outlined text-sm align-middle">info</span>
            Si el adulto no tiene QR, use la busqueda manual
          </p>
        </footer>
      </div>

      <!-- Manual Search Modal -->
      <div id="manual-search-modal" class="withdrawal-modal hidden">
        <div class="withdrawal-modal-content">
          <div class="withdrawal-modal-header">
            <h3>Buscar Persona Autorizada</h3>
            <button id="close-modal-btn" class="withdrawal-modal-close">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="withdrawal-modal-body">
            <input type="text" id="search-input" placeholder="Nombre o RUT..."
                   class="withdrawal-search-input" autocomplete="off">
            <div id="search-results" class="withdrawal-search-results"></div>
          </div>
        </div>
      </div>
    `;

    initializeView();
  }

  // Initialize after render
  function initializeView() {
    video = document.getElementById('qr-video');
    canvas = document.getElementById('qr-canvas');
    if (canvas) {
      canvasContext = canvas.getContext('2d');
    }

    // Start camera
    startCamera();

    // Attach event handlers
    attachEventHandlers();

    // Add modal styles if not present
    addModalStyles();
  }

  // Add modal styles dynamically
  function addModalStyles() {
    if (document.getElementById('withdrawal-modal-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'withdrawal-modal-styles';
    styleEl.textContent = `
      .withdrawal-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
      }

      .withdrawal-modal.hidden {
        display: none;
      }

      .withdrawal-modal-content {
        background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
        border-radius: 1.5rem;
        width: 90%;
        max-width: 400px;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      }

      .withdrawal-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.25rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .withdrawal-modal-header h3 {
        margin: 0;
        color: white;
        font-size: 1.25rem;
        font-weight: 600;
      }

      .withdrawal-modal-close {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: white;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.2s;
      }

      .withdrawal-modal-close:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .withdrawal-modal-body {
        padding: 1.25rem;
        overflow-y: auto;
      }

      .withdrawal-search-input {
        width: 100%;
        padding: 1rem;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 0.75rem;
        background: rgba(255, 255, 255, 0.05);
        color: white;
        font-size: 1rem;
        margin-bottom: 1rem;
        outline: none;
        transition: border-color 0.2s;
      }

      .withdrawal-search-input:focus {
        border-color: rgba(251, 146, 60, 0.5);
      }

      .withdrawal-search-input::placeholder {
        color: rgba(255, 255, 255, 0.4);
      }

      .withdrawal-search-results {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-height: 300px;
        overflow-y: auto;
      }

      .withdrawal-search-item {
        padding: 1rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .withdrawal-search-item:hover {
        background: rgba(251, 146, 60, 0.1);
        border-color: rgba(251, 146, 60, 0.3);
      }

      .withdrawal-search-item .name {
        font-weight: 600;
        color: white;
        margin-bottom: 0.25rem;
      }

      .withdrawal-search-item .relationship {
        font-size: 0.875rem;
        color: rgba(255, 255, 255, 0.6);
      }

      .withdrawal-no-results {
        text-align: center;
        padding: 2rem;
        color: rgba(255, 255, 255, 0.5);
      }
    `;
    document.head.appendChild(styleEl);
  }

  // Attach event handlers
  function attachEventHandlers() {
    // Back button
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        cleanup();
        Router.navigate('/home');
      });
    }

    // Manual search button
    const manualSearchBtn = document.getElementById('manual-search-btn');
    if (manualSearchBtn) {
      manualSearchBtn.addEventListener('click', showManualSearch);
    }

    // Modal close button
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', hideManualSearch);
    }

    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
    }

    // Close modal on backdrop click
    const modal = document.getElementById('manual-search-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          hideManualSearch();
        }
      });
    }

    // Handle cleanup on route change
    window.addEventListener('hashchange', cleanupOnRouteChange);
  }

  // Cleanup on route change
  function cleanupOnRouteChange() {
    if (!window.location.hash.includes('withdrawal-scan')) {
      cleanup();
      window.removeEventListener('hashchange', cleanupOnRouteChange);
    }
  }

  // Start camera for QR scanning
  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('Camera API not available');
      UI.showToast('Camara no disponible', 'error');
      hideOverlay();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      video.srcObject = stream;
      video.setAttribute('playsinline', true);
      await video.play();

      // Hide overlay once video is playing
      hideOverlay();

      scanning = true;
      requestAnimationFrame(scanQRCode);
    } catch (err) {
      console.error('Error accessing camera:', err);
      UI.showToast('Error al acceder a la camara', 'error');
      hideOverlay();
    }
  }

  // Hide the scanner overlay icon
  function hideOverlay() {
    const overlay = document.getElementById('scanner-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 300);
    }
  }

  // Stop camera
  function stopCamera() {
    scanning = false;
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    if (video && video.srcObject) {
      const tracks = video.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      video.srcObject = null;
    }
  }

  // Scan for QR codes
  function scanQRCode() {
    if (!scanning) return;

    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);

      // Use jsQR library (same as home.js)
      if (typeof jsQR !== 'undefined') {
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          // QR code detected!
          scanning = false;
          processQR(code.data);
          return;
        }
      }
    }

    animationFrame = requestAnimationFrame(scanQRCode);
  }

  // Process scanned QR code
  async function processQR(qrCode) {
    if (!qrCode || qrCode.length < 10) {
      UI.showToast('Codigo QR invalido', 'error');
      scanning = true;
      requestAnimationFrame(scanQRCode);
      return;
    }

    UI.showToast('Verificando...', 'info', 2000);

    // Play success beep
    playSuccessBeep();

    // First try local lookup (async - hashes the token to match stored hash)
    const localResult = await State.resolvePickupByQR(qrCode);

    if (localResult && localResult.pickup) {
      // Found locally, proceed
      proceedWithPickup(localResult.pickup);
      return;
    }

    // Try server lookup
    try {
      const serverResult = await Sync.lookupPickupByQR(qrCode);
      if (serverResult) {
        const pickup = {
          id: serverResult.id,
          full_name: serverResult.full_name,
          relationship_type: serverResult.relationship_type,
          photo_url: serverResult.photo_url,
          student_ids: serverResult.student_ids
        };
        proceedWithPickup(pickup);
      } else {
        UI.showToast('QR no reconocido', 'error');
        // Resume scanning
        scanning = true;
        requestAnimationFrame(scanQRCode);
      }
    } catch (err) {
      console.error('Error verifying QR:', err);
      UI.showToast('Error al verificar QR', 'error');
      // Resume scanning
      scanning = true;
      requestAnimationFrame(scanQRCode);
    }
  }

  // Audio feedback
  function playSuccessBeep() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);

      oscillator.onended = () => {
        audioContext.close();
      };
    } catch (e) {
      console.log('Audio feedback not available:', e);
    }
  }

  // Show manual search modal
  function showManualSearch() {
    const modal = document.getElementById('manual-search-modal');
    if (modal) {
      modal.classList.remove('hidden');
      const input = document.getElementById('search-input');
      if (input) {
        input.value = '';
        input.focus();
      }
      // Clear results
      const results = document.getElementById('search-results');
      if (results) {
        results.innerHTML = '<p class="withdrawal-no-results">Ingrese al menos 2 caracteres</p>';
      }
    }
  }

  // Hide manual search modal
  function hideManualSearch() {
    const modal = document.getElementById('manual-search-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  // Handle search input
  function handleSearch(term) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;

    if (!term || term.length < 2) {
      resultsContainer.innerHTML = '<p class="withdrawal-no-results">Ingrese al menos 2 caracteres</p>';
      return;
    }

    const results = State.searchPickupsByName(term);

    if (results.length === 0) {
      resultsContainer.innerHTML = '<p class="withdrawal-no-results">No se encontraron resultados</p>';
      return;
    }

    resultsContainer.innerHTML = results.map(pickup => `
      <div class="withdrawal-search-item" data-pickup-id="${pickup.id}">
        <div class="name">${UI.escapeHtml ? UI.escapeHtml(pickup.full_name) : pickup.full_name}</div>
        <div class="relationship">${UI.escapeHtml ? UI.escapeHtml(pickup.relationship_type) : pickup.relationship_type}</div>
      </div>
    `).join('');

    // Attach click handlers to results
    resultsContainer.querySelectorAll('.withdrawal-search-item').forEach(item => {
      item.addEventListener('click', () => {
        const pickupId = parseInt(item.dataset.pickupId, 10);
        selectPickup(pickupId);
      });
    });
  }

  // Select pickup from search results
  function selectPickup(pickupId) {
    const pickup = State.getPickupById(pickupId);
    if (pickup) {
      hideManualSearch();
      proceedWithPickup(pickup);
    }
  }

  // Proceed with selected pickup to student selection
  function proceedWithPickup(pickup) {
    cleanup();

    // Store pickup in pending withdrawal
    if (State.startWithdrawal) {
      State.startWithdrawal(pickup.id, []);
    }

    // Navigate to student selection
    Router.navigate(`/withdrawal-select?pickup_id=${pickup.id}`);
  }

  // Cleanup function
  function cleanup() {
    stopCamera();
    scanning = false;
  }

  // Public API
  return render;
})();

// Expose globally
window.Views = window.Views || {};
window.Views.withdrawalScan = Views.withdrawalScan;
