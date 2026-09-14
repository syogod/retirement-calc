import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { AdjustablePanel } from './AdjustablePanel'
import { createDefaultInputs } from '../state/appInputs'
import { createDemoInputs } from '../state/demoInputs'

function Harness() {
  const [inputs, setInputs] = useState(createDemoInputs)
  return <AdjustablePanel inputs={inputs} onChange={setInputs} />
}

describe('AdjustablePanel', () => {
  it('renders one slider per pension, labeled by pension name (and owner, since the demo plan has a spouse)', () => {
    render(<Harness />)
    expect(
      screen.getByRole('spinbutton', { name: /federal pension \(fers-style\) \(alex\) start age/i }),
    ).toBeInTheDocument()
  })

  it('renders one Social Security claiming-age slider per person, labeled by name', () => {
    render(<Harness />)
    expect(screen.getByRole('spinbutton', { name: /alex: social security claiming age/i })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /jordan: social security claiming age/i })).toBeInTheDocument()
  })

  it('updates retirement age via the number box', () => {
    render(<Harness />)
    const input = screen.getByRole('spinbutton', { name: /^retirement age$/i })
    expect(input).toHaveValue(60) // createDemoInputs' retirement age

    fireEvent.change(input, { target: { value: '62' } })
    expect(input).toHaveValue(62)
  })

  it('updates monthly spend via the range slider', () => {
    render(<Harness />)
    const slider = screen.getByRole('slider', { name: /monthly spend/i })
    expect(slider).toHaveValue('5000') // createDemoInputs' monthly spend

    fireEvent.change(slider, { target: { value: '4000' } })
    expect(screen.getByRole('spinbutton', { name: /monthly spend/i })).toHaveValue(4000)
  })

  it('never produces duplicate element ids when two instances render at once with different idPrefix values (regression: broke label association in the expanded-chart overlay)', () => {
    const inputs = createDefaultInputs()
    const { container } = render(
      <>
        <AdjustablePanel inputs={inputs} onChange={() => {}} />
        <AdjustablePanel inputs={inputs} onChange={() => {}} idPrefix="overlay-" />
      </>,
    )

    const allIds = Array.from(container.querySelectorAll('[id]')).map((el) => el.id)
    const uniqueIds = new Set(allIds)
    expect(allIds.length).toBeGreaterThan(0)
    expect(uniqueIds.size).toBe(allIds.length)

    // And each instance's field is independently addressable by label.
    const [firstPanel, secondPanel] = screen.getAllByRole('heading', { name: /explore/i }).map((h) => h.closest('section')!)
    expect(within(firstPanel).getByRole('spinbutton', { name: /^retirement age$/i })).toBeInTheDocument()
    expect(within(secondPanel).getByRole('spinbutton', { name: /^retirement age$/i })).toBeInTheDocument()
  })
})
