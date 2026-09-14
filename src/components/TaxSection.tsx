import { PercentField } from './PercentField'
import { filingStatusForHousehold } from '../engine/people'
import type { TaxSettings } from '../engine/tax'
import type { PersonalInputs } from '../engine/types'

export interface TaxSectionProps {
  value: TaxSettings
  personal: PersonalInputs
  onChange: (value: TaxSettings) => void
}

const FILING_STATUS_LABELS = {
  single: 'Single',
  marriedFilingJointly: 'Married Filing Jointly',
}

export function TaxSection({ value, personal, onChange }: TaxSectionProps) {
  const filingStatus = filingStatusForHousehold(personal)

  return (
    <section className="card">
      <h2>Taxes</h2>
      <p className="section-hint">
        Federal brackets, the standard deduction, and long-term capital gains rates are 2026 figures, applied
        automatically — there's nothing to enter for those. Filing status is assumed from whether a spouse is
        set up under Personal: currently <strong>{FILING_STATUS_LABELS[filingStatus]}</strong>. State income tax
        varies enormously (some states have none), so it's a single flat rate you set yourself.
      </p>
      <div className="field-grid">
        <PercentField
          id="stateTaxRate"
          label="Flat state income tax rate"
          value={value.stateRate}
          onChange={(stateRate) => onChange({ ...value, stateRate })}
          hint="0% if your state has no income tax"
        />
      </div>
      <p className="section-hint">
        Withdrawals are grossed up so what's actually spendable, after this tax, still covers your spending
        need — not just an estimate on the side.
      </p>
    </section>
  )
}
