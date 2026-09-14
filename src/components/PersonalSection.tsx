import { NumberField } from './NumberField'
import type { PersonalInputs } from '../engine/types'

export interface PersonalSectionProps {
  value: PersonalInputs
  onChange: (value: PersonalInputs) => void
}

/** Just the facts (current age, current year, household members) — retirement age
 * and plan-to age are "what if" knobs that live in the Explore panel instead,
 * alongside the charts. */
export function PersonalSection({ value, onChange }: PersonalSectionProps) {
  function toggleSpouse(hasSpouse: boolean) {
    onChange({ ...value, spouse: hasSpouse ? { name: 'Spouse', currentAge: value.currentAge } : undefined })
  }

  return (
    <section className="card">
      <h2>Personal</h2>
      <div className="field-grid">
        <label className="field">
          <span className="field-label">Your name</span>
          <input
            type="text"
            value={value.name ?? ''}
            placeholder="You"
            onChange={(event) => onChange({ ...value, name: event.target.value })}
          />
        </label>
        <NumberField
          id="currentAge"
          label="Current age"
          value={value.currentAge}
          onChange={(currentAge) => onChange({ ...value, currentAge })}
        />
        <NumberField
          id="currentYear"
          label="Current calendar year"
          value={value.currentYear}
          onChange={(currentYear) => onChange({ ...value, currentYear })}
        />
      </div>

      <label className="field-checkbox">
        <input type="checkbox" checked={Boolean(value.spouse)} onChange={(event) => toggleSpouse(event.target.checked)} />
        <span>Add a spouse or partner</span>
      </label>

      {value.spouse && (
        <div className="field-grid">
          <label className="field">
            <span className="field-label">Spouse's name</span>
            <input
              type="text"
              value={value.spouse.name}
              onChange={(event) => onChange({ ...value, spouse: { ...value.spouse!, name: event.target.value } })}
            />
          </label>
          <NumberField
            id="spouseCurrentAge"
            label="Spouse's current age"
            value={value.spouse.currentAge}
            onChange={(currentAge) => onChange({ ...value, spouse: { ...value.spouse!, currentAge } })}
          />
        </div>
      )}
      {value.spouse && (
        <p className="section-hint">
          Retirement age, spending, and mortgage timing stay one shared household plan — only Required Minimum
          Distributions, catch-up contribution limits, and Social Security use each person's own age.
        </p>
      )}
    </section>
  )
}
