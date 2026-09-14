import { LineAreaChart } from './charts/LineAreaChart'
import type { ProjectionYear } from '../engine/projection'

export interface HomeEquityChartProps {
  years: ProjectionYear[]
  height?: number
}

/**
 * Shows home value over time, split into what's actually yours (equity) and what's
 * still owed on a linked mortgage — stacked so the top of the band is always the
 * home's total value. `homeValue`/`homeEquity` come straight from `ProjectionYear`;
 * the remaining mortgage balance is just their difference (a home with no linked
 * mortgage, or one that's been sold, has 0 there). Both drop to 0 together once a
 * home is sold — see the Year-by-Year table's "Home sold" flag for exactly when.
 */
export function HomeEquityChart({ years, height }: HomeEquityChartProps) {
  return (
    <LineAreaChart
      mode="stackedArea"
      xValues={years.map((y) => y.age)}
      height={height}
      series={[
        {
          id: 'homeEquity',
          label: 'Home equity',
          color: 'var(--series-3)',
          values: years.map((y) => y.homeEquity),
        },
        {
          id: 'remainingMortgage',
          label: 'Remaining mortgage',
          color: 'var(--series-4)',
          values: years.map((y) => y.homeValue - y.homeEquity),
        },
      ]}
    />
  )
}
