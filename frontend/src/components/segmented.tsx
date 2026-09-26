export interface Segment<T extends string> {
  value: T
  label: string
  count?: number
}

interface Props<T extends string> {
  label: string
  value: T
  options: Segment<T>[]
  onChange: (value: T) => void
}

// Pill-style filter tabs ("All · Issues · Pull requests"). A radio group, so arrow keys are not needed for a11y.
export function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="segment"
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && <span className="segment-count">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}
