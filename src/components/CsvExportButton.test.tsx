import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CsvExportButton } from './CsvExportButton'
import type { ProjectionYear } from '../engine/projection'

// jsdom doesn't implement these — stub them so the export path is testable.
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  vi.restoreAllMocks()
})

const years: ProjectionYear[] = [
  {
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
  },
]

describe('CsvExportButton', () => {
  it('downloads a CSV file when clicked', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<CsvExportButton years={years} accounts={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /download csv/i }))

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
