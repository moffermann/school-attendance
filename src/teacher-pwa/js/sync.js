/**
 * Sync queue manager for teacher-pwa
 * Handles offline queue and synchronization with backend API
 */
const Sync = {
  isSyncing: false,
  maxRetries: 3,
  batchSize: 10,

  /**
   * Process pending events in the queue
   */
  async processQueue() {
    if (this.isSyncing || !State.isOnline()) return;

    const queue = await IDB.getAll('queue');
    const pending = queue.filter(e => e.status === 'pending' || (e.status === 'error' && (e.retries || 0) < this.maxRetries));

    if (!pending.length) return;

    this.isSyncing = true;

    // Check if we have API authentication
    if (!API.isAuthenticated()) {
      console.warn('Cannot sync: not authenticated');
      this.isSyncing = false;
      return;
    }

    UI.showToast('Sincronizando...', 'info', 1500);

    // Process events in batches
    const batch = pending.slice(0, this.batchSize);

    for (const event of batch) {
      // F4 fix: Store original status to revert on failure
      const originalStatus = event.status;
      event.status = 'in_progress';
      await IDB.put('queue', event);

      try {
        await this.syncEvent(event);
        event.status = 'synced';
        event.synced_at = new Date().toISOString();
      } catch (error) {
        console.error('Sync error for event:', event.id, error);
        // F4 fix: Revert to pending (not error) if network failure to allow retry
        if (error.name === 'TypeError' || error.message.includes('network') || error.message.includes('fetch')) {
          // Network error - revert to pending for automatic retry
          event.status = 'pending';
        } else {
          // API error - mark as error with retry count
          event.status = 'error';
          event.retries = (event.retries || 0) + 1;
        }
        event.last_error = error.message;
      }

      await IDB.put('queue', event);
    }

    this.isSyncing = false;

    // Check if there are more pending items
    const remainingQueue = await IDB.getAll('queue');
    const stillPending = remainingQueue.filter(e => e.status === 'pending' || (e.status === 'error' && (e.retries || 0) < this.maxRetries));

    if (stillPending.length > 0) {
      // Schedule another sync pass
      setTimeout(() => this.processQueue(), 1000);
    }
  },

  /**
   * Sync a single event to the backend
   */
  async syncEvent(event) {
    // Try to submit to the API
    const result = await API.submitAttendanceEvent({
      student_id: event.student_id,
      type: event.type,
      gate_id: event.gate_id || 'PWA',
      device_id: event.device_id,
      occurred_at: event.occurred_at,
    });

    return result;
  },

  /**
   * Manual sync trigger with feedback
   */
  async syncNow() {
    if (!State.isOnline()) {
      UI.showToast('Dispositivo offline', 'error');
      return;
    }

    if (!API.isAuthenticated()) {
      UI.showToast('Debes iniciar sesión para sincronizar', 'error');
      return;
    }

    await this.processQueue();

    const queue = await IDB.getAll('queue');
    const synced = queue.filter(e => e.status === 'synced').length;
    const errors = queue.filter(e => e.status === 'error').length;
    const pending = queue.filter(e => e.status === 'pending').length;

    if (errors > 0) {
      UI.showToast(`Sincronizado: ${synced}, Errores: ${errors}`, 'warning');
    } else if (pending > 0) {
      UI.showToast(`Sincronizado: ${synced}, Pendientes: ${pending}`, 'info');
    } else {
      UI.showToast('Sincronización completa', 'success');
    }
  },

  /**
   * Bulk sync - sends all pending events for a course at once
   * More efficient for syncing many events
   */
  async bulkSyncCourse(courseId) {
    if (!State.isOnline()) {
      throw new Error('Dispositivo offline');
    }

    if (!API.isAuthenticated()) {
      throw new Error('No autenticado');
    }

    const queue = await IDB.getAll('queue');
    const pendingForCourse = queue.filter(
      e => e.course_id === courseId && (e.status === 'pending' || e.status === 'error')
    );

    if (!pendingForCourse.length) {
      return { processed: 0, errors: [] };
    }

    // Mark all as in_progress
    for (const event of pendingForCourse) {
      event.status = 'in_progress';
      await IDB.put('queue', event);
    }

    try {
      const events = pendingForCourse.map(e => ({
        student_id: e.student_id,
        type: e.type,
        occurred_at: e.occurred_at,
      }));

      const result = await API.submitBulkAttendance(
        courseId,
        'PWA',
        State.deviceId,
        events
      );

      // Mark successful events as synced
      for (const event of pendingForCourse) {
        event.status = 'synced';
        event.synced_at = new Date().toISOString();
        await IDB.put('queue', event);
      }

      return result;
    } catch (error) {
      // Mark events as error
      for (const event of pendingForCourse) {
        event.status = 'error';
        event.retries = (event.retries || 0) + 1;
        event.last_error = error.message;
        await IDB.put('queue', event);
      }

      throw error;
    }
  },

  /**
   * Clean up old synced events (keep last 100)
   * F17 fix: Added try/catch to prevent unhandled rejections
   */
  async cleanupQueue() {
    try {
      const queue = await IDB.getAll('queue');
      const synced = queue.filter(e => e.status === 'synced');

      if (synced.length > 100) {
        // Sort by synced_at and remove oldest
        synced.sort((a, b) => new Date(a.synced_at) - new Date(b.synced_at));
        const toRemove = synced.slice(0, synced.length - 100);

        for (const event of toRemove) {
          await IDB.delete('queue', event.id);
        }

        console.log(`Cleaned up ${toRemove.length} old synced events`);
      }
    } catch (error) {
      console.error('Error cleaning up queue:', error);
      // Don't rethrow - cleanup is non-critical
    }
  },

  /**
   * Get queue statistics
   */
  async getStats() {
    const queue = await IDB.getAll('queue');
    return {
      total: queue.length,
      pending: queue.filter(e => e.status === 'pending').length,
      synced: queue.filter(e => e.status === 'synced').length,
      errors: queue.filter(e => e.status === 'error').length,
      inProgress: queue.filter(e => e.status === 'in_progress').length,
    };
  },
};

// R8-F3 fix: Store interval IDs for proper cleanup
Sync._syncIntervalId = null;
Sync._cleanupIntervalId = null;

/**
 * Start automatic sync intervals
 * R8-F3 fix: Allows proper cleanup of intervals
 */
Sync.startAutoSync = function() {
  // Clear existing intervals if any
  this.stopAutoSync();

  // Auto-sync every 30 seconds when online and authenticated
  this._syncIntervalId = setInterval(() => {
    if (State.isOnline() && API.isAuthenticated()) {
      Sync.processQueue();
    }
  }, 30000);

  // Cleanup old events every 5 minutes
  this._cleanupIntervalId = setInterval(() => Sync.cleanupQueue(), 300000);
};

/**
 * Stop automatic sync intervals
 * R8-F3 fix: Prevents memory leaks when PWA is unloaded
 */
Sync.stopAutoSync = function() {
  if (this._syncIntervalId) {
    clearInterval(this._syncIntervalId);
    this._syncIntervalId = null;
  }
  if (this._cleanupIntervalId) {
    clearInterval(this._cleanupIntervalId);
    this._cleanupIntervalId = null;
  }
};

// Start auto-sync by default
Sync.startAutoSync();
