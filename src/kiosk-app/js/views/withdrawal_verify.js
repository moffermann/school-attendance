// Withdrawal Verify View - Identity verification for pickup
Views.withdrawalVerify = function() {
  const app = document.getElementById('app');
  const withdrawal = State.getPendingWithdrawal();

  if (!withdrawal || !withdrawal.pickup_id) {
    UI.showToast('No hay retiro pendiente', 'error');
    Router.go('/withdrawal-scan');
    return;
  }

  const pickup = State.getPickupById(withdrawal.pickup_id);

  app.innerHTML = `
    <div class="view-container withdrawal-verify">
      <header class="view-header">
        <button class="btn-back" onclick="Views.withdrawalVerify.goBack()">
          <span class="icon">←</span> Volver
        </button>
        <h1>Verificar Identidad</h1>
      </header>

      <main class="verify-content">
        <div class="verify-instructions">
          <h2>Confirme la identidad</h2>
          <p>Compare la foto registrada con la persona presente</p>
        </div>

        <div class="photo-comparison">
          <!-- Registered photo -->
          <div class="photo-card">
            <div class="photo-label">Foto Registrada</div>
            <div class="photo-frame">
              ${pickup.photo_url
                ? `<img src="${pickup.photo_url}" alt="Foto registrada" id="registered-photo"
                       onerror="this.parentElement.innerHTML='<div class=\\'photo-placeholder\\'>Sin foto</div>'">`
                : `<div class="photo-placeholder">Sin foto registrada</div>`
              }
            </div>
          </div>

          <div class="vs-divider">VS</div>

          <!-- Live selfie -->
          <div class="photo-card">
            <div class="photo-label">Persona Presente</div>
            <div class="photo-frame" id="selfie-container">
              <div class="photo-placeholder" id="selfie-placeholder">
                <button class="btn-capture" onclick="Views.withdrawalVerify.captureSelfie()">
                  📸 Capturar Selfie
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="pickup-summary">
          <strong>${pickup.full_name}</strong>
          <span>${pickup.relationship_type}</span>
        </div>

        <div class="students-summary">
          <p>Estudiantes a retirar:</p>
          <ul>
            ${withdrawal.students.map(s => `<li>${s.full_name}</li>`).join('')}
          </ul>
        </div>
      </main>

      <footer class="view-footer">
        <div class="verification-options">
          <button class="btn-secondary" onclick="Views.withdrawalVerify.skipVerification()">
            Verificación Manual
          </button>
          <button class="btn-primary" id="confirm-btn" onclick="Views.withdrawalVerify.confirmIdentity()" disabled>
            Confirmar Identidad
          </button>
        </div>
      </footer>

      <!-- Camera Modal -->
      <div id="camera-modal" class="modal hidden">
        <div class="modal-content camera-modal">
          <div class="modal-header">
            <h3>Capturar Foto</h3>
            <button class="btn-close" onclick="Views.withdrawalVerify.closeCameraModal()">×</button>
          </div>
          <div class="modal-body">
            <video id="camera-video" autoplay playsinline></video>
            <canvas id="camera-canvas" style="display: none;"></canvas>
          </div>
          <div class="modal-footer">
            <button class="btn-primary" onclick="Views.withdrawalVerify.takePhoto()">
              Tomar Foto
            </button>
          </div>
        </div>
      </div>
    </div>

    <style>
      .withdrawal-verify {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        color: white;
      }

      .view-header {
        display: flex;
        align-items: center;
        padding: 1rem;
        background: rgba(0,0,0,0.3);
      }

      .btn-back {
        background: transparent;
        border: none;
        color: white;
        font-size: 1rem;
        cursor: pointer;
        padding: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .view-header h1 {
        flex: 1;
        text-align: center;
        font-size: 1.25rem;
        margin: 0;
        margin-right: 4rem;
      }

      .verify-content {
        flex: 1;
        padding: 1rem;
        overflow-y: auto;
      }

      .verify-instructions {
        text-align: center;
        margin-bottom: 1.5rem;
      }

      .verify-instructions h2 {
        margin: 0;
        font-size: 1.25rem;
      }

      .verify-instructions p {
        margin: 0.5rem 0 0;
        opacity: 0.8;
        font-size: 0.875rem;
      }

      /* Photo comparison */
      .photo-comparison {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .photo-card {
        text-align: center;
      }

      .photo-label {
        font-size: 0.75rem;
        opacity: 0.7;
        margin-bottom: 0.5rem;
        text-transform: uppercase;
      }

      .photo-frame {
        width: 140px;
        height: 140px;
        border-radius: 1rem;
        overflow: hidden;
        background: #333;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .photo-frame img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .photo-placeholder {
        text-align: center;
        padding: 1rem;
        color: #999;
        font-size: 0.875rem;
      }

      .vs-divider {
        font-weight: bold;
        font-size: 1.5rem;
        opacity: 0.5;
      }

      .btn-capture {
        background: rgba(76, 175, 80, 0.3);
        border: 1px solid rgba(76, 175, 80, 0.5);
        color: white;
        padding: 0.75rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        cursor: pointer;
      }

      .pickup-summary {
        text-align: center;
        padding: 1rem;
        background: rgba(255,255,255,0.1);
        border-radius: 0.5rem;
        margin-bottom: 1rem;
      }

      .pickup-summary strong {
        display: block;
        font-size: 1.1rem;
      }

      .pickup-summary span {
        font-size: 0.875rem;
        opacity: 0.7;
      }

      .students-summary {
        padding: 1rem;
        background: rgba(255,255,255,0.05);
        border-radius: 0.5rem;
      }

      .students-summary p {
        margin: 0 0 0.5rem;
        font-size: 0.875rem;
        opacity: 0.7;
      }

      .students-summary ul {
        margin: 0;
        padding-left: 1.5rem;
      }

      .students-summary li {
        margin-bottom: 0.25rem;
      }

      /* Footer */
      .view-footer {
        padding: 1rem;
        background: rgba(0,0,0,0.3);
      }

      .verification-options {
        display: flex;
        gap: 1rem;
      }

      .btn-secondary {
        flex: 1;
        padding: 1rem;
        font-size: 0.9rem;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        border-radius: 0.75rem;
        cursor: pointer;
      }

      .btn-primary {
        flex: 1;
        padding: 1rem;
        font-size: 0.9rem;
        font-weight: bold;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 0.75rem;
        cursor: pointer;
      }

      .btn-primary:disabled {
        background: #666;
        cursor: not-allowed;
      }

      /* Camera Modal */
      .modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .modal.hidden {
        display: none;
      }

      .camera-modal {
        background: #1a1a2e;
        border-radius: 1rem;
        width: 90%;
        max-width: 400px;
        overflow: hidden;
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }

      .modal-header h3 {
        margin: 0;
      }

      .btn-close {
        background: transparent;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
      }

      .modal-body {
        padding: 1rem;
      }

      .modal-body video {
        width: 100%;
        border-radius: 0.5rem;
        background: #000;
      }

      .modal-footer {
        padding: 1rem;
        text-align: center;
      }

      .modal-footer .btn-primary {
        width: auto;
        padding: 0.75rem 2rem;
      }
    </style>
  `;

  // Store selfie data
  Views.withdrawalVerify.selfieData = null;
  Views.withdrawalVerify.mediaStream = null;
};

