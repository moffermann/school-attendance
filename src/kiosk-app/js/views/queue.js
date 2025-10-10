// Queue view
Views.queue = function() {
  const app = document.getElementById('app');
  let activeTab = 'pending';

  function render() {
    const pending = State.queue.filter(e => e.status === 'pending');
    const inProgress = State.queue.filter(e => e.status === 'in_progress');
    const synced = State.queue.filter(e => e.status === 'synced');
    const errors = State.queue.filter(e => e.status === 'error');

    const currentList = {
      pending, inProgress, synced, errors
    }[activeTab] || pending;

    app.innerHTML = `
      ${UI.createHeader()}
      <div class="container">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${pending.length}</div>
            <div class="stat-label">Pendientes</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${inProgress.length}</div>
            <div class="stat-label">En Progreso</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${synced.length}</div>
            <div class="stat-label">Sincronizados</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${errors.length}</div>
            <div class="stat-label">Errores</div>
          </div>
        </div>

        <div class="card">
          <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
            <button class="btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}"
              onclick="Views.queue.switchTab('pending')">
              Pendientes
            </button>
            <button class="btn ${activeTab === 'inProgress' ? 'btn-primary' : 'btn-secondary'}"
              onclick="Views.queue.switchTab('inProgress')">
              En Progreso
            </button>
            <button class="btn ${activeTab === 'synced' ? 'btn-primary' : 'btn-secondary'}"
              onclick="Views.queue.switchTab('synced')">
              Sincronizados
            </button>
            <button class="btn ${activeTab === 'errors' ? 'btn-primary' : 'btn-secondary'}"
              onclick="Views.queue.switchTab('errors')">
              Errores
            </button>
          </div>

          <div style="overflow-x: auto;">
            <table>
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Tipo</th>
                  <th>Hora</th>
                  <th>Seq</th>
                  <th>Estado</th>
                  ${activeTab === 'errors' ? '<th>Reintentos</th><th>Acción</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${currentList.length === 0 ? `
                  <tr><td colspan="7" style="text-align: center; padding: 2rem;">No hay eventos</td></tr>
                ` : currentList.map(event => {
                  const student = State.students.find(s => s.id === event.student_id);
                  return `
                    <tr>
                      <td>${student?.full_name || event.student_id}</td>
                      <td>${UI.createChip(event.type, event.type === 'IN' ? 'success' : 'info')}</td>
                      <td>${UI.formatTime(event.ts)}</td>
                      <td>${event.local_seq}</td>
                      <td>${UI.createChip(event.status, event.status === 'synced' ? 'success' : event.status === 'error' ? 'error' : 'warning')}</td>
                      ${activeTab === 'errors' ? `
                        <td>${event.retries || 0}</td>
                        <td>
                          <button class="btn btn-secondary btn-sm" onclick="Views.queue.retry('${event.id}')">
                            Reintentar
                          </button>
                        </td>
                      ` : ''}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="flex gap-2 mt-3 flex-wrap">
          <button class="btn btn-primary" onclick="Sync.syncNow()">
            🔄 Sincronizar Ahora
          </button>
          <button class="btn btn-secondary" onclick="Router.navigate('/home')">
            ← Volver
          </button>
        </div>
      </div>
    `;
  }

  Views.queue.switchTab = function(tab) {
    activeTab = tab;
    render();
  };

  Views.queue.retry = function(id) {
    State.updateEventStatus(id, 'pending');
    Sync.processQueue();
    render();
  };

  render();
};
