// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { HistoricalReturnYear } from './historicalReturns'
import { bootstrapSample, computePercentile, createRng, runMonteCarloProjection } from './monteCarlo'
import type { MonteCarloInputs } from './monteCarlo'
import type { PensionInputs } from './pension'
import { runProjection } from './projection'
import type { ProjectionInputs } from './projection'
import type { SocialSecurityInputs } from './socialSecurity'
import type { GuardrailsSettings } from './guardrails'
import type { OneTimeEvent } from './oneTimeEvents'
import type { RmdSurplusSettings } from './rmd'
import type { TaxSettings } from './tax'
import type { Account, GrowthInputs, PersonalInputs } from './types'

const taxes: TaxSettings = { stateRate: 0 }
const rmdSurplus: RmdSurplusSettings = { strategy: 'spend' }
const oneTimeEvents: OneTimeEvent[] = []
const guardrails: GuardrailsSettings = {
  strategy: 'fixed',
  upperGuardrailPct: 0.2,
  cutPct: 0.1,
  lowerGuardrailPct: 0.2,
  raisePct: 0.1,
}

describe('createRng', () => {
  it('produces values in [0, 1)', () => {
    const rng = createRng(42)
    for (let i = 0; i < 100; i++) {
      const value = rng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('is deterministic: the same seed reproduces the same sequence', () => {
    const a = createRng(123)
    const b = createRng(123)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('different seeds produce different sequences', () => {
    const a = createRng(1)
    const b = createRng(2)
    const seqA = Array.from({ length: 5 }, () => a())
    const seqB = Array.from({ length: 5 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })
})

describe('bootstrapSample', () => {
  const pool: HistoricalReturnYear[] = [
    { year: 2001, realReturn: 0.1 },
    { year: 2002, realReturn: 0.2 },
    { year: 2003, realReturn: 0.3 },
  ]

  it('maps a low rng draw to the first pool entry', () => {
    expect(bootstrapSample(() => 0, pool)).toBe(0.1)
  })

  it('maps a mid rng draw to the second pool entry', () => {
    expect(bootstrapSample(() => 0.34, pool)).toBe(0.2)
  })

  it('maps a draw near 1 to the last pool entry, never out of bounds', () => {
    expect(bootstrapSample(() => 0.99999, pool)).toBe(0.3)
    expect(bootstrapSample(() => 1 - Number.EPSILON, pool)).toBe(0.3)
  })
})

describe('computePercentile', () => {
  const sorted = [10, 20, 30, 40, 50]

  it('matches hand-computed nearest-rank percentiles', () => {
    expect(computePercentile(sorted, 0)).toBe(10)
    expect(computePercentile(sorted, 0.1)).toBe(10)
    expect(computePercentile(sorted, 0.5)).toBe(30)
    expect(computePercentile(sorted, 0.9)).toBe(40)
    expect(computePercentile(sorted, 1)).toBe(50)
  })
})

describe('runMonteCarloProjection', () => {
  const personal: PersonalInputs = { currentAge: 60, retirementAge: 61, horizonAge: 65, currentYear: 2026 }
  const spending = { monthlySpendExclMortgage: 1000, bridgeHealthInsuranceMonthly: 0, medicareEligibilityAge: 999 }
  const pensions: PensionInputs[] = []
  const socialSecurity: SocialSecurityInputs[] = [
    { monthlyBenefitAt62: 0, monthlyBenefitAt67: 0, monthlyBenefitAt70: 0, claimingAge: 999, haircut: 1 },
  ]

  it('is deterministic: the same seed reproduces identical results', () => {
    const accounts: Account[] = [{ id: 'a', name: 'A', type: 'taxable', balance: 100000, annualContribution: 0 }]
    const inputs: MonteCarloInputs = {
      personal,
      accounts,
      spending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
      inflation: 0.03,
      numSimulations: 200,
      seed: 7,
    }
    expect(runMonteCarloProjection(inputs)).toEqual(runMonteCarloProjection(inputs))
  })

  it('matches the deterministic projection when the historical pool has exactly one return', () => {
    const accounts: Account[] = [
      { id: 'taxable', name: 'Taxable', type: 'taxable', balance: 100000, annualContribution: 0 },
      { id: 'taxDeferred', name: 'TaxDeferred', type: 'tax-deferred', balance: 50000, annualContribution: 0 },
    ]
    const growth: GrowthInputs = { nominalReturn: 0.07, inflation: 0.03 }
    const fixedRealReturn = (1 + growth.nominalReturn) / (1 + growth.inflation) - 1

    const deterministicInputs: ProjectionInputs = {
      personal,
      growth,
      accounts,
      spending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    }
    const deterministic = runProjection(deterministicInputs)

    const mcInputs: MonteCarloInputs = {
      personal,
      accounts,
      spending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
      inflation: growth.inflation,
      numSimulations: 3,
      seed: 1,
      historicalReturns: [{ year: 2000, realReturn: fixedRealReturn }],
    }
    const mc = runMonteCarloProjection(mcInputs)

    for (const yearPercentiles of mc.percentiles) {
      const expected = deterministic.find((y) => y.age === yearPercentiles.age)!.totalPortfolio
      expect(yearPercentiles.p10).toBeCloseTo(expected, 4)
      expect(yearPercentiles.p30).toBeCloseTo(expected, 4)
      expect(yearPercentiles.p50).toBeCloseTo(expected, 4)
      expect(yearPercentiles.p70).toBeCloseTo(expected, 4)
      expect(yearPercentiles.p90).toBeCloseTo(expected, 4)
    }
  })

  it('orders percentiles p10 <= p30 <= p50 <= p70 <= p90 for every year, given varied returns', () => {
    const accounts: Account[] = [{ id: 'a', name: 'A', type: 'taxable', balance: 100000, annualContribution: 0 }]
    const varied: import('./historicalReturns').HistoricalReturnYear[] = [
      { year: 2000, realReturn: -0.3 },
      { year: 2001, realReturn: -0.1 },
      { year: 2002, realReturn: 0.05 },
      { year: 2003, realReturn: 0.15 },
      { year: 2004, realReturn: 0.35 },
    ]
    const inputs: MonteCarloInputs = {
      personal,
      accounts,
      spending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
      inflation: 0.03,
      numSimulations: 500,
      seed: 11,
      historicalReturns: varied,
    }
    const result = runMonteCarloProjection(inputs)
    for (const y of result.percentiles) {
      expect(y.p10).toBeLessThanOrEqual(y.p30)
      expect(y.p30).toBeLessThanOrEqual(y.p50)
      expect(y.p50).toBeLessThanOrEqual(y.p70)
      expect(y.p70).toBeLessThanOrEqual(y.p90)
    }
  })

  it('goes negative by the cumulative shortfall once a simulation depletes, instead of clamping at 0', () => {
    const accounts: Account[] = [{ id: 'a', name: 'A', type: 'taxable', balance: 1000, annualContribution: 0 }]
    const noGrowthPersonal = { currentAge: 50, retirementAge: 51, horizonAge: 53, currentYear: 2026 }
    const inputs: MonteCarloInputs = {
      personal: noGrowthPersonal,
      accounts,
      spending: { monthlySpendExclMortgage: 2000 / 12, bridgeHealthInsuranceMonthly: 0, medicareEligibilityAge: 999 },
      pensions: [],
      socialSecurity: [
        { monthlyBenefitAt62: 0, monthlyBenefitAt67: 0, monthlyBenefitAt70: 0, claimingAge: 999, haircut: 1 },
      ],
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
      inflation: 0.03,
      numSimulations: 1,
      seed: 1,
      historicalReturns: [{ year: 2000, realReturn: 0 }],
    }
    const result = runMonteCarloProjection(inputs)
    const byAge = Object.fromEntries(result.percentiles.map((p) => [p.age, p.p50]))

    // Balance covers only the first year's $2000 need (from $1000), so each
    // subsequent year adds another full $2000 of unmet need to the running deficit.
    expect(byAge[51]).toBeCloseTo(-1000, 6)
    expect(byAge[52]).toBeCloseTo(-3000, 6)
    expect(byAge[53]).toBeCloseTo(-5000, 6)
  })

  it('reports 0% success when returns are catastrophic and the plan always depletes', () => {
    const accounts: Account[] = [{ id: 'a', name: 'A', type: 'taxable', balance: 1000, annualContribution: 0 }]
    const inputs: MonteCarloInputs = {
      personal,
      accounts,
      spending: { ...spending, monthlySpendExclMortgage: 10000 },
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
      inflation: 0.03,
      numSimulations: 50,
      seed: 3,
      historicalReturns: [{ year: 2000, realReturn: -0.9 }],
    }
    expect(runMonteCarloProjection(inputs).successRate).toBe(0)
  })

  it('reports 100% success when the portfolio comfortably covers spending every year', () => {
    const accounts: Account[] = [{ id: 'a', name: 'A', type: 'taxable', balance: 10_000_000, annualContribution: 0 }]
    const inputs: MonteCarloInputs = {
      personal,
      accounts,
      spending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
      inflation: 0.03,
      numSimulations: 50,
      seed: 9,
      historicalReturns: [{ year: 2000, realReturn: 0.05 }],
    }
    expect(runMonteCarloProjection(inputs).successRate).toBe(1)
  })
})
