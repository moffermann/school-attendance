// Auth view - Role selection
const Views = window.Views || {};
window.Views = Views;

Views.auth = function() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <img src="/static/spa/assets/logo.svg" alt="Logo" class="auth-logo">
        <h1 class="auth-title">Control de Ingreso/Salida Escolar</h1>
        <p class="mb-3">Selecciona tu perfil para continuar:</p>

        <div class="role-buttons">
          <button class="role-button" id="btn-director">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🏫</div>
            <div>Dirección / Inspectoría</div>
          </button>

          <button class="role-button" id="btn-parent">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">👨‍👩‍👧</div>
            <div>Apoderado</div>
          </button>
        </div>
      </div>
    </div>
  `;

  // Director/Inspector button
  document.getElementById('btn-director').addEventListener('click', () => {
    Components.showModal('Seleccionar Rol', `
      <div class="form-group">
        <label class="form-label">Rol</label>
        <select id="director-role" class="form-select">
          <option value="director">Director</option>
          <option value="inspector">Inspector</option>
        </select>
      </div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      {
        label: 'Continuar',
        action: 'submit',
        className: 'btn-primary',
        onClick: () => {
          const role = document.getElementById('director-role').value;
          State.setRole(role);
          Router.navigate('/director/dashboard');
        }
      }
    ]);
  });

  // Parent button
  document.getElementById('btn-parent').addEventListener('click', () => {
    const guardians = State.getGuardians();
    const options = guardians.map(g => `
      <option value="${g.id}">${g.full_name}</option>
    `).join('');

    Components.showModal('Seleccionar Apoderado', `
      <div class="form-group">
        <label class="form-label">Apoderado</label>
        <select id="guardian-select" class="form-select">
          <option value="">Seleccione...</option>
          ${options}
        </select>
      </div>
      <div id="students-preview" class="mt-2"></div>
    `, [
      { label: 'Cancelar', action: 'close', className: 'btn-secondary' },
      {
        label: 'Continuar',
        action: 'submit',
        className: 'btn-primary',
        onClick: () => {
          const guardianId = parseInt(document.getElementById('guardian-select').value);
          if (!guardianId) {
            Components.showToast('Debe seleccionar un apoderado', 'error');
            return;
          }
          State.setRole('parent', guardianId);
          Router.navigate('/parent/home');
        }
      }
    ]);

    // Show students preview when guardian is selected
    document.getElementById('guardian-select').addEventListener('change', (e) => {
      const guardianId = parseInt(e.target.value);
      const preview = document.getElementById('students-preview');

      if (!guardianId) {
        preview.innerHTML = '';
        return;
      }

      const students = State.getGuardianStudents(guardianId);
      preview.innerHTML = `
        <div class="card">
          <div class="card-header">Alumnos vinculados</div>
          <div class="card-body">
            <ul style="list-style: none; padding: 0;">
              ${students.map(s => `<li>• ${s.full_name} - ${State.getCourse(s.course_id).name}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    });
  });
};
