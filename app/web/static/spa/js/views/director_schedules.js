// Director Schedules
Views.directorSchedules = function() {
  const app = document.getElementById('app');
  app.innerHTML = Components.createLayout(State.currentRole);

  const content = document.getElementById('view-content');
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = 'Horarios Base';

  const courses = State.getCourses();
  const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  function renderSchedules() {
    content.innerHTML = `
      <div class="card">
        <div class="card-header flex justify-between items-center">
          <span>Horarios por Curso y Día</span>
        </div>

        <div class="card-body">
          ${courses.map(course => {
            const schedules = State.getSchedules(course.id);

            return `
              <div class="card mb-3" style="background: var(--color-gray-50);">
                <div class="card-header">${course.name} - ${course.grade}</div>
                <div class="card-body">
                  <table>
                    <thead>
                      <tr>
                        <th>Día</th>
                        <th>Hora Ingreso</th>
                        <th>Hora Salida</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${[1,2,3,4,5].map(weekday => {
                        const schedule = schedules.find(s => s.weekday === weekday) || {
                          course_id: course.id,
                          weekday,
                          in_time: '08:00',
                          out_time: '16:00'
                        };

                        return `
                          <tr>
                            <td>${weekdays[weekday]}</td>
                            <td>
                              <input type="time" class="form-input" style="width: 120px;"
                                value="${schedule.in_time}"
                                data-schedule-id="${schedule.id}"
                                data-course-id="${course.id}"
                                data-weekday="${weekday}"
                                data-field="in_time">
                            </td>
                            <td>
                              <input type="time" class="form-input" style="width: 120px;"
                                value="${schedule.out_time}"
                                data-schedule-id="${schedule.id}"
                                data-course-id="${course.id}"
                                data-weekday="${weekday}"
                                data-field="out_time">
                            </td>
                            <td>
                              <button class="btn btn-primary btn-sm"
                                onclick="Views.directorSchedules.saveSchedule(${schedule.id || 'null'}, ${course.id}, ${weekday})">
                                Guardar
                              </button>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  Views.directorSchedules.saveSchedule = function(scheduleId, courseId, weekday) {
    const inTime = document.querySelector(`[data-course-id="${courseId}"][data-weekday="${weekday}"][data-field="in_time"]`).value;
    const outTime = document.querySelector(`[data-course-id="${courseId}"][data-weekday="${weekday}"][data-field="out_time"]`).value;

    if (scheduleId) {
      State.updateSchedule(scheduleId, { in_time: inTime, out_time: outTime });
    } else {
      // Create new schedule (simplified)
      const newSchedule = {
        id: Math.max(0, ...State.data.schedules.map(s => s.id)) + 1,
        course_id: courseId,
        weekday: weekday,
        in_time: inTime,
        out_time: outTime
      };
      State.data.schedules.push(newSchedule);
      State.persist();
    }

    Components.showToast('Horario guardado exitosamente', 'success');
  };

  renderSchedules();
};
