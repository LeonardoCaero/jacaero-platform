import { Clock, Calendar, StickyNote, Building2, Users, ShieldCheck, type LucideIcon } from 'lucide-react'

export type Module = {
  path: string
  label: string
  description: string
  icon: LucideIcon
  permission: string
  primary?: boolean
}

export const modules: Module[] = [
  {
    path: '/time-tracker',
    label: 'Time Tracker',
    description: 'Log your hours',
    icon: Clock,
    permission: 'TIME:CREATE_OWN',
    primary: true,
  },
  {
    path: '/calendar',
    label: 'Calendar',
    description: 'Company events and holidays',
    icon: Calendar,
    permission: 'CALENDAR:VIEW',
  },
  {
    path: '/notes',
    label: 'Notes',
    description: 'Quick personal notes',
    icon: StickyNote,
    permission: 'NOTES:CREATE',
  },
  {
    path: '/clients',
    label: 'Clients',
    description: 'Manage clients and contracts',
    icon: Building2,
    permission: 'CLIENTS:MANAGE',
  },
  {
    path: '/team',
    label: 'Team',
    description: 'Manage employees and roles',
    icon: Users,
    permission: 'USERS:MANAGE',
  },
  {
    path: '/audit',
    label: 'Audit Log',
    description: 'Track changes across the app',
    icon: ShieldCheck,
    permission: 'AUDIT:VIEW',
  },
]
