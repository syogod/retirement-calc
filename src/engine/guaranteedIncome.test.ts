import { describe, expect, it } from 'vitest'
import { totalGuaranteedIncomeForAge } from './guaranteedIncome'
import type { PensionInputs } from './pension'
import type { SocialSecurityInputs } from './socialSecurity'

// Pension starts at 60 ($9,995.9706/yr), Social Security claimed at 67 ($38,880/yr).
const pensions: PensionInputs[] = [
  {
    id: 'p1',
    name: 'FERS Pension',
    type: 'fers',
    high3Salary: 98000,
    yearsOfService: 11.3333,
    annuityMultiplier: 0.01,
    startAge: 60,
  },
]
const socialSecurity: SocialSecurityInputs[] = [
  {
    monthlyBenefitAt62: 2400,
    monthlyBenefitAt67: 3600,
    monthlyBenefitAt70: 4500,
    claimingAge: 67,
    haircut: 0.9,
  },
]

describe('totalGuaranteedIncomeForAge', () => {
  it('is 0 before either pension or Social Security has started', () => {
    expect(totalGuaranteedIncomeForAge(() => 55, pensions, socialSecurity)).toBe(0)
  })

  it('is pension-only between the pension start age and the SS claiming age', () => {
    expect(totalGuaranteedIncomeForAge(() => 63, pensions, socialSecurity)).toBeCloseTo(9995.9706, 3)
  })

  it('is pension plus Social Security once both have started', () => {
    expect(totalGuaranteedIncomeForAge(() => 70, pensions, socialSecurity)).toBeCloseTo(
      9995.9706 + 38880,
      3,
    )
  })

  it('sums multiple pensions plus Social Security', () => {
    const twoPensions: PensionInputs[] = [
      ...pensions,
      { id: 'p2', name: 'Old Employer Pension', type: 'fixed', monthlyBenefit: 500, startAge: 65 },
    ]
    expect(totalGuaranteedIncomeForAge(() => 70, twoPensions, socialSecurity)).toBeCloseTo(
      9995.9706 + 6000 + 38880,
      3,
    )
  })

  it('resolves each pension/SS entry against its own owner age when a spouse is present', () => {
    const mixedPensions: PensionInputs[] = [
      { id: 'p1', name: 'Primary Pension', type: 'fixed', monthlyBenefit: 1000, startAge: 65 },
      { id: 'p2', name: 'Spouse Pension', type: 'fixed', ownerId: 'spouse', monthlyBenefit: 500, startAge: 65 },
    ]
    const mixedSS: SocialSecurityInputs[] = [
      { ownerId: 'primary', monthlyBenefitAt62: 0, monthlyBenefitAt67: 2000, monthlyBenefitAt70: 0, claimingAge: 67, haircut: 1 },
      { ownerId: 'spouse', monthlyBenefitAt62: 0, monthlyBenefitAt67: 1000, monthlyBenefitAt70: 0, claimingAge: 67, haircut: 1 },
    ]
    // Primary is 65 (pension started, SS not yet); spouse is 67 (both started).
    const ageForOwner = (ownerId: 'primary' | 'spouse') => (ownerId === 'spouse' ? 67 : 65)
    expect(totalGuaranteedIncomeForAge(ageForOwner, mixedPensions, mixedSS)).toBeCloseTo(1000 * 12 + 500 * 12 + 1000 * 12, 3)
  })
})
