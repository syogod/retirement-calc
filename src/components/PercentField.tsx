import { NumberField } from './NumberField'

export interface PercentFieldProps {
  id: string
  label: string
  /** Stored as a fraction (0.07 for 7%); displayed and edited as a percent. */
  value: number
  onChange: (value: number) => void
  step?: number
  hint?: string
}

export function PercentField({ id, label, value, onChange, step = 0.1, hint }: PercentFieldProps) {
  return (
    <NumberField
      id={id}
      label={label}
      value={roundAwayFloatDust(value * 100)}
      onChange={(percent) => onChange(percent / 100)}
      step={step}
      suffix="%"
      hint={hint}
    />
  )
}

/** `0.07 * 100` is `7.000000000000001` in floating point — round off dust past a
 * precision no one would type anyway, purely for display. */
function roundAwayFloatDust(value: number): number {
  return Math.round(value * 1e9) / 1e9
}
