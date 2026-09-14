// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { computeTax, stackedTax, taxableSocialSecurity } from './tax'
import type { TaxBracket } from './tax'

describe('stackedTax', () => {
  const brackets: TaxBracket[] = [
    { rate: 0.1, upTo: 10000 },
    { rate: 0.2, upTo: 40000 },
    { rate: 0.3, upTo: Infinity },
  ]

  it('computes ordinary marginal-bracket tax from $0 (base amount 0)', () => {
    // 10% * 10000 + 20% * (25000 - 10000) = 1000 + 3000 = 4000
    expect(stackedTax(0, 25000, brackets)).toBeCloseTo(4000, 6)
  })

  it('taxes an entire amount within the top bracket at just that rate when stacked above it', () => {
    // Stacking 10000 on top of 40000 (already at the top bracket boundary): all at 30%.
    expect(stackedTax(40000, 10000, brackets)).toBeCloseTo(3000, 6)
  })

  it('splits an incremental amount across a bracket boundary correctly when stacked', () => {
    // Stacking 20000 on top of 35000: 5000 remaining in the 20% bracket (up to 40000),
    // then 15000 spills into the 30% bracket.
    // 5000*0.2 + 15000*0.3 = 1000 + 4500 = 5500
    expect(stackedTax(35000, 20000, brackets)).toBeCloseTo(5500, 6)
  })

  it('matches the golden 2026 single-filer bracket math at $60,000 taxable income', () => {
    // Real 2026 single brackets (IRS): 10% to 12400, 12% to 50400, 22% to 105700, ...
    const brackets2026Single: TaxBracket[] = [
      { rate: 0.1, upTo: 12400 },
      { rate: 0.12, upTo: 50400 },
      { rate: 0.22, upTo: 105700 },
      { rate: 0.24, upTo: 201775 },
      { rate: 0.32, upTo: 256225 },
      { rate: 0.35, upTo: 640600 },
      { rate: 0.37, upTo: Infinity },
    ]
    // 12400*0.10 + (50400-12400)*0.12 + (60000-50400)*0.22 = 1240 + 4560 + 2112 = 7912
    expect(stackedTax(0, 60000, brackets2026Single)).toBeCloseTo(7912, 2)
  })

  it('returns 0 for a non-positive incremental amount', () => {
    expect(stackedTax(10000, 0, brackets)).toBe(0)
    expect(stackedTax(10000, -500, brackets)).toBe(0)
  })
})

describe('taxableSocialSecurity', () => {
  it('is 0 when benefits are 0', () => {
    expect(taxableSocialSecurity(100000, 0, 'single', 1)).toBe(0)
  })

  it('is 0 when combined income is at or below the lower base amount', () => {
    // Single lower base: $25,000. otherIncome=10000, benefits=20000 -> combined = 10000+10000=20000 <= 25000.
    expect(taxableSocialSecurity(10000, 20000, 'single', 1)).toBe(0)
  })

  it('applies the tier-1 (up to 50%) formula between the lower and upper base amounts', () => {
    // Single: lower=25000, upper=34000. otherIncome=20000, benefits=20000 -> combined=30000.
    // tier1 = min(0.5*20000, 0.5*(30000-25000)) = min(10000, 2500) = 2500.
    expect(taxableSocialSecurity(20000, 20000, 'single', 1)).toBeCloseTo(2500, 6)
  })

  it('applies the tier-2 (up to 85%) formula above the upper base amount', () => {
    // Single: otherIncome=40000, benefits=30000 -> combined=40000+15000=55000 > 34000.
    // tier1 = min(0.5*30000, 0.5*(55000-25000)) = min(15000, 15000) = 15000.
    // tier2 = 0.85*(55000-34000) + 15000 = 17850 + 15000 = 32850.
    // capped at 0.85*30000 = 25500.
    expect(taxableSocialSecurity(40000, 30000, 'single', 1)).toBeCloseTo(25500, 6)
  })

  it('uses the married-filing-jointly base amounts when specified', () => {
    // MFJ lower base is 32000 (vs 25000 single) -- same income taxes less.
    const single = taxableSocialSecurity(20000, 20000, 'single', 1)
    const mfj = taxableSocialSecurity(20000, 20000, 'marriedFilingJointly', 1)
    expect(mfj).toBeLessThan(single)
    expect(mfj).toBe(0) // combined income 30000 <= MFJ lower base 32000
  })

  it('shrinks the base amounts in real terms as the inflation factor grows — the "stealth tax"', () => {
    // Same real income, but a larger inflation factor shrinks the real base amount,
    // pushing more of the benefit into taxable territory.
    const atPlanStart = taxableSocialSecurity(20000, 20000, 'single', 1)
    const twentyYearsOfThreePercentInflation = taxableSocialSecurity(20000, 20000, 'single', 1.03 ** 20)
    expect(twentyYearsOfThreePercentInflation).toBeGreaterThan(atPlanStart)
  })
})

describe('computeTax', () => {
  it('is all zero when there is no income at all', () => {
    const result = computeTax({
      filingStatus: 'single',
      ordinaryIncome: 0,
      socialSecurityBenefits: 0,
      capitalGains: 0,
      inflationFactor: 1,
      stateRate: 0.05,
    })
    expect(result.totalTax).toBe(0)
  })

  it('taxes ordinary income after subtracting the standard deduction', () => {
    const result = computeTax({
      filingStatus: 'single',
      ordinaryIncome: 10000, // below the 2026 single standard deduction ($16,100)
      socialSecurityBenefits: 0,
      capitalGains: 0,
      inflationFactor: 1,
      stateRate: 0,
    })
    expect(result.taxableOrdinaryIncome).toBe(0)
    expect(result.federalOrdinaryTax).toBe(0)
  })

  it('stacks capital gains tax on top of ordinary taxable income, not from $0', () => {
    const noGains = computeTax({
      filingStatus: 'single',
      ordinaryIncome: 100000,
      socialSecurityBenefits: 0,
      capitalGains: 0,
      inflationFactor: 1,
      stateRate: 0,
    })
    const withGains = computeTax({
      filingStatus: 'single',
      ordinaryIncome: 100000,
      socialSecurityBenefits: 0,
      capitalGains: 20000,
      inflationFactor: 1,
      stateRate: 0,
    })
    // Ordinary tax is unaffected by adding capital gains.
    expect(withGains.federalOrdinaryTax).toBeCloseTo(noGains.federalOrdinaryTax, 6)
    expect(withGains.federalCapitalGainsTax).toBeGreaterThan(0)
  })

  it('applies the flat state rate to ordinary + capital gains taxable income, not to tax-free Social Security', () => {
    const result = computeTax({
      filingStatus: 'single',
      ordinaryIncome: 50000,
      socialSecurityBenefits: 0,
      capitalGains: 10000,
      inflationFactor: 1,
      stateRate: 0.05,
    })
    const expectedTaxableOrdinary = 50000 - 16100 // 2026 single standard deduction
    expect(result.stateTax).toBeCloseTo(0.05 * (expectedTaxableOrdinary + 10000), 2)
  })

  it('a married-filing-jointly household owes less tax than single at identical income (double deduction, wider brackets)', () => {
    const inputs = {
      ordinaryIncome: 80000,
      socialSecurityBenefits: 30000,
      capitalGains: 5000,
      inflationFactor: 1,
      stateRate: 0.05,
    }
    const single = computeTax({ ...inputs, filingStatus: 'single' })
    const mfj = computeTax({ ...inputs, filingStatus: 'marriedFilingJointly' })
    expect(mfj.totalTax).toBeLessThan(single.totalTax)
  })
})
