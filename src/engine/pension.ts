import type { PersonId } from './types'

export interface FersPensionInputs {
  id: string
  name: string
  type: 'fers'
  /** Who this pension belongs to — defaults to the primary person when omitted. */
  ownerId?: PersonId
  /** High-3 average salary. */
  high3Salary: number
  /** Years of service. */
  yearsOfService: number
  /** Annuity multiplier, e.g. 0.01 for a FERS-style 1% multiplier. */
  annuityMultiplier: number
  /** Chosen pension start age. */
  startAge: number
}

export interface FixedPensionInputs {
  id: string
  name: string
  type: 'fixed'
  /** Who this pension belongs to — defaults to the primary person when omitted. */
  ownerId?: PersonId
  /** Flat monthly benefit, starting at `startAge` and continuing for life — no
   * formula, no early-start reduction. Covers most private pensions and annuities. */
  monthlyBenefit: number
  startAge: number
}

/** A single pension or annuity: either a FERS-style high-3 formula benefit, or a flat
 * fixed monthly amount (most private pensions and annuities). A plan can have several
 * — see `totalPensionIncomeForAge`. */
export type PensionInputs = FersPensionInputs | FixedPensionInputs

/** Annual pension if started at age 62 (the unreduced age for a FERS-style benefit). */
export function unreducedAnnualPension(pension: FersPensionInputs): number {
  return pension.high3Salary * pension.yearsOfService * pension.annuityMultiplier
}

/** Reduction fraction for starting a FERS-style pension before 62: 5% per year early. */
export function pensionReductionFactor(pension: FersPensionInputs): number {
  return Math.max(0, 62 - pension.startAge) * 0.05
}

/** Annual FERS-style pension after the early-start reduction is applied. */
export function annualPensionAfterReduction(pension: FersPensionInputs): number {
  return unreducedAnnualPension(pension) * (1 - pensionReductionFactor(pension))
}

/** The annual benefit this pension pays once started, regardless of type. */
export function annualPensionAmount(pension: PensionInputs): number {
  return pension.type === 'fers' ? annualPensionAfterReduction(pension) : pension.monthlyBenefit * 12
}

/** Annual income from a single pension at a given age: its annual benefit once the
 * start age is reached, otherwise 0. */
export function pensionIncomeForAge(age: number, pension: PensionInputs): number {
  return age >= pension.startAge ? annualPensionAmount(pension) : 0
}

/** Combined annual income from every pension/annuity, each evaluated against its own
 * owner's age via `ageForOwner` (see `people.ts`) rather than one household age. */
export function totalPensionIncomeForAge(
  ageForOwner: (ownerId: PersonId) => number,
  pensions: PensionInputs[],
): number {
  return pensions.reduce(
    (total, pension) => total + pensionIncomeForAge(ageForOwner(pension.ownerId ?? 'primary'), pension),
    0,
  )
}
