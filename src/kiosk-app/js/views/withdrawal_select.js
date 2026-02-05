// Withdrawal Select View - Select students to withdraw
Views.withdrawalSelect = function() {
  const app = document.getElementById('app');
  const params = Router.getQueryParams();
  const pickupId = parseInt(params.pickup_id, 10);

  // Get pickup info
  const pickup = State.getPickupById(pickupId);
  if (!pickup) {
    UI.showToast('Persona autorizada no encontrada', 'error');
    Router.go('/withdrawal-scan');
    return;
  }

  // Get withdrawable students for this pickup
  const students = State.getWithdrawableStudents(pickupId);

  app.innerHTML = `
    <div class="view-container withdrawal-select">
      <header class="view-header">
        <button class="btn-back" onclick="Views.withdrawalSelect.goBack()">
          <span class="icon">←</span> Volver
        </button>
        <h1>Seleccionar Estudiantes</h1>
      </header>

      <main class="select-content">
        <!-- Pickup info card -->
        <div class="pickup-card">
          <div class="pickup-photo">
            ${pickup.photo_url
              ? `<img src="${pickup.photo_url}" alt="${pickup.full_name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23fff%22 font-size=%2240%22>${pickup.full_name.charAt(0)}</text></svg>'">`
              : `<div class="pickup-initials">${pickup.full_name.charAt(0)}</div>`
            }
          </div>
          <div class="pickup-info">
            <div class="pickup-name">${pickup.full_name}</div>
            <div class="pickup-relationship">${pickup.relationship_type}</div>
          </div>
          <div class="pickup-verified">✓ Verificado</div>
        </div>

        <!-- Student selection -->
        <div class="students-section">
          <h2>Estudiantes autorizados</h2>
          <p class="hint">Seleccione los estudiantes a retirar</p>

          <div class="students-list" id="students-list">
            ${students.length > 0 ? students.map(student => `
              <div class="student-item ${student.canWithdraw ? '' : 'disabled'}"
                   onclick="${student.canWithdraw ? `Views.withdrawalSelect.toggleStudent(${student.id})` : ''}">
                <div class="student-checkbox">
                  <input type="checkbox" id="student-${student.id}" ${student.canWithdraw ? '' : 'disabled'}>
                </div>
                <div class="student-photo">
                  ${student.photo_url
                    ? `<img src="${student.photo_url}" alt="${student.full_name}" onerror="this.parentElement.innerHTML='<div class=\\'student-initials\\'>${student.full_name.charAt(0)}</div>'">`
                    : `<div class="student-initials">${student.full_name.charAt(0)}</div>`
                  }
                </div>
                <div class="student-info">
                  <div class="student-name">${student.full_name}</div>
                  <div class="student-course">${student.course_name || 'Sin curso'}</div>
                  ${!student.canWithdraw ? `<div class="student-warning">${student.withdrawReason}</div>` : ''}
                </div>
              </div>
            `).join('') : `
              <div class="no-students">
                <p>No hay estudiantes disponibles para retirar</p>
              </div>
            `}
          </div>
        </div>
      </main>

      <footer class="view-footer">
        <button class="btn-primary" id="continue-btn" onclick="Views.withdrawalSelect.continueWithdrawal()" disabled>
          Continuar
        </button>
      </footer>
    </div>

    <style>
      .withdrawal-select {
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

      .select-content {
        flex: 1;
        padding: 1rem;
        overflow-y: auto;
      }

      /* Pickup card */
      .pickup-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: rgba(76, 175, 80, 0.2);
        border: 1px solid rgba(76, 175, 80, 0.5);
        border-radius: 1rem;
        margin-bottom: 1.5rem;
      }

      .pickup-photo {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        overflow: hidden;
        background: #333;
      }

      .pickup-photo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .pickup-initials {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        font-weight: bold;
        background: #4CAF50;
        color: white;
      }

      .pickup-info {
        flex: 1;
      }

      .pickup-name {
        font-weight: bold;
        font-size: 1.1rem;
      }

      .pickup-relationship {
        font-size: 0.875rem;
        opacity: 0.8;
      }

      .pickup-verified {
        color: #4CAF50;
        font-weight: bold;
      }

      /* Students section */
      .students-section h2 {
        margin: 0 0 0.5rem;
        font-size: 1.1rem;
      }

      .hint {
        margin: 0 0 1rem;
        opacity: 0.7;
        font-size: 0.875rem;
      }

      .students-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .student-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: rgba(255,255,255,0.1);
        border-radius: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .student-item:hover:not(.disabled) {
        background: rgba(255,255,255,0.2);
      }

      .student-item.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .student-item.selected {
        background: rgba(76, 175, 80, 0.3);
        border: 1px solid rgba(76, 175, 80, 0.5);
      }

      .student-checkbox {
        width: 24px;
        height: 24px;
      }

      .student-checkbox input {
        width: 24px;
        height: 24px;
        cursor: pointer;
      }

      .student-photo {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        overflow: hidden;
        background: #333;
      }

      .student-photo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .student-initials {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        font-weight: bold;
        background: #666;
        color: white;
      }

      .student-info {
        flex: 1;
      }

      .student-name {
        font-weight: bold;
      }

      .student-course {
        font-size: 0.875rem;
        opacity: 0.7;
      }

      .student-warning {
        font-size: 0.75rem;
        color: #ff9800;
        margin-top: 0.25rem;
      }

      .no-students {
        text-align: center;
        padding: 2rem;
        opacity: 0.7;
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

  // Store selected students
  Views.withdrawalSelect.selectedStudents = new Set();
  Views.withdrawalSelect.pickupId = pickupId;
};

// Toggle student selection
Views.withdrawalSelect.toggleStudent = function(studentId) {
  const checkbox = document.getElementById(`student-${studentId}`);
  const item = checkbox.closest('.student-item');

  if (Views.withdrawalSelect.selectedStudents.has(studentId)) {
    Views.withdrawalSelect.selectedStudents.delete(studentId);
    checkbox.checked = false;
    item.classList.remove('selected');
  } else {
    Views.withdrawalSelect.selectedStudents.add(studentId);
    checkbox.checked = true;
    item.classList.add('selected');
  }

  // Update continue button state
  const continueBtn = document.getElementById('continue-btn');
  if (continueBtn) {
    continueBtn.disabled = Views.withdrawalSelect.selectedStudents.size === 0;
  }
};

// Go back to scan
Views.withdrawalSelect.goBack = function() {
  State.clearPendingWithdrawal();
  Router.go('/withdrawal-scan');
};

// Continue to verification
Views.withdrawalSelect.continueWithdrawal = function() {
  const selectedIds = Array.from(Views.withdrawalSelect.selectedStudents);

  if (selectedIds.length === 0) {
    UI.showToast('Seleccione al menos un estudiante', 'warning');
    return;
  }

  // Update pending withdrawal with selected students
  State.startWithdrawal(Views.withdrawalSelect.pickupId, selectedIds);

  // Navigate to verification
  Router.go('/withdrawal-verify');
};

// Expose globally
window.Views = window.Views || {};
window.Views.withdrawalSelect = Views.withdrawalSelect;
