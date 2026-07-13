const en = {
  login: {
    subtitle: 'Sign in to your account',
    email: 'Email',
    password: 'Password',
    invalidCredentials: 'Invalid email or password',
    signingIn: 'Signing in…',
    signIn: 'Sign in',
  },
  nav: {
    signOut: 'Sign out',
  },
  home: {
    welcome: 'Welcome',
  },
  profile: {
    role: 'Role',
    jobTitle: 'Job title',
    account: 'Account',
  },
  comingSoon: {
    back: 'Back',
    label: 'Coming soon',
  },
  modules: {
    timeTracker: { label: 'Time Tracker', description: 'Log your hours' },
    calendar: { label: 'Calendar', description: 'Company events and holidays' },
    notes: { label: 'Notes', description: 'Quick personal notes' },
    clients: { label: 'Clients', description: 'Manage clients and contracts' },
    team: { label: 'Team', description: 'Manage employees and roles' },
    audit: { label: 'Audit Log', description: 'Track changes across the app' },
  },
  settings: {
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    language: 'Language',
  },
}

const es = {
  login: {
    subtitle: 'Inicia sesión en tu cuenta',
    email: 'Correo electrónico',
    password: 'Contraseña',
    invalidCredentials: 'Correo o contraseña incorrectos',
    signingIn: 'Iniciando sesión…',
    signIn: 'Iniciar sesión',
  },
  nav: {
    signOut: 'Cerrar sesión',
  },
  home: {
    welcome: 'Bienvenido',
  },
  profile: {
    role: 'Rol',
    jobTitle: 'Puesto',
    account: 'Cuenta',
  },
  comingSoon: {
    back: 'Volver',
    label: 'Próximamente',
  },
  modules: {
    timeTracker: { label: 'Fichaje', description: 'Registra tus horas' },
    calendar: { label: 'Calendario', description: 'Eventos y festivos de la empresa' },
    notes: { label: 'Notas', description: 'Notas personales rápidas' },
    clients: { label: 'Clientes', description: 'Gestiona clientes y contratos' },
    team: { label: 'Equipo', description: 'Gestiona empleados y roles' },
    audit: { label: 'Auditoría', description: 'Historial de cambios en la app' },
  },
  settings: {
    theme: 'Tema',
    light: 'Claro',
    dark: 'Oscuro',
    system: 'Sistema',
    language: 'Idioma',
  },
} satisfies typeof en

export const translations = { en, es }

export type Language = keyof typeof translations
