// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { projectAccountGrowth, realReturn } from './growth'
import type { Account, GrowthInputs, PersonalInputs } from './types'

describe('realReturn', () => {
  it('derives the real return from nominal return and inflation', () => {
    expect(realReturn({ nominalReturn: 0.07, inflation: 0.03 })).toBeCloseTo(
      0.03883495145631068,
      10,
    )
  })
})

// Golden values below are the cached, actually-calculated numbers from running
// projectAccountGrowth() itself against this fixture, ages 42-45, which is a pure
// accumulation stretch (retirement age is 52, so no withdrawals affect these years) —
// a regression baseline, not tied to any external source.
describe('projectAccountGrowth', () => {
  const growth: GrowthInputs = { nominalReturn: 0.07, inflation: 0.03 }
  const personal: PersonalInputs = {
    currentAge: 42,
    retirementAge: 52,
    horizonAge: 95,
    currentYear: 2026,
  }
  const accounts: Account[] = [
    { id: 'espp', name: 'ESPP', type: 'taxable', balance: 45000, annualContribution: 13000 / (1 - 0.15) },
    { id: 'tsp', name: 'TSP', type: 'tax-deferred', balance: 360000, annualContribution: 0 },
    { id: 'brokerage', name: 'Brokerage', type: 'taxable', balance: 70000, annualContribution: 100 * 12 },
    { id: 'four01k-sam', name: '401(k) - Sam', type: 'tax-deferred', balance: 95000, annualContribution: 650 * 26 },
    { id: 'four01k-robin', name: '401(k) - Robin', type: 'tax-deferred', balance: 125000, annualContribution: 0 },
    { id: 'roth-sam', name: 'Roth IRA - Sam', type: 'roth', balance: 45000, annualContribution: 0 },
    { id: 'roth-robin', name: 'Roth IRA - Robin', type: 'roth', balance: 47000, annualContribution: 0 },
  ]

  it('matches the starting balances at the current age', () => {
    const years = projectAccountGrowth(accounts, personal, growth)
    expect(years[0].age).toBe(42)
    expect(years[0].year).toBe(2026)
    expect(years[0].total).toBeCloseTo(787000, 0)
  })

  it('matches the golden totals for the first few accumulation years', () => {
    const years = projectAccountGrowth(accounts, personal, growth)
    const byAge = Object.fromEntries(years.map((y) => [y.age, y]))

    expect(byAge[43].total).toBeCloseTo(850957.2244431752, 4)
    expect(byAge[44].total).toBeCloseTo(917398.2245928817, 4)
    expect(byAge[45].total).toBeCloseTo(986419.4577581107, 4)
  })

  it('matches the golden per-account balances at age 43', () => {
    const years = projectAccountGrowth(accounts, personal, growth)
    const age43 = years.find((y) => y.age === 43)!

    expect(age43.balances['espp']).toBeCloseTo(62041.69046259281, 4)
    expect(age43.balances['tsp']).toBeCloseTo(373980.58252427186, 4)
    expect(age43.balances['brokerage']).toBeCloseTo(73918.44660194175, 4)
    expect(age43.balances['four01k-sam']).toBeCloseTo(115589.32038834952, 4)
    expect(age43.balances['four01k-robin']).toBeCloseTo(129854.36893203884, 4)
    expect(age43.balances['roth-sam']).toBeCloseTo(46747.57281553398, 4)
    expect(age43.balances['roth-robin']).toBeCloseTo(48825.2427184466, 4)
  })

  it('stops contributions once an account reaches retirement age', () => {
    const soloAccounts: Account[] = [
      { id: 'a', name: 'A', type: 'taxable', balance: 1000, annualContribution: 500 },
    ]
    const soloPersonal: PersonalInputs = {
      currentAge: 50,
      retirementAge: 51,
      horizonAge: 53,
      currentYear: 2026,
    }
    const soloGrowth: GrowthInputs = { nominalReturn: 0.05, inflation: 0.02 }
    const r = realReturn(soloGrowth)

    const years = projectAccountGrowth(soloAccounts, soloPersonal, soloGrowth)
    const byAge = Object.fromEntries(years.map((y) => [y.age, y]))

    // age 51 is still before retirementAge (51 < 51 is false — retirement starts at 51)
    // so the transition into age 51 gets no contribution, but growth still applies.
    expect(byAge[51].total).toBeCloseTo(1000 * (1 + r), 10)
    // age 52 is past retirement too — still no contribution, just growth.
    expect(byAge[52].total).toBeCloseTo(1000 * (1 + r) * (1 + r), 10)
  })

  it('includes the last contribution the year before retirement age', () => {
    const soloAccounts: Account[] = [
      { id: 'a', name: 'A', type: 'taxable', balance: 1000, annualContribution: 500 },
    ]
    const soloPersonal: PersonalInputs = {
      currentAge: 49,
      retirementAge: 51,
      horizonAge: 51,
      currentYear: 2026,
    }
    const soloGrowth: GrowthInputs = { nominalReturn: 0.05, inflation: 0.02 }
    const r = realReturn(soloGrowth)

    const years = projectAccountGrowth(soloAccounts, soloPersonal, soloGrowth)
    const byAge = Object.fromEntries(years.map((y) => [y.age, y]))

    // age 50 < retirementAge 51, so this transition still gets the contribution.
    expect(byAge[50].total).toBeCloseTo(1000 * (1 + r) + 500, 10)
  })
})
