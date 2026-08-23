import {
  Clock,
  Calendar,
  StickyNote,
  Building2,
  Users,
  ShieldCheck,
  FolderKanban,
  type LucideIcon,
} from 'lucide-react'

export type ModuleKey = 'timeTracker' | 'calendar' | 'notes' | 'clients' | 'team' | 'audit' | 'papeleo'

export type Module = {
  key: ModuleKey
  path: string
  icon: LucideIcon
  permission: string
  primary?: boolean
}

export const modules: Module[] = [
  { key: 'timeTracker', path: '/time-tracker', icon: Clock, permission: 'TIME:CREATE_OWN', primary: true },
  { key: 'calendar', path: '/calendar', icon: Calendar, permission: 'CALENDAR:VIEW' },
  { key: 'notes', path: '/notes', icon: StickyNote, permission: 'NOTES:CREATE' },
  { key: 'clients', path: '/clients', icon: Building2, permission: 'CLIENTS:MANAGE' },
  { key: 'team', path: '/team', icon: Users, permission: 'USERS:MANAGE' },
  { key: 'papeleo', path: '/papeleo', icon: FolderKanban, permission: 'ORDERS:MANAGE' },
  { key: 'audit', path: '/audit', icon: ShieldCheck, permission: 'AUDIT:VIEW' },
]
