import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { RmdSurplusSection } from './RmdSurplusSection'
import type { RmdSurplusSettings } from '../engine/rmd'
import type { Account } from '../engine/types'

const accounts: Account[] = [
  { id: 'brokerage', name: 'Brokerage', type: 'taxable', balance: 100000, annualContribution: 0 },
  { id: 'reserve', name: 'Emergency Fund', type: 'cash', balance: 20000, annualContribution: 0 },
  { id: 'ira', name: 'IRA', type: 'tax-deferred', balance: 500000, annualContribution: 0 },
]

function Harness({ initial }: { initial: RmdSurplusSettings }) {
  const [value, setValue] = useState(initial)
  return <RmdSurplusSection value={value} accounts={accounts} onChange={setValue} />
}

describe('RmdSurplusSection', () => {
  it('shows no target-account dropdown for the "spend" strategy', () => {
    render(<Harness initial={{ strategy: 'spend' }} />)
    expect(screen.queryByLabelText(/reinvest into|cash reserve account/i)).not.toBeInTheDocument()
  })

  it('shows only taxable accounts as targets for "reinvest"', () => {
    render(<Harness initial={{ strategy: 'reinvest', targetAccountId: 'brokerage' }} />)
    const select = screen.getByLabelText(/reinvest into/i)
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Brokerage' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Emergency Fund' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'IRA' })).not.toBeInTheDocument()
  })

  it('shows only cash accounts as targets for "cashReserve"', () => {
    render(<Harness initial={{ strategy: 'cashReserve', targetAccountId: 'reserve' }} />)
    expect(screen.getByRole('option', { name: 'Emergency Fund' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Brokerage' })).not.toBeInTheDocument()
  })

  it('resets the target account when switching strategy', () => {
    render(<Harness initial={{ strategy: 'reinvest', targetAccountId: 'brokerage' }} />)
    fireEvent.change(screen.getByLabelText(/if an rmd exceeds spending need/i), { target: { value: 'cashReserve' } })
    expect(screen.getByLabelText(/cash reserve account/i)).toHaveValue('reserve') // auto-picks the first cash account
  })

  it('flags when no valid target account exists yet for the chosen strategy', () => {
    function NoTaxableHarness() {
      const [value, setValue] = useState<RmdSurplusSettings>({ strategy: 'reinvest' })
      return (
        <RmdSurplusSection
          value={value}
          accounts={accounts.filter((a) => a.type !== 'taxable')}
          onChange={setValue}
        />
      )
    }
    render(<NoTaxableHarness />)
    expect(screen.getByText(/add a taxable account/i)).toBeInTheDocument()
  })
})
