// State management for Kiosk
const State = {
  device: {},
  config: {},
  students: [],
  teachers: [],
  tags: [],
  queue: [],
  localSeq: 0,

  async init() {
    // Load from localStorage or JSON
    const stored = localStorage.getItem('kioskData');
    if (stored) {
      const data = JSON.parse(stored);
      this.students = data.students || [];
      this.teachers = data.teachers || [];
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
      const [students, teachers, tags, device, queue, config] = await Promise.all([
        fetch('data/students.json').then(r => r.json()),
        fetch('data/teachers.json').then(r => r.json()),
        fetch('data/tags.json').then(r => r.json()),
        fetch('data/device.json').then(r => r.json()),
        fetch('data/queue.json').then(r => r.json()),
        fetch('data/config.json').then(r => r.json())
      ]);

      this.students = students;
      this.teachers = teachers;
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
      teachers: this.teachers,
      tags: this.tags,
      queue: this.queue,
      device: this.device,
      config: this.config,
      localSeq: this.localSeq
    }));
  },

  resolveByToken(token) {
    const tag = this.tags.find(t => t.token === token);
    if (!tag) return null;
    if (tag.status !== 'ACTIVE') return { error: 'REVOKED' };

    // Check if it's a teacher
    if (tag.teacher_id) {
      const teacher = this.teachers.find(t => t.id === tag.teacher_id);
      return teacher ? { type: 'teacher', data: teacher } : null;
    }

    // Check if it's a student
    if (tag.student_id) {
      const student = this.students.find(s => s.id === tag.student_id);
      return student ? { type: 'student', data: student } : null;
    }

    return null;
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
  },

  // Update students from server data (includes photo_pref_opt_in)
  updateStudents(serverStudents) {
    // Merge server data with local data, preserving local-only fields
    const studentMap = new Map(this.students.map(s => [s.id, s]));

    for (const serverStudent of serverStudents) {
      const existing = studentMap.get(serverStudent.id);
      if (existing) {
        // Update existing student with server data
        existing.full_name = serverStudent.full_name;
        existing.course_id = serverStudent.course_id;
        existing.photo_ref = serverStudent.photo_ref;
        existing.photo_opt_in = serverStudent.photo_pref_opt_in ?? false;
      } else {
        // Add new student
        this.students.push({
          id: serverStudent.id,
          full_name: serverStudent.full_name,
          course_id: serverStudent.course_id,
          photo_ref: serverStudent.photo_ref,
          photo_opt_in: serverStudent.photo_pref_opt_in ?? false,
          guardian_name: null // Not provided by kiosk endpoint
        });
      }
    }

    // Remove students that no longer exist on server
    const serverIds = new Set(serverStudents.map(s => s.id));
    this.students = this.students.filter(s => serverIds.has(s.id));

    this.persist();
  },

  // Update tags from server data
  updateTags(serverTags) {
    this.tags = serverTags.map(t => ({
      token: t.token,
      student_id: t.student_id,
      teacher_id: t.teacher_id,
      status: t.status
    }));
    this.persist();
  },

  // Update teachers from server data
  updateTeachers(serverTeachers) {
    this.teachers = serverTeachers.map(t => ({
      id: t.id,
      full_name: t.full_name
    }));
    this.persist();
  },

  // Check if student has photo consent
  hasPhotoConsent(studentId) {
    const student = this.students.find(s => s.id === studentId);
    // Default to true for backwards compatibility if field not present
    return student ? (student.photo_opt_in !== false) : true;
  }
};
