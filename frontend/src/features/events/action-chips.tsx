import { actionChipText } from './event-text'
import type { EventItem } from './schemas'

// "label: bug", "comment", "Slack"; failed ones are tinted and the status is in the tooltip.
export function ActionChips({ actions }: { actions: EventItem['actions'] }) {
  if (!actions.length) return <span className="no-match">No rule matched</span>
  return (
    <span className="chip-row">
      {actions.map((a, i) => (
        <span key={`${a.type}-${i}`} className="chip action-chip" data-status={a.status} title={`${actionChipText(a)} · ${a.status}`}>
          {actionChipText(a)}
        </span>
      ))}
    </span>
  )
}
