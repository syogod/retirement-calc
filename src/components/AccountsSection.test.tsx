import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { AccountsSection } from './AccountsSection'
import type { Account, PersonalInputs } from '../engine/types'

const personal: PersonalInputs = { currentAge: 45, retirementAge: 65, horizonAge: 90, currentYear: 2026 }

function Harness({ initial }: { initial: Account[] }) {
  const [accounts, setAccounts] = useState(initial)
  return <AccountsSection accounts={accounts} personal={personal} onChange={setAccounts} />
}

const oneAccount: Account[] = [
  { id: 'a1', name: 'ESPP', type: 'taxable', balance: 45000, annualContribution: 12000 },
]

describe('AccountsSection', () => {
  it('renders each account row with its current values', () => {
    render(<Harness initial={oneAccount} />)
    expect(screen.getByDisplayValue('ESPP')).toBeInTheDocument()
    // Balance defaults the (unset) cost-basis field to the same value, so scope by
    // label rather than asserting a single display value.
    expect(screen.getByLabelText(/^balance/i)).toHaveValue(45000)
  })

  it('only shows the Roth basis field for roth-type accounts', () => {
    render(<Harness initial={oneAccount} />)
    expect(screen.queryByLabelText(/total contributions to date/i)).not.toBeInTheDocument()
  })

  it('shows the Roth basis field once an account is switched to roth', () => {
    render(<Harness initial={oneAccount} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'roth' } })
    expect(screen.getByLabelText(/total contributions to date/i)).toBeInTheDocument()
  })

  it('adds a new blank account row when "Add account" is clicked', () => {
    render(<Harness initial={oneAccount} />)
    expect(screen.getAllByRole('textbox')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /add account/i }))

    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    expect(screen.getByDisplayValue('New account')).toBeInTheDocument()
  })

  it('removes an account row when its Remove button is clicked', () => {
    render(<Harness initial={oneAccount} />)
    fireEvent.click(screen.getByRole('button', { name: /remove espp/i }))
    expect(screen.queryByDisplayValue('ESPP')).not.toBeInTheDocument()
  })

  it('edits an account balance in place', () => {
    render(<Harness initial={oneAccount} />)
    const balanceInput = screen.getByLabelText(/^balance/i)
    fireEvent.change(balanceInput, { target: { value: '50000' } })
    expect(screen.getByLabelText(/^balance/i)).toHaveValue(50000)
  })

  it('shows the taxable cost-basis field for taxable accounts, defaulting to the balance', () => {
    render(<Harness initial={oneAccount} />)
    expect(screen.getByLabelText(/cost basis/i)).toHaveValue(45000)
  })

  it('does not show an owner selector for a single-person household', () => {
    render(<Harness initial={oneAccount} />)
    expect(screen.queryByLabelText(/^owner/i)).not.toBeInTheDocument()
  })

  it('shows an owner selector once a spouse is present, defaulting to the primary person', () => {
    function HarnessWithSpouse() {
      const [accounts, setAccounts] = useState(oneAccount)
      return (
        <AccountsSection
          accounts={accounts}
          personal={{ ...personal, spouse: { name: 'Jordan', currentAge: 43 } }}
          onChange={setAccounts}
        />
      )
    }
    render(<HarnessWithSpouse />)
    expect(screen.getByLabelText(/^owner/i)).toHaveValue('primary')
  })
})
