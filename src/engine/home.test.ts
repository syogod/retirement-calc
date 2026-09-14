// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { calculateHomeSale } from './home'

describe('calculateHomeSale', () => {
  it('nets sale value minus selling costs minus the mortgage payoff, with no gain at all', () => {
    // $600,000 sale, 6% selling costs -> $564,000 realized. Basis is also $600,000
    // (no gain), $200,000 mortgage payoff.
    const result = calculateHomeSale(600000, 600000, 0.06, 200000, 'single')
    expect(result.netProceeds).toBeCloseTo(564000 - 200000, 2)
    expect(result.taxableGain).toBe(0)
  })

  it('excludes gain up to the primary-residence exclusion before any tax applies', () => {
    // $600,000 sale, 6% costs -> $564,000 realized. Basis $300,000 -> gain $264,000,
    // fully under the $250,000 single exclusion... wait, $264,000 > $250,000, so
    // $14,000 is taxable.
    const result = calculateHomeSale(600000, 300000, 0.06, 0, 'single')
    expect(result.taxableGain).toBeCloseTo(264000 - 250000, 2)
  })

  it('excludes the full gain when it is under the exclusion amount', () => {
    const result = calculateHomeSale(500000, 300000, 0.06, 0, 'single')
    // Realized: 470000, gain: 170000, well under 250000 -> no tax.
    expect(result.taxableGain).toBe(0)
  })

  it('uses the larger married-filing-jointly exclusion ($500,000)', () => {
    const result = calculateHomeSale(1_000_000, 300000, 0.06, 0, 'marriedFilingJointly')
    // Realized: 940000, gain: 640000, minus 500000 exclusion -> 140000 taxable.
    expect(result.taxableGain).toBeCloseTo(140000, 2)
  })

  it('never reports a negative gain when selling at a loss (selling costs eat into a small gain)', () => {
    const result = calculateHomeSale(300000, 300000, 0.06, 0, 'single')
    // Realized: 282000 < basis 300000 -> a loss, not a negative "gain".
    expect(result.taxableGain).toBe(0)
  })

  it('pays off the mortgage in full from proceeds, even if that leaves little or nothing left', () => {
    const result = calculateHomeSale(300000, 300000, 0.06, 290000, 'single')
    // Realized: 282000, minus a 290000 mortgage payoff -> negative net proceeds
    // (still underwater after selling costs) — reported as-is, not floored, since
    // that's a real shortfall the household would have to cover some other way.
    expect(result.netProceeds).toBeCloseTo(282000 - 290000, 2)
  })

  it('defaults cost basis behavior is the caller\'s job — this function takes basis as given', () => {
    // Sanity check: a basis equal to sale value (no gain) with zero selling costs and no mortgage nets exactly the sale value.
    const result = calculateHomeSale(500000, 500000, 0, 0, 'single')
    expect(result.netProceeds).toBe(500000)
    expect(result.taxableGain).toBe(0)
  })
})
