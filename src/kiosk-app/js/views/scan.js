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
        <div class="card-header">ℹ️ Tokens de Prueba (Demo)</div>
        <div style="font-size: 0.875rem; padding: 0.5rem 0;">
          <p style="margin-bottom: 0.5rem; color: var(--color-gray-600);">
            <strong>Nota:</strong> En modo demo, solo funcionan estos tokens predefinidos:
          </p>
          <p><strong style="color: var(--color-success);">✓ Válidos:</strong> nfc_001 a nfc_010, qr_011, qr_012, qr_014, qr_015</p>
          <p><strong style="color: var(--color-error);">✗ Revocados:</strong> nfc_006, qr_013</p>
          <p><strong style="color: var(--color-warning);">⚠ Profesores:</strong> nfc_teacher_001, nfc_teacher_002, qr_teacher_003</p>
          <p style="margin-top: 0.75rem; padding: 0.5rem; background: var(--color-warning-light); border-radius: 4px; font-size: 0.8rem;">
            <strong>¿Tu QR no funciona?</strong> Los QR generados desde "Enrolar QR" en web-app requieren conexión al servidor.
            En demo local, usa los tokens de arriba.
          </p>
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
      const result = State.resolveByToken(token);

      if (!result) {
        // Provide helpful error message based on token format
        const isGeneratedToken = token.includes('_') && token.split('_').length > 2;
        if (isGeneratedToken) {
          UI.showToast('Token no registrado. ¿Usaste "Generar Token Válido"?', 'error', 4000);
        } else {
          UI.showToast('Token no válido. Revisa los tokens de prueba.', 'error', 3000);
        }
      } else if (result.error === 'REVOKED') {
        UI.showToast('Credencial revocada - Contactar administración', 'error', 3000);
      } else if (result.type === 'teacher') {
        // Teacher detected - navigate to admin panel
        Router.navigate('/admin-panel');
      } else if (result.type === 'student') {
        const eventType = State.nextEventTypeFor(result.data.id);
        Router.navigate(`/scan-result?student_id=${result.data.id}&type=${eventType}&source=${scanType.toUpperCase()}`);
      }
    }, 300 + Math.random() * 500);
  };

  Views.scan.generateValid = function() {
    // Only generate student tokens, not teacher tokens
    const validTokens = State.tags.filter(t => t.status === 'ACTIVE' && t.student_id);
    const random = validTokens[Math.floor(Math.random() * validTokens.length)];
    document.getElementById('token-input').value = random.token;
  };
};
