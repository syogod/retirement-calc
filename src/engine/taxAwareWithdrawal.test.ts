// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { solveTaxAwareWithdrawal } from './taxAwareWithdrawal'
import type { AccountBalance } from './withdrawal'

const baseInputs = {
  age: 70,
  ordinaryIncomeBeforeWithdrawal: 0,
  socialSecurityBenefits: 0,
  filingStatus: 'single' as const,
  inflationFactor: 1,
  stateRate: 0,
}

describe('solveTaxAwareWithdrawal', () => {
  it('withdraws exactly the pre-tax gap when there is no tax at all (Roth-only, 0% state rate)', () => {
    const accounts: AccountBalance[] = [{ id: 'roth', type: 'roth', balance: 500000, rothBasis: 500000 }]
    const result = solveTaxAwareWithdrawal({ ...baseInputs, accounts, preTaxGap: 40000 })
    expect(result.withdrawal.totalWithdrawn).toBeCloseTo(40000, 2)
    expect(result.tax.totalTax).toBe(0)
  })

  it('grosses up a tax-deferred withdrawal so the net-of-tax proceeds match the pre-tax gap', () => {
    const accounts: AccountBalance[] = [{ id: 'ira', type: 'tax-deferred', balance: 2000000 }]
    const preTaxGap = 60000
    const result = solveTaxAwareWithdrawal({ ...baseInputs, accounts, preTaxGap })
    // The core invariant: gross withdrawal minus tax minus penalty nets exactly the gap.
    const netProceeds = result.withdrawal.totalWithdrawn - result.tax.totalTax - result.earlyWithdrawalPenaltyAmount
    expect(netProceeds).toBeCloseTo(preTaxGap, 1)
    // And it actually did have to withdraw more than the raw need, because of tax.
    expect(result.withdrawal.totalWithdrawn).toBeGreaterThan(preTaxGap)
  })

  it('grosses up for capital gains tax on a taxable-account withdrawal with a real cost basis', () => {
    const accounts: AccountBalance[] = [{ id: 'brokerage', type: 'taxable', balance: 2000000, taxableCostBasis: 500000 }]
    const preTaxGap = 60000
    const result = solveTaxAwareWithdrawal({ ...baseInputs, accounts, preTaxGap })
    const netProceeds = result.withdrawal.totalWithdrawn - result.tax.totalTax - result.earlyWithdrawalPenaltyAmount
    expect(netProceeds).toBeCloseTo(preTaxGap, 1)
    expect(result.tax.federalCapitalGainsTax).toBeGreaterThanOrEqual(0)
  })

  it('needs no gains tax at all when the taxable account has no unrealized gain (basis = balance)', () => {
    const accounts: AccountBalance[] = [{ id: 'brokerage', type: 'taxable', balance: 100000, taxableCostBasis: 100000 }]
    const result = solveTaxAwareWithdrawal({ ...baseInputs, accounts, preTaxGap: 40000 })
    expect(result.withdrawal.totalWithdrawn).toBeCloseTo(40000, 2)
    expect(result.tax.federalCapitalGainsTax).toBe(0)
  })

  it('forces a real withdrawal even with a $0 pre-tax gap when guaranteed income alone owes tax', () => {
    // No spending shortfall at all (preTaxGap = 0), but pension income creates a
    // real tax bill that has to come from somewhere — the portfolio.
    const accounts: AccountBalance[] = [{ id: 'ira', type: 'tax-deferred', balance: 2000000 }]
    const result = solveTaxAwareWithdrawal({
      ...baseInputs,
      accounts,
      preTaxGap: 0,
      ordinaryIncomeBeforeWithdrawal: 80000, // a sizable pension, taxed regardless
    })
    expect(result.withdrawal.totalWithdrawn).toBeGreaterThan(0)
    const netProceeds = result.withdrawal.totalWithdrawn - result.tax.totalTax - result.earlyWithdrawalPenaltyAmount
    expect(netProceeds).toBeCloseTo(0, 1)
  })

  it('includes the 10% early-withdrawal penalty in the gross-up, before age 59.5', () => {
    const accounts: AccountBalance[] = [{ id: 'ira', type: 'tax-deferred', balance: 2000000 }]
    const preTaxGap = 40000
    const result = solveTaxAwareWithdrawal({ ...baseInputs, accounts, age: 50, preTaxGap })
    expect(result.earlyWithdrawalPenaltyAmount).toBeGreaterThan(0)
    const netProceeds = result.withdrawal.totalWithdrawn - result.tax.totalTax - result.earlyWithdrawalPenaltyAmount
    expect(netProceeds).toBeCloseTo(preTaxGap, 1)
  })

  it('degrades gracefully (funds depleted) when the account cannot cover even the grossed-up amount', () => {
    const accounts: AccountBalance[] = [{ id: 'ira', type: 'tax-deferred', balance: 1000 }]
    const result = solveTaxAwareWithdrawal({ ...baseInputs, accounts, preTaxGap: 100000 })
    expect(result.withdrawal.fundsDepleted).toBe(true)
    expect(result.withdrawal.totalWithdrawn).toBeCloseTo(1000, 6)
  })

  it('grosses up for tax on capitalGainsBeforeWithdrawal even when the withdrawal itself has no gain', () => {
    const accounts: AccountBalance[] = [{ id: 'roth', type: 'roth', balance: 500000, rothBasis: 500000 }]
    const withoutOutsideGain = solveTaxAwareWithdrawal({ ...baseInputs, accounts, preTaxGap: 40000 })
    const withOutsideGain = solveTaxAwareWithdrawal({
      ...baseInputs,
      accounts,
      preTaxGap: 40000,
      capitalGainsBeforeWithdrawal: 300000, // e.g. the taxable portion of a home-sale gain
    })
    expect(withoutOutsideGain.tax.totalTax).toBe(0)
    expect(withOutsideGain.tax.federalCapitalGainsTax).toBeGreaterThan(0)
    // The extra tax has to come from somewhere — the Roth withdrawal grows to cover it.
    expect(withOutsideGain.withdrawal.totalWithdrawn).toBeGreaterThan(withoutOutsideGain.withdrawal.totalWithdrawn)
  })

  it('a married-filing-jointly household withdraws less gross for the same net need (lower marginal rate)', () => {
    const accounts: AccountBalance[] = [{ id: 'ira', type: 'tax-deferred', balance: 2000000 }]
    const preTaxGap = 80000
    const single = solveTaxAwareWithdrawal({ ...baseInputs, accounts, preTaxGap, filingStatus: 'single' })
    const mfj = solveTaxAwareWithdrawal({ ...baseInputs, accounts, preTaxGap, filingStatus: 'marriedFilingJointly' })
    expect(mfj.withdrawal.totalWithdrawn).toBeLessThan(single.withdrawal.totalWithdrawn)
  })
})
