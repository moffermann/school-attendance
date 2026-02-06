# 2026-01-19: Rediseno Frontend Dashboard, Reportes, Metricas y Horarios (Preview Environment)

## Resumen

Sesion enfocada en implementar los disenos aprobados de NEUVOX para el entorno de preview (`/app-preview/`):
- **Dashboard Director**: Nuevo diseno con tarjetas de estadisticas, alertas y tabla de eventos
- **Modulo Reportes**: Nuevo diseno con graficos HTML/CSS, tabla de resumen y filtros
- **Modulo Metricas**: Nuevo diseno con KPIs, graficos Chart.js, tablas de ranking y paginacion
- **Modulo Horarios**: Implementacion del diseno aprobado con grid de dias, Time Picker Modal y botones de accion
- **Estandarizacion Headers**: Todos los modulos ahora usan la misma estructura de header

### Funcionalidades Implementadas
- **Preview Environment**: Entorno separado con Vite + Tailwind CSS para probar nuevos disenos
- **Dashboard Director**: Implementacion completa del diseno aprobado con estadisticas en vivo
- **Modulo Reportes**: Implementacion completa con graficos de barras y lineas sin dependencias externas
- **Modulo Metricas**: Implementacion completa con Chart.js, KPI cards con borde lateral, tablas paginadas
- **Modulo Horarios**: Implementacion completa con grid 5 columnas, day cards configurados/vacios, Time Picker
- **Headers Estandarizados**: Estructura consistente en Dashboard, Reportes, Metricas y Horarios
- **Dark Mode**: Soporte completo en todos los modulos
- **Responsive Design**: Sidebar colapsable y layouts adaptativos para mobile
- **CSS Utilities**: Clases custom para evitar conflictos con legacy styles.css

### Archivos Clave Modificados
- `src/web-app-preview/js/views/director_dashboard.js` - Dashboard completo
- `src/web-app-preview/js/views/director_reports.js` - Reportes completo (header estandarizado)
- `src/web-app-preview/js/views/director_metrics.js` - Metricas completo (header estandarizado)
- `src/web-app-preview/js/views/director_schedules.js` - Horarios completo (header estandarizado)
- `src/web-app-preview/css/tailwind.css` - Estilos para graficos, KPIs, day cards y utilities responsive
- `src/web-app-preview/tailwind.config.js` - Safelist de clases
- `src/web-app-preview/index.html` - Chart.js CDN agregado

---

## 1. Contexto: Preview Environment

### Justificacion

| Problema | Solucion |
|----------|----------|
| Modificar produccion directamente es riesgoso | Entorno `/app-preview/` separado |
| Bootstrap CSS limitado para nuevos disenos | Vite + Tailwind CSS con hot reload |
| Necesidad de iterar rapidamente en disenos | Preview aislado del codigo productivo |

### Estructura del Preview

```
src/web-app-preview/
├── index.html              # Entry point con Vite
├── vite.config.js          # Configuracion Vite
├── tailwind.config.js      # Configuracion Tailwind + safelist
├── postcss.config.js       # PostCSS para Tailwind
├── css/
│   ├── tailwind.css        # Input Tailwind con @layer
│   └── styles.css          # Estilos adicionales
├── js/
│   ├── state.js            # Estado de la aplicacion
│   ├── api.js              # Conexion al backend
│   ├── router.js           # SPA routing
│   ├── components.js       # Componentes reutilizables
│   └── views/
│       ├── director_dashboard.js  # Vista Dashboard
│       └── director_reports.js    # Vista Reportes
└── dist/                   # Build de produccion
```

### Acceso

```bash
# Desarrollo (hot reload)
cd src/web-app-preview
npm run dev
# -> http://localhost:5173/app-preview/

# Produccion
npm run build
# -> dist/index.html
```

---

## 2. Dashboard Director - Implementacion

### Diseno Aprobado

El diseno aprobado incluye:
- Header con titulo "Tablero en Vivo" y badge "En vivo"
- 4 tarjetas de estadisticas (Ingresos, Salidas, Atrasos, Sin Ingreso)
- Alerta de alumnos sin ingreso con botones de accion
- Seccion "Eventos de Hoy" con filtros y tabla
- Sidebar con navegacion completa

### Estructura del Layout

```html
<body class="h-screen flex overflow-hidden">
  <!-- Sidebar (w-64, fixed) -->
  <aside class="w-64 bg-[#1e1b4b] text-gray-300 flex-shrink-0">
    <!-- Logo NEUVOX -->
    <!-- Navegacion -->
  </aside>

  <!-- Main Content -->
  <main class="flex-1 flex flex-col overflow-hidden">
    <!-- Header (h-20) -->
    <header class="h-20 bg-white dark:bg-card-dark">
      <!-- Titulo + Badge En vivo -->
      <!-- Dark mode toggle + User menu -->
    </header>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      <!-- Stats Cards Grid -->
      <!-- Alert Banner -->
      <!-- Events Section -->
      <!-- Footer -->
    </div>
  </main>
</body>
```

### Tarjetas de Estadisticas

```javascript
function renderStatsCards() {
  const stats = [
    {
      label: 'INGRESOS HOY',
      value: todayStats.entries,
      icon: 'login',
      iconBg: 'bg-indigo-50 dark:bg-indigo-900/30',
      iconColor: 'text-indigo-600 dark:text-indigo-400'
    },
    {
      label: 'SALIDAS HOY',
      value: todayStats.exits,
      icon: 'logout',
      iconBg: 'bg-cyan-50 dark:bg-cyan-900/30',
      iconColor: 'text-cyan-600 dark:text-cyan-400'
    },
    {
      label: 'ATRASOS',
      value: todayStats.late,
      icon: 'schedule',
      iconBg: 'bg-amber-50 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400'
    },
    {
      label: 'SIN INGRESO',
      value: noIngressCount,
      icon: 'close',
      iconBg: 'bg-rose-50 dark:bg-rose-900/30',
      iconColor: 'text-rose-600 dark:text-rose-400',
      highlight: noIngressCount > 0
    }
  ];

  return stats.map(s => `
    <div class="bg-white dark:bg-card-dark rounded-xl p-6 shadow-sm border ${s.highlight ? 'border-rose-200' : 'border-gray-100'}">
      <div class="flex items-center justify-between mb-4">
        <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">${s.label}</span>
        <div class="${s.iconBg} p-2 rounded-lg">
          <span class="material-icons-round ${s.iconColor}">${s.icon}</span>
        </div>
      </div>
      <div class="text-4xl font-bold ${s.highlight ? 'text-rose-600' : 'text-gray-800 dark:text-white'}">
        ${s.value}
      </div>
    </div>
  `).join('');
}
```

