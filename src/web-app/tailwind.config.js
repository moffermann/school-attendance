/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./js/**/*.js"],
  safelist: [
    // Sidebar classes
    'bg-sidebar-dark', 'bg-sidebar-hover', 'border-indigo-900/50',
    'bg-indigo-800/50', 'border-indigo-500', 'bg-white/5',
    // Custom theme colors
    'bg-background-light', 'bg-background-dark', 'dark:bg-background-dark',
    'bg-card-light', 'bg-card-dark', 'dark:bg-card-dark',
    'text-text-light', 'text-text-dark', 'dark:text-text-dark',
    'text-muted-light', 'text-muted-dark', 'dark:text-muted-dark',
    'border-border-light', 'border-border-dark', 'dark:border-border-dark',
    // Clases dinámicas para badges de eventos (generadas con JS)
    'bg-blue-100', 'text-blue-700', 'dark:bg-blue-900/30', 'dark:text-blue-300',
    'bg-green-100', 'text-green-700', 'dark:bg-green-900/30', 'dark:text-green-300',
    'bg-red-100', 'text-red-700', 'dark:bg-red-900/30', 'dark:text-red-300',
    'bg-yellow-100', 'text-yellow-700', 'dark:bg-yellow-900/30', 'dark:text-yellow-300',
    // Metric cards
    'bg-blue-50', 'bg-indigo-50', 'bg-yellow-50', 'bg-red-50',
    'dark:bg-blue-900/20', 'dark:bg-indigo-900/20', 'dark:bg-yellow-900/20', 'dark:bg-red-900/20',
    'text-blue-500', 'text-indigo-500', 'text-yellow-500', 'text-red-500',
    'text-blue-600', 'text-indigo-600', 'text-yellow-600', 'text-red-600',
    'dark:text-blue-400', 'dark:text-indigo-400', 'dark:text-yellow-400', 'dark:text-red-400',
    // Colores del módulo Reportes (emerald, amber, rose)
    'text-emerald-600', 'dark:text-emerald-400', 'bg-emerald-500', 'bg-emerald-50',
    'text-amber-600', 'dark:text-amber-400',
    'text-rose-600', 'dark:text-rose-400', 'bg-rose-500', 'bg-rose-400',
    // Botón gradient para Reportes
    'bg-gradient-to-r', 'from-indigo-600', 'to-purple-600',
    'hover:from-indigo-700', 'hover:to-purple-700',
    'shadow-indigo-100', 'dark:shadow-indigo-900/20',
    // Colores adicionales para gráficos y tablas
    'bg-gray-50/50', 'dark:bg-white/5', 'bg-gray-100', 'dark:bg-gray-800',

    // ===== MÉTRICAS MODULE =====
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

    // Backgrounds con opacidad
    'bg-indigo-50/30', 'bg-gray-50/30',

    // Sidebar activo estandarizado
    'border-l-4',

    // ===== HORARIOS MODULE =====
    // Course section header
    'bg-gray-50/50', 'dark:bg-slate-800/50',
    'bg-blue-50', 'dark:bg-blue-900/30',
    'text-blue-600',

    // Gradient buttons
    'to-blue-500', 'hover:to-blue-600',

    // Day card borders (configurado)
    'border-gray-200', 'dark:border-slate-700',
    'hover:shadow-md',

    // Day card buttons (configurado)
    'border-indigo-100', 'dark:border-indigo-900/30',
    'border-red-100', 'dark:border-red-900/30',
    'text-red-500',
    'hover:bg-indigo-50', 'dark:hover:bg-indigo-900/20',
    'hover:bg-red-50', 'dark:hover:bg-red-900/20',

    // Day card buttons (vacío - atenuados)
    'border-indigo-100/50', 'dark:border-indigo-900/20',
    'border-red-100/50', 'dark:border-red-900/20',
    'text-indigo-300', 'text-red-200',
    'hover:text-indigo-600', 'hover:text-red-500',

    // Border red for delete buttons
    'border-red-200', 'dark:border-red-900/50',
    'hover:bg-red-900/10',

    // Inputs
    'pl-8', 'text-[10px]',

    // Grid
    'md:grid-cols-5',

    // Selector de curso en header
    'min-w-[200px]',

    // ===== EXCEPCIONES MODULE =====
    // Gradient button "Nueva Excepción" (indigo → cyan)
    'to-cyan-500', 'hover:opacity-90',
    'shadow-indigo-200',

    // Badge Global (indigo) - border
    'border-indigo-100', 'dark:border-indigo-800',

    // Badge Curso (orange) - NUEVO
    'bg-orange-50', 'text-orange-600', 'border-orange-100',
    'dark:bg-orange-900/30', 'dark:text-orange-400', 'dark:border-orange-800',

    // Tabla Excepciones
    'bg-slate-50/50', 'bg-slate-50/30',
    'divide-slate-100', 'dark:divide-slate-700',
    'text-[11px]', 'tracking-wider',
    'border-slate-100', 'dark:border-slate-700',

    // Botón eliminar
    'text-red-400', 'hover:text-red-600',
    'dark:text-red-500', 'dark:hover:text-red-400',

    // Paginación
    'border-slate-200', 'dark:border-slate-600',
    'hover:bg-white', 'disabled:opacity-50',

    // Texto Excepciones
    'text-slate-700', 'text-slate-600', 'text-slate-400', 'text-slate-500',
    'dark:text-slate-300', 'dark:text-slate-400', 'dark:text-slate-500',
    'text-slate-800', 'dark:text-white',

    // Footer
    'tracking-widest',

    // ===== COMUNICADOS MODULE =====
    // Info card (blue theme)
    'bg-blue-50', 'dark:bg-blue-900/20',
    'border-blue-100', 'dark:border-blue-800/50',
    'bg-blue-100', 'dark:bg-blue-800',
    'text-blue-600', 'dark:text-blue-300',
    'text-blue-900', 'dark:text-blue-200',
    'text-blue-700', 'dark:text-blue-400',

    // Template buttons
    'hover:bg-indigo-50', 'hover:border-indigo-200',
    'dark:hover:bg-indigo-900/30',

    // Form inputs with icons
    'pl-10', 'appearance-none',

    // Channel icons
    'text-green-500',  // WhatsApp

    // Gradient button "Enviar Comunicado" (indigo → blue)
    'to-blue-600', 'hover:to-blue-700',
    'hover:from-indigo-700',

    // Form footer
    'bg-gray-50', 'dark:bg-white/5',
    'hover:bg-gray-100', 'dark:hover:bg-gray-700',

    // Separators
    'border-gray-100', 'dark:border-gray-700',

    // ===== DISPOSITIVOS MODULE =====
    // KPI Cards border-left
    'border-l-green-500', 'border-l-orange-400', 'border-l-red-500',

    // KPI labels
    'text-4xl', 'tracking-wider',

    // Table headers (slate)
    'bg-slate-50', 'dark:bg-slate-800/50',
    'text-[11px]',

    // Table body
    'divide-slate-100', 'dark:divide-slate-800',
    'hover:bg-slate-50', 'dark:hover:bg-slate-800/30',
    'text-slate-700', 'dark:text-slate-200',

    // Device ID badge
    'border-slate-200', 'dark:border-slate-700',

    // Pendientes badge (circular)
    'w-8', 'h-8',

    // Battery/Status badges (orange)
    'bg-orange-100', 'text-orange-700',
    'dark:bg-orange-900/30', 'dark:text-orange-400',

    // Action buttons hover
    'hover:text-indigo-600', 'hover:bg-indigo-50', 'dark:hover:bg-indigo-900/30',
    'hover:text-blue-600', 'hover:bg-blue-50', 'dark:hover:bg-blue-900/30',
    'hover:text-red-600', 'hover:bg-red-50', 'dark:hover:bg-red-900/30',

    // Gradient button "Nuevo Dispositivo" (indigo → purple)
    'to-purple-600', 'hover:to-purple-700',

    // Pagination footer
    'bg-slate-50/50', 'dark:bg-slate-800/30',

    // ===== ALUMNOS MODULE =====
    // Filter section
    'min-w-[240px]', 'w-48',

    // Table divider
    'divide-slate-50',

    // Avatar
    'w-9', 'h-9',
    'border-indigo-100', 'dark:border-indigo-800',

    // Progress bar colors
    'bg-emerald-500', 'bg-amber-500',

    // Photo auth badge
    'text-[10px]',
    'text-green-600',

    // Action buttons
    'text-indigo-600', 'dark:text-indigo-400',
    'text-indigo-700',
    'text-blue-600', 'dark:text-blue-400',
    'text-slate-600', 'dark:text-slate-400',
    'text-red-400', 'hover:text-red-600',
    'dark:hover:text-red-300',

    // Icon size
    'text-[20px]',

    // Opacity transition
    'opacity-80', 'group-hover:opacity-100',

    // Gradient button (indigo)
    'from-indigo-500', 'to-indigo-600',
    'hover:from-indigo-600', 'hover:to-indigo-700',
    'shadow-indigo-200',

    // Status badge (slate for inactive)
    'bg-slate-100', 'text-slate-500',
    'dark:bg-slate-700',

    // ===== APODERADOS MODULE =====
    // Info card (indigo theme)
    'bg-indigo-50', 'dark:bg-indigo-900/20',
    'bg-indigo-100', 'dark:bg-indigo-800',
    'text-indigo-900', 'dark:text-indigo-200',
    'text-indigo-700/80', 'dark:text-indigo-300/80',

    // Filter grid
    'lg:col-span-4', 'lg:col-span-3', 'lg:col-span-2',

    // Student badge in table
    'text-indigo-700', 'dark:text-indigo-300',

    // Action buttons (purple for manage students)
    'hover:text-purple-600', 'hover:bg-purple-50',
    'dark:hover:text-purple-400', 'dark:hover:bg-purple-900/30',

    // Restore button
    'text-green-600', 'dark:text-green-400',
    'bg-green-50', 'dark:bg-green-900/30',
    'hover:bg-green-100', 'dark:hover:bg-green-900/50',
    'border-green-200', 'dark:border-green-800',

    // Gradient button (indigo → blue)
    'to-blue-600', 'hover:to-blue-700',

    // Icon size
    'text-[18px]',

    // Pagination text
    'disabled:cursor-not-allowed',

    // ===== PROFESORES MODULE =====
    // Info card (blue theme - uses same classes as COMUNICADOS)
    // 'bg-blue-50', 'dark:bg-blue-900/20', (already in COMUNICADOS)
    // 'border-blue-100', 'dark:border-blue-800', (already in COMUNICADOS)
    // 'text-blue-900', 'dark:text-blue-200', (already in COMUNICADOS)
    // 'text-blue-700', 'dark:text-blue-300', (already in COMUNICADOS)

    // Avatar colors (rotating)
    'bg-purple-50', 'text-purple-600',
    'dark:bg-purple-900/30', 'dark:text-purple-600',
    'bg-teal-50', 'text-teal-600',
    'dark:bg-teal-900/30', 'dark:text-teal-600', 'dark:text-teal-400',

    // Status badge with dot
    'w-1.5', 'h-1.5', 'mr-1.5',
    // emerald for active (already exists)
    // amber for on_leave (already exists)
    // slate for inactive (already exists)
    // red for deleted (already exists)

    // Avatar size
    'w-10', 'h-10',

    // Table row hover (gray version)
    'hover:bg-gray-50/50',

    // Gradient primary button (gradient pattern)
    'bg-primary-gradient',

    // Filter grid (md:col-span variants)
    'md:col-span-4', 'md:col-span-3', 'md:col-span-2', 'md:col-span-5',
    'md:grid-cols-12',

    // Pagination chevron buttons
    'p-1',

    // ===== AUSENCIAS MODULE =====
    // KPI Cards border-left
    'border-l-indigo-500', 'border-l-emerald-500', 'border-l-rose-400',

    // KPI text colors (rose)
    'text-rose-500', 'dark:text-rose-400',

    // Type badges (text-[11px] already exists)
    // emerald for vacation (already exists)
    // blue for family (already exists)
    // amber for medical (already exists)
    // gray for other (already exists)

    // Tabs gradient active
    'tab-active',

    // Avatar size 8x8 for absences
    // 'w-8', 'h-8', (already in DISPOSITIVOS)

    // Days subtext
    // 'text-[10px]', (already in HORARIOS)

    // Action buttons (emerald for approve)
    'text-emerald-500', 'hover:bg-emerald-50', 'dark:hover:bg-emerald-900/30',

    // Action buttons (orange for reject)
    // 'text-orange-400', (already in DISPOSITIVOS)
    'hover:bg-orange-50', 'dark:hover:bg-orange-900/30',

    // Action buttons (rose for delete)
    // 'text-rose-500', (added above)
    'hover:bg-rose-50', 'dark:hover:bg-rose-900/30',

    // Filter grid (6 columns)
    'md:col-span-2', 'lg:grid-cols-6',

    // Rounded custom
    'rounded-custom',

    // ===== NOTIFICACIONES MODULE =====
    // Stats cards border-top colors
    'border-t-4', 'border-purple-500',
    'text-purple-600', 'dark:text-purple-400',

    // Channel badges borders
    'border-emerald-100', 'dark:border-emerald-800',
    'border-blue-100', 'dark:border-blue-800',

    // Status badges (rose)
    'bg-rose-50', 'dark:bg-rose-900/30',
    'text-rose-600', 'dark:text-rose-400',
    'border-rose-200', 'dark:border-rose-800',
    'hover:bg-rose-50', 'dark:hover:bg-rose-900/30',

    // Message truncate
    'max-w-[120px]',

    // ===== BIOMETRIA MODULE =====
    // Info banner (indigo) - most classes already exist
    'text-indigo-900', 'dark:text-indigo-300',

    // Status card registered (emerald)
    'dark:bg-emerald-900/20',
    'text-emerald-900', 'dark:text-emerald-300',
    'text-emerald-700', 'dark:text-emerald-400',

    // Status card pending (orange)
    'dark:bg-orange-900/20',
    'text-orange-900', 'dark:text-orange-300',
    'text-orange-700', 'dark:text-orange-400',
    'bg-orange-500',

    // Delete button (red)
    'border-red-100', 'dark:border-red-800',
    'hover:bg-red-100', 'dark:hover:bg-red-900/30',

    // Grid layout
    'col-span-12', 'lg:col-span-8',

    // Student list height
    'h-[400px]',

    // Avatar/sensor sizes
    'w-20', 'h-20', 'w-32', 'h-32',

    // Fingerprint sensor gradients
    'from-indigo-100', 'to-indigo-200',
    'dark:from-indigo-900/50', 'dark:to-indigo-800/50',
    'border-indigo-400/50',

    // Sensor state gradients (waiting)
    'from-amber-100', 'to-amber-200',
    'dark:from-amber-900/50', 'dark:to-amber-800/50',

    // Sensor state gradients (reading)
    'from-blue-100', 'to-blue-200',
    'dark:from-blue-900/50', 'dark:to-blue-800/50',

    // Sensor state gradients (success)
    'from-emerald-100', 'to-emerald-200',
    'dark:from-emerald-900/50', 'dark:to-emerald-800/50',

    // Sensor state gradients (error)
    'from-red-100', 'to-red-200',
    'dark:from-red-900/50', 'dark:to-red-800/50',

    // Gradient direction
    'bg-gradient-to-br',

    // ===== AUTH REDESIGN 2026 =====
    // Gradient mesh background
    'bg-gradient-mesh',

    // Auth card
    'auth-card-new',
    'rounded-[2.5rem]',
    'shadow-2xl',

    // Role cards
    'role-card', 'role-icon',

    // Brand gradient button
    'bg-brand-gradient',
    'shadow-indigo-500/30',

    // Brand text colors
    'text-brand-blue', 'text-brand-darkblue', 'text-brand-purple',
    'dark:text-brand-blue', 'dark:text-brand-purple',
    'text-[#000080]',

    // Typography
    'tracking-tighter',
    'font-black',

    // Blur decorations
    'blur-decoration',
    'bg-primary/20', 'bg-purple-500/20', 'bg-indigo-500/20',

    // Auth inputs
    'auth-input',
    'focus:ring-primary/20',
    'focus:border-primary',

    // Buttons
    'py-3.5',
    'sm:w-1/3', 'sm:flex-1',
    'rounded-xl',

    // Dark mode borders
    'border-slate-200/50', 'border-slate-800/50',
    'dark:border-slate-700',
    'hover:border-primary',

    // Backgrounds with opacity
    'bg-slate-50/50', 'bg-slate-800/30',

    // Layout
    'max-w-[480px]',
    'space-y-4', 'space-y-5',
    'flex-grow',

    // Hover effects
    'group-hover:text-white', 'group-hover:text-primary',

    // Footer buttons
    'rounded-full',
    'hover:text-primary',

    // Role cards - new design
    'rounded-2xl',
    'gap-5', 'p-5',
    'w-14', 'h-14',
    'bg-indigo-100', 'bg-purple-100',
    'text-indigo-600', 'text-purple-600',
    'dark:text-indigo-400', 'dark:text-purple-400',
    'group-hover:bg-indigo-500', 'group-hover:bg-purple-500',
    'group-hover:text-indigo-600', 'group-hover:text-purple-600',
    'dark:group-hover:text-indigo-400', 'dark:group-hover:text-purple-400',
    'hover:text-indigo-500', 'hover:text-purple-500',
    'hover:border-sky-500',
    'border-indigo-200', 'dark:border-indigo-800',

    // Logo gradient
    'from-sky-500', 'to-purple-500',
    'bg-gradient-to-br',
    'rounded-lg',
    'w-3', 'h-3',

    // Passkey button
    'h-14',
    'bg-indigo-500/10', 'dark:bg-indigo-500/20',
    'hover:bg-indigo-500/20',

    // ===== PARENT MODULE REDESIGN 2026 =====
    // Background colors
    'bg-[#f8fafc]',
    'bg-indigo-50', 'bg-indigo-100', 'bg-indigo-600',
    'bg-purple-100', 'bg-purple-500',
    'bg-green-50', 'bg-green-100', 'bg-green-500',
    'bg-red-50', 'bg-red-100', 'bg-red-500',
    'bg-yellow-50', 'bg-yellow-100', 'bg-yellow-500',
    'bg-blue-50', 'bg-blue-100', 'bg-blue-500',
    'bg-pink-100',

    // Dark mode backgrounds
    'dark:bg-slate-900', 'dark:bg-slate-800',
    'dark:bg-indigo-900/30', 'dark:bg-indigo-800/30',
    'dark:bg-purple-900/30',
    'dark:bg-green-900/10', 'dark:bg-green-900/30', 'dark:bg-green-800/30',
    'dark:bg-red-900/10', 'dark:bg-red-900/30', 'dark:bg-red-800/30',
    'dark:bg-yellow-900/10', 'dark:bg-yellow-900/30', 'dark:bg-yellow-800/30',
    'dark:bg-blue-900/10', 'dark:bg-blue-800/30',
    'dark:bg-gray-700',

    // Text colors
    'text-indigo-600', 'text-indigo-400', 'text-indigo-900',
    'text-purple-600', 'text-purple-400',
    'text-green-600', 'text-green-400', 'text-green-700',
    'text-red-600', 'text-red-400', 'text-red-700',
    'text-yellow-600', 'text-yellow-400', 'text-yellow-700',
    'text-blue-600', 'text-blue-400',
    'text-pink-600', 'text-pink-400',
    'dark:text-indigo-400', 'dark:text-green-400', 'dark:text-red-400',
    'dark:text-yellow-400', 'dark:text-blue-400',

    // Border colors
    'border-green-100', 'border-red-100', 'border-yellow-100', 'border-blue-100',
    'dark:border-green-900/20', 'dark:border-red-900/20',
    'dark:border-yellow-900/20', 'dark:border-blue-900/20',
    'border-gray-100', 'border-gray-200',
    'dark:border-slate-700', 'dark:border-slate-800',

    // Gradient
    'bg-gradient-to-r', 'from-indigo-500', 'to-purple-600',
    'shadow-indigo-200', 'shadow-indigo-500/30',

    // Toggle switch (Tailwind peer approach)
    'peer', 'sr-only',
    'peer-checked:bg-indigo-600',
    'peer-checked:after:translate-x-full',
    "after:content-['']", 'after:absolute', 'after:top-[2px]', 'after:start-[2px]',
    'after:bg-white', 'after:rounded-full', 'after:h-4', 'after:w-4',
    'after:transition-all',
    'rtl:peer-checked:after:-translate-x-full',

    // Sizes and spacing
    'w-5', 'h-5', 'w-9', 'w-12', 'h-12', 'w-16',
    'text-[10px]',
    'pb-24',
    '-bottom-1', '-right-1',

    // Misc utilities
    'divide-y', 'divide-gray-100',
    'rounded-xl', 'rounded-full',
    'capitalize',
    'tracking-wide',
    'overflow-hidden',

    // Parent module responsive classes (layout + views)
    'md:flex-row', 'md:h-20', 'md:items-center', 'md:justify-end',
    'md:px-8', 'md:p-8', 'md:pb-8', 'md:gap-0', 'md:w-auto',
    'md:grid-cols-2', 'md:hidden', 'md:block', 'md:flex',
    'sm:inline',
    'flex-col', 'flex-shrink-0',
    'h-screen',
    'gap-4', 'gap-3',

    // Parent home specific
    'bg-indigo-500', 'bg-purple-500', 'bg-blue-500', 'bg-pink-500', 'bg-orange-500',
    'border-gray-50', 'dark:border-gray-800',
    'text-red-500', 'text-green-600', 'text-yellow-500', 'text-blue-500',
    'bg-red-100', 'text-red-700', 'dark:text-red-300',
    'bg-green-100', 'text-green-700', 'dark:text-green-300',
    'bg-yellow-100', 'text-yellow-700', 'dark:text-yellow-300',
    'bg-blue-100', 'text-blue-700', 'dark:text-blue-300',
    'shadow-indigo-200', 'dark:shadow-none',
    'hover:shadow-xl', 'hover:shadow-md',
    'hover:-translate-y-0.5',
    'group', 'group-hover:text-indigo-600',
  ],
  theme: {
    extend: {
      colors: {
        primary: "#6366f1",
        secondary: "#0ea5e9",
        brand: {
          blue: "#0ea5e9",
          darkblue: "#000080",
          purple: "#a855f7",
        },
        "background-light": "#f3f4f6",
        "background-dark": "#0f172a",
        "sidebar-dark": "#1e1b4b",
        "sidebar-hover": "#312e81",
        "card-light": "#ffffff",
        "card-dark": "#1e293b",
        "text-light": "#1f2937",
        "text-dark": "#e2e8f0",
        "muted-light": "#6b7280",
        "muted-dark": "#94a3b8",
        "border-light": "#e5e7eb",
        "border-dark": "#334155",
      },
      fontFamily: {
        display: ["Inter", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
  ],
};
