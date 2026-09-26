const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

// "just now", "3 minutes ago", "yesterday" — coarse on purpose; the exact time is in the title attribute.
export function timeAgo(iso: string, now = Date.now()): string {
  const secs = Math.round((Date.parse(iso) - now) / 1000)
  for (const [unit, size] of UNITS) {
    if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit)
  }
  return 'just now'
}

const SHORT: [string, number][] = [
  ['d', 86_400],
  ['h', 3_600],
  ['m', 60],
]

// Compact age for tables: "12s", "3m", "2h", "4d". Future times count as 0s.
export function shortAge(iso: string, now = Date.now()): string {
  const secs = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  for (const [unit, size] of SHORT) if (secs >= size) return `${Math.floor(secs / size)}${unit}`
  return `${secs}s`
}

// "in 38s", "in 2m"; "now" once the time has passed.
export function shortUntil(iso: string, now = Date.now()): string {
  const secs = Math.round((Date.parse(iso) - now) / 1000)
  return secs <= 0 ? 'now' : `in ${shortAge(new Date(now).toISOString(), now + secs * 1000)}`
}

// Wall-clock time of day, 24h: "10:42:08".
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour12: false })
}
