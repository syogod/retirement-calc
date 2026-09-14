import { describe, expect, it } from 'vitest'
import { projectionToCsv } from './csvExport'
import type { ProjectionYear } from '../engine/projection'
import type { Account } from '../engine/types'

function baseYear(overrides: Partial<ProjectionYear>): ProjectionYear {
  return {
    age: 65,
    year: 2026,
    balances: {},
    totalPortfolio: 0,
    contributionsThisYear: 0,
    spendingNeed: 0,
    mortgagePayment: 0,
    guaranteedIncome: 0,
    netWithdrawalNeeded: 0,
    netWithdrawalTaken: 0,
    rmdWithdrawn: 0,
    rmdSurplus: 0,
    oneTimeOutflow: 0,
    oneTimeInflow: 0,
    homeValue: 0,
    homeEquity: 0,
    homeSaleProceeds: 0,
    discretionarySpending: 0,
    taxOwed: 0,
    earlyWithdrawalPenaltyAmount: 0,
    earlyWithdrawalPenaltyFlag: false,
    fundsDepleted: false,
    ...overrides,
  }
}

describe('projectionToCsv', () => {
  it('includes a header row and one row per year', () => {
    const years = [baseYear({ age: 65 }), baseYear({ age: 66 })]
    const csv = projectionToCsv(years, [])
    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(3) // header + 2 years
    expect(lines[0]).toMatch(/^Age,Year,Total Portfolio,/)
  })

  it('adds one column per non-mortgage, non-home account, named by the account, in order', () => {
    const accounts: Account[] = [
      { id: 'a', name: 'Brokerage', type: 'taxable', balance: 0, annualContribution: 0 },
      { id: 'm', name: 'Mortgage', type: 'mortgage', balance: 0, annualContribution: 0 },
      { id: 'h', name: 'House', type: 'home', balance: 0, annualContribution: 0 },
      { id: 'b', name: '401(k)', type: 'tax-deferred', balance: 0, annualContribution: 0 },
    ]
    const years = [baseYear({ balances: { a: 111.111, b: 222.229 } })]
    const csv = projectionToCsv(years, accounts)
    const [header, row] = csv.split('\r\n')
    expect(header).toBe(
      'Age,Year,Total Portfolio,Brokerage,401(k),Spending Need,Guaranteed Income,Net Withdrawal,Tax Owed,RMD Withdrawn,Home Value,Home Equity,One-Time Inflow,One-Time Outflow,Funds Depleted,Early Withdrawal Penalty',
    )
    // Values are rounded to cents.
    expect(row).toContain('111.11,222.23')
  })

  it('quotes an account name containing a comma, doubling any embedded quotes', () => {
    const accounts: Account[] = [{ id: 'a', name: 'Brokerage, "Taxable"', type: 'taxable', balance: 0, annualContribution: 0 }]
    const csv = projectionToCsv([baseYear({})], accounts)
    const [header] = csv.split('\r\n')
    expect(header).toContain('"Brokerage, ""Taxable"""')
  })

  it('renders boolean flags as Yes/No', () => {
    const csv = projectionToCsv([baseYear({ fundsDepleted: true, earlyWithdrawalPenaltyFlag: false })], [])
    const [, row] = csv.split('\r\n')
    expect(row.endsWith('Yes,No')).toBe(true)
  })
})
