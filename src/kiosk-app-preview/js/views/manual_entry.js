// Manual entry view
Views.manualEntry = function() {
  const app = document.getElementById('app');
  let searchTerm = '';
  let filtered = [];

  function render() {
    filtered = searchTerm
      ? State.students.filter(s => s.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
      : State.students;

    app.innerHTML = `
      ${UI.createHeader()}
      <div class="container">
        <div class="card">
          <div class="card-header">Búsqueda Manual de Alumno</div>

          <div class="form-group">
            <label class="form-label">Buscar por nombre</label>
            <input type="text" id="search-input" class="form-input"
              placeholder="Ingresa el nombre..."
              value="${searchTerm}"
              autofocus>
          </div>

          <div class="search-list">
            ${filtered.slice(0, 20).map(student => `
              <div class="search-item" onclick="Views.manualEntry.selectStudent(${student.id})">
                <div>
                  <div style="font-size: 1.25rem; font-weight: 600;">${student.full_name}</div>
                  <div style="color: var(--color-gray-500);">Curso ${student.course_id}</div>
                </div>
                <div style="font-size: 2rem;">→</div>
              </div>
            `).join('')}
            ${filtered.length === 0 ? '<div class="text-center" style="padding: 2rem; color: var(--color-gray-500);">No se encontraron alumnos</div>' : ''}
            ${filtered.length > 20 ? `<div class="text-center" style="padding: 1rem; color: var(--color-gray-500);">... y ${filtered.length - 20} más</div>` : ''}
          </div>

          <div class="mt-3">
            <button class="btn btn-secondary" onclick="Router.navigate('/home')">
              ← Volver
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('search-input').addEventListener('input', (e) => {
      searchTerm = e.target.value;
      render();
    });
  }

  Views.manualEntry.selectStudent = function(studentId) {
    const eventType = State.nextEventTypeFor(studentId);
    Router.navigate(`/scan-result?student_id=${studentId}&type=${eventType}&source=MANUAL`);
  };

  render();
};
