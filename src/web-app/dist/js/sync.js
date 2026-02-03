/**
 * Sync Queue Manager for Parent Portal PWA
 * Handles offline actions and synchronization with backend
 *
 * Queue item types:
 * - ABSENCE_REQUEST: Submit absence request
 * - PREFERENCE_UPDATE: Update notification preferences
 * - PHOTO_CONSENT: Update photo consent settings
 */

const Sync = {
  isSyncing: false,
  maxRetries: 3,
  batchSize: 10,
  autoSyncInterval: null,

  // Queue item statuses
  STATUS: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    SYNCED: 'synced',
    ERROR: 'error',
  },

  // Queue item types
  TYPE: {
    ABSENCE_REQUEST: 'ABSENCE_REQUEST',
    PREFERENCE_UPDATE: 'PREFERENCE_UPDATE',
    PHOTO_CONSENT: 'PHOTO_CONSENT',
  },

  /**
   * Add an action to the offline queue
   */
  async enqueue(type, payload) {
    const item = {
      type,
      payload,
      status: this.STATUS.PENDING,
      retries: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const id = await IDB.put('queue', item);
    console.log(`[Sync] Enqueued ${type} with id ${id}`);

    // Try to sync immediately if online
    if (navigator.onLine && API.isAuthenticated()) {
      this.processQueue();
    }

    return id;
  },

  /**
   * Process pending items in the queue
   */
  async processQueue() {
    if (this.isSyncing) {
      console.log('[Sync] Already syncing, skipping');
      return;
    }

    if (!navigator.onLine) {
      console.log('[Sync] Offline, skipping sync');
      return;
    }

    if (!API.isAuthenticated()) {
      console.log('[Sync] Not authenticated, skipping sync');
      return;
    }

    this.isSyncing = true;

    try {
      const queue = await IDB.getAll('queue');
      const pending = queue.filter(item =>
        item.status === this.STATUS.PENDING ||
        (item.status === this.STATUS.ERROR && item.retries < this.maxRetries)
      );

      if (pending.length === 0) {
        console.log('[Sync] No pending items');
        return;
      }

      console.log(`[Sync] Processing ${pending.length} items`);

      // Process in batches
      const batch = pending.slice(0, this.batchSize);

      for (const item of batch) {
        await this.processItem(item);
      }

      // Check if more items remain
      const remaining = pending.length - batch.length;
      if (remaining > 0) {
        console.log(`[Sync] ${remaining} items remaining, scheduling next batch`);
        setTimeout(() => this.processQueue(), 1000);
      }

    } catch (error) {
      console.error('[Sync] Queue processing failed:', error);
    } finally {
      this.isSyncing = false;
    }
  },

  /**
   * Process a single queue item
   */
  async processItem(item) {
    console.log(`[Sync] Processing item ${item.id}: ${item.type}`);

    // Mark as in progress
    item.status = this.STATUS.IN_PROGRESS;
    item.updated_at = new Date().toISOString();
    await IDB.put('queue', item);

    try {
      // Execute the action based on type
      await this.executeAction(item);

      // Mark as synced
      item.status = this.STATUS.SYNCED;
      item.synced_at = new Date().toISOString();
      item.updated_at = new Date().toISOString();
      await IDB.put('queue', item);

      console.log(`[Sync] Item ${item.id} synced successfully`);

    } catch (error) {
      console.error(`[Sync] Item ${item.id} failed:`, error);

      // Check if it's a network error (should retry) or API error (might not retry)
      const isNetworkError = error.name === 'TypeError' ||
        error.message?.includes('network') ||
        error.message?.includes('fetch');

      if (isNetworkError) {
        // Network error - keep as pending for automatic retry
        item.status = this.STATUS.PENDING;
      } else {
        // API error - mark as error with retry count
        item.status = this.STATUS.ERROR;
        item.retries = (item.retries || 0) + 1;
      }

      item.last_error = error.message;
      item.updated_at = new Date().toISOString();
      await IDB.put('queue', item);
    }
  },

  /**
   * Execute the actual API call for a queue item
   */
  async executeAction(item) {
    const { type, payload } = item;

    switch (type) {
      case this.TYPE.ABSENCE_REQUEST:
        return API.submitAbsence(payload);

      case this.TYPE.PREFERENCE_UPDATE:
        return API.updateGuardianPreferences(payload.guardian_id, payload.preferences);

      case this.TYPE.PHOTO_CONSENT:
        return API.updatePhotoConsent(payload.guardian_id, payload.consents);

      default:
        throw new Error(`Unknown queue item type: ${type}`);
    }
  },

  /**
   * Get queue statistics
   */
  async getStats() {
    const queue = await IDB.getAll('queue');
    return {
      total: queue.length,
      pending: queue.filter(i => i.status === this.STATUS.PENDING).length,
      inProgress: queue.filter(i => i.status === this.STATUS.IN_PROGRESS).length,
      synced: queue.filter(i => i.status === this.STATUS.SYNCED).length,
      errors: queue.filter(i => i.status === this.STATUS.ERROR).length,
    };
  },

  /**
   * Manual sync trigger with UI feedback
   */
  async syncNow() {
    if (!navigator.onLine) {
      if (typeof Components !== 'undefined') {
        Components.showToast('Sin conexión a internet', 'error');
      }
      return { success: false, message: 'Offline' };
    }

    if (!API.isAuthenticated()) {
      if (typeof Components !== 'undefined') {
        Components.showToast('Debes iniciar sesión para sincronizar', 'error');
      }
      return { success: false, message: 'Not authenticated' };
    }

    if (typeof Components !== 'undefined') {
      Components.showToast('Sincronizando...', 'info');
    }

    await this.processQueue();

    const stats = await this.getStats();

    if (stats.errors > 0) {
      if (typeof Components !== 'undefined') {
        Components.showToast(`Sincronizado con ${stats.errors} errores`, 'warning');
      }
      return { success: false, stats };
    }

    if (stats.pending > 0) {
      if (typeof Components !== 'undefined') {
        Components.showToast(`${stats.pending} pendientes de sincronizar`, 'info');
      }
      return { success: true, stats };
    }

    if (typeof Components !== 'undefined') {
      Components.showToast('Sincronización completa', 'success');
    }
    return { success: true, stats };
  },

  /**
   * Clean up old synced items (keep last 50)
   */
  async cleanup() {
    try {
      const queue = await IDB.getAll('queue');
      const synced = queue
        .filter(i => i.status === this.STATUS.SYNCED)
        .sort((a, b) => new Date(b.synced_at) - new Date(a.synced_at));

      // Keep only last 50 synced items
      const toDelete = synced.slice(50);

      for (const item of toDelete) {
        await IDB.delete('queue', item.id);
      }

      if (toDelete.length > 0) {
        console.log(`[Sync] Cleaned up ${toDelete.length} old items`);
      }
    } catch (error) {
      console.error('[Sync] Cleanup failed:', error);
    }
  },

  /**
   * Start automatic sync (call on app init)
   */
  startAutoSync() {
    // Stop any existing interval
    this.stopAutoSync();

    // Sync every 30 seconds when online
    this.autoSyncInterval = setInterval(() => {
      if (navigator.onLine && API.isAuthenticated()) {
        this.processQueue();
      }
    }, 30000);

    // Cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000);

    // Listen for online event
    window.addEventListener('online', () => {
      console.log('[Sync] Back online, triggering sync');
      if (typeof Components !== 'undefined') {
        Components.showToast('Conexión restaurada', 'success');
      }
      this.processQueue();
    });

    // Listen for offline event
    window.addEventListener('offline', () => {
      console.log('[Sync] Gone offline');
      if (typeof Components !== 'undefined') {
        Components.showToast('Sin conexión - los cambios se guardarán localmente', 'warning');
      }
    });

    // Listen for service worker sync message
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'SYNC_QUEUE') {
          this.processQueue();
        }
      });
    }

    console.log('[Sync] Auto-sync started');
  },

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    console.log('[Sync] Auto-sync stopped');
  },

  /**
   * Check if there are pending items
   */
  async hasPending() {
    const stats = await this.getStats();
    return stats.pending > 0 || stats.errors > 0;
  },
};

// Note: Don't auto-start here - let State.init() control when to start
