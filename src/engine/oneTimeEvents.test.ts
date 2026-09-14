// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { applyOneTimeInflows, totalOneTimeOutflowForAge } from './oneTimeEvents'
import type { OneTimeEvent } from './oneTimeEvents'
import type { Account } from './types'

// Represents a single projection year in which the primary person is 70 and the
// spouse (2 years younger) is 68 — already scoped to "this year," the way the real
// `makeAgeForOwner(household, primaryAge)` closure works.
const ageForOwner = (ownerId: 'primary' | 'spouse') => (ownerId === 'spouse' ? 68 : 70)

describe('totalOneTimeOutflowForAge', () => {
  it('sums outflow events (negative amount) that fire this exact age, as a positive number', () => {
    const events: OneTimeEvent[] = [
      { id: 'e1', name: 'New roof', age: 70, amount: -20000 },
      { id: 'e2', name: 'Wedding', age: 70, amount: -15000 },
    ]
    expect(totalOneTimeOutflowForAge(events, ageForOwner)).toBe(35000)
  })

  it('ignores events at a different age, or belonging to the other owner', () => {
    const events: OneTimeEvent[] = [
      { id: 'e1', name: 'New roof', age: 71, amount: -20000 }, // different age
      { id: 'e2', name: "Spouse's expense", age: 70, ownerId: 'spouse', amount: -15000 }, // spouse is 68, not 70
    ]
    expect(totalOneTimeOutflowForAge(events, ageForOwner)).toBe(0)
  })

  it('ignores inflow events (positive amount)', () => {
    const events: OneTimeEvent[] = [{ id: 'e1', name: 'Inheritance', age: 70, amount: 100000 }]
    expect(totalOneTimeOutflowForAge(events, ageForOwner)).toBe(0)
  })

  it('fires for the correct owner at their own age', () => {
    const events: OneTimeEvent[] = [{ id: 'e1', name: "Spouse's expense", age: 68, ownerId: 'spouse', amount: -5000 }]
    expect(totalOneTimeOutflowForAge(events, ageForOwner)).toBe(5000)
  })
})

describe('totalOneTimeOutflowForAge — recurring outflows (repeatEveryYears)', () => {
  const agedFor = (primaryAge: number) => (ownerId: 'primary' | 'spouse') => (ownerId === 'spouse' ? primaryAge - 2 : primaryAge)

  it('fires at the starting age and every multiple of the interval after it, not in between', () => {
    const events: OneTimeEvent[] = [{ id: 'e1', name: 'New car', age: 65, amount: -25000, repeatEveryYears: 10 }]
    for (const age of [64, 66, 70, 74, 84]) {
      expect(totalOneTimeOutflowForAge(events, agedFor(age))).toBe(0)
    }
    for (const age of [65, 75, 85, 95]) {
      expect(totalOneTimeOutflowForAge(events, agedFor(age))).toBe(25000)
    }
  })

  it('stops recurring past repeatUntilAge, but still fired on-schedule right up to it', () => {
    const events: OneTimeEvent[] = [
      { id: 'e1', name: 'New car', age: 65, amount: -25000, repeatEveryYears: 10, repeatUntilAge: 85 },
    ]
    expect(totalOneTimeOutflowForAge(events, agedFor(85))).toBe(25000) // last one still fires exactly at the boundary
    expect(totalOneTimeOutflowForAge(events, agedFor(95))).toBe(0) // would have recurred here without the cap
  })

  it('recurs against the correct owner\'s own age, independent of the primary\'s', () => {
    const events: OneTimeEvent[] = [
      { id: 'e1', name: "Spouse's car", age: 60, ownerId: 'spouse', amount: -20000, repeatEveryYears: 10 },
    ]
    // Spouse is 2 years younger; spouse turns 60 when primary is 62, and 70 when primary is 72.
    expect(totalOneTimeOutflowForAge(events, agedFor(62))).toBe(20000)
    expect(totalOneTimeOutflowForAge(events, agedFor(65))).toBe(0)
    expect(totalOneTimeOutflowForAge(events, agedFor(72))).toBe(20000)
  })

  it('a non-repeating outflow (repeatEveryYears omitted) still fires exactly once, as before', () => {
    const events: OneTimeEvent[] = [{ id: 'e1', name: 'Wedding', age: 65, amount: -15000 }]
    expect(totalOneTimeOutflowForAge(events, agedFor(65))).toBe(15000)
    expect(totalOneTimeOutflowForAge(events, agedFor(75))).toBe(0)
  })
})

