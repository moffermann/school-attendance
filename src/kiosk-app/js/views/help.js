// Help view
Views.help = function() {
  const app = document.getElementById('app');

  app.innerHTML = `
    ${UI.createHeader()}
    <div class="container">
      <div class="card">
        <div class="card-header">Ayuda Rápida</div>

        <div style="font-size: 1.125rem; line-height: 1.8;">
          <h3 style="margin-top: 1rem; margin-bottom: 0.5rem;">Cómo Usar el Kiosco</h3>
          <ol>
            <li><strong>Escaneo NFC/QR:</strong> En la pantalla principal, selecciona el tipo de lectura. Ingresa un token de prueba o genera uno válido.</li>
            <li><strong>Confirmar Registro:</strong> Verifica el alumno, selecciona Ingreso/Salida y confirma.</li>
            <li><strong>Entrada Manual:</strong> Si no funciona el escaneo, busca al alumno por nombre.</li>
            <li><strong>Cola Offline:</strong> Los eventos se almacenan localmente y se sincronizan cuando hay conexión.</li>
          </ol>

          <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">Tokens de Prueba</h3>
          <p><strong>Válidos:</strong> nfc_001, nfc_002, nfc_007, nfc_008, qr_011, qr_012, qr_014, qr_015</p>
          <p><strong>Revocados:</strong> nfc_006, qr_013</p>
          <p><strong>Inválidos:</strong> invalid_token_123</p>

          <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">Simulación Online/Offline</h3>
          <p>En <strong>Estado de Dispositivo</strong>, puedes cambiar entre Online/Offline para probar la cola de sincronización.</p>

          <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">Sincronización</h3>
          <p>Los eventos se sincronizan automáticamente cada 30 segundos cuando el dispositivo está Online. También puedes forzar la sincronización desde la vista de Cola.</p>

          <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">Configuración</h3>
          <p>Antes de usar el kiosco por primera vez, configura el Gate ID y Device ID en Configuración.</p>
        </div>
      </div>

      <div class="mt-3">
        <button class="btn btn-secondary" onclick="Router.navigate('/home')">
          ← Volver al Inicio
        </button>
      </div>
    </div>
  `;
};
