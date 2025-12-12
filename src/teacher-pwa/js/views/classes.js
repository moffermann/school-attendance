Views.classes = async function() {
  const app = document.getElementById('app');

  // Check authentication
  if (!State.isAuthenticated()) {
    Router.navigate('/auth');
    return;
  }

  // Use courses from State (loaded from API) or fallback to IDB
  let myCourses = State.courses;

  if (!myCourses.length) {
    // Try to load from IDB (offline mode)
    myCourses = await IDB.getAll('courses');
  }

  const teacherName = State.teacher ? State.teacher.full_name : 'Profesor';
  const greeting = getGreeting();

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  const courseEmojis = ['📚', '📖', '📝', '🎓', '✏️', '📐'];

  // Check if first visit
  const hasSeenOnboarding = localStorage.getItem('teacher_onboarding_seen');

  app.innerHTML = `
    ${UI.createHeader('Mis Cursos')}
    <div class="container">
      ${!hasSeenOnboarding ? `
      <!-- Guía de inicio para nuevos usuarios -->
      <div class="card" style="background: linear-gradient(135deg, var(--primary-light) 0%, var(--info-light) 100%); border: 1px solid var(--primary); margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h3 style="margin: 0 0 0.5rem; color: var(--primary-dark);">👋 ¡Bienvenido/a!</h3>
            <p style="font-size: 0.9rem; color: var(--gray-700); margin: 0;">¿Primera vez usando la app? Te mostramos cómo tomar asistencia.</p>
          </div>
          <button onclick="Views.classes.dismissOnboarding()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--gray-400);">✕</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem; background: white; padding: 0.75rem; border-radius: 8px;">
            <span style="font-size: 1.5rem;">1️⃣</span>
            <div>
              <strong>Selecciona un curso</strong>
              <p style="font-size: 0.8rem; color: var(--gray-500); margin: 0;">Toca el curso donde quieres pasar lista</p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem; background: white; padding: 0.75rem; border-radius: 8px;">
            <span style="font-size: 1.5rem;">2️⃣</span>
            <div>
              <strong>Marca la asistencia</strong>
              <p style="font-size: 0.8rem; color: var(--gray-500); margin: 0;">Presente, Tarde o Ausente para cada alumno</p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem; background: white; padding: 0.75rem; border-radius: 8px;">
            <span style="font-size: 1.5rem;">3️⃣</span>
            <div>
              <strong>Guarda los registros</strong>
              <p style="font-size: 0.8rem; color: var(--gray-500); margin: 0;">Se sincronizan automáticamente con el servidor</p>
            </div>
          </div>
        </div>
        <button class="btn btn-primary btn-block mt-3" onclick="Views.classes.dismissOnboarding()">
          ¡Entendido, empezar!
        </button>
      </div>
      ` : ''}

      <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <p style="font-size: 0.9rem; color: var(--gray-500);">${greeting}</p>
          <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--gray-900); margin-top: 0.25rem;">
            ${UI.escapeHtml(teacherName)}
          </h2>
          ${State.demoMode ? '<span class="chip chip-warning" style="margin-top: 0.5rem;">Modo Demo</span>' : ''}
        </div>
        <button class="btn btn-secondary btn-sm" onclick="Views.classes.showHelp()" title="Ayuda">
          ❓
        </button>
      </div>

      ${myCourses.length ? `
        <p style="font-size: 0.85rem; color: var(--gray-500); margin-bottom: 1rem;">
          ${myCourses.length} curso${myCourses.length > 1 ? 's' : ''} asignado${myCourses.length > 1 ? 's' : ''}
        </p>

        ${myCourses.map((c, i) => `
          <div class="course-card" onclick="Views.classes.selectCourse(${c.id})">
            <div class="course-icon">${courseEmojis[i % courseEmojis.length]}</div>
            <div class="course-info">
              <div class="course-name">${UI.escapeHtml(c.name)}</div>
              <div class="course-meta">${UI.escapeHtml(c.grade || 'Sin nivel asignado')}</div>
            </div>
            <div class="course-arrow">→</div>
          </div>
        `).join('')}

        <div style="margin-top: 1.5rem;">
          <button class="btn btn-primary btn-block" onclick="Views.classes.quickAttendance()">
            ✓ Tomar Asistencia Rápida
          </button>
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <div class="empty-state-title">Sin cursos asignados</div>
          <div class="empty-state-text">No tienes cursos asignados. Contacta al administrador.</div>
        </div>
      `}

      <div style="margin-top: 2rem; display: flex; flex-direction: column; gap: 0.75rem;">
        <button class="btn btn-secondary" onclick="Views.classes.switchApp()">
          🔄 Cambiar Aplicación
        </button>
        <div style="display: flex; gap: 0.75rem;">
          <button class="btn btn-secondary" style="flex: 1;" onclick="Router.navigate('/settings')">
            ⚙️ Configuración
          </button>
          <button class="btn btn-secondary" style="flex: 1;" onclick="Views.classes.logout()">
            🚪 Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
    ${UI.createBottomNav('/classes')}
  `;

  Views.classes.selectCourse = function(id) {
    State.setSession(State.currentTeacherId, id);
    Router.navigate('/roster');
  };

  Views.classes.quickAttendance = function() {
    if (myCourses.length === 1) {
      State.setSession(State.currentTeacherId, myCourses[0].id);
      Router.navigate('/take-attendance');
    } else {
      // Show course selector
      const options = myCourses.map(c => `
        <button class="btn btn-secondary btn-block mb-1" onclick="Views.classes.startAttendance(${c.id})">
          ${UI.escapeHtml(c.name)}
        </button>
      `).join('');

      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 1000;">
          <div class="card" style="width: 100%; max-width: 320px;">
            <div class="card-header">Seleccionar Curso</div>
            ${options}
            <button class="btn btn-secondary btn-block mt-2" onclick="this.closest('.modal-overlay').remove()">
              Cancelar
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
  };

  Views.classes.startAttendance = function(id) {
    document.querySelector('.modal-overlay')?.remove();
    State.setSession(State.currentTeacherId, id);
    Router.navigate('/take-attendance');
  };

  Views.classes.logout = function() {
    State.logout();
    UI.showToast('Sesión cerrada', 'info');
    Router.navigate('/auth');
  };

  Views.classes.switchApp = function() {
    // Redirect to login app selector, preserving tokens
    const token = sessionStorage.getItem('accessToken');
    const refresh = sessionStorage.getItem('refreshToken');
    if (token && refresh) {
      window.location.href = `/#token=${token}&refresh=${refresh}`;
    } else {
      window.location.href = '/';
    }
  };

  Views.classes.dismissOnboarding = function() {
    localStorage.setItem('teacher_onboarding_seen', 'true');
    // Re-render without onboarding
    Views.classes();
  };

  Views.classes.showHelp = function() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 1000;">
        <div class="card" style="width: 100%; max-width: 400px; max-height: 80vh; overflow-y: auto;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
            <span>❓ Ayuda - Cómo usar la app</span>
            <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer;">✕</button>
          </div>

          <div style="padding: 1rem 0;">
            <h4 style="margin: 0 0 0.5rem; color: var(--primary);">📋 Pasar Lista</h4>
            <ol style="margin: 0; padding-left: 1.25rem; font-size: 0.9rem; color: var(--gray-600);">
              <li>Selecciona un curso de la lista</li>
              <li>Verás la lista de alumnos</li>
              <li>Toca "Marcado en Lote" o registra uno por uno</li>
              <li>Los registros se guardan automáticamente</li>
            </ol>
          </div>

          <div style="padding: 1rem 0; border-top: 1px solid var(--gray-200);">
            <h4 style="margin: 0 0 0.5rem; color: var(--primary);">📱 Escanear QR</h4>
            <p style="margin: 0; font-size: 0.9rem; color: var(--gray-600);">
              Desde la lista de alumnos, toca "Escanear QR" para registrar entrada/salida escaneando la credencial del alumno.
            </p>
          </div>

          <div style="padding: 1rem 0; border-top: 1px solid var(--gray-200);">
            <h4 style="margin: 0 0 0.5rem; color: var(--primary);">🔄 Sincronización</h4>
            <p style="margin: 0; font-size: 0.9rem; color: var(--gray-600);">
              Los registros se guardan localmente y se sincronizan automáticamente cuando hay conexión. Si ves "Cola" en el menú inferior, hay registros pendientes de enviar.
            </p>
          </div>

          <div style="padding: 1rem 0; border-top: 1px solid var(--gray-200);">
            <h4 style="margin: 0 0 0.5rem; color: var(--primary);">🔔 Alertas</h4>
            <p style="margin: 0; font-size: 0.9rem; color: var(--gray-600);">
              En "Alertas" verás alumnos que no han registrado entrada hoy.
            </p>
          </div>

          <button class="btn btn-primary btn-block mt-2" onclick="this.closest('.modal-overlay').remove()">
            Cerrar
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };
};