describe('applyOneTimeInflows', () => {
  const accounts: Account[] = [
    { id: 'brokerage', name: 'Brokerage', type: 'taxable', balance: 100000, annualContribution: 0 },
    { id: 'reserve', name: 'Cash Reserve', type: 'cash', balance: 5000, annualContribution: 0 },
    { id: 'ira', name: 'IRA', type: 'tax-deferred', balance: 50000, annualContribution: 0 },
    { id: 'roth', name: 'Roth', type: 'roth', balance: 20000, annualContribution: 0 },
  ]
  const balances = { brokerage: 100000, reserve: 5000, ira: 50000, roth: 20000 }
  const taxableCostBasis = { brokerage: 60000 }

  it('deposits a tax-free inflow into a taxable target, increasing both balance and cost basis', () => {
    const events: OneTimeEvent[] = [
      { id: 'e1', name: 'Inheritance', age: 70, amount: 100000, targetAccountId: 'brokerage' },
    ]
    const result = applyOneTimeInflows(events, ageForOwner, accounts, balances, taxableCostBasis)
    expect(result.balances.brokerage).toBe(200000)
    expect(result.taxableCostBasis.brokerage).toBe(160000)
    expect(result.taxableOrdinaryIncome).toBe(0)
    expect(result.totalInflow).toBe(100000)
  })

  it('deposits into a cash target without touching any cost-basis tracking', () => {
    const events: OneTimeEvent[] = [
      { id: 'e1', name: 'Inheritance', age: 70, amount: 30000, targetAccountId: 'reserve' },
    ]
    const result = applyOneTimeInflows(events, ageForOwner, accounts, balances, taxableCostBasis)
    expect(result.balances.reserve).toBe(35000)
  })

  it('counts a taxable inflow as ordinary income while still depositing the full pre-tax amount', () => {
    const events: OneTimeEvent[] = [
      { id: 'e1', name: 'Bonus', age: 70, amount: 50000, taxable: true, targetAccountId: 'brokerage' },
    ]
    const result = applyOneTimeInflows(events, ageForOwner, accounts, balances, taxableCostBasis)
    expect(result.taxableOrdinaryIncome).toBe(50000)
    expect(result.balances.brokerage).toBe(150000) // full amount, not net of tax
  })

  it('is a documented no-op when the target account is missing', () => {
    const events: OneTimeEvent[] = [{ id: 'e1', name: 'Inheritance', age: 70, amount: 100000 }] // no targetAccountId
    const result = applyOneTimeInflows(events, ageForOwner, accounts, balances, taxableCostBasis)
    expect(result.balances).toEqual(balances)
    expect(result.totalInflow).toBe(100000) // still reported, just not deposited anywhere
  })

  it('is a no-op when the target account is a tax-deferred or Roth account (not allowed)', () => {
    const events: OneTimeEvent[] = [{ id: 'e1', name: 'Inheritance', age: 70, amount: 100000, targetAccountId: 'ira' }]
    const result = applyOneTimeInflows(events, ageForOwner, accounts, balances, taxableCostBasis)
    expect(result.balances.ira).toBe(50000)
  })

  it('ignores outflow events entirely (they are handled via spending need, not here)', () => {
    const events: OneTimeEvent[] = [
      { id: 'e1', name: 'New roof', age: 70, amount: -20000, targetAccountId: 'brokerage' },
    ]
    const result = applyOneTimeInflows(events, ageForOwner, accounts, balances, taxableCostBasis)
    expect(result.balances.brokerage).toBe(100000)
    expect(result.totalInflow).toBe(0)
  })

  it('only applies events firing at this exact age', () => {
    const events: OneTimeEvent[] = [
      { id: 'e1', name: 'Inheritance', age: 71, amount: 100000, targetAccountId: 'brokerage' },
    ]
    const result = applyOneTimeInflows(events, ageForOwner, accounts, balances, taxableCostBasis)
    expect(result.balances.brokerage).toBe(100000)
  })

  it('never recurs, even if repeatEveryYears is set on an inflow by mistake — it is an outflow-only concept', () => {
    const events: OneTimeEvent[] = [
      { id: 'e1', name: 'Inheritance', age: 70, amount: 25000, repeatEveryYears: 5, targetAccountId: 'brokerage' },
    ]
    // Fires once, at age 70 (the ordinary one-time case)...
    expect(applyOneTimeInflows(events, ageForOwner, accounts, balances, taxableCostBasis).balances.brokerage).toBe(125000)
    // ...but does NOT recur at age 75, unlike a real repeating outflow would.
    const ageForOwnerAt75 = () => 75
    expect(applyOneTimeInflows(events, ageForOwnerAt75, accounts, balances, taxableCostBasis).balances.brokerage).toBe(100000)
  })

  it('sums multiple inflow events landing in the same year', () => {
    const events: OneTimeEvent[] = [
      { id: 'e1', name: 'Inheritance', age: 70, amount: 100000, targetAccountId: 'brokerage' },
      { id: 'e2', name: 'Gift', age: 70, amount: 5000, targetAccountId: 'brokerage' },
    ]
    const result = applyOneTimeInflows(events, ageForOwner, accounts, balances, taxableCostBasis)
    expect(result.balances.brokerage).toBe(205000)
    expect(result.totalInflow).toBe(105000)
  })
})
