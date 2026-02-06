// Withdrawal Signature View - Digital signature for pickup confirmation
Views.withdrawalSignature = function() {
  const app = document.getElementById('app');
  const withdrawal = State.getPendingWithdrawal();

  if (!withdrawal || !withdrawal.pickup_id) {
    UI.showToast('No hay retiro pendiente', 'error');
    Router.go('/withdrawal-scan');
    return;
  }

  const pickup = State.getPickupById(withdrawal.pickup_id);

  app.innerHTML = `
    <div class="view-container withdrawal-signature">
      <header class="view-header">
        <button class="btn-back" onclick="Views.withdrawalSignature.goBack()">
          <span class="icon">←</span> Volver
        </button>
        <h1>Firma de Retiro</h1>
      </header>

      <main class="signature-content">
        <div class="signature-declaration">
          <p>Yo, <strong>${pickup.full_name}</strong>, confirmo el retiro de:</p>
          <ul class="students-to-withdraw">
            ${withdrawal.students.map(s => `<li>${s.full_name}</li>`).join('')}
          </ul>
        </div>

        <div class="datetime-info">
          <span class="date" id="current-date"></span>
          <span class="time" id="current-time"></span>
        </div>

        <div class="signature-area">
          <p class="signature-label">Firme aquí:</p>
          <div class="canvas-container">
            <canvas id="signature-canvas"></canvas>
          </div>
          <button class="btn-clear" onclick="Views.withdrawalSignature.clearSignature()">
            Limpiar Firma
          </button>
        </div>

        <div class="reason-section">
          <label for="withdrawal-reason">Motivo del retiro (opcional):</label>
          <select id="withdrawal-reason">
            <option value="">Seleccione un motivo...</option>
            <option value="Cita médica">Cita médica</option>
            <option value="Emergencia familiar">Emergencia familiar</option>
            <option value="Asunto personal">Asunto personal</option>
            <option value="Actividad extracurricular">Actividad extracurricular</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
      </main>

      <footer class="view-footer">
        <button class="btn-primary" id="confirm-withdrawal-btn" onclick="Views.withdrawalSignature.confirmWithdrawal()" disabled>
          Confirmar Retiro
        </button>
      </footer>
    </div>

    <style>
      .withdrawal-signature {
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

      .signature-content {
        flex: 1;
        padding: 1rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .signature-declaration {
        text-align: center;
        padding: 1rem;
        background: rgba(255,255,255,0.1);
        border-radius: 0.75rem;
      }

      .signature-declaration p {
        margin: 0 0 0.75rem;
        font-size: 1rem;
      }

      .students-to-withdraw {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .students-to-withdraw li {
        padding: 0.5rem;
        margin: 0.25rem 0;
        background: rgba(76, 175, 80, 0.2);
        border-radius: 0.5rem;
        font-weight: bold;
      }

      .datetime-info {
        display: flex;
        justify-content: center;
        gap: 2rem;
        padding: 0.75rem;
        background: rgba(0,0,0,0.2);
        border-radius: 0.5rem;
        font-size: 0.9rem;
      }

      .datetime-info .date,
      .datetime-info .time {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .signature-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 200px;
      }

      .signature-label {
        margin: 0 0 0.5rem;
        font-size: 0.875rem;
        opacity: 0.8;
      }

      .canvas-container {
        flex: 1;
        background: white;
        border-radius: 0.75rem;
        overflow: hidden;
        min-height: 150px;
        position: relative;
      }

      #signature-canvas {
        width: 100%;
        height: 100%;
        display: block;
        touch-action: none;
      }

      .btn-clear {
        margin-top: 0.5rem;
        padding: 0.5rem 1rem;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        cursor: pointer;
        align-self: flex-end;
      }

      .reason-section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .reason-section label {
        font-size: 0.875rem;
        opacity: 0.8;
      }

      .reason-section select {
        padding: 0.75rem;
        border-radius: 0.5rem;
        border: 1px solid rgba(255,255,255,0.3);
        background: rgba(255,255,255,0.1);
        color: white;
        font-size: 1rem;
      }

      .reason-section select option {
        background: #1a1a2e;
        color: white;
      }

      /* Footer */
      .view-footer {
        padding: 1rem;
        background: rgba(0,0,0,0.3);
      }

      .btn-primary {
        width: 100%;
        padding: 1rem;
        font-size: 1.1rem;
        font-weight: bold;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-primary:hover:not(:disabled) {
        background: #45a049;
      }

      .btn-primary:disabled {
        background: #666;
        cursor: not-allowed;
      }
    </style>
  `;

  // Initialize signature canvas
  Views.withdrawalSignature.initCanvas();

  // Update date/time display
  Views.withdrawalSignature.updateDateTime();
};

