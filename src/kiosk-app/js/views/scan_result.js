// Scan result and confirmation
Views.scanResult = function() {
  const app = document.getElementById('app');
  const params = Router.getQueryParams();
  const studentId = parseInt(params.student_id);
  const eventType = params.type || 'IN';
  const source = params.source || 'NFC';

  const student = State.students.find(s => s.id === studentId);
  if (!student) {
    Router.navigate('/home');
    return;
  }

  let selectedType = eventType;

  function render() {
    app.innerHTML = `
      ${UI.createHeader()}
      <div class="container">
        <div class="student-card">
          <img src="assets/placeholder_photo.jpg" alt="Foto" class="student-photo">
          <div class="student-name">${student.full_name}</div>
          <div class="student-course">Curso ${student.course_id}</div>

          <div class="event-type-selector">
            <button class="btn btn-success type-button ${selectedType === 'IN' ? 'selected' : ''}"
              onclick="Views.scanResult.selectType('IN')">
              ⬇️ INGRESO
            </button>
            <button class="btn btn-error type-button ${selectedType === 'OUT' ? 'selected' : ''}"
              onclick="Views.scanResult.selectType('OUT')">
              ⬆️ SALIDA
            </button>
          </div>

          ${State.config.photoEnabled ? `
            <div class="mb-3">
              <div class="form-label">Foto de Evidencia</div>
              <img src="assets/placeholder_photo.jpg" alt="Evidencia" style="width: 200px; border-radius: 8px;">
              <div class="mt-2">
                <button class="btn btn-secondary" onclick="Views.scanResult.capturePhoto()">
                  📷 Capturar (simulado)
                </button>
              </div>
            </div>
          ` : ''}

          <div class="flex gap-2 justify-center mt-3">
            <button class="btn btn-primary btn-lg" onclick="Views.scanResult.confirm()">
              ✓ Confirmar ${selectedType === 'IN' ? 'Ingreso' : 'Salida'}
            </button>
            <button class="btn btn-secondary" onclick="Router.navigate('/home')">
              ✗ Cancelar
            </button>
          </div>
        </div>
      </div>
    `;
  }

  Views.scanResult.selectType = function(type) {
    selectedType = type;
    render();
  };

  Views.scanResult.capturePhoto = function() {
    UI.showToast('Foto capturada (simulado)', 'success');
  };

  Views.scanResult.confirm = function() {
    const event = {
      student_id: studentId,
      type: selectedType,
      ts: new Date().toISOString(),
      source: source,
      photo_ref: State.config.photoEnabled ? 'simulated.jpg' : null
    };

    State.enqueueEvent(event);
    UI.showToast(`${selectedType === 'IN' ? 'Ingreso' : 'Salida'} registrado`, 'success');

    // Show success screen briefly
    app.innerHTML = `
      ${UI.createHeader()}
      <div class="container">
        <div class="result-screen">
          <img src="assets/success.svg" alt="Éxito" class="result-icon">
          <div class="result-title">¡Registro Exitoso!</div>
          <div class="result-message">${student.full_name}<br>${selectedType === 'IN' ? 'Ingreso' : 'Salida'} a las ${UI.formatTime(event.ts)}</div>
        </div>
      </div>
    `;

    setTimeout(() => Router.navigate('/home'), 2000);
  };

  render();
};