### Banner de Alerta

```javascript
function renderAlertBanner() {
  if (noIngressCount === 0) return '';

  return `
    <div class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-5 border border-amber-200 dark:border-amber-800">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-4">
          <div class="p-2 bg-amber-100 dark:bg-amber-800/50 rounded-full">
            <span class="material-icons-round text-amber-600 dark:text-amber-400">warning</span>
          </div>
          <div>
            <p class="font-bold text-amber-800 dark:text-amber-200">
              ${noIngressCount} alumnos <span class="font-normal">sin registro de entrada</span>
            </p>
            <p class="text-sm text-amber-600 dark:text-amber-400">
              Estos alumnos no han registrado ingreso hoy.
            </p>
          </div>
        </div>
        <div class="flex gap-3">
          <button onclick="Views.directorDashboard.showNoIngressList()"
                  class="px-4 py-2 bg-white dark:bg-transparent border border-gray-200 rounded-lg text-sm font-medium">
            <span class="material-icons-round text-sm mr-1">visibility</span>
            Ver Lista
          </button>
          <button onclick="Router.navigate('/director/reports')"
                  class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
            <span class="material-icons-round text-sm mr-1">analytics</span>
            Ir a Reportes
          </button>
        </div>
      </div>
    </div>
  `;
}
```

### Tabla de Eventos

| Columna | Descripcion |
|---------|-------------|
| HORA | Timestamp del evento (HH:MM) |
| ALUMNO | Nombre completo del estudiante |
| CURSO | Nombre del curso |
| TIPO | Badge con color (Ingreso=indigo, Salida=cyan, Atraso=amber) |
| FOTO | Icono clickeable si hay foto |

```javascript
const typeStyles = {
  entry: { label: 'Ingreso', bg: 'bg-indigo-50', text: 'text-indigo-700', icon: 'login' },
  exit: { label: 'Salida', bg: 'bg-cyan-50', text: 'text-cyan-700', icon: 'logout' },
  late: { label: 'Atraso', bg: 'bg-amber-50', text: 'text-amber-700', icon: 'schedule' }
};
```

---

## 3. Modulo Reportes - Implementacion

### Diseno Aprobado

El diseno incluye:
- Header con breadcrumb "Tablero > Reportes"
- Seccion de filtros (Fecha Inicio, Fecha Fin, Curso)
- Boton gradient "Generar Reporte"
- Tabla de resumen con colores por columna
- Grafico de barras HTML/CSS (sin Chart.js)
- Grafico de linea SVG para tendencias

### Estilos CSS para Graficos

**Archivo:** `src/web-app-preview/css/tailwind.css`

```css
@layer components {
  /* Contenedor de graficos */
  .chart-container {
    position: relative;
    height: 300px;
    width: 100%;
  }

  /* Grafico de barras - del diseno aprobado Reportes */
  .bar-chart-grid {
    display: flex;
    align-items: flex-end;
    gap: 2rem;
    height: 240px;
    padding-bottom: 24px;
    border-bottom: 1px solid #e5e7eb;
    position: relative;
  }

  .bar-group {
    flex: 1;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 4px;
    height: 100%;
    position: relative;
  }

  .bar-present {
    width: 16px;
    background: #10b981;  /* emerald-500 */
    border-radius: 4px 4px 0 0;
    transition: height 0.3s ease;
  }

  .bar-absent {
    width: 16px;
    background: #f43f5e;  /* rose-500 */
    border-radius: 4px 4px 0 0;
    transition: height 0.3s ease;
  }

  .line-chart-svg {
    width: 100%;
    height: 240px;
  }

  .dark .bar-chart-grid {
    border-bottom-color: #334155;
  }
}
```

### Safelist de Tailwind

**Archivo:** `src/web-app-preview/tailwind.config.js`

```javascript
module.exports = {
  // ...
  safelist: [
    // Colores del modulo Reportes (emerald, amber, rose)
    'text-emerald-600', 'dark:text-emerald-400', 'bg-emerald-500', 'bg-emerald-50',
    'text-amber-600', 'dark:text-amber-400',
    'text-rose-600', 'dark:text-rose-400', 'bg-rose-500', 'bg-rose-400',

    // Boton gradient para Reportes
    'bg-gradient-to-r', 'from-indigo-600', 'to-purple-600',
    'hover:from-indigo-700', 'hover:to-purple-700',
    'shadow-indigo-100', 'dark:shadow-indigo-900/20',

    // Colores adicionales para graficos y tablas
    'bg-gray-50/50', 'dark:bg-white/5', 'bg-gray-100', 'dark:bg-gray-800',
  ],
};
```

### Seccion de Filtros

