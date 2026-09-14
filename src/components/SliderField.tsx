export interface SliderFieldProps {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  prefix?: string
  suffix?: string
  hint?: string
}

/** A range slider paired with a small editable number box showing the exact value —
 * built for exploring "what if" inputs quickly, without losing the ability to type an
 * exact number. */
export function SliderField({ id, label, value, onChange, min, max, step = 1, prefix, suffix, hint }: SliderFieldProps) {
  return (
    <div className="slider-field">
      <div className="slider-field-header">
        <label htmlFor={id}>{label}</label>
        <span className="slider-field-input-wrap">
          {prefix && <span className="field-affix">{prefix}</span>}
          <input
            id={id}
            type="number"
            className="slider-field-number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(event) => {
              const parsed = Number.parseFloat(event.target.value)
              if (!Number.isNaN(parsed)) onChange(parsed)
            }}
          />
          {suffix && <span className="field-affix">{suffix}</span>}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        className="slider-field-range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}
