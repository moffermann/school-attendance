// Withdrawal Confirm View - Confirmation screen after successful withdrawal
Views.withdrawalConfirm = function() {
  const app = document.getElementById('app');
  const withdrawal = State.getPendingWithdrawal();

  // Can show confirmation even without full withdrawal data
  const pickup = withdrawal && withdrawal.pickup_id
    ? State.getPickupById(withdrawal.pickup_id)
    : null;

  const students = withdrawal && withdrawal.students
    ? withdrawal.students
    : [];

  const completedAt = withdrawal && withdrawal.completed_at
    ? new Date(withdrawal.completed_at)
    : new Date();

  app.innerHTML = `
    <div class="view-container withdrawal-confirm">
      <main class="confirm-content">
        <div class="success-icon">
          <div class="checkmark">✓</div>
        </div>

        <h1>Retiro Registrado</h1>

        <div class="withdrawal-summary">
          ${students.length > 0 ? `
            <div class="summary-section">
              <h3>Estudiante${students.length > 1 ? 's' : ''}</h3>
              <ul class="student-list">
                ${students.map(s => `<li>${s.full_name}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${pickup ? `
            <div class="summary-section">
              <h3>Retirado por</h3>
              <p class="pickup-name">${pickup.full_name}</p>
              <p class="pickup-relationship">${pickup.relationship_type}</p>
            </div>
          ` : ''}

          <div class="summary-section">
            <h3>Fecha y Hora</h3>
            <p class="datetime">${completedAt.toLocaleDateString('es-CL', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</p>
            <p class="datetime">${completedAt.toLocaleTimeString('es-CL', {
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>
        </div>

        <div class="notification-info">
          <span class="icon">📧</span>
          <p>Se ha notificado al apoderado principal</p>
        </div>
      </main>

      <footer class="view-footer">
        <button class="btn-primary" onclick="Views.withdrawalConfirm.newWithdrawal()">
          Nuevo Retiro
        </button>
        <button class="btn-secondary" onclick="Views.withdrawalConfirm.goHome()">
          Volver al Inicio
        </button>
      </footer>
    </div>

    <style>
      .withdrawal-confirm {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        color: white;
      }

      .confirm-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        text-align: center;
      }

      .success-icon {
        margin-bottom: 1.5rem;
      }

      .checkmark {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 3rem;
        color: white;
        box-shadow: 0 10px 30px rgba(76, 175, 80, 0.4);
        animation: scaleIn 0.5s ease-out;
      }

      @keyframes scaleIn {
        0% {
          transform: scale(0);
          opacity: 0;
        }
        50% {
          transform: scale(1.1);
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }

      .confirm-content h1 {
        margin: 0 0 1.5rem;
        font-size: 1.75rem;
        animation: fadeInUp 0.5s ease-out 0.2s both;
      }

      @keyframes fadeInUp {
        0% {
          transform: translateY(20px);
          opacity: 0;
        }
        100% {
          transform: translateY(0);
          opacity: 1;
        }
      }

      .withdrawal-summary {
        width: 100%;
        max-width: 350px;
        background: rgba(255,255,255,0.1);
        border-radius: 1rem;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        animation: fadeInUp 0.5s ease-out 0.3s both;
      }

      .summary-section {
        padding: 0.75rem 0;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }

      .summary-section:last-child {
        border-bottom: none;
      }

      .summary-section h3 {
        margin: 0 0 0.5rem;
        font-size: 0.75rem;
        text-transform: uppercase;
        opacity: 0.7;
        letter-spacing: 0.5px;
      }

      .student-list {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .student-list li {
        padding: 0.25rem 0;
        font-weight: bold;
      }

      .pickup-name {
        margin: 0;
        font-weight: bold;
        font-size: 1.1rem;
      }

      .pickup-relationship {
        margin: 0.25rem 0 0;
        opacity: 0.8;
        font-size: 0.9rem;
      }

      .datetime {
        margin: 0.25rem 0;
      }

      .notification-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem 1.5rem;
        background: rgba(76, 175, 80, 0.2);
        border: 1px solid rgba(76, 175, 80, 0.3);
        border-radius: 0.75rem;
        animation: fadeInUp 0.5s ease-out 0.4s both;
      }

      .notification-info .icon {
        font-size: 1.5rem;
      }

      .notification-info p {
        margin: 0;
        font-size: 0.9rem;
      }

      /* Footer */
      .view-footer {
        padding: 1rem;
        background: rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
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

      .btn-primary:hover {
        background: #45a049;
      }

      .btn-secondary {
        width: 100%;
        padding: 0.875rem;
        font-size: 1rem;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        border-radius: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-secondary:hover {
        background: rgba(255,255,255,0.2);
      }
    </style>
  `;

  // Auto-redirect to home after 30 seconds of inactivity
  Views.withdrawalConfirm.autoRedirectTimer = setTimeout(() => {
    Views.withdrawalConfirm.goHome();
  }, 30000);
};

// Start new withdrawal
Views.withdrawalConfirm.newWithdrawal = function() {
  Views.withdrawalConfirm.cleanup();
  State.clearPendingWithdrawal();
  Router.go('/withdrawal-scan');
};

// Go back to home
Views.withdrawalConfirm.goHome = function() {
  Views.withdrawalConfirm.cleanup();
  State.clearPendingWithdrawal();
  Router.go('/home');
};

// Cleanup
Views.withdrawalConfirm.cleanup = function() {
  if (Views.withdrawalConfirm.autoRedirectTimer) {
    clearTimeout(Views.withdrawalConfirm.autoRedirectTimer);
    Views.withdrawalConfirm.autoRedirectTimer = null;
  }
};

// Register cleanup on route change
Router.registerCleanup('/withdrawal-confirm', () => {
  Views.withdrawalConfirm.cleanup();
});

// Expose globally
window.Views = window.Views || {};
window.Views.withdrawalConfirm = Views.withdrawalConfirm;
