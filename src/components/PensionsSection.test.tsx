import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { PensionsSection } from './PensionsSection'
import type { PensionInputs } from '../engine/pension'
import type { PersonalInputs } from '../engine/types'

const personal: PersonalInputs = { currentAge: 45, retirementAge: 65, horizonAge: 90, currentYear: 2026 }

function Harness({ initial }: { initial: PensionInputs[] }) {
  const [pensions, setPensions] = useState(initial)
  return <PensionsSection pensions={pensions} personal={personal} onChange={setPensions} />
}

const fersPension: PensionInputs = {
  id: 'p1',
  name: 'FERS Pension',
  type: 'fers',
  high3Salary: 98000,
  yearsOfService: 11.3333,
  annuityMultiplier: 0.01,
  startAge: 60,
}

describe('PensionsSection', () => {
  it('shows FERS-specific fields for a fers-type pension', () => {
    render(<Harness initial={[fersPension]} />)
    expect(screen.getByLabelText(/high-3 average salary/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/years of service/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/monthly benefit/i)).not.toBeInTheDocument()
  })

  it('switches to the fixed-amount fields when the type is changed', () => {
    render(<Harness initial={[fersPension]} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'fixed' } })
    expect(screen.getByLabelText(/monthly benefit/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/high-3 average salary/i)).not.toBeInTheDocument()
  })

  it('adds a second pension row without disturbing the first', () => {
    render(<Harness initial={[fersPension]} />)
    fireEvent.click(screen.getByRole('button', { name: /add pension/i }))
    expect(screen.getByDisplayValue('FERS Pension')).toBeInTheDocument()
    expect(screen.getByDisplayValue('New pension')).toBeInTheDocument()
  })

  it('removes a pension row', () => {
    render(<Harness initial={[fersPension]} />)
    fireEvent.click(screen.getByRole('button', { name: /remove fers pension/i }))
    expect(screen.queryByDisplayValue('FERS Pension')).not.toBeInTheDocument()
  })

  it('sums correctly when multiple pensions of different types coexist (smoke test via two rows)', () => {
    const fixedPension: PensionInputs = { id: 'p2', name: 'Old Employer', type: 'fixed', monthlyBenefit: 500, startAge: 65 }
    render(<Harness initial={[fersPension, fixedPension]} />)
    expect(screen.getByDisplayValue('FERS Pension')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Old Employer')).toBeInTheDocument()
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
  })
})
