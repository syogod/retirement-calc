import { NumberField } from './NumberField'
import { PercentField } from './PercentField'
import type { PensionInputs } from '../engine/pension'
import { personName } from '../engine/people'
import type { PersonalInputs, PersonId } from '../engine/types'
import { createBlankPension } from '../state/appInputs'

export interface PensionsSectionProps {
  pensions: PensionInputs[]
  personal: PersonalInputs
  onChange: (pensions: PensionInputs[]) => void
}

export function PensionsSection({ pensions, personal, onChange }: PensionsSectionProps) {
  const hasSpouse = Boolean(personal.spouse)
  function updatePension(id: string, patch: Partial<PensionInputs>) {
    onChange(
      pensions.map((pension) => (pension.id === id ? ({ ...pension, ...patch } as PensionInputs) : pension)),
    )
  }

  function switchType(id: string, type: PensionInputs['type']) {
    const current = pensions.find((pension) => pension.id === id)
    if (!current) return
    const replacement: PensionInputs =
      type === 'fers'
        ? {
            id,
            name: current.name,
            type: 'fers',
            ownerId: current.ownerId,
            high3Salary: 0,
            yearsOfService: 0,
            annuityMultiplier: 0.01,
            startAge: current.startAge,
          }
        : { id, name: current.name, type: 'fixed', ownerId: current.ownerId, monthlyBenefit: 0, startAge: current.startAge }
    onChange(pensions.map((pension) => (pension.id === id ? replacement : pension)))
  }

  function removePension(id: string) {
    onChange(pensions.filter((pension) => pension.id !== id))
  }

  function addPension() {
    onChange([...pensions, createBlankPension()])
  }

  return (
    <section className="card">
      <h2>Pensions &amp; Annuities</h2>
      <p className="section-hint">
        Any defined-benefit pension or annuity that pays a set income starting at some age — a federal FERS
        pension, a former employer's pension, or a purchased annuity. Add one row per source. Each pension's
        start age is a "what if" knob — find it in Explore.
      </p>
      <div className="accounts-list">
        {pensions.map((pension) => (
          <div className="account-row" key={pension.id}>
            <label className="field account-name">
              <span className="field-label">Name</span>
              <input
                type="text"
                value={pension.name}
                onChange={(event) => updatePension(pension.id, { name: event.target.value })}
              />
            </label>

            <label className="field account-type">
              <span className="field-label">Type</span>
              <select value={pension.type} onChange={(event) => switchType(pension.id, event.target.value as PensionInputs['type'])}>
                <option value="fers">FERS-style (high-3 formula)</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>

            {hasSpouse && (
              <label className="field">
                <span className="field-label">Owner</span>
                <select
                  value={pension.ownerId ?? 'primary'}
                  onChange={(event) => updatePension(pension.id, { ownerId: event.target.value as PersonId })}
                >
                  <option value="primary">{personName(personal, 'primary')}</option>
                  <option value="spouse">{personName(personal, 'spouse')}</option>
                </select>
              </label>
            )}

            {pension.type === 'fers' ? (
              <>
                <NumberField
                  id={`high3-${pension.id}`}
                  label="High-3 average salary"
                  value={pension.high3Salary}
                  onChange={(high3Salary) => updatePension(pension.id, { high3Salary })}
                  prefix="$"
                />
                <NumberField
                  id={`years-${pension.id}`}
                  label="Years of service"
                  value={pension.yearsOfService}
                  onChange={(yearsOfService) => updatePension(pension.id, { yearsOfService })}
                  step={0.01}
                />
                <PercentField
                  id={`multiplier-${pension.id}`}
                  label="Annuity multiplier"
                  value={pension.annuityMultiplier}
                  onChange={(annuityMultiplier) => updatePension(pension.id, { annuityMultiplier })}
                  step={0.01}
                  hint="Start age (5%/year reduction before 62) is in Explore"
                />
              </>
            ) : (
              <>
                <NumberField
                  id={`monthly-${pension.id}`}
                  label="Monthly benefit"
                  value={pension.monthlyBenefit}
                  onChange={(monthlyBenefit) => updatePension(pension.id, { monthlyBenefit })}
                  prefix="$"
                  hint="Start age is in Explore"
                />
              </>
            )}

            <button
              type="button"
              className="remove-button"
              onClick={() => removePension(pension.id)}
              aria-label={`Remove ${pension.name}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="add-button" onClick={addPension}>
        + Add pension
      </button>
    </section>
  )
}
