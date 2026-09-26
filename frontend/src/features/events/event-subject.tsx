import { subjectTitle } from './event-text'
import type { EventSummary } from './schemas'

// Two-line subject cell: the title, then a muted detail line (repo, author).
export function EventSubject({ summary, detail }: { summary: EventSummary; detail: string }) {
  return (
    <span className="event-subject">
      <span className="event-subject-title">{subjectTitle(summary)}</span>
      <span className="event-subject-detail">{detail}</span>
    </span>
  )
}