// Go back to student selection
Views.withdrawalVerify.goBack = function() {
  const withdrawal = State.getPendingWithdrawal();
  if (withdrawal) {
    Router.go(`/withdrawal-select?pickup_id=${withdrawal.pickup_id}`);
  } else {
    Router.go('/withdrawal-scan');
  }
};

// Open camera for selfie capture
Views.withdrawalVerify.captureSelfie = function() {
  const modal = document.getElementById('camera-modal');
  const video = document.getElementById('camera-video');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    UI.showToast('Cámara no disponible en este dispositivo', 'error');
    return;
  }

  modal.classList.remove('hidden');

  // Use 'ideal' constraints for broad device compatibility.
  // Exact width/height values cause black screens on some phones.
  const preferredConstraints = {
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 }
    }
  };

  // Fallback: minimal constraints if preferred ones fail
  const fallbackConstraints = { video: { facingMode: 'user' } };
  const minimalConstraints = { video: true };

  navigator.mediaDevices.getUserMedia(preferredConstraints)
    .catch(err => {
      console.warn('Preferred camera constraints failed, trying fallback:', err.message);
      return navigator.mediaDevices.getUserMedia(fallbackConstraints);
    })
    .catch(err => {
      console.warn('Fallback constraints failed, trying minimal:', err.message);
      return navigator.mediaDevices.getUserMedia(minimalConstraints);
    })
    .then(stream => {
      Views.withdrawalVerify.mediaStream = stream;
      video.srcObject = stream;
      // Explicit play() needed on some mobile browsers (e.g., Safari/iOS)
      return video.play();
    })
    .then(() => {
      console.log('Camera stream active');
    })
    .catch(err => {
      console.error('Camera error:', err);
      UI.showToast('Error al acceder a la cámara: ' + (err.message || 'Permiso denegado'), 'error');
      Views.withdrawalVerify.closeCameraModal();
    });
};

