import type { Tone } from '@/lib/status'
import type { AppInfo } from './schemas'

const PERMISSION_NAMES: Record<string, string> = {
  issues: 'Issues',
  pull_requests: 'Pull requests',
  metadata: 'Metadata',
  contents: 'Contents',
}

// Shown first, in this order; anything else GitHub returns follows alphabetically.
const ORDER = ['issues', 'pull_requests', 'metadata', 'contents']

export const EVENT_NOTES: Record<string, string> = {
  issues: 'opened, closed, labeled',
  pull_request: 'opened, closed',
  push: 'all branches',
}

export interface PermissionRow {
  key: string
  name: string
  access: string
  tone: Tone
}

function describe(level: string | undefined): { access: string; tone: Tone } {
  if (level === 'write' || level === 'admin') return { access: 'Read & write', tone: 'outline' }
  if (level === 'read') return { access: 'Read', tone: 'muted' }
  return { access: 'No access', tone: 'muted' }
}

// Contents is always listed, so users can see the bot never reads code (unless GitHub says otherwise).
export function permissionRows(permissions: AppInfo['permissions']): PermissionRow[] {
  const keys = new Set([...Object.keys(permissions), 'contents'])
  const sorted = [...keys].sort((a, b) => {
    const ia = ORDER.indexOf(a)
    const ib = ORDER.indexOf(b)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return a.localeCompare(b)
  })
  return sorted.map((key) => ({
    key,
    name: PERMISSION_NAMES[key] ?? key.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase()),
    ...describe(permissions[key]),
  }))
}
