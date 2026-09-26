import { X } from 'lucide-react'
import { useState } from 'react'

interface Props {
  values: string[]
  onChange: (values: string[]) => void
  placeholder: string
  label: string
  invalid?: boolean
  disabled?: boolean
}

// Tag-style input: Enter or comma adds, Backspace on an empty box removes the last, × removes one.
export function ChipInput({ values, onChange, placeholder, label, invalid, disabled }: Props) {
  const [draft, setDraft] = useState('')

  function commit(text: string) {
    const added = text
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !values.includes(s))
    if (added.length) onChange([...values, ...added])
    setDraft('')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="chip-input" data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
      {values.map((v) => (
        <span key={v} className="chip-input-chip">
          {v}
          <button
            type="button"
            className="chip-input-remove"
            aria-label={`Remove ${v}`}
            disabled={disabled}
            onClick={() => onChange(values.filter((x) => x !== v))}
          >
            <X />
          </button>
        </span>
      ))}
      <input
        className="chip-input-field"
        value={draft}
        placeholder={values.length ? '' : placeholder}
        aria-label={label}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onChange={(e) => (e.target.value.includes(',') ? commit(e.target.value) : setDraft(e.target.value))}
        onKeyDown={onKeyDown}
        onBlur={() => draft.trim() && commit(draft)}
      />
    </div>
  )
}
