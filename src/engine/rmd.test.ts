// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { applyRequiredMinimumDistributions, requiredMinimumDistribution, rmdStartAge } from './rmd'
import type { Account } from './types'

describe('rmdStartAge', () => {
  it('is 73 for anyone born in 1959 or earlier', () => {
    expect(rmdStartAge(1950)).toBe(73)
    expect(rmdStartAge(1959)).toBe(73)
  })

  it('is 75 for anyone born in 1960 or later', () => {
    expect(rmdStartAge(1960)).toBe(75)
    expect(rmdStartAge(1990)).toBe(75)
  })
})

describe('requiredMinimumDistribution', () => {
  it('is 0 before the owner reaches their RMD start age', () => {
    expect(requiredMinimumDistribution(500000, 72, 1959)).toBe(0)
    expect(requiredMinimumDistribution(500000, 74, 1960)).toBe(0)
  })

  it('is 0 once the balance is exhausted, even past the start age', () => {
    expect(requiredMinimumDistribution(0, 80, 1950)).toBe(0)
  })

  it('matches the IRS Uniform Lifetime Table divisor exactly at known ages', () => {
    // Golden values straight from IRS Pub 590-B, Appendix B, Table III.
    expect(requiredMinimumDistribution(1000000, 73, 1950)).toBeCloseTo(1000000 / 26.5, 6)
    expect(requiredMinimumDistribution(1000000, 90, 1950)).toBeCloseTo(1000000 / 12.2, 6)
  })

  it('uses the 2.0 floor divisor for age 120 and beyond', () => {
    expect(requiredMinimumDistribution(100000, 120, 1900)).toBeCloseTo(100000 / 2.0, 6)
    expect(requiredMinimumDistribution(100000, 130, 1900)).toBeCloseTo(100000 / 2.0, 6)
  })

  it('applies the age-75 rule exactly at the 1959/1960 birth-year boundary', () => {
    // Born 1959: RMD age 73, so age 74 already owes one.
    expect(requiredMinimumDistribution(1000000, 74, 1959)).toBeGreaterThan(0)
    // Born 1960: RMD age 75, so the same age 74 owes nothing yet.
    expect(requiredMinimumDistribution(1000000, 74, 1960)).toBe(0)
  })
})

describe('applyRequiredMinimumDistributions', () => {
  const ageForOwner = (ownerId: 'primary' | 'spouse') => (ownerId === 'spouse' ? 76 : 80)
  const birthYearForOwner = (ownerId: 'primary' | 'spouse') => (ownerId === 'spouse' ? 1949 : 1945)

  it('only forces a withdrawal from tax-deferred accounts, never taxable/roth/mortgage', () => {
    const accounts: Account[] = [
      { id: 'taxable', name: 'Taxable', type: 'taxable', balance: 100000, annualContribution: 0 },
      { id: 'roth', name: 'Roth', type: 'roth', balance: 100000, annualContribution: 0 },
      { id: 'deferred', name: 'Tax-Deferred', type: 'tax-deferred', balance: 100000, annualContribution: 0 },
      { id: 'mortgage', name: 'House', type: 'mortgage', balance: 200000, annualContribution: 0 },
    ]
    const balances = { taxable: 100000, roth: 100000, deferred: 100000 }
    const result = applyRequiredMinimumDistributions(accounts, balances, ageForOwner, birthYearForOwner)

    expect(result.balances.taxable).toBe(100000)
    expect(result.balances.roth).toBe(100000)
    expect(result.balances.deferred).toBeCloseTo(100000 - 100000 / 20.2, 6) // age 80 divisor
    expect(result.totalWithdrawn).toBeCloseTo(100000 / 20.2, 6)
  })

  it("resolves each account's RMD against its own owner's age and birth year", () => {
    const accounts: Account[] = [
      { id: 'primary-401k', name: "Primary's 401(k)", type: 'tax-deferred', balance: 100000, annualContribution: 0 },
      {
        id: 'spouse-401k',
        name: "Spouse's 401(k)",
        type: 'tax-deferred',
        ownerId: 'spouse',
        balance: 100000,
        annualContribution: 0,
      },
    ]
    const balances = { 'primary-401k': 100000, 'spouse-401k': 100000 }
    const result = applyRequiredMinimumDistributions(accounts, balances, ageForOwner, birthYearForOwner)

    // Primary is 80 -> divisor 20.2; spouse is 76 -> divisor 23.7.
    expect(result.balances['primary-401k']).toBeCloseTo(100000 - 100000 / 20.2, 6)
    expect(result.balances['spouse-401k']).toBeCloseTo(100000 - 100000 / 23.7, 6)
  })

  it('sums to 0 for a household with no tax-deferred accounts', () => {
    const accounts: Account[] = [{ id: 'a', name: 'Taxable', type: 'taxable', balance: 100000, annualContribution: 0 }]
    const result = applyRequiredMinimumDistributions(accounts, { a: 100000 }, ageForOwner, birthYearForOwner)
    expect(result.totalWithdrawn).toBe(0)
  })
})
