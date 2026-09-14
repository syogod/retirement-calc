import type { ProjectionYear } from '../engine/projection'
import type { Account } from '../engine/types'

/**
 * Flattens the year-by-year projection into a CSV string, one row per year — for
 * opening in a spreadsheet, not for round-tripping back into the app (that's what
 * the JSON save file is for). Per-account balance columns use each account's name
 * as the header, in the same order as `accounts`; mortgages and homes are excluded
 * since neither appears in `ProjectionYear.balances` (see `home.ts`).
 */
export function projectionToCsv(years: ProjectionYear[], accounts: Account[]): string {
  const balanceAccounts = accounts.filter((a) => a.type !== 'mortgage' && a.type !== 'home')

  const headers = [
    'Age',
    'Year',
    'Total Portfolio',
    ...balanceAccounts.map((a) => a.name),
    'Spending Need',
    'Guaranteed Income',
    'Net Withdrawal',
    'Tax Owed',
    'RMD Withdrawn',
    'Home Value',
    'Home Equity',
    'One-Time Inflow',
    'One-Time Outflow',
    'Funds Depleted',
    'Early Withdrawal Penalty',
  ]

  const rows = years.map((y) => [
    y.age,
    y.year,
    round2(y.totalPortfolio),
    ...balanceAccounts.map((a) => round2(y.balances[a.id] ?? 0)),
    round2(y.spendingNeed),
    round2(y.guaranteedIncome),
    round2(y.netWithdrawalTaken),
    round2(y.taxOwed),
    round2(y.rmdWithdrawn),
    round2(y.homeValue),
    round2(y.homeEquity),
    round2(y.oneTimeInflow),
    round2(y.oneTimeOutflow),
    y.fundsDepleted ? 'Yes' : 'No',
    y.earlyWithdrawalPenaltyFlag ? 'Yes' : 'No',
  ])

  return [headers, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n')
}

function csvField(value: string | number): string {
  const str = String(value)
  return /["\r\n,]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

/** Cents are meaningless for a real-dollars, multi-decade projection — round off
 * the same floating-point dust the rest of the app rounds away for display. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}
