import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AccountBreakdownChart } from './AccountBreakdownChart'
import type { ProjectionYear } from '../engine/projection'
import type { Account } from '../engine/types'

describe('AccountBreakdownChart', () => {
  it('excludes mortgage accounts from the legend — they are a liability, not portfolio value', () => {
    const accounts: Account[] = [
      { id: 'save', name: 'Savings', type: 'taxable', balance: 100000, annualContribution: 0 },
      { id: 'roth', name: 'Roth', type: 'roth', balance: 50000, annualContribution: 0 },
      { id: 'house', name: 'House', type: 'mortgage', balance: 300000, annualContribution: 0 },
    ]
    const years: ProjectionYear[] = [
      {
        age: 40,
        year: 2026,
        balances: { save: 100000, roth: 50000 }, // note: no 'house' key, matching the real engine output
        totalPortfolio: 150000,
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
      },
    ]

    render(<AccountBreakdownChart years={years} accounts={accounts} />)

    expect(screen.getByText('Savings')).toBeInTheDocument()
    expect(screen.queryByText('House')).not.toBeInTheDocument()
  })

  it('excludes home accounts from the legend — they are tracked separately (homeValue), not in balances', () => {
    const accounts: Account[] = [
      { id: 'save', name: 'Savings', type: 'taxable', balance: 100000, annualContribution: 0 },
      { id: 'roth', name: 'Roth', type: 'roth', balance: 50000, annualContribution: 0 },
      { id: 'house', name: 'House', type: 'home', balance: 500000, annualContribution: 0 },
    ]
    const years: ProjectionYear[] = [
      {
        age: 40,
        year: 2026,
        balances: { save: 100000, roth: 50000 }, // note: no 'house' key, matching the real engine output
        totalPortfolio: 150000,
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
        homeValue: 500000,
        homeEquity: 500000,
        homeSaleProceeds: 0,
        discretionarySpending: 0,
        taxOwed: 0,
        earlyWithdrawalPenaltyAmount: 0,
        earlyWithdrawalPenaltyFlag: false,
        fundsDepleted: false,
      },
    ]

    render(<AccountBreakdownChart years={years} accounts={accounts} />)

    expect(screen.getByText('Savings')).toBeInTheDocument()
    expect(screen.queryByText('House')).not.toBeInTheDocument()
  })
})
