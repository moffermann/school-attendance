// Centralized SPA state backed by the real backend APIs.
const API_BASE = '/api/v1';

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
    notifications: [],
    alerts: []
  },
  currentRole: null,
  currentGuardianId: null,
  currentUser: null,
  accessToken: null,

  async init() {
    const loadingEl = document.getElementById('loading');
    try {
      await this.bootstrap();
      if (loadingEl) {
        loadingEl.remove();
      }
    } catch (error) {
      console.error('No se pudo inicializar la aplicación', error);
      if (loadingEl) {
        loadingEl.innerHTML = `
          <div class="error-state">
            <p>No fue posible cargar la información requeridas para el portal.</p>
            <button class="btn btn-primary" onclick="window.location.reload()">Reintentar</button>
          </div>
        `;
      }
      throw error;
    }
  },

  async bootstrap() {
    const session = await this.fetchSession();
    this.accessToken = session.access_token;
    window.API_TOKEN = session.access_token;
    this.currentUser = session.user;
    this.currentRole = this.mapRole(session.user.role);
    this.currentGuardianId = session.user.guardian_id ?? null;

    const payload = await this.apiFetch('/web-app/bootstrap');

    this.data = {
      students: (payload.students || []).map((item) => this.normalizeStudent(item)),
      guardians: (payload.guardians || []).map((item) => this.normalizeGuardian(item)),
      courses: payload.courses || [],
      schedules: (payload.schedules || []).map((item) => this.normalizeSchedule(item)),
      schedule_exceptions: (payload.schedule_exceptions || []).map((item) => this.normalizeScheduleException(item)),
      attendance_events: (payload.attendance_events || []).map((item) => this.normalizeAttendanceEvent(item)),
      devices: (payload.devices || []).map((item) => this.normalizeDevice(item)),
      absences: (payload.absences || []).map((item) => this.normalizeAbsence(item)),
      notifications: (payload.notifications || []).map((item) => this.normalizeNotification(item))
    };

    if (!window.location.hash || window.location.hash === '#/auth') {
      window.location.hash = this.currentRole === 'parent' ? '/parent/home' : '/director/dashboard';
    }
  },

  async fetchSession() {
    const response = await fetch(`${API_BASE}/auth/session`, {
      credentials: 'include'
    });

    if (response.status === 401) {
      const next = encodeURIComponent('/app');
      window.location.href = `/login?next=${next}`;
      throw new Error('Sesión no válida');
    }

    if (!response.ok) {
      throw new Error('No fue posible recuperar la sesión actual');
    }

    return response.json();
  },

  async apiFetch(path, options = {}) {
    const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = { ...(options.headers || {}) };
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers
    });

    if (response.status === 401) {
      const next = encodeURIComponent('/app');
      window.location.href = `/login?next=${next}`;
      throw new Error('Sesión expirada');
    }

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || 'Error inesperado al comunicarse con el servidor');
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  },

  buildQuery(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        qs.set(key, value);
      }
    });
    return qs.toString();
  },

  async fetchDashboardSnapshot(params = {}) {
    const query = this.buildQuery(params);
    const path = query ? `/web-app/dashboard?${query}` : '/web-app/dashboard';
    return this.apiFetch(path);
  },

  async exportDashboardCsv(params = {}) {
    const query = this.buildQuery(params);
    const url = `${API_BASE}/web-app/dashboard/export${query ? `?${query}` : ''}`;
    const headers = {};
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    const response = await fetch(url, {
      credentials: 'include',
      headers
    });

    if (!response.ok) {
      throw new Error('No se pudo exportar el CSV');
    }

    return response.blob();
  },

  async fetchReportsSnapshot(params = {}) {
    const query = this.buildQuery(params);
    const path = query ? `/web-app/reports?${query}` : '/web-app/reports';
    return this.apiFetch(path);
  },

  async fetchDevices() {
    const devices = await this.apiFetch('/devices');
    this.data.devices = (devices || []).map((item) => this.normalizeDevice(item));
    return this.data.devices;
  },

  async fetchAlerts(params = {}) {
    const query = this.buildQuery(params);
    const path = query ? `/alerts/no-entry?${query}` : '/alerts/no-entry';
    const alerts = await this.apiFetch(path);
    this.data.alerts = alerts || [];
    return this.data.alerts;
  },

  async resolveAlert(alertId, notes = '') {
    const payload = { notes: notes || null };
    const result = await this.apiFetch(`/alerts/no-entry/${alertId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    this.data.alerts = this.data.alerts.map((alert) => (alert.id === alertId ? result : alert));
    return result;
  },

  async exportAlerts(params = {}) {
    const query = this.buildQuery(params);
    const url = `${API_BASE}/alerts/no-entry/export${query ? `?${query}` : ''}`;
    const headers = {};
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    const response = await fetch(url, {
      credentials: 'include',
      headers
    });
    if (!response.ok) {
      throw new Error('No se pudo exportar alertas');
    }
    return response.blob();
  },

  async exportNotifications(params = {}) {
    const query = this.buildQuery(params);
    const url = `${API_BASE}/notifications/export${query ? `?${query}` : ''}`;
    const headers = {};
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    const response = await fetch(url, { credentials: 'include', headers });
    if (!response.ok) throw new Error('No se pudo exportar notificaciones');
    return response.blob();
  },

  async exportAbsences() {
    const headers = {};
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    const response = await fetch(`${API_BASE}/absences/export`, { credentials: 'include', headers });
    if (!response.ok) throw new Error('No se pudo exportar ausencias');
    return response.blob();
  },

  mapRole(role) {
    if (!role) return 'director';
    const normalized = role.toUpperCase();
    if (normalized === 'PARENT') return 'parent';
    if (normalized === 'INSPECTOR') return 'inspector';
    return 'director';
  },

  setRole(role, guardianId = null) {
    this.currentRole = role;
    this.currentGuardianId = guardianId;
  },

  logout() {
    window.location.href = '/logout';
  },

  // Normalizers -----------------------------------------------------------
  normalizeStudent(student) {
    return {
      id: student.id,
      full_name: student.full_name,
      course_id: student.course_id,
      photo_pref_opt_in: Boolean(student.photo_pref_opt_in)
    };
  },

  normalizeGuardian(guardian) {
    return {
      id: guardian.id,
      full_name: guardian.full_name,
      contacts: guardian.contacts || [],
      student_ids: guardian.student_ids || []
    };
  },

  normalizeSchedule(schedule) {
    const toTime = (value) => (value ? String(value).slice(0, 5) : null);
    return {
      id: schedule.id,
      course_id: schedule.course_id,
      weekday: schedule.weekday,
      in_time: toTime(schedule.in_time),
      out_time: toTime(schedule.out_time)
    };
  },

  normalizeScheduleException(exception) {
    const toTime = (value) => (value ? String(value).slice(0, 5) : null);
    return {
      id: exception.id,
      scope: exception.scope,
      course_id: exception.course_id,
      date: exception.date,
      in_time: toTime(exception.in_time),
      out_time: toTime(exception.out_time),
      reason: exception.reason
    };
  },

  normalizeAttendanceEvent(event) {
    return {
      id: event.id,
      student_id: event.student_id,
      type: event.type,
      gate_id: event.gate_id,
      ts: event.ts,
      device_id: event.device_id,
      photo_ref: event.photo_ref
    };
  },

  normalizeDevice(device) {
    return {
      id: device.id,
      gate_id: device.gate_id,
      device_id: device.device_id,
      version: device.version || device.firmware_version,
      last_sync: device.last_sync,
      pending_count: device.pending_count ?? device.pending_events ?? 0,
      battery_pct: device.battery_pct ?? 0,
      status: device.status || (device.online ? 'ACTIVE' : 'OFFLINE')
    };
  },

  normalizeAbsence(absence) {
    return {
      id: absence.id,
      student_id: absence.student_id,
      type: absence.type,
      start: absence.start,
      end: absence.end,
      comment: absence.comment || null,
      attachment_name: absence.attachment_name || null,
      status: absence.status
    };
  },

  normalizeNotification(notification) {
    return {
      id: notification.id,
      guardian_id: notification.guardian_id,
      student_id: notification.student_id,
      type: notification.type,
      channel: notification.channel,
      sent_at: notification.sent_at || notification.ts_sent || null,
      status: notification.status,
      template: notification.template,
      payload: notification.payload || {},
      ts_created: notification.ts_created || null,
      retries: notification.retries ?? 0
    };
  },

  persist() {
    // Mantener para compatibilidad con vistas anteriores (no-op).
  },

  // Data getters ---------------------------------------------------------
  getStudents() {
    return this.data.students;
  },

  getStudent(id) {
    return this.data.students.find((s) => s.id === id);
  },

  getCourses() {
    return this.data.courses;
  },

  getCourse(id) {
    return this.data.courses.find((c) => c.id === id);
  },

  getGuardians() {
    return this.data.guardians;
  },

  getGuardian(id) {
    return this.data.guardians.find((g) => g.id === id);
  },

  getStudentsByCourse(courseId) {
    return this.data.students.filter((s) => s.course_id === courseId);
  },

  getSchedules(courseId) {
    return this.data.schedules.filter((s) => s.course_id === courseId);
  },

  getScheduleExceptions() {
    return this.data.schedule_exceptions;
  },

  getAttendanceEvents(filters = {}) {
    let events = [...this.data.attendance_events];

    if (filters.studentId) {
      events = events.filter((e) => e.student_id === filters.studentId);
    }

    if (filters.date) {
      events = events.filter((e) => e.ts && e.ts.startsWith(filters.date));
    }

    if (filters.type) {
      events = events.filter((e) => e.type === filters.type);
    }

    if (filters.courseId) {
      const ids = this.getStudentsByCourse(filters.courseId).map((s) => s.id);
      events = events.filter((e) => ids.includes(e.student_id));
    }

    return events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  },

  getTodayEvents() {
    const today = new Date().toISOString().split('T')[0];
    return this.getAttendanceEvents({ date: today });
  },

  getDevices() {
    return this.data.devices;
  },

  getAbsences() {
    return this.data.absences;
  },

  // Mutators -------------------------------------------------------------
  async addScheduleException(exception) {
    const payload = {
      scope: exception.scope,
      course_id: exception.course_id,
      date: exception.date,
      in_time: exception.in_time || null,
      out_time: exception.out_time || null,
      reason: exception.reason
    };

    const created = await this.apiFetch('/schedules/exceptions', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const normalized = this.normalizeScheduleException(created);
    this.data.schedule_exceptions.push(normalized);
    return normalized;
  },

  async deleteScheduleException(id) {
    await this.apiFetch(`/schedules/exceptions/${id}`, { method: 'DELETE' });
    this.data.schedule_exceptions = this.data.schedule_exceptions.filter((e) => e.id !== id);
  },

  async upsertSchedule(scheduleId, courseId, weekday, data) {
    if (scheduleId) {
      const payload = {
        weekday,
        in_time: data.in_time,
        out_time: data.out_time
      };
      const updated = await this.apiFetch(`/schedules/${scheduleId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      const normalized = this.normalizeSchedule(updated);
      this.data.schedules = this.data.schedules.map((item) => (item.id === normalized.id ? normalized : item));
      return normalized;
    }

    const payload = {
      weekday,
      in_time: data.in_time,
      out_time: data.out_time
    };
    const created = await this.apiFetch(`/schedules/courses/${courseId}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const normalized = this.normalizeSchedule(created);
    this.data.schedules.push(normalized);
    return normalized;
  },

  async refreshAttendance() {
    const payload = await this.apiFetch('/web-app/bootstrap');
    this.data.attendance_events = (payload.attendance_events || []).map((item) => this.normalizeAttendanceEvent(item));
  },

  async submitAbsenceRequest(data) {
    const payload = await this.apiFetch('/absences', {
      method: 'POST',
      body: JSON.stringify({
        student_id: data.student_id,
        type: String(data.type || '').toUpperCase(),
        start: data.start,
        end: data.end,
        comment: data.comment || null,
        attachment_name: data.attachment_name || null
      })
    });

    const normalized = this.normalizeAbsence(payload);
    const withoutExisting = this.data.absences.filter((item) => item.id !== normalized.id);
    this.data.absences = [normalized, ...withoutExisting];
    return normalized;
  },

  async fetchAbsences() {
    const payload = await this.apiFetch('/absences');
    this.data.absences = (payload || []).map((item) => this.normalizeAbsence(item));
    return this.data.absences;
  },

  async updateAbsence(absenceId, status) {
    const payload = await this.apiFetch(`/absences/${absenceId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
    const normalized = this.normalizeAbsence(payload);
    this.data.absences = this.data.absences.map((item) => (item.id === normalized.id ? normalized : item));
    return normalized;
  },

  // Stats helpers -------------------------------------------------------
  getTodayStats() {
    const events = this.getTodayEvents();
    const inEvents = events.filter((e) => e.type === 'IN');
    const outEvents = events.filter((e) => e.type === 'OUT');

    const lateEvents = inEvents.filter((e) => {
      const iso = e.ts || '';
      const time = iso.split('T')[1] || '';
      return time > '08:30:00';
    });

    const studentsWithIn = new Set(inEvents.map((e) => e.student_id));
    const totalStudents = this.getStudents().length;

    return {
      totalIn: inEvents.length,
      totalOut: outEvents.length,
      lateCount: lateEvents.length,
      noInCount: Math.max(0, totalStudents - studentsWithIn.size)
    };
  },

  getGuardianStudents(guardianId) {
    const guardian = this.getGuardian(guardianId);
    if (!guardian) return [];
    return guardian.student_ids
      .map((id) => this.getStudent(id))
      .filter(Boolean);
  }
};

window.State = State;
