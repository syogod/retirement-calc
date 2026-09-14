// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { filterTicksByPixelGap, niceTicks } from './chartMath'

describe('niceTicks', () => {
  it('produces clean round ticks spanning the range', () => {
    expect(niceTicks(0, 1000, 5)).toEqual([0, 200, 400, 600, 800, 1000])
  })

  it('regression: the last tick must never be below max (or the chart clips its own peak)', () => {
    // With the old buggy loop bound, a max just above a "nice" multiple (here, just
    // above 1,000,000 with a 500,000 step) stopped the loop one tick short — the
    // chart's y-axis ceiling ended up *below* the actual data max, silently clipping
    // the top of the line/area off the rendered SVG.
    const ticks = niceTicks(0, 1_050_000, 5)
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(1_050_000)
    expect(ticks[ticks.length - 1]).toBe(1_500_000)
  })

  it('never returns a last tick below max, across a range of values', () => {
    for (let max = 1; max <= 2_000_000; max += 37_123) {
      const ticks = niceTicks(0, max, 5)
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max)
    }
  })

  it('returns a single-element array when min equals max', () => {
    expect(niceTicks(5, 5)).toEqual([5])
  })

  it('respects a non-zero min as the floor', () => {
    const ticks = niceTicks(-200000, 0, 3)
    expect(ticks[0]).toBeLessThanOrEqual(-200000)
  })
})

describe('filterTicksByPixelGap', () => {
  it('keeps every tick when they are all far enough apart', () => {
    const toPixel = (v: number) => 100 - v // arbitrary monotonic mapping
    expect(filterTicksByPixelGap([0, 10, 20, 30], toPixel, 5)).toEqual([0, 10, 20, 30])
  })

  it('drops a tick that would collide with the previously kept one', () => {
    // 0 -> pixel 100, 0.001 -> pixel 99.999 (collides with 0), 50 -> pixel 50 (far enough)
    const toPixel = (v: number) => 100 - v
    expect(filterTicksByPixelGap([0, 0.001, 50], toPixel, 14)).toEqual([0, 50])
  })

  it('always keeps the first (most extreme) tick even if others collide with it', () => {
    const toPixel = (v: number) => v
    expect(filterTicksByPixelGap([-200000, -199999, -199998, 0], toPixel, 14)).toEqual([-200000, 0])
  })

  it('returns an empty array for an empty input', () => {
    expect(filterTicksByPixelGap([], (v) => v, 14)).toEqual([])
  })
})
