import { SliderField } from './SliderField'
import { personName } from '../engine/people'
import type { AppInputs } from '../state/appInputs'

export interface AdjustablePanelProps {
  inputs: AppInputs
  onChange: (inputs: AppInputs) => void
  /** Distinguishes this instance's element ids from another one rendered
   * simultaneously elsewhere in the DOM (e.g. the compact dashboard panel vs. the
   * one inside an expanded chart's overlay) — ids must stay unique per the HTML spec,
   * and duplicates silently break label association (for screen readers, and for
   * anything that looks an input up by its label). */
  idPrefix?: string
}

/**
 * The "what if" knobs — the inputs worth sliding to see how they move the charts,
 * as opposed to the one-time facts about your actual accounts (Setup). Kept right
 * alongside the results so a drag updates every chart immediately.
 */
export function AdjustablePanel({ inputs, onChange, idPrefix = '' }: AdjustablePanelProps) {
  const { personal, spending, socialSecurity, pensions } = inputs
  const hasSpouse = Boolean(personal.spouse)

  return (
    <section className="card adjustable-panel">
      <h2>Explore</h2>
      <p className="section-hint">Slide these to see how they change your plan. Account balances and other facts live under Account Setup.</p>

      <SliderField
        id={`${idPrefix}adj-retirementAge`}
        label="Retirement age"
        value={personal.retirementAge}
        onChange={(retirementAge) => onChange({ ...inputs, personal: { ...personal, retirementAge } })}
        min={personal.currentAge + 1}
        max={80}
      />
      <SliderField
        id={`${idPrefix}adj-horizonAge`}
        label="Plan-to age"
        value={personal.horizonAge}
        onChange={(horizonAge) => onChange({ ...inputs, personal: { ...personal, horizonAge } })}
        min={personal.retirementAge}
        max={105}
      />
      <SliderField
        id={`${idPrefix}adj-monthlySpend`}
        label="Monthly spend, excl. mortgage"
        value={spending.monthlySpendExclMortgage}
        onChange={(monthlySpendExclMortgage) => onChange({ ...inputs, spending: { ...spending, monthlySpendExclMortgage } })}
        min={0}
        max={20000}
        step={100}
        hint="Mortgage payment and escrow (property tax/insurance) are entered on the mortgage account, not here"
        prefix="$"
      />
      <SliderField
        id={`${idPrefix}adj-bridgeHealth`}
        label="Bridge-year health insurance, $/month"
        value={spending.bridgeHealthInsuranceMonthly}
        onChange={(bridgeHealthInsuranceMonthly) =>
          onChange({ ...inputs, spending: { ...spending, bridgeHealthInsuranceMonthly } })
        }
        min={0}
        max={4000}
        step={50}
        prefix="$"
      />
      <SliderField
        id={`${idPrefix}adj-medicareAge`}
        label="Medicare eligibility age"
        value={spending.medicareEligibilityAge}
        onChange={(medicareEligibilityAge) => onChange({ ...inputs, spending: { ...spending, medicareEligibilityAge } })}
        min={60}
        max={70}
      />
      {socialSecurity.map((entry) => {
        const ownerId = entry.ownerId ?? 'primary'
        return (
          <SliderField
            key={ownerId}
            id={`${idPrefix}adj-ssClaimingAge-${ownerId}`}
            label={hasSpouse ? `${personName(personal, ownerId)}: Social Security claiming age` : 'Social Security claiming age'}
            value={entry.claimingAge}
            onChange={(claimingAge) =>
              onChange({
                ...inputs,
                socialSecurity: socialSecurity.map((e) => (e === entry ? { ...e, claimingAge } : e)),
              })
            }
            min={62}
            max={70}
          />
        )
      })}
      {pensions.map((pension) => (
        <SliderField
          key={pension.id}
          id={`${idPrefix}adj-pension-${pension.id}`}
          label={
            hasSpouse
              ? `${pension.name} (${personName(personal, pension.ownerId ?? 'primary')}) start age`
              : `${pension.name} start age`
          }
          value={pension.startAge}
          onChange={(startAge) =>
            onChange({
              ...inputs,
              pensions: pensions.map((p) => (p.id === pension.id ? { ...p, startAge } : p)),
            })
          }
          min={55}
          max={70}
        />
      ))}
      <SliderField
        id={`${idPrefix}adj-numSimulations`}
        label="Monte Carlo simulations"
        value={inputs.numSimulations}
        onChange={(numSimulations) => onChange({ ...inputs, numSimulations })}
        min={100}
        max={5000}
        step={100}
      />
    </section>
  )
}
