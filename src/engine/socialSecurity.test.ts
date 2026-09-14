// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  socialSecurityAnnualBenefit,
  socialSecurityIncomeForAge,
  socialSecurityMonthlyBenefit,
} from './socialSecurity'
import type { SocialSecurityInputs } from './socialSecurity'

const benchmarks = {
  monthlyBenefitAt62: 2400,
  monthlyBenefitAt67: 3600,
  monthlyBenefitAt70: 4500,
}

describe('socialSecurityMonthlyBenefit', () => {
  it('returns the exact benchmark at 62, 67, and 70', () => {
    expect(socialSecurityMonthlyBenefit({ ...benchmarks, claimingAge: 62, haircut: 1 })).toBe(2400)
    expect(socialSecurityMonthlyBenefit({ ...benchmarks, claimingAge: 67, haircut: 1 })).toBe(3600)
    expect(socialSecurityMonthlyBenefit({ ...benchmarks, claimingAge: 70, haircut: 1 })).toBe(4500)
  })

  it('clamps ages at or below 62 to the 62 benefit', () => {
    expect(socialSecurityMonthlyBenefit({ ...benchmarks, claimingAge: 60, haircut: 1 })).toBe(2400)
  })

  it('clamps ages at or above 70 to the 70 benefit', () => {
    expect(socialSecurityMonthlyBenefit({ ...benchmarks, claimingAge: 72, haircut: 1 })).toBe(4500)
  })

  it('interpolates linearly between 62 and 67', () => {
    // Halfway (age 64.5) should be halfway between 2400 and 3600.
    const result = socialSecurityMonthlyBenefit({ ...benchmarks, claimingAge: 64.5, haircut: 1 })
    expect(result).toBeCloseTo((2400 + 3600) / 2, 6)
  })

  it('interpolates linearly between 67 and 70', () => {
    const result = socialSecurityMonthlyBenefit({ ...benchmarks, claimingAge: 68.5, haircut: 1 })
    expect(result).toBeCloseTo((3600 + 4500) / 2, 6)
  })
})

describe('socialSecurityAnnualBenefit', () => {
  it('multiplies the monthly benefit by 12 and applies the haircut', () => {
    const inputs: SocialSecurityInputs = { ...benchmarks, claimingAge: 67, haircut: 0.9 }
    expect(socialSecurityAnnualBenefit(inputs)).toBeCloseTo(38880, 6)
  })
})

describe('socialSecurityIncomeForAge', () => {
  const inputs: SocialSecurityInputs = { ...benchmarks, claimingAge: 67, haircut: 0.9 }

  it('pays nothing before the claiming age', () => {
    expect(socialSecurityIncomeForAge(66, inputs)).toBe(0)
  })

  it('pays the full annual benefit from the claiming age onward', () => {
    expect(socialSecurityIncomeForAge(67, inputs)).toBeCloseTo(38880, 6)
    expect(socialSecurityIncomeForAge(90, inputs)).toBeCloseTo(38880, 6)
  })
})
