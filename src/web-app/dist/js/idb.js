/**
 * IndexedDB wrapper for Parent Portal PWA
 * Provides offline storage for:
 * - Guardian profile
 * - Student data
 * - Attendance events (cache)
 * - Absence requests
 * - Notification preferences
 * - Offline sync queue
 */

const IDB = {
  dbName: 'parentPortalPWA',
  version: 1,
  db: null,

  /**
   * Object store definitions
   */
  stores: {
    guardians: { keyPath: 'id' },
    students: { keyPath: 'id' },
    events: { keyPath: 'id' },
    absences: { keyPath: 'id' },
    preferences: { keyPath: 'guardian_id' },
    queue: { keyPath: 'id', autoIncrement: true },
    config: { keyPath: 'key' },
  },

  /**
   * Open/initialize the database
   */
  async open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('[IDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IDB] Database opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('[IDB] Upgrading database schema');

        // Create object stores
        Object.entries(this.stores).forEach(([name, config]) => {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, config);
            console.log(`[IDB] Created store: ${name}`);

            // Add indexes for common queries
            if (name === 'events') {
              store.createIndex('student_id', 'student_id', { unique: false });
              store.createIndex('date', 'date', { unique: false });
            }
            if (name === 'absences') {
              store.createIndex('student_id', 'student_id', { unique: false });
              store.createIndex('status', 'status', { unique: false });
            }
            if (name === 'queue') {
              store.createIndex('status', 'status', { unique: false });
              store.createIndex('type', 'type', { unique: false });
            }
          }
        });
      };
    });
  },

  /**
   * Get a single record by key
   */
  async get(storeName, key) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get all records from a store
   */
  async getAll(storeName) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get records by index
   */
  async getByIndex(storeName, indexName, value) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Put (insert or update) a record
   */
  async put(storeName, data) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Put multiple records
   */
  async putAll(storeName, dataArray) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      let completed = 0;
      const results = [];

      dataArray.forEach((data, index) => {
        const request = store.put(data);
        request.onsuccess = () => {
          results[index] = request.result;
          completed++;
          if (completed === dataArray.length) {
            resolve(results);
          }
        };
        request.onerror = () => reject(request.error);
      });

      if (dataArray.length === 0) resolve([]);
    });
  },

  /**
   * Delete a record by key
   */
  async delete(storeName, key) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Clear all records from a store
   */
  async clear(storeName) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Count records in a store
   */
  async count(storeName) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[IDB] Database closed');
    }
  },

  // =========================================================================
  // Helper methods for common operations
  // =========================================================================

  /**
   * Save guardian profile
   */
  async saveGuardian(guardian) {
    return this.put('guardians', guardian);
  },

  /**
   * Get guardian by ID
   */
  async getGuardian(id) {
    return this.get('guardians', id);
  },

  /**
   * Save students (replace all)
   */
  async saveStudents(students) {
    await this.clear('students');
    return this.putAll('students', students);
  },

  /**
   * Get all students
   */
  async getStudents() {
    return this.getAll('students');
  },

  /**
   * Cache attendance events for a student
   */
  async cacheEvents(events) {
    return this.putAll('events', events);
  },

  /**
   * Get cached events for a student
   */
  async getCachedEvents(studentId) {
    return this.getByIndex('events', 'student_id', studentId);
  },

  /**
   * Save config value
   */
  async setConfig(key, value) {
    return this.put('config', { key, value, updated_at: new Date().toISOString() });
  },

  /**
   * Get config value
   */
  async getConfig(key) {
    const record = await this.get('config', key);
    return record?.value ?? null;
  },
};

// Auto-initialize on load
IDB.open().catch(err => console.warn('[IDB] Failed to initialize:', err));
