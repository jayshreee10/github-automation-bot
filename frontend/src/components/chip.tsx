// Small grey tag for action names, event types and keywords, e.g. "label: bug".
export function Chip({ mono, children }: { mono?: boolean; children: React.ReactNode }) {
  return (
    <span className="chip" data-mono={mono || undefined}>
      {children}
    </span>
  )
}
