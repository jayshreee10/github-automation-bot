import type { Tone } from '@/lib/status'

// One pill style for every status; the colour comes from data-tone in the CSS.
export function StatusBadge({ tone, title, children }: { tone: Tone; title?: string; children: React.ReactNode }) {
  return (
    <span className="status-badge" data-tone={tone} title={title}>
      {children}
    </span>
  )
}
