import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the app heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /retirement calculator/i })).toBeInTheDocument()
  })

  it('defaults to the Dashboard tab, showing the Explore panel and results', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /explore/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /total portfolio/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^accounts$/i })).not.toBeInTheDocument()
  })

  it('opens on a clean slate — no accounts, no pensions, nothing pre-filled', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: /account setup/i }))

    expect(screen.getByRole('heading', { name: /^accounts$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /pensions & annuities/i })).toBeInTheDocument()
    // No account/pension rows exist yet, so there's nothing to remove.
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
  })

  it('switches to Account Setup and back', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: /account setup/i }))
    expect(screen.getByRole('heading', { name: /^accounts$/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /explore/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /dashboard/i }))
    expect(screen.getByRole('heading', { name: /explore/i })).toBeInTheDocument()
  })

  it('updates the computed real return on the Setup tab when growth inputs change', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: /account setup/i }))

    expect(screen.getByText(/real return used for every account/i).textContent).toMatch(/3\.88%/)

    fireEvent.change(screen.getByLabelText(/assumed nominal investment return/i), {
      target: { value: '5' },
    })

    expect(screen.getByText(/real return used for every account/i).textContent).toMatch(/1\.94%/)
  })

  it('adding an account on the Setup tab creates the first row', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: /account setup/i }))

    // The only textbox on a blank slate is the "Your name" field on Personal — no
    // accounts or pensions yet.
    expect(screen.queryAllByRole('textbox')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /add account/i }))
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    expect(screen.getByDisplayValue('New account')).toBeInTheDocument()
  })

  it('adding a pension defaults to a fixed-amount type, not FERS', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: /account setup/i }))
    fireEvent.click(screen.getByRole('button', { name: /add pension/i }))
    expect(screen.getByDisplayValue('New pension')).toBeInTheDocument()

    const pensionsSection = screen.getByRole('heading', { name: /pensions & annuities/i }).closest('section')!
    expect(within(pensionsSection).getByLabelText(/monthly benefit/i)).toBeInTheDocument()
  })

  it('switches to the Report tab, showing the printable layout with no Explore panel', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: /^report$/i }))

    expect(screen.getByRole('heading', { name: /retirement plan/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /total portfolio/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /year-by-year detail/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /explore/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^print$/i })).toBeInTheDocument()
  })

  it('sliding retirement age in Explore updates the results table live', () => {
    render(<App />)
    // Give it a nonzero spend so there's something for retirement age to gate.
    fireEvent.change(screen.getByRole('spinbutton', { name: /monthly spend/i }), { target: { value: '3000' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: /^retirement age$/i }), { target: { value: '40' } })

    function spendingNeedAtAge(age: number): string {
      const row = screen.getAllByRole('row').find((r) => within(r).queryByRole('cell', { name: String(age) }))
      return within(row!).getAllByRole('cell')[3].textContent!
    }

    // Age 45 is already retired (retirement age 40): full spending need.
    expect(spendingNeedAtAge(45)).toBe('$36,000')

    fireEvent.change(screen.getByRole('spinbutton', { name: /^retirement age$/i }), { target: { value: '50' } })

    // Now age 45 is still working: no spending need yet.
    expect(spendingNeedAtAge(45)).toBe('$0')
  })
})
