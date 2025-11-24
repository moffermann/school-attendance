// UI components for kiosk - V2
const UI = {
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => toast.remove(), duration);
    }
  },

  showModal(title, content, onConfirm) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>${title}</h2>
          <button id="close-modal-btn" class="btn-close">&times;</button>
        </div>
        <div class="modal-content">
          ${content}
        </div>
      </div>
    `;
    modalContainer.style.display = 'flex';

    document.getElementById('close-modal-btn').addEventListener('click', UI.hideModal);
  },

  hideModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = '';
    modalContainer.style.display = 'none';
  },

  createConfirmationModal(student, eventType) {
    return `
      <div class="confirmation-modal">
        <img src="${student.photo_url}" alt="Foto de ${student.name}" class="student-photo-large">
        <h3>${student.name}</h3>
        <p>Curso: ${student.course}</p>
        <div class="flex gap-2">
          <button id="confirm-in-btn" class="btn btn-success btn-lg">Registrar ENTRADA</button>
          <button id="confirm-out-btn" class="btn btn-danger btn-lg">Registrar SALIDA</button>
        </div>
      </div>
    `;
  },
  
  createPinModal() {
    return `
      <div class="pin-modal">
        <div class="form-group">
          <label class="form-label">Ingrese PIN de Operador</label>
          <input type="password" id="pin-input" class="form-input-lg" maxlength="4" autofocus>
        </div>
        <div class="flex gap-2">
          <button id="submit-pin-btn" class="btn btn-primary">Aceptar</button>
          <button id="cancel-pin-btn" class="btn btn-secondary">Cancelar</button>
        </div>
      </div>
    `;
  },

  createHeader() {
    // This will be part of the main view now
    return '';
  },

  updateHeaderTime() {
    // This will be handled within the main view
  },

  createChip(label, type = 'gray') {
    return `<span class="chip chip-${type}">${label}</span>`;
  },

  formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  }
};