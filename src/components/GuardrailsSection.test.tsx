import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { GuardrailsSection } from './GuardrailsSection'
import type { GuardrailsSettings } from '../engine/guardrails'

function Harness({ initial }: { initial: GuardrailsSettings }) {
  const [value, setValue] = useState(initial)
  return <GuardrailsSection value={value} onChange={setValue} />
}

const fixed: GuardrailsSettings = { strategy: 'fixed', upperGuardrailPct: 0.2, cutPct: 0.1, lowerGuardrailPct: 0.2, raisePct: 0.1 }
const guardrails: GuardrailsSettings = { ...fixed, strategy: 'guardrails' }

describe('GuardrailsSection', () => {
  it('hides the guardrail parameter fields under the fixed strategy', () => {
    render(<Harness initial={fixed} />)
    expect(screen.queryByLabelText(/upper guardrail/i)).not.toBeInTheDocument()
  })

  it('reveals all four guardrail parameter fields once the dynamic strategy is selected', () => {
    render(<Harness initial={guardrails} />)
    expect(screen.getByLabelText(/upper guardrail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^cut by/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/lower guardrail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^raise by/i)).toBeInTheDocument()
  })

  it('switches strategy and reveals the fields on change', () => {
    render(<Harness initial={fixed} />)
    fireEvent.change(screen.getByLabelText(/strategy/i), { target: { value: 'guardrails' } })
    expect(screen.getByLabelText(/upper guardrail/i)).toBeInTheDocument()
  })

  it('edits a guardrail parameter as a percent', () => {
    render(<Harness initial={guardrails} />)
    fireEvent.change(screen.getByLabelText(/upper guardrail/i), { target: { value: '25' } })
    expect(screen.getByLabelText(/upper guardrail/i)).toHaveValue(25)
  })
})
