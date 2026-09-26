import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChipInput } from './chip-input'
import {
  type ConditionField,
  type ConditionOp,
  type ConditionRow,
  FIELD_LABELS,
  fieldsFor,
  keyFor,
  OP_LABELS,
  opsFor,
  rowId,
} from './rule-form-values'
import type { RuleEvent } from './schemas'

interface Props {
  event: RuleEvent
  match: 'all' | 'any'
  rows: ConditionRow[]
  error?: string
  onMatch: (match: 'all' | 'any') => void
  onRows: (rows: ConditionRow[]) => void
}

const PLACEHOLDERS: Record<ConditionField, string> = {
  title: 'Add keyword',
  body: 'Add keyword',
  author: 'Add username',
  labels: 'Add label',
  branch: 'Add branch',
}

// IF card: match all/any, then one row per field + operator with its values.
export function ConditionEditor({ event, match, rows, error, onMatch, onRows }: Props) {
  const fields = fieldsFor(event)
  const visible = rows.filter((r) => fields.includes(r.field))
  const used = new Set(visible.map((r) => keyFor(r.field, r.op)))

  const update = (id: string, change: Partial<ConditionRow>) =>
    onRows(rows.map((r) => (r.id === id ? { ...r, ...change } : r)))

  function addRow() {
    // Next field + operator pair not in use yet, so a new row never duplicates one.
    const next = fields.flatMap((f) => opsFor(f).map((op) => ({ field: f, op }))).find((k) => !used.has(keyFor(k.field, k.op)))
    const pick = next ?? { field: fields[0], op: opsFor(fields[0])[0] }
    onRows([...rows, { id: rowId(), ...pick, values: [] }])
  }

  return (
    <section className="panel editor-card" aria-labelledby="rule-if">
      <div className="editor-card-head">
        <span className="step-badge">IF</span>
        <h2 id="rule-if" className="section-title">
          Match
        </h2>
        <Select value={match} onValueChange={(v) => onMatch(v as 'all' | 'any')}>
          <SelectTrigger size="sm" className="match-select" aria-label="Match all or any">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">all</SelectItem>
              <SelectItem value="any">any</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="muted-text">of these conditions</span>
      </div>

      {visible.length === 0 && <p className="muted-text">No conditions: the rule matches every event of this type.</p>}

      <div className="condition-rows">
        {visible.map((row, i) => (
          <div key={row.id} className="condition-row">
            <Select
              value={row.field}
              onValueChange={(f) => f && update(row.id, { field: f as ConditionField, op: opsFor(f as ConditionField)[0] })}
            >
              <SelectTrigger className="condition-select" aria-label={`Condition ${i + 1} field`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {fields.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FIELD_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {/* Keyed by field: Radix reports '' when the option list changes under it, which would drop the row. */}
            <Select key={row.field} value={row.op} onValueChange={(op) => op && update(row.id, { op: op as ConditionOp })}>
              <SelectTrigger className="condition-select" aria-label={`Condition ${i + 1} operator`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {opsFor(row.field).map((op) => (
                    <SelectItem key={op} value={op}>
                      {OP_LABELS[op]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <ChipInput
              values={row.values}
              onChange={(values) => update(row.id, { values })}
              placeholder={PLACEHOLDERS[row.field]}
              label={`Condition ${i + 1} values`}
              invalid={Boolean(error)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove condition ${i + 1}`}
              onClick={() => onRows(rows.filter((r) => r.id !== row.id))}
            >
              <X />
            </Button>
          </div>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="condition-footer">
        <Button type="button" variant="ghost" size="sm" onClick={addRow}>
          <Plus />
          Add condition
        </Button>
        <span className="hint-text">
          Fields: {fields.map((f) => FIELD_LABELS[f].toLowerCase()).join(', ')}. Keywords are case-insensitive.
        </span>
      </div>
    </section>
  )
}
