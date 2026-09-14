import { PercentField } from './PercentField'
import type { GrowthInputs } from '../engine/types'

export interface GrowthSectionProps {
  value: GrowthInputs
  onChange: (value: GrowthInputs) => void
}

export function GrowthSection({ value, onChange }: GrowthSectionProps) {
  const realReturn = (1 + value.nominalReturn) / (1 + value.inflation) - 1

  return (
    <section className="card">
      <h2>Growth &amp; Inflation</h2>
      <div className="field-grid">
        <PercentField
          id="nominalReturn"
          label="Assumed nominal investment return"
          value={value.nominalReturn}
          onChange={(nominalReturn) => onChange({ ...value, nominalReturn })}
        />
        <PercentField
          id="inflation"
          label="Assumed inflation rate"
          value={value.inflation}
          onChange={(inflation) => onChange({ ...value, inflation })}
        />
      </div>
      <p className="computed-note">
        Real return used for every account: <strong>{(realReturn * 100).toFixed(2)}%</strong>
      </p>
    </section>
  )
}
