/**
 * API client for teacher-pwa
 * Extends shared base with teacher-pwa specific methods
 *
 * Note: Requires api-base.js to be loaded first (createApiClient function)
 * Include in HTML: <script src="/lib/api-base.js"></script>
 */
const API = Object.assign(createApiClient('pwaConfig'), {

  // ==================== Teacher API Methods ====================

  /**
   * Get current teacher profile and courses
   */
  async getTeacherMe() {
    const response = await this.request('/teachers/me');
    if (!response.ok) {
      throw new Error('No se pudo obtener perfil del profesor');
    }
    return response.json();
  },

  /**
   * Get students for a course
   */
  async getCourseStudents(courseId) {
    const response = await this.request(`/teachers/courses/${courseId}/students`);
    if (!response.ok) {
      throw new Error('No se pudo obtener lista de estudiantes');
    }
    return response.json();
  },

  /**
   * Submit bulk attendance events
   */
  async submitBulkAttendance(courseId, gateId, deviceId, events) {
    const response = await this.request('/teachers/attendance/bulk', {
      method: 'POST',
      body: JSON.stringify({
        course_id: courseId,
        gate_id: gateId,
        device_id: deviceId,
        events: events,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al enviar asistencia' }));
      throw new Error(error.detail || 'Error al enviar asistencia');
    }

    return response.json();
  },

  /**
   * Submit a single attendance event (for real-time sync)
   */
  async submitAttendanceEvent(event) {
    const response = await this.request('/attendance/events', {
      method: 'POST',
      body: JSON.stringify({
        student_id: event.student_id,
        type: event.type,
        gate_id: event.gate_id || 'PWA',
        device_id: event.device_id,
        occurred_at: event.occurred_at,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al registrar evento' }));
      throw new Error(error.detail || 'Error al registrar evento');
    }

    return response.json();
  },
});
