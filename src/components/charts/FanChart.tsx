import { Fragment } from 'react'
import { CHART_VIEWBOX_WIDTH, createLinearScale, filterTicksByPixelGap, formatCompactDollars, niceTicks } from './chartMath'
import { useChartHover } from './useChartHover'

export interface FanChartPoint {
  x: number
  p10: number
  p30: number
  p50: number
  p70: number
  p90: number
}

export interface FanChartProps {
  points: FanChartPoint[]
  color: string
  height?: number
}

const WIDTH = CHART_VIEWBOX_WIDTH
const MARGIN = { top: 16, right: 16, bottom: 32, left: 56 }

/** Traces a closed band polygon between an upper and lower series, tracing the top
 * left-to-right and the bottom back right-to-left (reversing the array, not just the
 * x positions, so each value stays paired with its own x). */
function bandPath(
  upper: number[],
  lower: number[],
  xScale: (i: number) => number,
  yScale: (v: number) => number,
): string {
  const n = upper.length
  const top = upper.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ')
  const bottom = [...lower]
    .reverse()
    .map((v, i) => `L ${xScale(n - 1 - i)} ${yScale(v)}`)
    .join(' ')
  return `${top} ${bottom} Z`
}

/** Median line with shaded 10th-90th and 30th-70th percentile bands — the standard
 * "fan chart" for an uncertain projection over time. One hue throughout: progressively
 * darker toward the center, so it reads as one series' uncertainty, not several. */
export function FanChart({ points, color, height = 320 }: FanChartProps) {
  const plotLeft = MARGIN.left
  const plotRight = WIDTH - MARGIN.right
  const plotTop = MARGIN.top
  const plotBottom = height - MARGIN.bottom
  const plotWidth = plotRight - plotLeft

  const n = points.length
  const { svgRef, hoverIndex, handleMouseMove, handleMouseLeave } = useChartHover(n, plotLeft, plotWidth)

  const xScale = createLinearScale([0, Math.max(1, n - 1)], [plotLeft, plotRight])

  // The axis floor tracks the actual minimum across the band (p10), not a hardcoded
  // 0 — a plan that never dips below, say, $500K shouldn't waste half the chart on
  // empty space below it, and one that runs out should visibly dip below $0 rather
  // than clamp there.
  const minValue = Math.min(0, ...points.map((p) => p.p10))
  const maxValue = Math.max(...points.map((p) => p.p90))

  const positiveTicks = niceTicks(0, maxValue, 5)
  const yMax = positiveTicks[positiveTicks.length - 1] || 1

  // Nice-round the negative floor using ITS OWN (small) span rather than the full
  // min-to-max span — otherwise a step sized for a $100M+ range floors a $29K
  // shortfall all the way down to -$50M, wasting most of the chart.
  const negativeTicks = minValue < 0 ? niceTicks(minValue, 0, 3).filter((t) => t < 0) : []
  const yMin = negativeTicks.length > 0 ? negativeTicks[0] : minValue
  const yScale = createLinearScale([yMin, yMax], [plotBottom, plotTop])
  // Drop any tick whose label would sit within ~14px of another — most visibly, the
  // negative floor colliding with $0 when the shortfall is tiny next to the upside.
  const yTicks = filterTicksByPixelGap([...negativeTicks, ...positiveTicks], yScale, 14)

  const outerBand = bandPath(
    points.map((p) => p.p90),
    points.map((p) => p.p10),
    xScale,
    yScale,
  )
  const innerBand = bandPath(
    points.map((p) => p.p70),
    points.map((p) => p.p30),
    xScale,
    yScale,
  )
  const medianPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p.p50)}`).join(' ')

  const xTickEvery = Math.max(1, Math.ceil(n / 9))

  return (
    <div className="chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {yTicks.map((tick) => (
          <Fragment key={tick}>
            <line className="chart-gridline" x1={plotLeft} x2={plotRight} y1={yScale(tick)} y2={yScale(tick)} />
            <text className="chart-axis-label" x={plotLeft - 8} y={yScale(tick)} textAnchor="end" dominantBaseline="middle">
              {formatCompactDollars(tick)}
            </text>
          </Fragment>
        ))}
        <line className="chart-baseline" x1={plotLeft} x2={plotRight} y1={yScale(0)} y2={yScale(0)} />
        {points.map((p, i) =>
          i % xTickEvery === 0 || i === n - 1 ? (
            <text key={p.x} className="chart-axis-label" x={xScale(i)} y={plotBottom + 20} textAnchor="middle">
              {p.x}
            </text>
          ) : null,
        )}

        <path d={outerBand} fill={color} fillOpacity={0.14} stroke="none" />
        <path d={innerBand} fill={color} fillOpacity={0.28} stroke="none" />
        <path d={medianPath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {hoverIndex !== null && (
          <line className="chart-crosshair" x1={xScale(hoverIndex)} x2={xScale(hoverIndex)} y1={plotTop} y2={plotBottom} />
        )}
      </svg>

      <div className="chart-legend">
        <span className="chart-legend-item">
          <span className="chart-legend-swatch chart-legend-swatch--line" style={{ background: color }} />
          Median outcome
        </span>
        <span className="chart-legend-item">
          <span className="chart-legend-swatch" style={{ background: color, opacity: 0.55 }} />
          30th-70th percentile range
        </span>
        <span className="chart-legend-item">
          <span className="chart-legend-swatch" style={{ background: color, opacity: 0.28 }} />
          10th-90th percentile range
        </span>
      </div>

      {hoverIndex !== null && (
        <div className="chart-tooltip" style={{ left: `${(xScale(hoverIndex) / WIDTH) * 100}%` }}>
          <div className="chart-tooltip-header">Age {points[hoverIndex].x}</div>
          <div className="chart-tooltip-row">
            <span>90th percentile</span>
            <span className="chart-tooltip-value">{formatCompactDollars(points[hoverIndex].p90)}</span>
          </div>
          <div className="chart-tooltip-row">
            <span>70th percentile</span>
            <span className="chart-tooltip-value">{formatCompactDollars(points[hoverIndex].p70)}</span>
          </div>
          <div className="chart-tooltip-row">
            <span>Median</span>
            <span className="chart-tooltip-value">{formatCompactDollars(points[hoverIndex].p50)}</span>
          </div>
          <div className="chart-tooltip-row">
            <span>30th percentile</span>
            <span className="chart-tooltip-value">{formatCompactDollars(points[hoverIndex].p30)}</span>
          </div>
          <div className="chart-tooltip-row">
            <span>10th percentile</span>
            <span className="chart-tooltip-value">{formatCompactDollars(points[hoverIndex].p10)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