// Initialize signature canvas
Views.withdrawalSignature.initCanvas = function() {
  const canvas = document.getElementById('signature-canvas');
  if (!canvas) return;

  const container = canvas.parentElement;
  const ctx = canvas.getContext('2d');

  // Set canvas size to match container
  const resizeCanvas = () => {
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Set drawing style
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Drawing state
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let hasSignature = false;

  // Get coordinates from event
  const getCoords = (e) => {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // Start drawing
  const startDrawing = (e) => {
    e.preventDefault();
    isDrawing = true;
    const coords = getCoords(e);
    lastX = coords.x;
    lastY = coords.y;
  };

  // Draw
  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCoords(e);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastX = coords.x;
    lastY = coords.y;
    hasSignature = true;

    // Enable confirm button
    const confirmBtn = document.getElementById('confirm-withdrawal-btn');
    if (confirmBtn) {
      confirmBtn.disabled = false;
    }
  };

  // Stop drawing
  const stopDrawing = () => {
    isDrawing = false;
  };

  // Mouse events
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);

  // Touch events
  canvas.addEventListener('touchstart', startDrawing);
  canvas.addEventListener('touchmove', draw);
  canvas.addEventListener('touchend', stopDrawing);
  canvas.addEventListener('touchcancel', stopDrawing);

  // Store reference for cleanup
  Views.withdrawalSignature.canvas = canvas;
  Views.withdrawalSignature.ctx = ctx;
  Views.withdrawalSignature.hasSignature = () => hasSignature;
  Views.withdrawalSignature.setHasSignature = (val) => { hasSignature = val; };
};

// Clear signature
Views.withdrawalSignature.clearSignature = function() {
  const canvas = Views.withdrawalSignature.canvas;
  const ctx = Views.withdrawalSignature.ctx;

  if (canvas && ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    Views.withdrawalSignature.setHasSignature(false);

    // Disable confirm button
    const confirmBtn = document.getElementById('confirm-withdrawal-btn');
    if (confirmBtn) {
      confirmBtn.disabled = true;
    }
  }
};

// Update date/time display
Views.withdrawalSignature.updateDateTime = function() {
  const dateEl = document.getElementById('current-date');
  const timeEl = document.getElementById('current-time');

  const now = new Date();

  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('es-CL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};

// Go back to verification
Views.withdrawalSignature.goBack = function() {
  Router.go('/withdrawal-verify');
};

// Confirm withdrawal with signature
Views.withdrawalSignature.confirmWithdrawal = async function() {
  if (!Views.withdrawalSignature.hasSignature || !Views.withdrawalSignature.hasSignature()) {
    UI.showToast('Por favor firme antes de confirmar', 'warning');
    return;
  }

  const canvas = Views.withdrawalSignature.canvas;
  if (!canvas) {
    UI.showToast('Error al obtener firma', 'error');
    return;
  }

  UI.showToast('Procesando retiro...', 'info', 3000);

  // Get signature as base64
  const signatureData = canvas.toDataURL('image/png');

  // Get reason
  const reasonSelect = document.getElementById('withdrawal-reason');
  const reason = reasonSelect ? reasonSelect.value : null;

  const withdrawal = State.getPendingWithdrawal();

  try {
    // Complete withdrawals on server
    if (withdrawal.server_withdrawal_ids && withdrawal.server_withdrawal_ids.length > 0) {
      for (const withdrawalId of withdrawal.server_withdrawal_ids) {
        await Sync.completeWithdrawal(withdrawalId, signatureData, reason);
      }
    }

    // Update local state
    State.updateWithdrawalStatus('COMPLETED', {
      signature_data: signatureData,
      reason: reason,
      completed_at: new Date().toISOString()
    });

    // Add to today's withdrawals locally
    const pickup = State.getPickupById(withdrawal.pickup_id);
    withdrawal.students.forEach(student => {
      State.todayWithdrawals.push({
        student_id: student.id,
        withdrawn_at: new Date().toISOString(),
        pickup_name: pickup.full_name
      });
    });
    State.persist();

    // Navigate to confirmation
    Router.go('/withdrawal-confirm');

  } catch (err) {
    console.error('Withdrawal completion error:', err);
    UI.showToast(err.message || 'Error al completar retiro', 'error');
  }
};

// Expose globally
window.Views = window.Views || {};
window.Views.withdrawalSignature = Views.withdrawalSignature;
