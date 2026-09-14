import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReportPage } from './ReportPage'
import { createDefaultInputs } from '../state/appInputs'
import type { AppInputs } from '../state/appInputs'

describe('ReportPage', () => {
  it('renders every chart section plus the year-by-year table', () => {
    render(<ReportPage inputs={createDefaultInputs()} />)
    expect(screen.getByRole('heading', { name: /total portfolio/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /account breakdown/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /guaranteed income vs\. spending/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /year-by-year detail/i })).toBeInTheDocument()
  })

  it('does not show the Home Equity section when there is no home account', () => {
    render(<ReportPage inputs={createDefaultInputs()} />)
    expect(screen.queryByRole('heading', { name: /home equity/i })).not.toBeInTheDocument()
  })

  it('shows the Home Equity section once a home account exists', () => {
    const inputs: AppInputs = {
      ...createDefaultInputs(),
      accounts: [{ id: 'house', name: 'House', type: 'home', balance: 400000, annualContribution: 0 }],
    }
    render(<ReportPage inputs={inputs} />)
    expect(screen.getByRole('heading', { name: /home equity/i })).toBeInTheDocument()
  })

  it('shows Print and Download CSV buttons', () => {
    render(<ReportPage inputs={createDefaultInputs()} />)
    expect(screen.getByRole('button', { name: /^print$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download csv/i })).toBeInTheDocument()
  })

  it('notes when funds are projected to run out', () => {
    const inputs: AppInputs = {
      personal: { currentAge: 50, retirementAge: 51, horizonAge: 55, currentYear: 2026 },
      growth: { nominalReturn: 0.07, inflation: 0.03 },
      accounts: [{ id: 'a', name: '401(k)', type: 'tax-deferred', balance: 10000, annualContribution: 0 }],
      spending: { monthlySpendExclMortgage: 5000, bridgeHealthInsuranceMonthly: 0, medicareEligibilityAge: 65 },
      pensions: [],
      socialSecurity: [{ monthlyBenefitAt62: 0, monthlyBenefitAt67: 0, monthlyBenefitAt70: 0, claimingAge: 999, haircut: 1 }],
      taxes: { stateRate: 0 },
      rmdSurplus: { strategy: 'spend' },
      oneTimeEvents: [],
      guardrails: { strategy: 'fixed', upperGuardrailPct: 0.2, cutPct: 0.1, lowerGuardrailPct: 0.2, raisePct: 0.1 },
      numSimulations: 100,
    }
    render(<ReportPage inputs={inputs} />)
    expect(screen.getByText(/funds are projected to run out/i)).toBeInTheDocument()
  })
})
