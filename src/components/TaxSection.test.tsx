import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { TaxSection } from './TaxSection'
import type { TaxSettings } from '../engine/tax'
import type { PersonalInputs } from '../engine/types'

const personal: PersonalInputs = { currentAge: 45, retirementAge: 65, horizonAge: 90, currentYear: 2026 }

function Harness({ initialPersonal }: { initialPersonal: PersonalInputs }) {
  const [taxes, setTaxes] = useState<TaxSettings>({ stateRate: 0.05 })
  return <TaxSection value={taxes} personal={initialPersonal} onChange={setTaxes} />
}

describe('TaxSection', () => {
  it('shows the state rate field with its current value', () => {
    render(<Harness initialPersonal={personal} />)
    expect(screen.getByLabelText(/flat state income tax rate/i)).toHaveValue(5)
  })

  it('updates the state rate via the field', () => {
    render(<Harness initialPersonal={personal} />)
    fireEvent.change(screen.getByLabelText(/flat state income tax rate/i), { target: { value: '7' } })
    expect(screen.getByLabelText(/flat state income tax rate/i)).toHaveValue(7)
  })

  it('shows Single as the assumed filing status with no spouse', () => {
    render(<Harness initialPersonal={personal} />)
    expect(screen.getByText('Single')).toBeInTheDocument()
  })

  it('shows Married Filing Jointly once a spouse is configured', () => {
    render(<Harness initialPersonal={{ ...personal, spouse: { name: 'Jordan', currentAge: 43 } }} />)
    expect(screen.getByText('Married Filing Jointly')).toBeInTheDocument()
  })
})
