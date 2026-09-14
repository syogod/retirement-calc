import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ResultsSection } from './ResultsSection'
import { createDefaultInputs } from '../state/appInputs'
import type { AppInputs } from '../state/appInputs'

describe('ResultsSection', () => {
  it('renders all four deterministic result sections plus Monte Carlo', () => {
    render(<ResultsSection inputs={createDefaultInputs()} onInputsChange={() => {}} />)
    expect(screen.getByRole('heading', { name: /total portfolio/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /account breakdown/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /guaranteed income vs\. spending/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /year-by-year detail/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /monte carlo/i })).toBeInTheDocument()
  })

  it('renders one table row per projected year, starting at the current age', () => {
    const inputs = createDefaultInputs()
    render(<ResultsSection inputs={inputs} onInputsChange={() => {}} />)
    const rows = screen.getAllByRole('row')
    // header row + one row per age from currentAge to horizonAge inclusive
    const expectedYears = inputs.personal.horizonAge - inputs.personal.currentAge + 1
    expect(rows).toHaveLength(expectedYears + 1)
    expect(screen.getByRole('cell', { name: String(inputs.personal.currentAge) })).toBeInTheDocument()
  })

  it('flags early-withdrawal years in the table for a plan that retires before 59.5 with only tax-deferred savings', () => {
    const inputs: AppInputs = {
      personal: { currentAge: 50, retirementAge: 51, horizonAge: 55, currentYear: 2026 },
      growth: { nominalReturn: 0.07, inflation: 0.03 },
      accounts: [{ id: 'a', name: '401(k)', type: 'tax-deferred', balance: 500000, annualContribution: 0 }],
      spending: { monthlySpendExclMortgage: 3000, bridgeHealthInsuranceMonthly: 0, medicareEligibilityAge: 65 },
      pensions: [],
      socialSecurity: [{ monthlyBenefitAt62: 0, monthlyBenefitAt67: 0, monthlyBenefitAt70: 0, claimingAge: 999, haircut: 1 }],
      taxes: { stateRate: 0 },
      rmdSurplus: { strategy: 'spend' },
      oneTimeEvents: [],
      guardrails: { strategy: 'fixed', upperGuardrailPct: 0.2, cutPct: 0.1, lowerGuardrailPct: 0.2, raisePct: 0.1 },
      numSimulations: 100,
    }
    render(<ResultsSection inputs={inputs} onInputsChange={() => {}} />)
    expect(screen.getAllByText(/early withdrawal/i).length).toBeGreaterThan(0)
  })

  it('does not show the Home Equity chart when there is no home account', () => {
    render(<ResultsSection inputs={createDefaultInputs()} onInputsChange={() => {}} />)
    expect(screen.queryByRole('heading', { name: /home equity/i })).not.toBeInTheDocument()
  })

  it('shows the Home Equity chart once a home account exists', () => {
    const inputs: AppInputs = {
      ...createDefaultInputs(),
      accounts: [{ id: 'house', name: 'House', type: 'home', balance: 400000, annualContribution: 0 }],
    }
    render(<ResultsSection inputs={inputs} onInputsChange={() => {}} />)
    expect(screen.getByRole('heading', { name: /home equity/i })).toBeInTheDocument()
  })

  it('shows a CSV download button alongside the year-by-year table', () => {
    render(<ResultsSection inputs={createDefaultInputs()} onInputsChange={() => {}} />)
    expect(screen.getByRole('button', { name: /download csv/i })).toBeInTheDocument()
  })

  it('does not run Monte Carlo until the button is clicked', async () => {
    render(<ResultsSection inputs={createDefaultInputs()} onInputsChange={() => {}} />)
    expect(screen.queryByText(/success rate/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /run simulation/i }))

    expect(await screen.findByText(/success rate/i)).toBeInTheDocument()
  })

  it('expands a chart into an overlay with the Explore sliders alongside it, then closes it', () => {
    render(<ResultsSection inputs={createDefaultInputs()} onInputsChange={() => {}} />)

    // Only the compact card's heading exists at first — one "Total Portfolio" heading.
    expect(screen.getAllByRole('heading', { name: /total portfolio/i })).toHaveLength(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const expandButtons = screen.getAllByRole('button', { name: /expand/i })
    fireEvent.click(expandButtons[0]) // Total Portfolio is the first chart card

    const dialog = screen.getByRole('dialog', { name: /total portfolio, expanded/i })
    expect(dialog).toBeInTheDocument()
    // The Explore sliders are present inside the expanded overlay too.
    expect(within(dialog).getByRole('heading', { name: /explore/i })).toBeInTheDocument()
    // Now there are two "Total Portfolio" headings: the compact card's and the overlay's.
    expect(screen.getAllByRole('heading', { name: /total portfolio/i })).toHaveLength(2)

    fireEvent.click(within(dialog).getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
