// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { applyWithdrawal } from './withdrawal'
import type { AccountBalance } from './withdrawal'

describe('applyWithdrawal', () => {
  it('draws from taxable accounts first, leaving other tiers untouched', () => {
    const accounts: AccountBalance[] = [
      { id: 'taxable', type: 'taxable', balance: 1000 },
      { id: 'taxDeferred', type: 'tax-deferred', balance: 5000 },
    ]
    const result = applyWithdrawal(accounts, 800, 70)

    expect(result.balances.taxable).toBeCloseTo(200, 6)
    expect(result.balances.taxDeferred).toBeCloseTo(5000, 6)
    expect(result.totalWithdrawn).toBeCloseTo(800, 6)
    expect(result.earlyWithdrawalPenaltyFlag).toBe(false)
    expect(result.fundsDepleted).toBe(false)
  })

  it('splits a tier pro-rata across multiple accounts by balance', () => {
    const accounts: AccountBalance[] = [
      { id: 'a', type: 'taxable', balance: 300 },
      { id: 'b', type: 'taxable', balance: 700 },
    ]
    const result = applyWithdrawal(accounts, 500, 70)

    expect(result.balances.a).toBeCloseTo(300 - 500 * 0.3, 6)
    expect(result.balances.b).toBeCloseTo(700 - 500 * 0.7, 6)
  })

  it('draws Roth basis before Roth gains, and before tax-deferred is touched', () => {
    const accounts: AccountBalance[] = [
      { id: 'roth', type: 'roth', balance: 1000, rothBasis: 400 },
    ]
    // Need is less than basis, so only basis should shrink — gains (balance - basis)
    // should be unaffected.
    const result = applyWithdrawal(accounts, 300, 70)

    expect(result.balances.roth).toBeCloseTo(700, 6)
    expect(result.rothBasis.roth).toBeCloseTo(100, 6)
    expect(result.balances.roth - result.rothBasis.roth).toBeCloseTo(600, 6) // gains untouched
  })

  it('exhausts Roth basis before dipping into Roth gains', () => {
    const accounts: AccountBalance[] = [
      { id: 'roth', type: 'roth', balance: 1000, rothBasis: 400 },
    ]
    const result = applyWithdrawal(accounts, 1000, 70)

    expect(result.balances.roth).toBeCloseTo(0, 6)
    expect(result.rothBasis.roth).toBeCloseTo(0, 6)
    expect(result.fundsDepleted).toBe(false)
  })

  it('only reaches tax-deferred and Roth gains after taxable and Roth basis are exhausted', () => {
    const accounts: AccountBalance[] = [
      { id: 'taxDeferred', type: 'tax-deferred', balance: 300 },
      { id: 'roth', type: 'roth', balance: 500, rothBasis: 200 },
    ]
    const result = applyWithdrawal(accounts, 700, 70)

    // Tier order: roth basis (200) -> tax-deferred (300) -> roth gains (200 of 300 available)
    expect(result.rothBasis.roth).toBeCloseTo(0, 6)
    expect(result.balances.taxDeferred).toBeCloseTo(0, 6)
    expect(result.balances.roth).toBeCloseTo(500 - 200 - 200, 6)
    expect(result.totalWithdrawn).toBeCloseTo(700, 6)
  })

  it('flags a withdrawal that touches tax-deferred money before 59.5', () => {
    const accounts: AccountBalance[] = [{ id: 'taxDeferred', type: 'tax-deferred', balance: 1000 }]

    expect(applyWithdrawal(accounts, 200, 55).earlyWithdrawalPenaltyFlag).toBe(true)
    expect(applyWithdrawal(accounts, 200, 60).earlyWithdrawalPenaltyFlag).toBe(false)
  })

  it('flags a withdrawal that touches Roth gains before 59.5, but not when only basis is touched', () => {
    const accounts: AccountBalance[] = [{ id: 'roth', type: 'roth', balance: 1000, rothBasis: 400 }]

    // Only within basis: no flag even though age is under 59.5.
    expect(applyWithdrawal(accounts, 300, 50).earlyWithdrawalPenaltyFlag).toBe(false)
    // Exceeds basis, dips into gains: flagged under 59.5.
    expect(applyWithdrawal(accounts, 1000, 50).earlyWithdrawalPenaltyFlag).toBe(true)
    // Same withdrawal at 60: not flagged.
    expect(applyWithdrawal(accounts, 1000, 60).earlyWithdrawalPenaltyFlag).toBe(false)
  })

  it('defaults Roth basis to the full balance when omitted (assumes no gains yet)', () => {
    const accounts: AccountBalance[] = [{ id: 'roth', type: 'roth', balance: 1000 }]
    const result = applyWithdrawal(accounts, 1000, 50)

    // Fully covered by "basis" (the whole balance), so no penalty flag even under 59.5.
    expect(result.earlyWithdrawalPenaltyFlag).toBe(false)
    expect(result.balances.roth).toBeCloseTo(0, 6)
  })

  it('clamps withdrawals and flags depletion when the need exceeds total assets', () => {
    const accounts: AccountBalance[] = [{ id: 'taxable', type: 'taxable', balance: 100 }]
    const result = applyWithdrawal(accounts, 500, 70)

    expect(result.balances.taxable).toBe(0)
    expect(result.totalWithdrawn).toBeCloseTo(100, 6)
    expect(result.fundsDepleted).toBe(true)
  })

  it('does nothing when no withdrawal is needed', () => {
    const accounts: AccountBalance[] = [{ id: 'taxable', type: 'taxable', balance: 100 }]
    const result = applyWithdrawal(accounts, 0, 70)

    expect(result.balances.taxable).toBe(100)
    expect(result.totalWithdrawn).toBe(0)
    expect(result.fundsDepleted).toBe(false)
  })

  it('reports the tax-deferred portion of the withdrawal separately from the total', () => {
    const accounts: AccountBalance[] = [
      { id: 'taxable', type: 'taxable', balance: 300, taxableCostBasis: 300 },
      { id: 'taxDeferred', type: 'tax-deferred', balance: 5000 },
    ]
    const result = applyWithdrawal(accounts, 800, 70)
    // 300 from taxable (tier 1), then 500 from tax-deferred (tier 3).
    expect(result.taxDeferredWithdrawn).toBeCloseTo(500, 6)
  })

  it('realizes a taxable-account withdrawal proportional to its gain fraction (balance vs. cost basis)', () => {
    // 40% of the account is unrealized gain (balance 1000, basis 600).
    const accounts: AccountBalance[] = [{ id: 'brokerage', type: 'taxable', balance: 1000, taxableCostBasis: 600 }]
    const result = applyWithdrawal(accounts, 500, 70)

    expect(result.taxableGainsWithdrawn).toBeCloseTo(500 * 0.4, 6)
    // Basis shrinks by the return-of-basis portion (60%), preserving the gain ratio.
    expect(result.taxableCostBasis.brokerage).toBeCloseTo(600 - 500 * 0.6, 6)
    expect(result.balances.brokerage).toBeCloseTo(500, 6)
  })

  it('defaults taxable cost basis to the full balance when omitted (assumes no gain yet)', () => {
    const accounts: AccountBalance[] = [{ id: 'brokerage', type: 'taxable', balance: 1000 }]
    const result = applyWithdrawal(accounts, 500, 70)

    expect(result.taxableGainsWithdrawn).toBe(0)
  })

  it('splits realized gains proportionally across multiple taxable accounts with different gain fractions', () => {
    const accounts: AccountBalance[] = [
      { id: 'a', type: 'taxable', balance: 500, taxableCostBasis: 500 }, // 0% gain
      { id: 'b', type: 'taxable', balance: 500, taxableCostBasis: 0 }, // 100% gain
    ]
    // Pro-rata by balance: 250 from each account.
    const result = applyWithdrawal(accounts, 500, 70)
    expect(result.taxableGainsWithdrawn).toBeCloseTo(250, 6) // 0 from 'a' + 250 from 'b'
  })

  it('computes the 10% early-withdrawal penalty dollar amount on tax-deferred and Roth-gains withdrawals before 59.5', () => {
    const accounts: AccountBalance[] = [{ id: 'taxDeferred', type: 'tax-deferred', balance: 10000 }]
    const before = applyWithdrawal(accounts, 4000, 55)
    expect(before.earlyWithdrawalPenaltyAmount).toBeCloseTo(400, 6) // 10% of 4000

    const after = applyWithdrawal(accounts, 4000, 60)
    expect(after.earlyWithdrawalPenaltyAmount).toBe(0)
  })

  it('sums the early-withdrawal penalty across both penalized tiers (tax-deferred and Roth gains)', () => {
    const accounts: AccountBalance[] = [
      { id: 'taxDeferred', type: 'tax-deferred', balance: 1000 },
      { id: 'roth', type: 'roth', balance: 1000, rothBasis: 200 },
    ]
    // Tier order: roth basis (200) -> tax-deferred (1000) -> roth gains (800 needed of 800 available).
    const result = applyWithdrawal(accounts, 2000, 50)
    expect(result.earlyWithdrawalPenaltyAmount).toBeCloseTo(0.1 * 1000 + 0.1 * 800, 6)
  })

  it('draws from a cash account only as an absolute last resort, after every other tier', () => {
    const accounts: AccountBalance[] = [
      { id: 'cash', type: 'cash', balance: 500 },
      { id: 'taxable', type: 'taxable', balance: 200, taxableCostBasis: 200 },
      { id: 'taxDeferred', type: 'tax-deferred', balance: 200 },
      { id: 'roth', type: 'roth', balance: 200, rothBasis: 200 },
    ]
    // Need 700: 200 (taxable) + 200 (roth basis) + 200 (tax-deferred) = 600, leaving
    // 100 to come from cash — none of the other three should be left untouched.
    const result = applyWithdrawal(accounts, 700, 70)

    expect(result.balances.taxable).toBeCloseTo(0, 6)
    expect(result.balances.roth).toBeCloseTo(0, 6)
    expect(result.balances.taxDeferred).toBeCloseTo(0, 6)
    expect(result.balances.cash).toBeCloseTo(400, 6)
    expect(result.totalWithdrawn).toBeCloseTo(700, 6)
    expect(result.fundsDepleted).toBe(false)
  })

  it('generates no ordinary income, capital gains, or early-withdrawal penalty when drawing from cash', () => {
    const accounts: AccountBalance[] = [{ id: 'cash', type: 'cash', balance: 1000 }]
    const result = applyWithdrawal(accounts, 500, 50) // well under 59.5
    expect(result.taxDeferredWithdrawn).toBe(0)
    expect(result.taxableGainsWithdrawn).toBe(0)
    expect(result.earlyWithdrawalPenaltyAmount).toBe(0)
    expect(result.earlyWithdrawalPenaltyFlag).toBe(false)
  })

  it('still flags depletion when even cash runs out', () => {
    const accounts: AccountBalance[] = [{ id: 'cash', type: 'cash', balance: 100 }]
    const result = applyWithdrawal(accounts, 500, 70)
    expect(result.totalWithdrawn).toBeCloseTo(100, 6)
    expect(result.fundsDepleted).toBe(true)
  })
})
