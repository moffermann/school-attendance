// Sync module
const Sync = {
  isSyncing: false,

  async processQueue() {
    if (this.isSyncing || !State.device.online) {
      return;
    }

    const pending = State.queue.filter(e => e.status === 'pending' || e.status === 'error');
    if (pending.length === 0) {
      return;
    }

    this.isSyncing = true;
    UI.showToast('Sincronizando...', 'info', 2000);

    for (const event of pending.slice(0, 5)) { // Process 5 at a time
      State.updateEventStatus(event.id, 'in_progress');

      // Simulate network request
      await this.simulateSync(event);
    }

    this.isSyncing = false;
  },

  async simulateSync(event) {
    return new Promise(resolve => {
      setTimeout(() => {
        // 15% chance of failure
        const success = Math.random() > 0.15;

        if (success) {
          State.markSynced(event.id);
        } else {
          State.updateEventStatus(event.id, 'error');
        }

        resolve(success);
      }, 500 + Math.random() * 1000);
    });
  },

  async syncNow() {
    if (!State.device.online) {
      UI.showToast('Dispositivo offline', 'error');
      return;
    }

    await this.processQueue();

    const synced = State.queue.filter(e => e.status === 'synced').length;
    const errors = State.queue.filter(e => e.status === 'error').length;

    if (errors > 0) {
      UI.showToast(`Sincronizado: ${synced}, Errores: ${errors}`, 'warning');
    } else {
      UI.showToast('Sincronización completa', 'success');
    }
  }
};

// Auto-sync every 30 seconds
setInterval(() => {
  if (State.device.online) {
    Sync.processQueue();
  }
}, 30000);
