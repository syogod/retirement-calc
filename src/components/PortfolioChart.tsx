import { LineAreaChart } from './charts/LineAreaChart'
import type { ProjectionYear } from '../engine/projection'

export interface PortfolioChartProps {
  years: ProjectionYear[]
  height?: number
}

export function PortfolioChart({ years, height }: PortfolioChartProps) {
  return (
    <LineAreaChart
      mode="line"
      xValues={years.map((y) => y.age)}
      series={[
        {
          id: 'total',
          label: 'Total portfolio',
          color: 'var(--series-1)',
          values: years.map((y) => y.totalPortfolio),
        },
      ]}
      height={height}
    />
  )
}