```javascript
function renderFilters() {
  return `
    <section class="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-gray-100 dark:border-border-dark p-6">
      <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">
        Filtros de Reporte
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
        <!-- Fecha Inicio -->
        <div class="space-y-2">
          <label class="block text-xs font-semibold text-gray-600">Fecha Inicio</label>
          <input type="date" id="filter-start-date" value="${defaultStartDate}"
                 class="w-full px-3 py-2.5 text-sm border-gray-200 rounded-lg bg-gray-50/50" />
        </div>

        <!-- Fecha Fin -->
        <div class="space-y-2">
          <label class="block text-xs font-semibold text-gray-600">Fecha Fin</label>
          <input type="date" id="filter-end-date" value="${defaultEndDate}"
                 class="w-full px-3 py-2.5 text-sm border-gray-200 rounded-lg bg-gray-50/50" />
        </div>

        <!-- Curso -->
        <div class="space-y-2">
          <label class="block text-xs font-semibold text-gray-600">Curso</label>
          <select id="filter-course" class="w-full px-3 py-2.5 text-sm border-gray-200 rounded-lg">
            <option value="">Todos</option>
            ${courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>

        <!-- Botones -->
        <div class="flex gap-3">
          <button onclick="Views.directorReports.generateReport()"
                  class="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600
                         hover:from-indigo-700 hover:to-purple-700
                         text-white rounded-lg text-sm font-semibold shadow-md">
            <span class="material-icons-round text-sm">settings_suggest</span>
            Generar Reporte
          </button>
          <button onclick="Views.directorReports.exportPDF()"
                  class="flex-1 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold">
            <span class="material-icons-round text-sm">picture_as_pdf</span>
            Exportar PDF
          </button>
        </div>
      </div>
    </section>
  `;
}
```

### Tabla de Resumen con Colores

```javascript
function renderSummaryTable(reportData) {
  return `
    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="bg-gray-50/50 dark:bg-white/5 border-y border-gray-100">
          <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase">CURSO</th>
          <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-center">TOTAL ALUMNOS</th>
          <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-center">PRESENTES</th>
          <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-center">ATRASOS</th>
          <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-center">AUSENTES</th>
          <th class="px-6 py-4 text-xs font-bold text-gray-400 uppercase">% ASISTENCIA</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100 text-sm">
        ${reportData.map(row => `
          <tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            <td class="px-6 py-4 font-semibold text-gray-900">${row.courseName}</td>
            <td class="px-6 py-4 text-center text-gray-600">${row.total}</td>
            <td class="px-6 py-4 text-center font-medium text-emerald-600">${row.present}</td>
            <td class="px-6 py-4 text-center font-medium text-amber-600">${row.late}</td>
            <td class="px-6 py-4 text-center font-medium text-rose-600">${row.absent}</td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full ${row.percentage >= 80 ? 'bg-emerald-500' : row.percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'} rounded-full"
                       style="width: ${row.percentage}%"></div>
                </div>
                <span class="text-xs font-bold text-gray-700 w-10 text-right">${row.percentage}%</span>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
```

### Grafico de Barras HTML/CSS

```javascript
function renderBarChart(reportData) {
  const maxValue = Math.max(...reportData.map(r => Math.max(r.present, r.absent)));

  return `
    <section class="bg-white dark:bg-card-dark rounded-xl shadow-sm border p-6">
      <div class="flex justify-between items-center mb-10">
        <h3 class="text-base font-bold text-gray-800">Grafico de Asistencia por Curso</h3>
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-sm bg-emerald-500"></div>
            <span class="text-xs font-medium text-gray-600">Presentes</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-sm bg-rose-500"></div>
            <span class="text-xs font-medium text-gray-600">Ausentes</span>
          </div>
        </div>
      </div>

      <div class="bar-chart-grid mt-4">
        <!-- Y-axis labels -->
        <div class="absolute left-0 h-full flex flex-col justify-between text-[10px] text-gray-400 -translate-x-2">
          <span>${maxValue}</span>
          <span>${Math.round(maxValue * 0.75)}</span>
          <span>${Math.round(maxValue * 0.5)}</span>
          <span>${Math.round(maxValue * 0.25)}</span>
          <span>0</span>
        </div>

        <!-- Bars -->
        ${reportData.map(row => {
          const presentHeight = maxValue > 0 ? (row.present / maxValue) * 100 : 0;
          const absentHeight = maxValue > 0 ? (row.absent / maxValue) * 100 : 0;
          return `
            <div class="bar-group">
              <div class="bar-present" style="height: ${presentHeight}%;"></div>
              <div class="bar-absent" style="height: ${absentHeight}%;"></div>
              <div class="absolute -bottom-8 left-0 right-0 text-center text-[10px] font-medium text-gray-500 whitespace-nowrap">
                ${row.courseName}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="h-8"></div>
    </section>
  `;
}
```

### Grafico de Linea SVG (Tendencia)

```javascript
function renderLineChart(trendData) {
  const maxY = Math.max(...trendData.map(d => d.present));
  const width = 1000;
  const height = 240;

  // Calculate points
  const points = trendData.map((d, i) => {
    const x = (i / (trendData.length - 1)) * width;
    const y = height - (d.present / maxY) * height;
    return { x, y, ...d };
  });

  // Create path
  const pathD = points.map((p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const prev = points[i - 1];
    const cpX = (prev.x + p.x) / 2;
    return `Q${cpX},${prev.y} ${cpX},${(prev.y + p.y) / 2} T${p.x},${p.y}`;
  }).join(' ');

  // Create area fill path
  const areaD = `${pathD} L${width},${height} L0,${height} Z`;

  return `
    <section class="bg-white dark:bg-card-dark rounded-xl shadow-sm border p-6">
      <h3 class="text-base font-bold text-gray-800 mb-10">Tendencia de Asistencia</h3>

      <div class="relative h-[280px] w-full mt-4 flex">
        <!-- Y-axis label (rotated) -->
        <div class="absolute left-0 top-0 h-[240px] flex items-center -rotate-90 origin-left -translate-x-6 translate-y-full">
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
            Alumnos presentes
          </span>
        </div>

        <div class="flex-1 ml-10">
          <div class="relative h-[240px] border-b border-gray-100 w-full">
            <!-- Grid lines -->
            <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
              ${Array(7).fill('').map(() => '<div class="w-full border-t border-gray-100"></div>').join('')}
            </div>

            <!-- SVG Chart -->
            <svg class="absolute inset-0 w-full h-full" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.2"/>
                  <stop offset="100%" stop-color="#4f46e5" stop-opacity="0"/>
                </linearGradient>
              </defs>

              <!-- Area fill -->
              <path d="${areaD}" fill="url(#chartGradient)"/>

              <!-- Line -->
              <path d="${pathD}" fill="none" stroke="#4f46e5" stroke-width="3" stroke-linecap="round"/>

              <!-- Data points -->
              ${points.map(p => `
                <circle cx="${p.x}" cy="${p.y}" r="4" fill="#4f46e5" stroke="white" stroke-width="2"/>
              `).join('')}
            </svg>

            <!-- Y-axis values -->
            <div class="absolute -left-6 top-0 h-full flex flex-col justify-between text-[10px] text-gray-400">
              ${Array(8).fill('').map((_, i) => `<span>${Math.round(maxY * (1 - i/7))}</span>`).join('')}
            </div>
          </div>

          <!-- X-axis labels (dates) -->
          <div class="flex justify-between mt-4 text-[10px] font-medium text-gray-500 px-0">
            ${trendData.map(d => `<span>${d.label}</span>`).join('')}
          </div>
        </div>
      </div>
    </section>
  `;
}
```

---

## 4. Modulo Metricas - Implementacion

### Diseno Aprobado

El diseno aprobado incluye:
- Header con breadcrumb "Tablero > Metricas"
- 4 KPI cards con borde lateral de color (no fondo gradient)
- Top 10 Alumnos con mas Atrasos (tabla con chips de colores)
- Grafico de barras Chart.js - Distribucion de Atrasos por Hora
- Tabla de Analisis por Curso con chips de % asistencia
- Grafico de linea Chart.js - Tendencia de Asistencia (con gradient fill)
- Tabla de Alumnos en Riesgo con paginacion funcional
- Footer estandarizado "© 2026 NEUVOX"

### KPI Cards con Borde Lateral

A diferencia del Dashboard (que usa fondo gradient), Metricas usa borde lateral:

```javascript
const kpis = [
  { label: 'Tasa de Asistencia', value: `${metrics.attendanceRate}%`, borderColor: 'bg-indigo-500', textColor: 'text-indigo-600' },
  { label: 'Total Atrasos', value: metrics.totalLateEvents, borderColor: 'bg-blue-500', textColor: 'text-blue-600' },
  { label: 'Promedio Diario', value: metrics.avgLatePerDay.toFixed(1), borderColor: 'bg-purple-500', textColor: 'text-purple-600' },
  { label: 'Alumnos en Riesgo', value: metrics.riskStudents.length, borderColor: 'bg-emerald-500', textColor: 'text-emerald-600' }
];
```

```html
<div class="kpi-card">
  <div class="kpi-card-border bg-indigo-500"></div>
  <p class="kpi-card-label">Tasa de Asistencia</p>
  <h3 class="kpi-card-value text-indigo-600">95.2%</h3>
</div>
```

### Estilos CSS para KPI Cards

```css
@layer components {
  .kpi-card {
    @apply bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden;
    @apply transition-all duration-200 hover:shadow-md;
  }

  .kpi-card-border {
    @apply absolute top-0 left-0 w-1 h-full;
  }

  .kpi-card-label {
    @apply text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1;
  }

  .kpi-card-value {
    @apply text-3xl font-bold;
  }

  .dark .kpi-card {
    @apply bg-slate-800 border-slate-700;
  }
}
```

### Chips de Colores - Sistema de 3 Niveles

**Chips para Atrasos (Top 10):**

| Cantidad | Clase CSS | Colores |
|----------|-----------|---------|
| >= 5 atrasos | `chip-delay-high` | amber-100/amber-700 |
| 3-4 atrasos | `chip-delay-medium` | indigo-100/indigo-700 |
| 1-2 atrasos | `chip-delay-low` | gray-100/gray-600 |

```javascript
function getDelayBadgeColor(count) {
  if (count >= 5) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  if (count >= 3) return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
}
```

**Chips para % Asistencia (Analisis por Curso):**

| Porcentaje | Clase CSS | Colores |
|------------|-----------|---------|
| >= 90% | `chip-attendance-high` | emerald-100/emerald-700 |
| 70-89% | `chip-attendance-medium` | amber-100/amber-600 |
| < 70% | `chip-attendance-low` | **red-100/red-600** (NO rose) |

```javascript
function getAttendanceChipColor(rate) {
  const percentage = parseFloat(rate);
  if (percentage >= 90) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (percentage >= 70) return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
}
```

### Graficos Chart.js

Se usa Chart.js via CDN (agregado a index.html):

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```

**Grafico de Barras - Distribucion por Hora:**

```javascript
new Chart(distCtx, {
  type: 'bar',
  data: {
    labels: hourLabels,
    datasets: [{
      data: hourCounts,
      backgroundColor: '#6366f1', // indigo-500
      borderRadius: 4,
      barThickness: 24
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } }
    }
  }
});
```

**Grafico de Linea - Tendencia de Asistencia (con gradient fill):**

```javascript
const gradient = ctx.createLinearGradient(0, 0, 0, 200);
gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

new Chart(trendCtx, {
  type: 'line',
  data: {
    labels: dateLabels,
    datasets: [{
      data: attendanceRates,
      borderColor: '#6366f1',
      backgroundColor: gradient,
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#6366f1',
      pointBorderColor: '#fff',
      pointBorderWidth: 2
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { min: 80, max: 100, ticks: { callback: v => v + '%' } }
    }
  }
});
```

### Tabla de Alumnos en Riesgo con Paginacion

La tabla muestra alumnos con alto riesgo (muchas ausencias/atrasos) con paginacion funcional:

```javascript
// Variables de estado
let riskStudentsPage = 1;
const riskStudentsPerPage = 3;

// Funciones de paginacion expuestas globalmente
Views.directorMetrics.prevRiskPage = function() {
  if (riskStudentsPage > 1) {
    riskStudentsPage--;
    updateRiskTable();
  }
};

Views.directorMetrics.nextRiskPage = function() {
  const totalPages = Math.ceil(metrics.riskStudents.length / riskStudentsPerPage);
  if (riskStudentsPage < totalPages) {
    riskStudentsPage++;
    updateRiskTable();
  }
};

// Actualizar tabla Y controles de paginacion
function updateRiskTable() {
  const tbody = document.getElementById('risk-students-tbody');
  const paginationInfo = document.getElementById('risk-pagination-info');
  const prevBtn = document.getElementById('risk-prev-btn');
  const nextBtn = document.getElementById('risk-next-btn');
  const totalPages = Math.ceil(metrics.riskStudents.length / riskStudentsPerPage);

  // Update table body
  if (tbody) {
    tbody.innerHTML = renderRiskStudentsRows(metrics.riskStudents, courses, riskStudentsPage, riskStudentsPerPage);
  }

  // Update pagination info text
  if (paginationInfo) {
    const start = (riskStudentsPage - 1) * riskStudentsPerPage + 1;
    const end = Math.min(riskStudentsPage * riskStudentsPerPage, metrics.riskStudents.length);
    paginationInfo.textContent = `Mostrando ${start}-${end} de ${metrics.riskStudents.length} alumnos`;
  }

  // Update button states (enabled/disabled styling)
  if (prevBtn) {
    prevBtn.className = riskStudentsPage === 1
      ? 'px-3 py-1 ... text-gray-400 cursor-not-allowed'
      : 'px-3 py-1 ... text-indigo-600 hover:bg-indigo-50';
  }
  // Similar for nextBtn...
}
```

### Safelist Agregado para Metricas

```javascript
safelist: [
  // KPI Cards - bordes laterales
  'bg-indigo-500', 'bg-blue-500', 'bg-purple-500', 'bg-emerald-500',
  'text-blue-600', 'text-purple-600', 'text-emerald-600',
  'dark:text-blue-400', 'dark:text-purple-400', 'dark:text-emerald-400',

  // Chips Top 10 Atrasos
  'bg-amber-100', 'text-amber-700',
  'bg-indigo-100', 'text-indigo-700',
  'text-gray-600',

  // Chips % Asistencia (USA RED, NO ROSE para bajo)
  'bg-emerald-100', 'text-emerald-700',
  'text-amber-600',
  'text-red-600',

  // Dark mode chips
  'bg-amber-900/30', 'text-amber-400',
  'bg-indigo-900/30',
  'bg-emerald-900/30',
  'bg-red-900/30', 'text-red-400',
  'bg-gray-700',

  // Sidebar activo estandarizado
  'border-l-4',
]
```

### Estandarizacion del Sidebar

Se estandarizo el sidebar en TODOS los modulos con borde izquierdo:

```javascript
<a href="#${item.path}" class="flex items-center px-6 py-2.5 transition-colors
  ${item.path === currentPath
    ? 'bg-indigo-800/50 text-white border-l-4 border-indigo-500'
    : 'hover:bg-white/5 border-l-4 border-transparent'}">
```

**IMPORTANTE:** `border-l-4` (IZQUIERDA) en todos los modulos, NO `border-r-4`

---

## 5. Comparacion: Diseno Original vs Implementacion

### Dashboard

| Elemento | Diseno | Implementacion | Estado |
|----------|--------|----------------|--------|
| Header con "En vivo" badge | Verde con punto pulsante | Identico | OK |
| 4 tarjetas estadisticas | Grid responsive | Identico | OK |
| Colores tarjetas | Indigo/Cyan/Amber/Rose | Identico | OK |
| Banner alerta amarillo | Con botones Ver Lista / Reportes | Identico | OK |
| Tabla eventos | Con filtros y paginacion | Identico | OK |
| Dark mode | Colores adaptados | Identico | OK |
| Sidebar NEUVOX | Fondo #1e1b4b | Identico | OK |

### Reportes

| Elemento | Diseno | Implementacion | Estado |
|----------|--------|----------------|--------|
| Breadcrumb | "Tablero > Reportes" | Identico | OK |
| Filtros | 3 inputs + 2 botones | Identico | OK |
| Boton gradient | Indigo a purple | Identico | OK |
| Tabla resumen | Colores emerald/amber/rose | Identico | OK |
| Progress bars | Con colores dinamicos | Identico | OK |
| Grafico barras | HTML/CSS (no Chart.js) | Identico | OK |
| Grafico linea | SVG con gradiente | Identico | OK |
| Dark mode | Colores adaptados | Identico | OK |

### Metricas

| Elemento | Diseno | Implementacion | Estado |
|----------|--------|----------------|--------|
| Breadcrumb | "Tablero > Metricas" | Identico | OK |
| KPI cards | 4 con borde lateral | Identico | OK |
| Colores KPI | indigo/blue/purple/emerald | Identico | OK |
| Top 10 tabla | Con chips de colores | Identico | OK |
| Chips atrasos | amber/indigo/gray | Identico | OK |
| Grafico barras | Chart.js | Identico | OK |
| Analisis curso | Con chips % asistencia | Identico | OK |
| Chips % bajo | **red** (no rose) | Identico | OK |
| Grafico linea | Chart.js con gradient | Identico | OK |
| Alumnos riesgo | Tabla con paginacion | Identico | OK |
| Paginacion | Botones funcionales | Identico | OK |
| Footer | © 2026 NEUVOX | Identico | OK |
| Sidebar | border-l-4 (izquierda) | Identico | OK |
| Dark mode | Colores adaptados | Identico | OK |

### Horarios

| Elemento | Diseno | Implementacion | Estado |
|----------|--------|----------------|--------|
| Header con selector curso | Sin breadcrumb | Identico | OK |
| Secciones curso | Sin acordeon (expandidas) | Identico | OK |
| Grid 5 dias | md:grid-cols-5 | Identico | OK |
| Day cards configurados | Border solido, botones activos | Identico | OK |
| Day cards vacios | Dashed border SVG | Identico | OK |
| Botones vacíos | Colores atenuados | Identico | OK |
| Time Picker Modal | Grid horas/minutos | Preservado | OK |
| Botones curso | Guardar/Copiar/Borrar Todo | Identico | OK |
| Footer | © 2026 NEUVOX | Identico | OK |
| Sidebar | border-l-4 (izquierda) | Identico | OK |
| Dark mode | Colores adaptados | Identico | OK |

---

## 6. Testing Funcional Completado

### Dashboard
- [x] Visualizacion de estadisticas en tiempo real
- [x] Banner de alerta cuando hay alumnos sin ingreso
- [x] Modal "Ver Lista" con todos los alumnos
- [x] Filtros de tabla (Curso, Tipo, Busqueda)
- [x] Dark mode toggle
- [x] Responsive en mobile (sidebar colapsable)
- [x] Navegacion desde sidebar

### Reportes
- [x] Filtros de fecha y curso
- [x] Boton "Generar Reporte" actualiza datos
- [x] Tabla de resumen con colores correctos
- [x] Progress bar con color dinamico segun porcentaje
- [x] Grafico de barras renderiza correctamente
- [x] Grafico de linea SVG renderiza correctamente
- [x] Dark mode toggle
- [x] Responsive en mobile
- [x] Navegacion entre Dashboard y Reportes

### Metricas
- [x] KPI cards con borde lateral y hover effect
- [x] Colores correctos: indigo/blue/purple/emerald
- [x] Top 10 tabla con chips de colores (amber/indigo/gray)
- [x] Grafico de barras Chart.js renderiza correctamente
- [x] Analisis por curso con chips de % asistencia
- [x] Chips % bajo usan RED (no rose)
- [x] Grafico de linea Chart.js con gradient fill
- [x] Tabla de alumnos en riesgo
- [x] Paginacion funcional (Anterior/Siguiente)
- [x] Actualizacion de texto "Mostrando X-Y de Z"
- [x] Estados de botones (habilitado/deshabilitado)
- [x] Footer "© 2026 NEUVOX"
- [x] Dark mode toggle
- [x] Responsive en mobile (sidebar colapsable)
- [x] Navegacion entre Dashboard/Reportes/Metricas

### Build de Produccion
- [x] `npm run build` exitoso
- [x] CSS incluye clases del safelist
- [x] Clases verificadas: `text-emerald-600`, `text-amber-600`, `text-rose-600`, `from-indigo-600`, `to-purple-600`
- [x] Clases Metricas verificadas: `bg-indigo-500`, `bg-blue-500`, `bg-purple-500`, `bg-emerald-500`, `text-red-600`

---

## 7. Archivos Modificados

```
Preview Environment (6 archivos principales):

src/web-app-preview/index.html
  - +1 linea (Chart.js CDN para Metricas)

src/web-app-preview/css/tailwind.css
  - +35 lineas (estilos bar-chart-grid, bar-present, bar-absent, line-chart-svg)
  - +90 lineas (estilos KPI cards, chips delay, chips attendance, dark mode)

src/web-app-preview/tailwind.config.js
  - +15 lineas (safelist para emerald, amber, rose, gradient)
  - +25 lineas (safelist para Metricas: KPIs, chips, red colors)

src/web-app-preview/js/views/director_dashboard.js
  - Reescritura completa (~400 lineas)
  - Layout con sidebar NEUVOX
  - Tarjetas de estadisticas
  - Banner de alerta
  - Tabla de eventos con filtros

src/web-app-preview/js/views/director_reports.js
  - Reescritura completa (~500 lineas)
  - Seccion de filtros con boton gradient
  - Tabla de resumen con colores
  - renderBarChart() - grafico HTML/CSS
  - renderLineChart() - grafico SVG
  - Logica de calculo de estadisticas

src/web-app-preview/js/views/director_metrics.js
  - Reescritura completa (~800 lineas)
  - Layout con sidebar estandarizado (border-l-4)
  - 4 KPI cards con borde lateral
  - Top 10 tabla con chips de colores
  - Grafico de barras Chart.js
  - Tabla analisis por curso
  - Grafico de linea Chart.js con gradient
  - Tabla alumnos en riesgo con paginacion
  - Funciones de paginacion: prevRiskPage(), nextRiskPage()
  - updateRiskTable() actualiza tabla + controles
  - Funciones de exportacion PDF
  - Footer estandarizado
```

---

## 8. Diagrama: Arquitectura Preview vs Produccion

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCCION                               │
│                      /app/ (Bootstrap CSS)                       │
├─────────────────────────────────────────────────────────────────┤
│  src/web-app/                                                    │
│  ├── index.html (Bootstrap 5)                                   │
│  ├── css/styles.css (CSS custom)                                │
│  └── js/views/*.js                                              │
│                                                                  │
│  Acceso: http://localhost:3000/app/                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          PREVIEW                                 │
│                    /app-preview/ (Tailwind CSS)                  │
├─────────────────────────────────────────────────────────────────┤
│  src/web-app-preview/                                           │
│  ├── index.html (Vite entry)                                    │
│  ├── vite.config.js                                             │
│  ├── tailwind.config.js                                         │
│  ├── css/tailwind.css (@tailwind directives)                    │
│  └── js/views/*.js (nuevos disenos)                             │
│                                                                  │
│  Dev:  http://localhost:5173/app-preview/                       │
│  Prod: dist/index.html                                          │
└─────────────────────────────────────────────────────────────────┘

                              │
                              ▼
                 ┌────────────────────────┐
                 │    Backend FastAPI     │
                 │    (compartido)        │
                 │    /api/v1/*           │
                 └────────────────────────┘
```

---

## 9. Proximos Pasos Sugeridos

1. **Continuar con otros modulos**: Horarios, Excepciones, Comunicados
2. **Migracion gradual**: Una vez validados los disenos, migrar a produccion
3. **Componentes reutilizables**: Extraer sidebar, header, modals a componentes
4. **Tests E2E**: Agregar tests con Playwright para validar flujos

---

## 10. Modulo Horarios - Implementacion

### Diseno Aprobado

El diseno aprobado (`Disenos html aprobados/Modulo Horarios/modulo horarios.html`) incluye:
- Header con selector de curso (NO breadcrumb)
- Secciones de curso siempre expandidas (NO acordeon)
- Grid de 5 dias (Lunes a Viernes) con `md:grid-cols-5`
- Day cards configurados con inputs de hora y botones de accion
- Day cards vacios con borde dashed (SVG) y botones atenuados
- Time Picker Modal para seleccion de hora
- Footer estandarizado "© 2026 NEUVOX"

### Estructura del Layout

```html
<!-- Header con selector de curso -->
<header class="h-20 bg-white dark:bg-card-dark ...">
  <div class="flex items-center gap-4">
    <button class="desktop-hidden">menu</button>
    <h2>Gestion de Horarios</h2>
    <div class="h-6 w-px bg-gray-200"></div>
    <select id="course-filter">...</select>
  </div>
  <!-- Dark mode, perfil, logout -->
</header>

<!-- Seccion de curso (siempre expandida) -->
<section class="bg-white rounded-2xl shadow-sm">
  <div class="p-6 flex justify-between items-center bg-gray-50/50">
    <!-- Icono + Nombre curso -->
    <!-- 3 botones: Guardar Todo, Copiar a Todos, Borrar Todo -->
  </div>
  <div class="p-6">
    <div class="grid grid-cols-1 md:grid-cols-5 gap-6">
      <!-- 5 Day Cards -->
    </div>
  </div>
</section>
```

### Day Card Configurado vs Vacio

**Day Card Configurado (con horario):**
```html
<div class="p-5 border border-gray-200 rounded-xl bg-white hover:shadow-md">
  <span class="text-sm font-bold text-gray-900 uppercase">Lunes</span>
  <!-- Inputs de hora -->
  <input type="text" value="08:00" class="w-full pl-8 ...">
  <!-- Botones: save, forward, delete (colores normales) -->
</div>
```

**Day Card Vacio (sin configurar):**
```html
<div class="p-5 dashed-card">
  <span class="text-sm font-bold text-gray-400 uppercase">Lunes</span>
  <!-- Placeholders --:-- -->
  <div class="time-placeholder"><span>--:--</span></div>
  <!-- Botones: save, forward, delete (colores atenuados) -->
</div>
```

### Estilos CSS para Day Cards

```css
@layer components {
  /* Day Card Vacio - Borde dashed con SVG */
  .dashed-card {
    @apply rounded-xl;
    background-image: url("data:image/svg+xml,..."); /* SVG dashed border */
  }

  .dark .dashed-card {
    background-image: url("data:image/svg+xml,..."); /* Dark mode version */
  }

  /* Placeholder de hora vacia */
  .time-placeholder {
    @apply h-9 border-b border-gray-100 flex items-center justify-center;
  }
}
```

### Time Picker Modal

Se preservo el Time Picker Modal existente que permite:
- Seleccion de hora (00-23) en grid visual
- Seleccion de minutos (00, 05, 10, ... 55) en grid visual
- Presets de horarios comunes (7:30, 8:00, 12:00, etc.)
- Botones Cancelar/Aceptar

### Safelist Agregado para Horarios

```javascript
safelist: [
  // Course section header
  'bg-gray-50/50', 'dark:bg-slate-800/50',
  'bg-blue-50', 'dark:bg-blue-900/30', 'text-blue-600',

  // Gradient buttons
  'to-blue-500', 'hover:to-blue-600',

  // Day card borders
  'border-gray-200', 'dark:border-slate-700', 'hover:shadow-md',

  // Day card buttons (configurado)
  'border-indigo-100', 'dark:border-indigo-900/30',
  'border-red-100', 'dark:border-red-900/30', 'text-red-500',

  // Day card buttons (vacio - atenuados)
  'border-indigo-100/50', 'text-indigo-300', 'text-red-200',

  // Inputs y grid
  'pl-8', 'text-[10px]', 'md:grid-cols-5', 'min-w-[200px]',
]
```

---

## 11. Estandarizacion de Headers

### Problema Original

Cada modulo tenia un header diferente:
- **Dashboard**: Tenia indicador "En vivo", boton menu mobile `desktop-hidden`
- **Reportes**: Tenia breadcrumb, usaba `md:gap-6`
- **Metricas**: Usaba `md:hidden` en lugar de `desktop-hidden`, padding `px-4 md:px-8`
- **Horarios**: No tenia boton menu mobile, tenia selector de curso

### Solucion Implementada

Se estandarizaron TODOS los headers para coincidir con la estructura de Dashboard:

```html
<header class="h-20 bg-white dark:bg-card-dark border-b border-border-light dark:border-border-dark flex items-center justify-between px-8 z-10 shadow-sm">
  <div class="flex items-center gap-4">
    <!-- Boton menu mobile (desktop-hidden) -->
    <button class="desktop-hidden text-muted-light dark:text-muted-dark hover:text-primary transition-colors" onclick="...toggleMobileSidebar()">
      <span class="material-icons-round text-2xl">menu</span>
    </button>
    <!-- Titulo del modulo -->
    <h2 class="text-xl font-bold text-gray-800 dark:text-text-dark">Titulo Modulo</h2>
  </div>
  <div class="flex items-center gap-2 md:gap-4 flex-1 justify-end">
    <div class="flex items-center gap-2 md:gap-3">
      <!-- Dark mode toggle -->
      <button class="p-2 rounded-full hover:bg-background-light dark:hover:bg-white/5 ...">
        <span class="material-icons-round" id="dark-mode-icon">dark_mode</span>
      </button>
      <!-- Avatar + Nombre usuario -->
      <div class="flex items-center gap-2 cursor-pointer">
        <div class="w-9 h-9 rounded-full border border-gray-200 bg-indigo-600 ...">
          ${inicial}
        </div>
        <div class="text-right mobile-hidden">
          <p class="text-sm font-semibold ...">${nombre}</p>
        </div>
      </div>
      <!-- Boton Salir -->
      <a class="ml-1 md:ml-2 text-sm text-gray-500 ... border px-2 md:px-3 py-1.5 rounded-md ...">
        <span class="material-icons-round text-lg">logout</span>
        <span class="mobile-hidden">Salir</span>
      </a>
    </div>
  </div>
</header>
```

### Cambios Realizados por Modulo

| Modulo | Cambios |
|--------|---------|
| **Dashboard** | Base de referencia - sin cambios |
| **Reportes** | Eliminado breadcrumb, unificado gaps y clases |
| **Metricas** | Cambiado `md:hidden` por `desktop-hidden`, padding unificado, eliminado breadcrumb |
| **Horarios** | Agregado boton menu mobile, selector curso movido despues del titulo, agregadas funciones toggleMobileSidebar/toggleDarkMode |

### Funciones Agregadas a Horarios

```javascript
// Toggle mobile sidebar
Views.directorSchedules.toggleMobileSidebar = function() {
  const sidebar = document.querySelector('aside.mobile-hidden');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) {
    sidebar.classList.toggle('mobile-hidden');
    sidebar.classList.toggle('fixed');
    sidebar.classList.toggle('inset-y-0');
    sidebar.classList.toggle('left-0');
    sidebar.classList.toggle('z-50');
  }
  if (backdrop) {
    backdrop.classList.toggle('hidden');
  }
};

// Toggle dark mode
Views.directorSchedules.toggleDarkMode = function() {
  document.documentElement.classList.toggle('dark');
  const icon = document.getElementById('dark-mode-icon');
  if (icon) {
    icon.textContent = document.documentElement.classList.contains('dark') ? 'light_mode' : 'dark_mode';
  }
};
```

---

## 12. CSS Utilities para Evitar Conflictos

### Problema

El archivo `styles.css` legacy tiene reglas con `!important` que sobreescriben clases de Tailwind:

```css
/* En styles.css */
.hidden {
  display: none !important;
}
```

Esto rompe clases como `hidden sm:inline` o `flex-col sm:flex-row`.

### Solucion

Se crearon clases custom en `tailwind.css` que no entran en conflicto:

```css
@layer utilities {
  /* Clases responsive que evitan conflicto con .hidden de styles.css */
  .mobile-hidden {
    display: none;
  }
  @media (min-width: 768px) {
    .mobile-hidden {
      display: flex;
    }
  }

  .desktop-hidden {
    display: block;
  }
  @media (min-width: 768px) {
    .desktop-hidden {
      display: none !important;
    }
  }

  /* Texto responsive para botones */
  .sm-show-text {
    display: none;
  }
  @media (min-width: 640px) {
    .sm-show-text {
      display: inline;
    }
  }

  .sm-hide-text {
    display: inline;
  }
  @media (min-width: 640px) {
    .sm-hide-text {
      display: none;
    }
  }

  /* Block version para contenedores */
  .sm-show-block {
    display: none;
  }
  @media (min-width: 640px) {
    .sm-show-block {
      display: block;
    }
  }

  /* Flex responsive - column en mobile, row en sm+ */
  .sm-flex-row {
    flex-direction: column;
    align-items: flex-start;
  }
  @media (min-width: 640px) {
    .sm-flex-row {
      flex-direction: row;
      align-items: center;
    }
  }

  /* Layout horizontal responsive para alert banner */
  .flex-responsive {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  @media (min-width: 1024px) {
    .flex-responsive {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }

  /* Botones que ocupan todo el ancho en movil/tablet */
  .btn-responsive {
    flex: 1;
    width: 100%;
  }
  @media (min-width: 1024px) {
    .btn-responsive {
      flex: none;
      width: auto;
    }
  }
}
```

### Uso

```html
<!-- Antes (roto por styles.css) -->
<span class="hidden sm:inline">Texto</span>

<!-- Despues (funciona correctamente) -->
<span class="mobile-hidden">Texto</span>
```

---

## 13. Notas Tecnicas

### Material Icons

Se usa `material-icons-round` de Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Material+Icons+Round" rel="stylesheet">

<!-- Uso -->
<span class="material-icons-round">dashboard</span>
```

### Dark Mode

Implementado con clase `dark` en `<html>`:

```javascript
// Toggle
document.documentElement.classList.toggle('dark');

// CSS
.dark .bg-white { @apply bg-card-dark; }
.dark .text-gray-800 { @apply text-gray-100; }
```

### Colores Personalizados

Definidos en tailwind.config.js:

```javascript
colors: {
  'background-dark': '#0f172a',
  'sidebar-dark': '#1e1b4b',
  'card-dark': '#1e293b',
  'border-dark': '#334155',
}
```

### Chart.js (Modulo Metricas)

Se usa Chart.js via CDN para graficos interactivos:

```html
<!-- En index.html -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```

**Nota:** No se usa ES modules (`import`) porque los scripts de la app no cargan como modulos.
Se accede via `window.Chart` globalmente.

```javascript
// Grafico de barras
new Chart(ctx, { type: 'bar', data: {...}, options: {...} });

// Grafico de linea con gradient
const gradient = ctx.createLinearGradient(0, 0, 0, 200);
gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
new Chart(ctx, { type: 'line', data: { datasets: [{ backgroundColor: gradient, fill: true }] } });
```

### Paginacion en Tablas

Para tablas con paginacion, es importante actualizar tanto el contenido como los controles:

```javascript
function updateTable() {
  // 1. Actualizar tbody
  document.getElementById('tbody').innerHTML = renderRows();

  // 2. Actualizar texto informativo
  document.getElementById('info').textContent = `Mostrando ${start}-${end} de ${total}`;

  // 3. Actualizar estado de botones
  prevBtn.className = currentPage === 1 ? 'disabled-style' : 'enabled-style';
  nextBtn.className = currentPage >= totalPages ? 'disabled-style' : 'enabled-style';
}
```

### Estandarizacion del Sidebar

Todos los modulos usan el mismo patron de sidebar:

```javascript
// Borde IZQUIERDO (border-l-4) en todos los modulos
<a class="${isActive ? 'border-l-4 border-indigo-500 bg-indigo-800/50' : 'border-l-4 border-transparent'}">
```

**IMPORTANTE:** Nunca usar `border-r-4`. Siempre `border-l-4` para consistencia.

---

*Completado el 19 de Enero de 2026*
*Ultima actualizacion: 19 de Enero de 2026 - Headers estandarizados, modulo Horarios*
