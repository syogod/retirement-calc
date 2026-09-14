import type { PersonId } from './types'

export interface SocialSecurityInputs {
  /** Whose benefit this is — defaults to the primary person when omitted. A
   * household can have up to one entry per person. */
  ownerId?: PersonId
  /** Monthly benefit if claimed at 62, from the SSA statement. */
  monthlyBenefitAt62: number
  /** Monthly benefit if claimed at 67 (full retirement age). */
  monthlyBenefitAt67: number
  /** Monthly benefit if claimed at 70. */
  monthlyBenefitAt70: number
  /** Chosen claiming age, 62-70. */
  claimingAge: number
  /** Haircut multiplier for stopping work before the claiming age, e.g. 0.9 for a 10% reduction. */
  haircut: number
}

/** Monthly benefit at the chosen claiming age, linearly interpolated between the three
 * SSA-provided benchmark ages (62, 67, 70), before the haircut is applied. */
export function socialSecurityMonthlyBenefit(inputs: SocialSecurityInputs): number {
  const { monthlyBenefitAt62: b62, monthlyBenefitAt67: b67, monthlyBenefitAt70: b70, claimingAge } =
    inputs

  if (claimingAge <= 62) return b62
  if (claimingAge < 67) return b62 + ((b67 - b62) * (claimingAge - 62)) / 5
  if (claimingAge === 67) return b67
  if (claimingAge < 70) return b67 + ((b70 - b67) * (claimingAge - 67)) / 3
  return b70
}

/** Annual Social Security benefit at the claiming age, after the haircut. */
export function socialSecurityAnnualBenefit(inputs: SocialSecurityInputs): number {
  return 12 * socialSecurityMonthlyBenefit(inputs) * inputs.haircut
}

/** Annual Social Security income received at a given age: the benefit once the
 * claiming age is reached, otherwise 0. */
export function socialSecurityIncomeForAge(age: number, inputs: SocialSecurityInputs): number {
  return age >= inputs.claimingAge ? socialSecurityAnnualBenefit(inputs) : 0
}

/** Combined Social Security income across every household member's benefit, each
 * evaluated against its own owner's age via `ageForOwner` (see `people.ts`). */
export function totalSocialSecurityIncomeForAge(
  ageForOwner: (ownerId: PersonId) => number,
  entries: SocialSecurityInputs[],
): number {
  return entries.reduce(
    (total, entry) => total + socialSecurityIncomeForAge(ageForOwner(entry.ownerId ?? 'primary'), entry),
    0,
  )
}
