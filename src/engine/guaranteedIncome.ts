import { totalPensionIncomeForAge, type PensionInputs } from './pension'
import { totalSocialSecurityIncomeForAge, type SocialSecurityInputs } from './socialSecurity'
import type { PersonId } from './types'

/** Total guaranteed (non-portfolio) income at a given age: all pensions/annuities plus
 * Social Security, each resolved against its own owner's age via `ageForOwner`
 * (see `people.ts`) rather than one household age. */
export function totalGuaranteedIncomeForAge(
  ageForOwner: (ownerId: PersonId) => number,
  pensions: PensionInputs[],
  socialSecurity: SocialSecurityInputs[],
): number {
  return (
    totalPensionIncomeForAge(ageForOwner, pensions) + totalSocialSecurityIncomeForAge(ageForOwner, socialSecurity)
  )
}
