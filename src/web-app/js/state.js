// State management with localStorage persistence
const State = {
  data: {
    students: [],
    guardians: [],
    courses: [],
    schedules: [],
    schedule_exceptions: [],
    attendance_events: [],
    devices: [],
    absences: [],
    notifications: []
  },
  currentRole: null, // 'director', 'inspector', 'parent'
  currentGuardianId: null,

  async init() {
    // Try to load from localStorage first
    const stored = localStorage.getItem('appData');
    if (stored) {
      try {
        this.data = JSON.parse(stored);
      } catch (e) {
        console.error('Error parsing stored data', e);
      }
    }

    // If no stored data or empty, load from JSON files
    if (!this.data.students || this.data.students.length === 0) {
      await this.loadFromJSON();
    }

    // Load user session
    const role = localStorage.getItem('currentRole');
    const guardianId = localStorage.getItem('currentGuardianId');
    if (role) this.currentRole = role;
    if (guardianId) this.currentGuardianId = parseInt(guardianId);
  },

  async loadFromJSON() {
    const files = [
      'students', 'guardians', 'courses', 'schedules',
      'schedule_exceptions', 'attendance_events', 'devices',
      'absences', 'notifications'
    ];

    for (const file of files) {
      try {
        const response = await fetch(`data/${file}.json`);
        this.data[file] = await response.json();
      } catch (e) {
        console.error(`Error loading ${file}.json`, e);
        this.data[file] = [];
      }
    }

    this.persist();
  },

  persist() {
    localStorage.setItem('appData', JSON.stringify(this.data));
  },

  setRole(role, guardianId = null) {
    this.currentRole = role;
    this.currentGuardianId = guardianId;
    localStorage.setItem('currentRole', role);
    if (guardianId) {
      localStorage.setItem('currentGuardianId', guardianId);
    } else {
      localStorage.removeItem('currentGuardianId');
    }
  },

  logout() {
    this.currentRole = null;
    this.currentGuardianId = null;
    localStorage.removeItem('currentRole');
    localStorage.removeItem('currentGuardianId');
  },

  // Getters
  getStudents() {
    return this.data.students || [];
  },

  getStudent(id) {
    return this.data.students.find(s => s.id === id);
  },

  getCourses() {
    return this.data.courses || [];
  },

  getCourse(id) {
    return this.data.courses.find(c => c.id === id);
  },

  getGuardians() {
    return this.data.guardians || [];
  },

  getGuardian(id) {
    return this.data.guardians.find(g => g.id === id);
  },

  getStudentsByCourse(courseId) {
    return this.data.students.filter(s => s.course_id === courseId);
  },

  getSchedules(courseId) {
    return this.data.schedules.filter(s => s.course_id === courseId);
  },

  getScheduleExceptions() {
    return this.data.schedule_exceptions || [];
  },

  getAttendanceEvents(filters = {}) {
    let events = this.data.attendance_events || [];

    if (filters.studentId) {
      events = events.filter(e => e.student_id === filters.studentId);
    }

    if (filters.date) {
      events = events.filter(e => e.ts.startsWith(filters.date));
    }

    if (filters.type) {
      events = events.filter(e => e.type === filters.type);
    }

    if (filters.courseId) {
      const studentIds = this.getStudentsByCourse(filters.courseId).map(s => s.id);
      events = events.filter(e => studentIds.includes(e.student_id));
    }

    return events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  },

  getTodayEvents() {
    const today = new Date().toISOString().split('T')[0];
    return this.getAttendanceEvents({ date: today });
  },

  getDevices() {
    return this.data.devices || [];
  },

  getAbsences() {
    return this.data.absences || [];
  },

  // Setters
  addScheduleException(exception) {
    const id = Math.max(0, ...this.data.schedule_exceptions.map(e => e.id)) + 1;
    exception.id = id;
    this.data.schedule_exceptions.push(exception);
    this.persist();
    return exception;
  },

  updateScheduleException(id, data) {
    const index = this.data.schedule_exceptions.findIndex(e => e.id === id);
    if (index !== -1) {
      this.data.schedule_exceptions[index] = { ...this.data.schedule_exceptions[index], ...data };
      this.persist();
    }
  },

  deleteScheduleException(id) {
    this.data.schedule_exceptions = this.data.schedule_exceptions.filter(e => e.id !== id);
    this.persist();
  },

  addAbsence(absence) {
    const id = Math.max(0, ...this.data.absences.map(a => a.id)) + 1;
    absence.id = id;
    absence.status = absence.status || 'PENDING';
    this.data.absences.push(absence);
    this.persist();
    return absence;
  },

  updateAbsence(id, data) {
    const index = this.data.absences.findIndex(a => a.id === id);
    if (index !== -1) {
      this.data.absences[index] = { ...this.data.absences[index], ...data };
      this.persist();
    }
  },

  updateSchedule(id, data) {
    const index = this.data.schedules.findIndex(s => s.id === id);
    if (index !== -1) {
      this.data.schedules[index] = { ...this.data.schedules[index], ...data };
      this.persist();
    }
  },

  // Stats helpers
  getTodayStats() {
    const events = this.getTodayEvents();
    const inEvents = events.filter(e => e.type === 'IN');
    const outEvents = events.filter(e => e.type === 'OUT');

    // Count late arrivals (after 08:30)
    const lateEvents = inEvents.filter(e => {
      const time = e.ts.split('T')[1];
      return time > '08:30:00';
    });

    // Students without IN event
    const studentsWithIn = new Set(inEvents.map(e => e.student_id));
    const allStudents = this.getStudents();
    const noInCount = allStudents.length - studentsWithIn.size;

    return {
      totalIn: inEvents.length,
      totalOut: outEvents.length,
      lateCount: lateEvents.length,
      noInCount
    };
  },

  // Parent helpers
  getGuardianStudents(guardianId) {
    const guardian = this.getGuardian(guardianId);
    if (!guardian) return [];
    return guardian.student_ids.map(id => this.getStudent(id)).filter(Boolean);
  }
};
