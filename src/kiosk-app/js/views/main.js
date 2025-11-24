// Main view - V2
const Views = window.Views || {};
window.Views = Views;

Views.main = function() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="main-container">
      <div class="header">
        <div>
            <h1>Kiosco ${State.device.gate_id || ''}</h1>
            <p>${State.device.device_id || ''}</p>
        </div>
        <div class="time-display">${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</div>
        <button id="operator-mode-btn" class="btn btn-secondary btn-sm">☰</button>
      </div>

      <div class="scan-container">
        <div class="card">
          <div class="card-header">Escanear Tarjeta o QR</div>
          <div class="form-group">
            <input type="text" id="token-input" class="form-input-lg" placeholder="Esperando escaneo..." autofocus>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary" onclick="Views.main.generateValid()">Generar Token de Prueba</button>
          </div>
        </div>
      </div>

       <div class="footer">
         <div class="badge ${State.device.online ? 'badge-online' : 'badge-offline'}">
           ${State.device.online ? '🟢 Online' : '🔴 Offline'}
         </div>
         <div class="badge badge-battery">
           🔋 ${State.device.battery_pct}%
         </div>
         <div id="pending-count-badge" class="badge badge-queue" style="display: none;">
            ⏳ <span id="pending-count">0</span>
         </div>
      </div>
    </div>
  `;

  const tokenInput = document.getElementById('token-input');
  tokenInput.addEventListener('change', Views.main.processToken);

  // Auto-focus input
  setInterval(() => {
    if(document.activeElement.tagName !== 'INPUT') {
      tokenInput.focus();
    }
  }, 1000);


  document.getElementById('operator-mode-btn').addEventListener('click', () => {
    Router.promptPin();
  });

  Views.main.updateFooter();
  setInterval(Views.main.updateFooter, 1000);
};

Views.main.processToken = function(event) {
  const token = event.target.value.trim();
  if (!token) {
    return;
  }

  // Clear input for next scan
  event.target.value = '';
  event.target.focus();

  UI.showToast('Procesando...', 'info', 500);

  setTimeout(() => {
    const result = State.resolveStudentByToken(token);

    if (!result) {
      UI.showToast('Token no válido', 'error');
    } else if (result.error === 'REVOKED') {
      UI.showToast('Credencial revocada', 'error');
    } else {
      const eventType = State.nextEventTypeFor(result.id);
      const content = UI.createConfirmationModal(result, eventType);
      UI.showModal(`Confirmar Registro - ${result.name}`, content);

      document.getElementById('confirm-in-btn').addEventListener('click', () => {
          State.addAttendanceEvent(result.id, 'IN');
          UI.hideModal();
          UI.showToast('Entrada registrada.', 'success');
          Views.main.updateFooter();
      });

      document.getElementById('confirm-out-btn').addEventListener('click', () => {
          State.addAttendanceEvent(result.id, 'OUT');
          UI.hideModal();
          UI.showToast('Salida registrada.', 'success');
          Views.main.updateFooter();
      });
    }
  }, 300);
};

Views.main.generateValid = function() {
  const validTokens = State.tags.filter(t => t.status === 'ACTIVE');
   if (validTokens.length === 0) {
    UI.showToast('No hay tokens válidos para generar.', 'error');
    return;
  }
  const random = validTokens[Math.floor(Math.random() * validTokens.length)];
  const tokenInput = document.getElementById('token-input');
  tokenInput.value = random.token;
  
  // Trigger the change event to process the token
  tokenInput.dispatchEvent(new Event('change'));
};

Views.main.updateFooter = function() {
    const timeEl = document.querySelector('.time-display');
    if(timeEl) {
        timeEl.textContent = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    }

    const pendingCount = State.getPendingCount();
    const pendingBadge = document.getElementById('pending-count-badge');
    if (pendingBadge) {
        if(pendingCount > 0) {
            document.getElementById('pending-count').textContent = pendingCount;
            pendingBadge.style.display = 'inline-flex';
        } else {
            pendingBadge.style.display = 'none';
        }
    }
};