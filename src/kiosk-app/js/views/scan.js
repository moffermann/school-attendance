// Scan simulation view
Views.scan = function() {
  const app = document.getElementById('app');
  const params = Router.getQueryParams();
  const scanType = params.type || 'nfc';

  app.innerHTML = `
    ${UI.createHeader()}
    <div class="container">
      <div class="card">
        <div class="card-header">Simular Lectura ${scanType.toUpperCase()}</div>

        <div class="form-group">
          <label class="form-label">Token ${scanType.toUpperCase()}</label>
          <input type="text" id="token-input" class="form-input"
            placeholder="Ingresa o genera un token..."
            autofocus>
        </div>

        <div class="flex gap-2">
          <button class="btn btn-primary btn-lg" onclick="Views.scan.processToken()">
            Simular Lectura
          </button>
          <button class="btn btn-secondary" onclick="Views.scan.generateValid()">
            Generar Token Válido
          </button>
        </div>

        <div class="mt-3">
          <button class="btn btn-secondary" onclick="Router.navigate('/home')">
            ← Volver
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Tokens de Prueba</div>
        <div style="font-size: 0.875rem;">
          <p><strong>Válidos:</strong> nfc_001, nfc_002, qr_011, qr_012</p>
          <p><strong>Revocados:</strong> nfc_006, qr_013</p>
          <p><strong>Inválidos:</strong> invalid_token_123</p>
        </div>
      </div>
    </div>
  `;

  Views.scan.processToken = function() {
    const token = document.getElementById('token-input').value.trim();
    if (!token) {
      UI.showToast('Ingresa un token', 'error');
      return;
    }

    // Show loader
    UI.showToast('Leyendo...', 'info', 500);

    setTimeout(() => {
      const result = State.resolveStudentByToken(token);

      if (!result) {
        UI.showToast('Token no válido', 'error');
      } else if (result.error === 'REVOKED') {
        UI.showToast('Credencial revocada', 'error');
      } else {
        const eventType = State.nextEventTypeFor(result.id);
        Router.navigate(`/scan-result?student_id=${result.id}&type=${eventType}&source=${scanType.toUpperCase()}`);
      }
    }, 300 + Math.random() * 500);
  };

  Views.scan.generateValid = function() {
    const validTokens = State.tags.filter(t => t.status === 'ACTIVE');
    const random = validTokens[Math.floor(Math.random() * validTokens.length)];
    document.getElementById('token-input').value = random.token;
  };
};
