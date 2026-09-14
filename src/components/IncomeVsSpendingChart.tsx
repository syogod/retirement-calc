import { LineAreaChart } from './charts/LineAreaChart'
import type { ProjectionYear } from '../engine/projection'

export interface IncomeVsSpendingChartProps {
  years: ProjectionYear[]
  height?: number
}

/**
 * Shows what covers each year's spending — guaranteed income, then the portfolio
 * withdrawal actually available to spend (net of tax and any early-withdrawal
 * penalty) — stacked against a dashed "spending need" target line. Those two should
 * meet (or fall short only once funds are actually depleted). Tax & penalties stack
 * on top as a third band, above the target line — visible proof that withdrawals are
 * grossed up to cover them, not just "spent" invisibly.
 */
export function IncomeVsSpendingChart({ years, height }: IncomeVsSpendingChartProps) {
  return (
    <LineAreaChart
      mode="stackedArea"
      xValues={years.map((y) => y.age)}
      height={height}
      series={[
        {
          id: 'guaranteedIncome',
          label: 'Guaranteed income (SS + pensions)',
          color: 'var(--series-3)',
          values: years.map((y) => y.guaranteedIncome),
        },
        {
          id: 'netWithdrawal',
          label: 'Portfolio withdrawal (net of tax)',
          color: 'var(--series-1)',
          values: years.map((y) => y.netWithdrawalTaken - y.taxOwed - y.earlyWithdrawalPenaltyAmount),
        },
        {
          id: 'taxAndPenalties',
          label: 'Taxes & penalties',
          color: 'var(--series-5)',
          values: years.map((y) => y.taxOwed + y.earlyWithdrawalPenaltyAmount),
        },
      ]}
      referenceLines={[
        {
          id: 'spendingNeed',
          label: 'Spending need',
          color: 'var(--chart-text-secondary)',
          values: years.map((y) => y.spendingNeed),
        },
      ]}
    />
  )
}
