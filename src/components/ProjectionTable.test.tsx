import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProjectionTable } from './ProjectionTable'
import type { ProjectionYear } from '../engine/projection'

function baseYear(overrides: Partial<ProjectionYear>): ProjectionYear {
  return {
    age: 75,
    year: 2026,
    balances: {},
    totalPortfolio: 100000,
    contributionsThisYear: 0,
    spendingNeed: 10000,
    mortgagePayment: 0,
    guaranteedIncome: 0,
    netWithdrawalNeeded: 10000,
    netWithdrawalTaken: 10000,
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

describe('ProjectionTable', () => {
  it('shows no status icon for an ordinary year', () => {
    render(<ProjectionTable years={[baseYear({})]} />)
    expect(screen.queryByText(/depleted|early withdrawal|rmd exceeds/i)).not.toBeInTheDocument()
  })

  it('flags a year where a forced RMD exceeds the spending need', () => {
    render(<ProjectionTable years={[baseYear({ netWithdrawalNeeded: 5000, netWithdrawalTaken: 12000, rmdWithdrawn: 12000 })]} />)
    expect(screen.getByText(/rmd exceeds need/i)).toBeInTheDocument()
  })

  it('does not flag the RMD icon when the RMD is fully absorbed by spending need', () => {
    render(<ProjectionTable years={[baseYear({ netWithdrawalNeeded: 20000, netWithdrawalTaken: 20000, rmdWithdrawn: 8000 })]} />)
    expect(screen.queryByText(/rmd exceeds need/i)).not.toBeInTheDocument()
  })

  it('prioritizes the Depleted icon over the RMD-exceeds-need icon', () => {
    render(
      <ProjectionTable
        years={[baseYear({ fundsDepleted: true, netWithdrawalNeeded: 5000, netWithdrawalTaken: 3000, rmdWithdrawn: 12000 })]}
      />,
    )
    expect(screen.getByText(/depleted/i)).toBeInTheDocument()
    expect(screen.queryByText(/rmd exceeds need/i)).not.toBeInTheDocument()
  })

  it('flags a year with a one-time inflow or outflow event, alongside any other status', () => {
    render(<ProjectionTable years={[baseYear({ oneTimeInflow: 50000 })]} />)
    expect(screen.getByText(/one-time event/i)).toBeInTheDocument()
  })

  it('does not flag the one-time-event icon in a year with no event', () => {
    render(<ProjectionTable years={[baseYear({})]} />)
    expect(screen.queryByText(/one-time event/i)).not.toBeInTheDocument()
  })

  it('flags a year where a home is sold', () => {
    render(<ProjectionTable years={[baseYear({ homeSaleProceeds: 400000 })]} />)
    expect(screen.getByText(/home sold/i)).toBeInTheDocument()
  })

  it('does not flag the home-sold icon in a year with no sale', () => {
    render(<ProjectionTable years={[baseYear({})]} />)
    expect(screen.queryByText(/home sold/i)).not.toBeInTheDocument()
  })

  it('flags a guardrails cut when discretionary spending drops from the previous year', () => {
    render(
      <ProjectionTable
        years={[baseYear({ age: 66, discretionarySpending: 50000 }), baseYear({ age: 67, discretionarySpending: 45000 })]}
      />,
    )
    expect(screen.getByText(/spending cut/i)).toBeInTheDocument()
  })

  it('flags a guardrails raise when discretionary spending rises from the previous year', () => {
    render(
      <ProjectionTable
        years={[baseYear({ age: 66, discretionarySpending: 50000 }), baseYear({ age: 67, discretionarySpending: 55000 })]}
      />,
    )
    expect(screen.getByText(/spending raised/i)).toBeInTheDocument()
  })

  it('does not flag a guardrails adjustment for the first retirement year (0 → base spending)', () => {
    render(
      <ProjectionTable
        years={[baseYear({ age: 65, discretionarySpending: 0 }), baseYear({ age: 66, discretionarySpending: 50000 })]}
      />,
    )
    expect(screen.queryByText(/spending cut|spending raised/i)).not.toBeInTheDocument()
  })

  it('does not flag a guardrails adjustment when spending is unchanged (fixed strategy)', () => {
    render(
      <ProjectionTable
        years={[baseYear({ age: 66, discretionarySpending: 50000 }), baseYear({ age: 67, discretionarySpending: 50000 })]}
      />,
    )
    expect(screen.queryByText(/spending cut|spending raised/i)).not.toBeInTheDocument()
  })
})
