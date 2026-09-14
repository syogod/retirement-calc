import type { GuardrailsSettings } from '../engine/guardrails'
import type { OneTimeEvent } from '../engine/oneTimeEvents'
import type { PensionInputs } from '../engine/pension'
import type { RmdSurplusSettings } from '../engine/rmd'
import type { SocialSecurityInputs } from '../engine/socialSecurity'
import type { SpendingInputs } from '../engine/spending'
import type { TaxSettings } from '../engine/tax'
import type { Account, GrowthInputs, PersonalInputs, PersonId } from '../engine/types'

/** Everything the app needs to run both the deterministic projection and Monte Carlo. */
export interface AppInputs {
  personal: PersonalInputs
  growth: GrowthInputs
  accounts: Account[]
  spending: SpendingInputs
  pensions: PensionInputs[]
  socialSecurity: SocialSecurityInputs[]
  taxes: TaxSettings
  rmdSurplus: RmdSurplusSettings
  oneTimeEvents: OneTimeEvent[]
  guardrails: GuardrailsSettings
  numSimulations: number
}

function makeId(): string {
  return crypto.randomUUID()
}

/**
 * A clean slate — no accounts, no pensions, no personal financial figures. Opens
 * blank every time (there's no browser storage; see PLAN.md), so nothing here should
 * ever be a real person's data. Growth/simulation-count defaults are generic
 * assumptions, not financial facts, so those stay at reasonable non-zero values.
 * Use `createDemoInputs()` (demoInputs.ts) for a filled-in example that exercises
 * every feature, or "Load from file" for your own saved plan.
 */
export function createDefaultInputs(): AppInputs {
  return {
    personal: { currentAge: 30, retirementAge: 65, horizonAge: 90, currentYear: new Date().getFullYear() },
    growth: { nominalReturn: 0.07, inflation: 0.03 },
    accounts: [],
    spending: { monthlySpendExclMortgage: 0, bridgeHealthInsuranceMonthly: 0, medicareEligibilityAge: 65 },
    pensions: [],
    socialSecurity: [
      { ownerId: 'primary', monthlyBenefitAt62: 0, monthlyBenefitAt67: 0, monthlyBenefitAt70: 0, claimingAge: 67, haircut: 1 },
    ],
    taxes: { stateRate: 0 },
    rmdSurplus: { strategy: 'spend' },
    oneTimeEvents: [],
    // Guyton-Klinger's classic 20%-wide guardrails / 10% adjustment, ready to go
    // the moment someone switches the strategy to "guardrails" — not applied at
    // all under the default "fixed" strategy.
    guardrails: { strategy: 'fixed', upperGuardrailPct: 0.2, cutPct: 0.1, lowerGuardrailPct: 0.2, raisePct: 0.1 },
    numSimulations: 1000,
  }
}

export function createBlankOneTimeEvent(): OneTimeEvent {
  return { id: makeId(), name: 'New event', age: 65, amount: -10000 }
}

/** A default Social Security entry for the given person — same shape used for the
 * primary person by `createDefaultInputs`, exposed so the UI can add a spouse's
 * entry on demand. */
export function createBlankSocialSecurity(ownerId: PersonId): SocialSecurityInputs {
  return { ownerId, monthlyBenefitAt62: 0, monthlyBenefitAt67: 0, monthlyBenefitAt70: 0, claimingAge: 67, haircut: 1 }
}

export function createBlankAccount(): Account {
  return { id: makeId(), name: 'New account', type: 'taxable', balance: 0, annualContribution: 0 }
}

export function createBlankPension(): PensionInputs {
  return { id: makeId(), name: 'New pension', type: 'fixed', monthlyBenefit: 0, startAge: 65 }
}
