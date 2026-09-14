import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { OneTimeEventsSection } from './OneTimeEventsSection'
import type { OneTimeEvent } from '../engine/oneTimeEvents'
import type { Account, PersonalInputs } from '../engine/types'

const accounts: Account[] = [
  { id: 'brokerage', name: 'Brokerage', type: 'taxable', balance: 100000, annualContribution: 0 },
  { id: 'reserve', name: 'Emergency Fund', type: 'cash', balance: 10000, annualContribution: 0 },
  { id: 'ira', name: 'IRA', type: 'tax-deferred', balance: 200000, annualContribution: 0 },
]

const personal: PersonalInputs = { currentAge: 50, retirementAge: 65, horizonAge: 90, currentYear: 2026 }

function Harness({ initial }: { initial: OneTimeEvent[] }) {
  const [events, setEvents] = useState(initial)
  return <OneTimeEventsSection events={events} accounts={accounts} personal={personal} onChange={setEvents} />
}

const inheritance: OneTimeEvent = { id: 'e1', name: 'Inheritance', age: 68, amount: 50000, targetAccountId: 'brokerage' }
const expense: OneTimeEvent = { id: 'e2', name: 'New roof', age: 75, amount: -20000 }

describe('OneTimeEventsSection', () => {
  it('renders an inflow event with its target-account and taxable fields', () => {
    render(<Harness initial={[inheritance]} />)
    expect(screen.getByDisplayValue('Inheritance')).toBeInTheDocument()
    expect(screen.getByLabelText(/^amount/i)).toHaveValue(50000)
    expect(screen.getByLabelText(/deposit into/i)).toHaveValue('brokerage')
    expect(screen.getByLabelText(/taxable as ordinary income/i)).not.toBeChecked()
  })

  it('does not show target-account or taxable fields for an outflow event', () => {
    render(<Harness initial={[expense]} />)
    expect(screen.getByLabelText(/^amount/i)).toHaveValue(20000) // shown as a positive magnitude
    expect(screen.queryByLabelText(/deposit into/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/taxable as ordinary income/i)).not.toBeInTheDocument()
  })

  it('only offers taxable and cash accounts as inflow targets', () => {
    render(<Harness initial={[inheritance]} />)
    const select = screen.getByLabelText(/deposit into/i)
    expect(within(select).queryByRole('option', { name: 'IRA' })).not.toBeInTheDocument()
  })

  it('flips the sign of the amount when switching between inflow and outflow, preserving magnitude', () => {
    render(<Harness initial={[inheritance]} />)
    fireEvent.change(screen.getByRole('combobox', { name: /type/i }), { target: { value: 'outflow' } })
    expect(screen.getByLabelText(/^amount/i)).toHaveValue(50000)
    expect(screen.queryByLabelText(/deposit into/i)).not.toBeInTheDocument()
  })

  it('adds a new blank event row when "Add event" is clicked', () => {
    render(<Harness initial={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /add event/i }))
    expect(screen.getByDisplayValue('New event')).toBeInTheDocument()
  })

  it('removes an event row when its Remove button is clicked', () => {
    render(<Harness initial={[inheritance]} />)
    fireEvent.click(screen.getByRole('button', { name: /remove inheritance/i }))
    expect(screen.queryByDisplayValue('Inheritance')).not.toBeInTheDocument()
  })

  it('shows a "Repeats" checkbox for an outflow but not an inflow', () => {
    render(<Harness initial={[expense, inheritance]} />)
    expect(screen.getAllByLabelText(/^repeats$/i)).toHaveLength(1)
  })

  it('reveals the interval and end-age fields once "Repeats" is checked, defaulting to every 10 years', () => {
    render(<Harness initial={[expense]} />)
    expect(screen.queryByLabelText(/every n years/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/^repeats$/i))
    expect(screen.getByLabelText(/every n years/i)).toHaveValue(10)
    expect(screen.getByLabelText(/until age/i)).toHaveValue(0)
  })

  it('hides the interval/end-age fields again when "Repeats" is unchecked', () => {
    const repeating: OneTimeEvent = { ...expense, repeatEveryYears: 10, repeatUntilAge: 85 }
    render(<Harness initial={[repeating]} />)
    expect(screen.getByLabelText(/every n years/i)).toHaveValue(10)
    fireEvent.click(screen.getByLabelText(/^repeats$/i))
    expect(screen.queryByLabelText(/every n years/i)).not.toBeInTheDocument()
  })

  it('treats 0 in the "Until age" field as no end date (clears repeatUntilAge)', () => {
    const repeating: OneTimeEvent = { ...expense, repeatEveryYears: 10, repeatUntilAge: 85 }
    render(<Harness initial={[repeating]} />)
    fireEvent.change(screen.getByLabelText(/until age/i), { target: { value: '0' } })
    expect(screen.getByLabelText(/until age/i)).toHaveValue(0)
  })

  it('clears repeat fields when an outflow is switched to an inflow', () => {
    const repeating: OneTimeEvent = { ...expense, repeatEveryYears: 10 }
    render(<Harness initial={[repeating]} />)
    fireEvent.change(screen.getByRole('combobox', { name: /type/i }), { target: { value: 'inflow' } })
    expect(screen.queryByLabelText(/^repeats$/i)).not.toBeInTheDocument()
  })

  it('shows an owner selector once a spouse is present', () => {
    function SpouseHarness() {
      const [events, setEvents] = useState<OneTimeEvent[]>([inheritance])
      return (
        <OneTimeEventsSection
          events={events}
          accounts={accounts}
          personal={{ ...personal, spouse: { name: 'Jordan', currentAge: 48 } }}
          onChange={setEvents}
        />
      )
    }
    render(<SpouseHarness />)
    expect(screen.getByLabelText(/^owner/i)).toHaveValue('primary')
  })
})
