import type { GuardrailsSettings } from './guardrails'
import type { HistoricalReturnYear } from './historicalReturns'
import { SP500_HISTORICAL_REAL_RETURNS } from './historicalReturns'
import type { PensionInputs } from './pension'
import type { OneTimeEvent } from './oneTimeEvents'
import type { AdvanceYearInputs } from './projection'
import { advanceProjectionYear, createInitialProjectionState } from './projection'
import type { RmdSurplusSettings } from './rmd'
import type { SocialSecurityInputs } from './socialSecurity'
import type { SpendingInputs } from './spending'
import type { TaxSettings } from './tax'
import type { Account, PersonalInputs } from './types'

export interface MonteCarloInputs {
  personal: PersonalInputs
  accounts: Account[]
  spending: SpendingInputs
  pensions: PensionInputs[]
  socialSecurity: SocialSecurityInputs[]
  taxes: TaxSettings
  rmdSurplus: RmdSurplusSettings
  oneTimeEvents: OneTimeEvent[]
  guardrails: GuardrailsSettings
  /** Assumed inflation rate — investment returns are bootstrapped from real
   * (already inflation-adjusted) historical data, but a mortgage's fixed nominal
   * payment still needs this to convert into each year's real dollars. */
  inflation: number
  numSimulations: number
  /** Seed for reproducible runs. A time-based seed is used when omitted. */
  seed?: number
  /** Pool of historical real annual returns to bootstrap from. Defaults to the bundled
   * S&P 500 real-return dataset (see historicalReturns.ts). */
  historicalReturns?: HistoricalReturnYear[]
}

export interface YearPercentiles {
  age: number
  year: number
  /**
   * 10th/30th/50th/70th/90th percentile "net position" across all simulations: the
   * portfolio balance, minus the cumulative shortfall (unmet spending need) once a
   * simulation has depleted. A portfolio balance itself can never go negative, but
   * this can — it's what tells a bad simulation ("ran dry, $10K/year short") apart
   * from a catastrophic one ("ran dry, $80K/year short"), which look identical if
   * you only ever clamp at $0. Equal to the plain portfolio balance for any
   * simulation that never depletes.
   */
  p10: number
  p30: number
  p50: number
  p70: number
  p90: number
}

export interface MonteCarloResult {
  /** Per-year percentile bands of net position (see `YearPercentiles`) across all simulations. */
  percentiles: YearPercentiles[]
  /** Fraction (0-1) of simulations that never ran out of money before the horizon age. */
  successRate: number
}

/** Small, fast, deterministic PRNG (mulberry32) so a given seed always reproduces the
 * same sequence of simulations. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Draws one real annual return from `pool`, uniformly at random with replacement. */
export function bootstrapSample(rng: () => number, pool: HistoricalReturnYear[]): number {
  const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length))
  return pool[index].realReturn
}

/** Nearest-rank percentile of an already-sorted array (ascending), `p` in [0, 1]. */
export function computePercentile(sortedValues: number[], p: number): number {
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.floor(p * (sortedValues.length - 1))))
  return sortedValues[index]
}

function runSingleSimulation(
  rng: () => number,
  pool: HistoricalReturnYear[],
  personal: PersonalInputs,
  advanceInputs: AdvanceYearInputs,
): { netPositionByYearIndex: number[]; depleted: boolean } {
  let state = createInitialProjectionState(advanceInputs.accounts)
  const netPositionByYearIndex: number[] = [sum(Object.values(state.balances))]
  let depleted = false
  let cumulativeShortfall = 0

  for (let age = personal.currentAge + 1; age <= personal.horizonAge; age++) {
    const r = bootstrapSample(rng, pool)
    const step = advanceProjectionYear(state, age, r, advanceInputs)
    state = step.state
    if (step.year.fundsDepleted) depleted = true
    cumulativeShortfall += Math.max(0, step.year.netWithdrawalNeeded - step.year.netWithdrawalTaken)
    netPositionByYearIndex.push(step.year.totalPortfolio - cumulativeShortfall)
  }

  return { netPositionByYearIndex, depleted }
}

/**
 * Runs `numSimulations` independent projections, each drawing a fresh bootstrapped
 * real return every year from the historical return pool (instead of one fixed
 * assumed return), reusing the same growth/withdrawal mechanics as the deterministic
 * projection. Returns per-year 10th/30th/50th/70th/90th percentile net position (see
 * `YearPercentiles`) and the fraction of simulations that never depleted before the
 * horizon age.
 */
export function runMonteCarloProjection(inputs: MonteCarloInputs): MonteCarloResult {
  const {
    personal,
    accounts,
    spending,
    pensions,
    socialSecurity,
    taxes,
    rmdSurplus,
    oneTimeEvents,
    guardrails,
    inflation,
    numSimulations,
  } = inputs
  const pool = inputs.historicalReturns ?? SP500_HISTORICAL_REAL_RETURNS
  const rng = createRng(inputs.seed ?? Date.now())

  const advanceInputs: AdvanceYearInputs = {
    accounts,
    retirementAge: personal.retirementAge,
    spending,
    pensions,
    socialSecurity,
    currentAge: personal.currentAge,
    inflation,
    spouse: personal.spouse,
    currentYear: personal.currentYear,
    taxes,
    rmdSurplus,
    guardrails,
    oneTimeEvents,
  }

  const numYears = personal.horizonAge - personal.currentAge + 1
  const netPositionsByYearIndex: number[][] = Array.from({ length: numYears }, () => [])
  let successCount = 0

  for (let sim = 0; sim < numSimulations; sim++) {
    const { netPositionByYearIndex, depleted } = runSingleSimulation(rng, pool, personal, advanceInputs)
    for (let i = 0; i < numYears; i++) {
      netPositionsByYearIndex[i].push(netPositionByYearIndex[i])
    }
    if (!depleted) successCount++
  }

  const percentiles: YearPercentiles[] = netPositionsByYearIndex.map((totals, i) => {
    const sorted = [...totals].sort((a, b) => a - b)
    return {
      age: personal.currentAge + i,
      year: personal.currentYear + i,
      p10: computePercentile(sorted, 0.1),
      p30: computePercentile(sorted, 0.3),
      p50: computePercentile(sorted, 0.5),
      p70: computePercentile(sorted, 0.7),
      p90: computePercentile(sorted, 0.9),
    }
  })

  return {
    percentiles,
    successRate: numSimulations > 0 ? successCount / numSimulations : 0,
  }
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
