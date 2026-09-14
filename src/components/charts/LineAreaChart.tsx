import { Fragment } from 'react'
import { CHART_VIEWBOX_WIDTH, createLinearScale, formatCompactDollars, niceTicks } from './chartMath'
import { useChartHover } from './useChartHover'

export interface ChartSeries {
  id: string
  label: string
  color: string
  values: number[]
}

export interface LineAreaChartProps {
  /** Ages (or years) aligned with every series' `values` array. */
  xValues: number[]
  series: ChartSeries[]
  /** 'line' draws each series as its own line (+ a light area wash if there's only
   * one). 'stackedArea' stacks every series cumulatively — a part-to-whole view. */
  mode: 'line' | 'stackedArea'
  /** Extra plain (dashed) lines drawn on top, sharing the same y-scale but never
   * stacked — e.g. a "spending need" target line over a stacked area of what covers it. */
  referenceLines?: ChartSeries[]
  valueFormatter?: (value: number) => string
  height?: number
}

const WIDTH = CHART_VIEWBOX_WIDTH
const MARGIN = { top: 16, right: 16, bottom: 32, left: 56 }

export function LineAreaChart({
  xValues,
  series,
  mode,
  referenceLines = [],
  valueFormatter = formatCompactDollars,
  height = 320,
}: LineAreaChartProps) {
  const plotLeft = MARGIN.left
  const plotRight = WIDTH - MARGIN.right
  const plotTop = MARGIN.top
  const plotBottom = height - MARGIN.bottom
  const plotWidth = plotRight - plotLeft

  const n = xValues.length
  const { svgRef, hoverIndex, handleMouseMove, handleMouseLeave } = useChartHover(n, plotLeft, plotWidth)

  const xScale = createLinearScale([0, Math.max(1, n - 1)], [plotLeft, plotRight])

  const stackedTops: number[][] =
    mode === 'stackedArea'
      ? series.reduce<number[][]>((acc, s) => {
          const prevTop = acc.length > 0 ? acc[acc.length - 1] : xValues.map(() => 0)
          acc.push(s.values.map((v, i) => prevTop[i] + v))
          return acc
        }, [])
      : []

  const allValues =
    mode === 'stackedArea'
      ? [...(stackedTops[stackedTops.length - 1] ?? [0]), ...referenceLines.flatMap((r) => r.values), 0]
      : [...series.flatMap((s) => s.values), ...referenceLines.flatMap((r) => r.values), 0]
  const maxValue = Math.max(...allValues)
  const yTicks = niceTicks(0, maxValue, 5)
  const yMax = yTicks[yTicks.length - 1] || 1
  const yScale = createLinearScale([0, yMax], [plotBottom, plotTop])

  function pathFor(values: number[]): string {
    return values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ')
  }

  function areaFor(topValues: number[], bottomValues: number[]): string {
    const top = topValues.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ')
    // Trace back right-to-left along the bottom edge, so each value stays paired with
    // its own x position (reverse the array first, not just the x positions).
    const bottom = [...bottomValues]
      .reverse()
      .map((v, i) => `L ${xScale(n - 1 - i)} ${yScale(v)}`)
      .join(' ')
    return `${top} ${bottom} Z`
  }

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
            <line
              className="chart-gridline"
              x1={plotLeft}
              x2={plotRight}
              y1={yScale(tick)}
              y2={yScale(tick)}
            />
            <text className="chart-axis-label" x={plotLeft - 8} y={yScale(tick)} textAnchor="end" dominantBaseline="middle">
              {formatCompactDollars(tick)}
            </text>
          </Fragment>
        ))}

        <line className="chart-baseline" x1={plotLeft} x2={plotRight} y1={plotBottom} y2={plotBottom} />

        {xValues.map((x, i) =>
          i % xTickEvery === 0 || i === n - 1 ? (
            <text key={x} className="chart-axis-label" x={xScale(i)} y={plotBottom + 20} textAnchor="middle">
              {x}
            </text>
          ) : null,
        )}

        {mode === 'stackedArea' &&
          series.map((s, si) => {
            const top = stackedTops[si]
            const bottom = si === 0 ? xValues.map(() => 0) : stackedTops[si - 1]
            return (
              <path key={s.id} d={areaFor(top, bottom)} fill={s.color} fillOpacity={0.82} stroke="none" />
            )
          })}
        {mode === 'stackedArea' &&
          stackedTops.slice(0, -1).map((top, i) => (
            <path key={series[i].id + '-edge'} d={pathFor(top)} fill="none" stroke="var(--chart-surface)" strokeWidth={2} />
          ))}

        {mode === 'line' && series.length === 1 && (
          <path d={areaFor(series[0].values, xValues.map(() => 0))} fill={series[0].color} fillOpacity={0.1} stroke="none" />
        )}
        {mode === 'line' &&
          series.map((s) => (
            <path key={s.id} d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          ))}

        {referenceLines.map((r) => (
          <path
            key={r.id}
            d={pathFor(r.values)}
            fill="none"
            stroke={r.color}
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
        ))}

        {(mode === 'line' ? series : []).map((s) => {
          const lastIndex = s.values.length - 1
          return (
            <circle
              key={s.id + '-dot'}
              cx={xScale(lastIndex)}
              cy={yScale(s.values[lastIndex])}
              r={4}
              fill={s.color}
              stroke="var(--chart-surface)"
              strokeWidth={2}
            />
          )
        })}

        {hoverIndex !== null && (
          <line
            className="chart-crosshair"
            x1={xScale(hoverIndex)}
            x2={xScale(hoverIndex)}
            y1={plotTop}
            y2={plotBottom}
          />
        )}
      </svg>

      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span className="chart-legend-item" key={s.id}>
              <span className="chart-legend-swatch" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
          {referenceLines.map((r) => (
            <span className="chart-legend-item" key={r.id}>
              <span className="chart-legend-swatch chart-legend-swatch--line" style={{ background: r.color }} />
              {r.label}
            </span>
          ))}
        </div>
      )}

      {hoverIndex !== null && (
        <div
          className="chart-tooltip"
          style={{ left: `${(xScale(hoverIndex) / WIDTH) * 100}%` }}
        >
          <div className="chart-tooltip-header">Age {xValues[hoverIndex]}</div>
          {(mode === 'stackedArea' ? [...series].reverse() : series).map((s) => (
            <div className="chart-tooltip-row" key={s.id}>
              <span className="chart-legend-swatch" style={{ background: s.color }} />
              <span>{s.label}</span>
              <span className="chart-tooltip-value">{valueFormatter(s.values[hoverIndex])}</span>
            </div>
          ))}
          {referenceLines.map((r) => (
            <div className="chart-tooltip-row" key={r.id}>
              <span className="chart-legend-swatch chart-legend-swatch--line" style={{ background: r.color }} />
              <span>{r.label}</span>
              <span className="chart-tooltip-value">{valueFormatter(r.values[hoverIndex])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
