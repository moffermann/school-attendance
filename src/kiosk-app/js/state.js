// State management for Kiosk
const State = {
  device: {},
  config: {},
  students: [],
  tags: [],
  queue: [],
  localSeq: 0,

  async init() {
    // Load from localStorage or JSON
    const stored = localStorage.getItem('kioskData');
    if (stored) {
      const data = JSON.parse(stored);
      this.students = data.students || [];
      this.tags = data.tags || [];
      this.queue = data.queue || [];
      this.device = data.device || {};
      this.config = data.config || {};
      this.localSeq = data.localSeq || 0;
    }

    if (!this.students.length) {
      await this.loadFromJSON();
    }
  },

  async loadFromJSON() {
    try {
      const [students, tags, device, queue, config] = await Promise.all([
        fetch('data/students.json').then(r => r.json()),
        fetch('data/tags.json').then(r => r.json()),
        fetch('data/device.json').then(r => r.json()),
        fetch('data/queue.json').then(r => r.json()),
        fetch('data/config.json').then(r => r.json())
      ]);

      this.students = students;
      this.tags = tags;
      this.device = device;
      this.queue = queue;
      this.config = config;
      this.persist();
    } catch (e) {
      console.error('Error loading data', e);
    }
  },

  persist() {
    localStorage.setItem('kioskData', JSON.stringify({
      students: this.students,
      tags: this.tags,
      queue: this.queue,
      device: this.device,
      config: this.config,
      localSeq: this.localSeq
    }));
  },

  resolveStudentByToken(token) {
    const tag = this.tags.find(t => t.token === token);
    if (!tag) return null;
    if (tag.status !== 'ACTIVE') return { error: 'REVOKED' };

    const student = this.students.find(s => s.id === tag.student_id);
    return student || null;
  },

  nextEventTypeFor(studentId) {
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = this.queue.filter(e => e.student_id === studentId && e.ts.startsWith(today));
    const lastEvent = todayEvents[todayEvents.length - 1];
    return lastEvent && lastEvent.type === 'IN' ? 'OUT' : 'IN';
  },

  enqueueEvent(event) {
    this.localSeq++;
    event.local_seq = this.localSeq;
    event.id = `${this.device.device_id}_${this.localSeq}`;
    event.device_id = this.device.device_id;
    event.gate_id = this.device.gate_id;
    event.status = 'pending';
    event.retries = 0;

    this.queue.push(event);
    this.persist();
    return event;
  },

  markSynced(id) {
    const event = this.queue.find(e => e.id === id);
    if (event) {
      event.status = 'synced';
      this.persist();
    }
  },

  updateEventStatus(id, status) {
    const event = this.queue.find(e => e.id === id);
    if (event) {
      event.status = status;
      if (status === 'error') event.retries = (event.retries || 0) + 1;
      this.persist();
    }
  },

  getPendingCount() {
    return this.queue.filter(e => e.status === 'pending' || e.status === 'in_progress').length;
  },

  toggleOnline() {
    this.device.online = !this.device.online;
    this.persist();
  }
};
