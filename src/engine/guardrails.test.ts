// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { applyGuardrails } from './guardrails'
import type { GuardrailsSettings } from './guardrails'

const settings: GuardrailsSettings = {
  strategy: 'guardrails',
  upperGuardrailPct: 0.2,
  cutPct: 0.1,
  lowerGuardrailPct: 0.2,
  raisePct: 0.1,
}

describe('applyGuardrails', () => {
  it('leaves spending unchanged when the current rate is within the guardrails', () => {
    // Initial rate 4%; portfolio at $1,000,000 with $40,000 planned spending is
    // exactly 4% — right at the baseline, no adjustment.
    const result = applyGuardrails(40000, 0.04, 1_000_000, settings)
    expect(result).toBe(40000)
  })

  it('cuts spending when the current rate exceeds the upper guardrail (portfolio underperforming)', () => {
    // Initial rate 4%. Portfolio has shrunk to $700,000; $40,000 / 700,000 = 5.71%,
    // which is more than 20% above 4% (i.e. above 4.8%) -> cut by 10%.
    const result = applyGuardrails(40000, 0.04, 700_000, settings)
    expect(result).toBeCloseTo(40000 * 0.9, 6)
  })

  it('raises spending when the current rate falls below the lower guardrail (portfolio outperforming)', () => {
    // Initial rate 4%. Portfolio has grown to $1,500,000; $40,000 / 1,500,000 =
    // 2.67%, which is more than 20% below 4% (i.e. below 3.2%) -> raise by 10%.
    const result = applyGuardrails(40000, 0.04, 1_500_000, settings)
    expect(result).toBeCloseTo(40000 * 1.1, 6)
  })

  it('does not trigger right at the guardrail boundary, only strictly past it', () => {
    // Exactly at the upper boundary: rate = 4% * 1.2 = 4.8%.
    const portfolioAtBoundary = 40000 / (0.04 * 1.2)
    const result = applyGuardrails(40000, 0.04, portfolioAtBoundary, settings)
    expect(result).toBe(40000)
  })

  it('passes spending through unchanged when the portfolio value is zero or negative (no sensible rate)', () => {
    expect(applyGuardrails(40000, 0.04, 0, settings)).toBe(40000)
    expect(applyGuardrails(40000, 0.04, -100, settings)).toBe(40000)
  })

  it('respects custom guardrail widths and adjustment sizes', () => {
    const wideSettings: GuardrailsSettings = {
      strategy: 'guardrails',
      upperGuardrailPct: 0.5, // very wide — hard to trigger
      cutPct: 0.25,
      lowerGuardrailPct: 0.5,
      raisePct: 0.25,
    }
    // Same shrink as the "cuts spending" test above (rate 5.71%, only 43% above
    // 4%) doesn't clear a 50%-wide guardrail.
    expect(applyGuardrails(40000, 0.04, 700_000, wideSettings)).toBe(40000)
  })
})
