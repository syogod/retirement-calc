// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { checkContributionLimits, employeeDeferralLimit, iraContributionLimit } from './contributionLimits'
import type { Account } from './types'

describe('employeeDeferralLimit', () => {
  it('is the base limit under 50', () => {
    expect(employeeDeferralLimit(45)).toBe(24500)
  })

  it('adds the standard catch-up from 50-59', () => {
    expect(employeeDeferralLimit(50)).toBe(24500 + 8000)
    expect(employeeDeferralLimit(59)).toBe(24500 + 8000)
  })

  it('adds the larger SECURE 2.0 catch-up for ages 60-63', () => {
    expect(employeeDeferralLimit(60)).toBe(24500 + 11250)
    expect(employeeDeferralLimit(63)).toBe(24500 + 11250)
  })

  it('reverts to the standard catch-up at 64+', () => {
    expect(employeeDeferralLimit(64)).toBe(24500 + 8000)
    expect(employeeDeferralLimit(70)).toBe(24500 + 8000)
  })
})

describe('iraContributionLimit', () => {
  it('is the base limit under 50', () => {
    expect(iraContributionLimit(49)).toBe(7500)
  })

  it('adds the catch-up at 50+', () => {
    expect(iraContributionLimit(50)).toBe(7500 + 1100)
    expect(iraContributionLimit(70)).toBe(7500 + 1100)
  })
})

describe('checkContributionLimits', () => {
  const age = 45 // under 50, so limits are 24500 (deferral) and 7500 (IRA)

  it('flags a tax-deferred account over the deferral limit', () => {
    const accounts: Account[] = [
      { id: 'a', name: '401(k)', type: 'tax-deferred', balance: 0, annualContribution: 30000 },
    ]
    const warnings = checkContributionLimits(accounts, () => age)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({ accountId: 'a', accountName: '401(k)', limit: 24500, contribution: 30000 })
  })

  it('flags a roth account over the IRA limit', () => {
    const accounts: Account[] = [{ id: 'b', name: 'Roth IRA', type: 'roth', balance: 0, annualContribution: 8000 }]
    const warnings = checkContributionLimits(accounts, () => age)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({ accountId: 'b', limit: 7500, contribution: 8000 })
  })

  it('does not flag a taxable or mortgage account regardless of contribution size', () => {
    const accounts: Account[] = [
      { id: 'c', name: 'Brokerage', type: 'taxable', balance: 0, annualContribution: 100000 },
      { id: 'd', name: 'House', type: 'mortgage', balance: 300000, annualContribution: 0 },
    ]
    expect(checkContributionLimits(accounts, () => age)).toEqual([])
  })

  it('does not flag contributions at or under the limit', () => {
    const accounts: Account[] = [
      { id: 'a', name: '401(k)', type: 'tax-deferred', balance: 0, annualContribution: 24500 },
      { id: 'b', name: 'Roth IRA', type: 'roth', balance: 0, annualContribution: 7500 },
    ]
    expect(checkContributionLimits(accounts, () => age)).toEqual([])
  })

  it('uses the age-appropriate catch-up limit', () => {
    const accounts: Account[] = [
      { id: 'a', name: '401(k)', type: 'tax-deferred', balance: 0, annualContribution: 32000 },
    ]
    // Under the 50+ catch-up limit (32500), so no warning at age 55...
    expect(checkContributionLimits(accounts, () => 55)).toEqual([])
    // ...but over the base limit (24500) at age 45.
    expect(checkContributionLimits(accounts, () => 45)).toHaveLength(1)
  })

  it("checks each account against its own owner's age, not one shared age", () => {
    const accounts: Account[] = [
      { id: 'a', name: "Primary's 401(k)", type: 'tax-deferred', balance: 0, annualContribution: 30000 },
      { id: 'b', name: "Spouse's 401(k)", type: 'tax-deferred', ownerId: 'spouse', balance: 0, annualContribution: 30000 },
    ]
    // Primary is 45 (base limit 24500, so $30k warns); spouse is 60 (SECURE 2.0
    // catch-up limit 35750, so $30k does NOT warn).
    const ageForOwner = (ownerId: 'primary' | 'spouse') => (ownerId === 'spouse' ? 60 : 45)
    const warnings = checkContributionLimits(accounts, ageForOwner)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].accountId).toBe('a')
  })
})
