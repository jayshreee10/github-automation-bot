import { Bell, Bot, CircleAlert, MessageSquare, Tag } from 'lucide-react'

const ICONS = { add_label: Tag, add_comment: MessageSquare, slack_notify: Bell, ai_triage: Bot }

// Icon per action type; a job-level failure (no action to blame) gets an alert icon.
export function ActionIcon({ type }: { type: keyof typeof ICONS | null }) {
  const Icon = type ? ICONS[type] : CircleAlert
  return <Icon className="failure-action-icon" aria-hidden />
}
