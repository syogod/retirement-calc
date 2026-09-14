import { assignSeriesColors } from './charts/palette'
import { LineAreaChart } from './charts/LineAreaChart'
import type { ProjectionYear } from '../engine/projection'
import type { Account } from '../engine/types'

export interface AccountBreakdownChartProps {
  years: ProjectionYear[]
  accounts: Account[]
  height?: number
}

export function AccountBreakdownChart({ years, accounts, height }: AccountBreakdownChartProps) {
  // Mortgages and homes are excluded from `balances` entirely (a liability and a
  // non-portfolio asset, respectively — see `home.ts`) — they'd otherwise show up
  // here as a meaningless flat-$0 series, same bug this app already fixed once for
  // mortgages alone.
  const investableAccounts = accounts.filter((account) => account.type !== 'mortgage' && account.type !== 'home')
  const groups = assignSeriesColors(investableAccounts, (account) => account.id)

  const series = groups.map((group) => ({
    id: group.key,
    label: group.items.length > 1 ? 'Other' : group.items[0].name,
    color: group.color,
    values: years.map((year) => group.items.reduce((sum, account) => sum + (year.balances[account.id] ?? 0), 0)),
  }))

  return <LineAreaChart mode="stackedArea" xValues={years.map((y) => y.age)} series={series} height={height} />
}
