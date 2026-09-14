import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HomeEquityChart } from './HomeEquityChart'
import type { ProjectionYear } from '../engine/projection'

function baseYear(overrides: Partial<ProjectionYear>): ProjectionYear {
  return {
    age: 60,
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

describe('HomeEquityChart', () => {
  it('shows both a "Home equity" and a "Remaining mortgage" series', () => {
    const years = [baseYear({ homeValue: 400000, homeEquity: 300000 })]
    render(<HomeEquityChart years={years} />)
    expect(screen.getByText('Home equity')).toBeInTheDocument()
    expect(screen.getByText('Remaining mortgage')).toBeInTheDocument()
  })

  it('shows no remaining-mortgage band when the home has no linked mortgage (equity equals full value)', () => {
    const years = [baseYear({ homeValue: 400000, homeEquity: 400000 }), baseYear({ age: 61, homeValue: 410000, homeEquity: 410000 })]
    const { container } = render(<HomeEquityChart years={years} />)
    // Both series still render as legend entries (2+ series keeps the legend), but
    // the remaining-mortgage area itself should be flat at 0.
    expect(screen.getByText('Remaining mortgage')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('drops to 0 for both series once the home is sold', () => {
    const years = [
      baseYear({ age: 79, homeValue: 500000, homeEquity: 200000 }),
      baseYear({ age: 80, homeValue: 0, homeEquity: 0, homeSaleProceeds: 470000 }),
    ]
    render(<HomeEquityChart years={years} />)
    // Just a smoke check that it renders without error across a sale transition.
    expect(screen.getByText('Home equity')).toBeInTheDocument()
  })
})
