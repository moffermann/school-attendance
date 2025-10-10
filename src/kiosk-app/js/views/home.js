// Home view - Main screen
const Views = window.Views || {};
window.Views = Views;

Views.home = function() {
  const app = document.getElementById('app');

  app.innerHTML = `
    ${UI.createHeader()}
    <div class="container">
      <div class="scan-grid">
        <div class="scan-button" onclick="Router.navigate('/scan?type=nfc')">
          <img src="assets/nfc_placeholder.svg" alt="NFC" class="scan-icon">
          <div class="scan-label">Acerca tu tarjeta NFC</div>
        </div>

        <div class="scan-button" onclick="Router.navigate('/scan?type=qr')">
          <img src="assets/qr_placeholder.svg" alt="QR" class="scan-icon">
          <div class="scan-label">Escanear código QR</div>
        </div>
      </div>

      <div class="nav-buttons">
        <button class="btn btn-secondary" onclick="Router.navigate('/manual')">
          📝 Entrada Manual
        </button>
        <button class="btn btn-secondary" onclick="Router.navigate('/queue')">
          📋 Cola (${State.getPendingCount()})
        </button>
        <button class="btn btn-secondary" onclick="Router.navigate('/device')">
          📊 Estado Dispositivo
        </button>
        <button class="btn btn-secondary" onclick="Router.navigate('/settings')">
          ⚙️ Configuración
        </button>
        <button class="btn btn-secondary" onclick="Router.navigate('/help')">
          ❓ Ayuda
        </button>
      </div>
    </div>
  `;
};
