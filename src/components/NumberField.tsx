import { useEffect, useState } from 'react'

export interface NumberFieldProps {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  prefix?: string
  suffix?: string
  hint?: string
  hintTone?: 'muted' | 'warning'
}

/**
 * A controlled numeric input that keeps its own draft text so the user can type
 * intermediate states ("-", "1.", "") without the field snapping back to a formatted
 * number on every keystroke. Only calls `onChange` once the draft parses to a valid
 * number.
 */
export function NumberField({ id, label, value, onChange, step, min, prefix, suffix, hint, hintTone = 'muted' }: NumberFieldProps) {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    const parsed = Number.parseFloat(text)
    if (parsed !== value) setText(String(value))
    // Only resync from `value` when it changed for a reason other than this field's
    // own last edit (e.g. loading a different account) — see the comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <span className="field-input-wrap">
        {prefix && <span className="field-affix">{prefix}</span>}
        <input
          id={id}
          type="number"
          step={step}
          min={min}
          value={text}
          onChange={(event) => {
            const raw = event.target.value
            setText(raw)
            const parsed = Number.parseFloat(raw)
            if (!Number.isNaN(parsed)) onChange(parsed)
          }}
        />
        {suffix && <span className="field-affix">{suffix}</span>}
      </span>
      {hint && (
        <span className={hintTone === 'warning' ? 'field-hint status-icon status-icon--warning' : 'field-hint'}>
          {hintTone === 'warning' ? <>&#9888; {hint}</> : hint}
        </span>
      )}
    </label>
  )
}
