/** Every chart's SVG viewBox is this many units wide — a fixed internal coordinate
 * system that CSS then scales to the real rendered width. Shared so callers that need
 * to reverse-engineer a target aspect ratio (e.g. "what `height` prop makes this chart
 * exactly fill a box of these pixel dimensions?") use the same number the charts do. */
export const CHART_VIEWBOX_WIDTH = 720

export function createLinearScale(domain: [number, number], range: [number, number]): (value: number) => number {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0 || 1
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0)
}

/**
 * "Nice" round-number tick values spanning [min, max], e.g. 0/1000/2000 rather than
 * whatever the raw data range happens to be. The last tick is guaranteed to be >= max
 * (via `Math.ceil`, not a loop bound that can stop short) — callers use it as the
 * chart's y-axis ceiling, and a max that fell just above the last tick used to get
 * clipped off the top of the chart entirely.
 */
export function niceTicks(min: number, max: number, targetCount = 5): number[] {
  if (min === max) return [min]
  const span = max - min
  const rawStep = span / targetCount
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const residual = rawStep / magnitude

  let step: number
  if (residual > 5) step = 10 * magnitude
  else if (residual > 2) step = 5 * magnitude
  else if (residual > 1) step = 2 * magnitude
  else step = magnitude

  const niceMin = Math.floor(min / step) * step
  const niceMax = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let t = niceMin; t <= niceMax + step * 0.5; t += step) {
    ticks.push(Math.round(t / step) * step)
  }
  return ticks
}

/**
 * Drops ticks that would render too close to the previous kept one, so labels don't
 * overlap — e.g. a tiny negative floor sitting right next to $0 on a chart whose top
 * is in the hundreds of millions. Always keeps the first (most extreme) tick.
 */
export function filterTicksByPixelGap(
  ticks: number[],
  toPixel: (value: number) => number,
  minGapPx: number,
): number[] {
  if (ticks.length === 0) return []
  const sorted = [...ticks].sort((a, b) => a - b)
  const kept: number[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const lastPixel = toPixel(kept[kept.length - 1])
    const thisPixel = toPixel(sorted[i])
    if (Math.abs(thisPixel - lastPixel) >= minGapPx) {
      kept.push(sorted[i])
    }
  }
  return kept
}

/** Compact dollar formatting for axis ticks and tooltips: $1.2M, $340K, $6,000. */
export function formatCompactDollars(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`
  return `${sign}$${Math.round(abs)}`
}

export function formatWholeDollars(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`
}