// Close camera modal
Views.withdrawalVerify.closeCameraModal = function() {
  const modal = document.getElementById('camera-modal');
  modal.classList.add('hidden');

  // Stop camera stream
  if (Views.withdrawalVerify.mediaStream) {
    Views.withdrawalVerify.mediaStream.getTracks().forEach(track => track.stop());
    Views.withdrawalVerify.mediaStream = null;
  }
};

// Take photo from camera
Views.withdrawalVerify.takePhoto = function() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  const ctx = canvas.getContext('2d');

  // Set canvas size to video size
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Draw video frame to canvas
  ctx.drawImage(video, 0, 0);

  // Get image data as base64
  Views.withdrawalVerify.selfieData = canvas.toDataURL('image/jpeg', 0.8);

  // Update UI
  const selfieContainer = document.getElementById('selfie-container');
  if (selfieContainer) {
    selfieContainer.innerHTML = `
      <img src="${Views.withdrawalVerify.selfieData}" alt="Selfie">
      <button class="btn-retake" onclick="Views.withdrawalVerify.captureSelfie()"
              style="position: absolute; bottom: 0.5rem; right: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.75rem; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 0.25rem; cursor: pointer;">
        Retomar
      </button>
    `;
    selfieContainer.style.position = 'relative';
  }

  // Enable confirm button
  const confirmBtn = document.getElementById('confirm-btn');
  if (confirmBtn) {
    confirmBtn.disabled = false;
  }

  // Close camera modal
  Views.withdrawalVerify.closeCameraModal();
};

// Skip photo verification (admin manual verification)
Views.withdrawalVerify.skipVerification = function() {
  // Mark as manual verification
  State.updateWithdrawalStatus('VERIFIED', {
    verification_method: 'ADMIN_OVERRIDE',
    verified_at: new Date().toISOString()
  });

  Router.go('/withdrawal-signature');
};

// Confirm identity with selfie
Views.withdrawalVerify.confirmIdentity = async function() {
  if (!Views.withdrawalVerify.selfieData) {
    UI.showToast('Capture una foto primero', 'warning');
    return;
  }

  UI.showToast('Verificando...', 'info', 2000);

  const withdrawal = State.getPendingWithdrawal();

  try {
    // Initiate withdrawal on server
    const result = await Sync.initiateWithdrawal(
      withdrawal.student_ids,
      withdrawal.pickup_id
    );

    if (result && result.length > 0) {
      // Store server withdrawal IDs
      State.updateWithdrawalStatus('INITIATED', {
        server_withdrawal_ids: result.map(w => w.id)
      });

      // Verify the first withdrawal (they're all for the same pickup)
      const verifyResult = await Sync.verifyWithdrawal(
        result[0].id,
        'PHOTO_MATCH',
        null // Photo would be uploaded to S3 in production
      );

      if (verifyResult) {
        State.updateWithdrawalStatus('VERIFIED', {
          verification_method: 'PHOTO_MATCH',
          verified_at: new Date().toISOString()
        });

        Router.go('/withdrawal-signature');
      } else {
        throw new Error('Verification failed');
      }
    }
  } catch (err) {
    console.error('Withdrawal error:', err);
    UI.showToast(err.message || 'Error al verificar', 'error');
  }
};

// Cleanup on route change
Router.registerCleanup('/withdrawal-verify', () => {
  if (Views.withdrawalVerify.mediaStream) {
    Views.withdrawalVerify.mediaStream.getTracks().forEach(track => track.stop());
  }
});

// Expose globally
window.Views = window.Views || {};
window.Views.withdrawalVerify = Views.withdrawalVerify;
