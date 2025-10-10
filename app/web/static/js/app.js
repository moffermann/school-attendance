const API_HEADERS = { 'Content-Type': 'application/json' };

function buildHeaders() {
  const headers = { ...API_HEADERS };
  if (window.API_TOKEN) {
    headers.Authorization = `Bearer ${window.API_TOKEN}`;
  }
  return headers;
}

function setMessage(el, text, type = '') {
  if (!el) return;
  el.textContent = text;
  el.className = `form-message ${type}`.trim();
}

function handleUnauthorized(response) {
  if (response && (response.status === 401 || response.status === 403)) {
    const next = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?next=${next}`;
    return true;
  }
  return false;
}

document.addEventListener('DOMContentLoaded', () => {
  // Horarios: crear nueva regla
  const scheduleForm = document.getElementById('schedule-form');
  if (scheduleForm) {
    scheduleForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const courseId = document.getElementById('course-id').value;
      const weekday = parseInt(document.getElementById('weekday').value, 10);
      const inTime = document.getElementById('in-time').value;
      const outTime = document.getElementById('out-time').value;
      const messageEl = document.getElementById('schedule-message');

      if (!courseId) {
        setMessage(messageEl, 'Debes seleccionar un curso', 'error');
        return;
      }

      setMessage(messageEl, 'Guardando…');

      try {
        const response = await fetch(`/api/v1/schedules/courses/${courseId}`, {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify({ weekday, in_time: inTime, out_time: outTime })
        });

        if (handleUnauthorized(response)) return;
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || 'Error al crear horario');
        }

        setMessage(messageEl, 'Horario creado correctamente', 'success');
        setTimeout(() => window.location.reload(), 800);
      } catch (error) {
        setMessage(messageEl, error.message, 'error');
      }
    });
  }

  // Broadcast: previsualización
  const broadcastForm = document.getElementById('broadcast-form');
  if (broadcastForm) {
    broadcastForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const subject = document.getElementById('subject').value.trim();
      const courseId = document.getElementById('course').value;
      const message = document.getElementById('message').value.trim();
      const messageEl = document.getElementById('broadcast-message');

      if (!subject || !message) {
        setMessage(messageEl, 'Completa asunto y mensaje', 'error');
        return;
      }

      setMessage(messageEl, 'Calculando audiencia…');

      try {
        const body = {
          subject,
          message,
          template: 'CAMBIO_HORARIO',
          audience: {
            scope: courseId ? 'course' : 'global',
            course_ids: courseId ? [parseInt(courseId, 10)] : []
          }
        };

        const response = await fetch('/api/v1/broadcasts/preview', {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify(body)
        });

        if (handleUnauthorized(response)) return;
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || 'Error al previsualizar broadcast');
        }

        const data = await response.json();
        setMessage(messageEl, `Destinatarios estimados: ${data.recipients}`, 'success');
      } catch (error) {
        setMessage(messageEl, error.message, 'error');
      }
    });
  }

  // Preferencias de apoderados
  const prefsForm = document.getElementById('prefs-form');
  if (prefsForm) {
    const prefsGuardianId = document.getElementById('prefs-guardian-id');
    const prefsMessage = document.getElementById('prefs-message');
    const prefsTitle = document.getElementById('prefs-title');
    const templateCheckboxes = Array.from(prefsForm.querySelectorAll('input[type="checkbox"]'));

    document.querySelectorAll('[data-guardian-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const guardianId = button.dataset.guardianId;
        const name = button.dataset.name;
        const prefsData = button.dataset.prefs ? JSON.parse(button.dataset.prefs) : {};

        prefsGuardianId.value = guardianId;
        prefsTitle.textContent = `Editar preferencias · ${name}`;

        templateCheckboxes.forEach((checkbox) => {
          const tpl = checkbox.dataset.template;
          const enabledChannels = (prefsData[tpl] || []).map((item) => item.channel || item);
          checkbox.checked = enabledChannels.includes(checkbox.value);
        });

        setMessage(prefsMessage, 'Selecciona los canales y guarda');
        prefsForm.hidden = false;
      });
    });

    prefsForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const guardianId = prefsGuardianId.value;
      if (!guardianId) {
        setMessage(prefsMessage, 'Selecciona un apoderado', 'error');
        return;
      }

      const preferences = {};
      templateCheckboxes.forEach((checkbox) => {
        const template = checkbox.dataset.template;
        if (!preferences[template]) {
          preferences[template] = [];
        }
        if (checkbox.checked) {
          preferences[template].push({ channel: checkbox.value, enabled: true });
        }
      });

      setMessage(prefsMessage, 'Guardando…');

      try {
        const response = await fetch(`/api/v1/parents/${guardianId}/preferences`, {
          method: 'PUT',
          headers: buildHeaders(),
          body: JSON.stringify({ preferences })
        });

        if (handleUnauthorized(response)) return;
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || 'Error al guardar preferencias');
        }

        setMessage(prefsMessage, 'Preferencias guardadas', 'success');
        setTimeout(() => window.location.reload(), 800);
      } catch (error) {
        setMessage(prefsMessage, error.message, 'error');
      }
    });
  }

  // Resolver alertas de no ingreso
  document.querySelectorAll('.btn-resolve').forEach((button) => {
    button.addEventListener('click', async () => {
      const alertId = button.dataset.alertId;
      const row = document.querySelector(`tr[data-alert-id="${alertId}"]`);
      if (!alertId || !row) return;

      try {
        const response = await fetch(`/api/v1/alerts/no-entry/${alertId}/resolve`, {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify({ notes: 'Marcado manualmente desde portal' }),
        });

        if (handleUnauthorized(response)) return;
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || 'Error al resolver alerta');
        }

        row.querySelector('.btn-resolve')?.remove();
        const statusCell = row.querySelector('td:nth-child(5)');
        if (statusCell) {
          statusCell.innerHTML = '<span class="chip chip-success">Resuelto</span>';
        }
      } catch (error) {
        alert(error.message);
      }
    });
  });
});
