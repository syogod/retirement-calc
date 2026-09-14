/**
 * A dynamic ("guardrails") withdrawal strategy — an alternative to spending a fixed
 * real amount every year regardless of how the portfolio is actually doing. Based
 * on the widely-used Guyton-Klinger approach, simplified to its two core rules: an
 * initial withdrawal rate is set the year retirement begins, and every year after
 * that, if the *current* withdrawal rate (this year's planned spending divided by
 * the portfolio's value entering the year) has drifted too far from that initial
 * rate, spending is cut (portfolio underperforming) or raised (portfolio
 * outperforming) by a fixed percentage — then held at the new level until the next
 * guardrail is hit. This app doesn't implement Guyton-Klinger's other rules (the
 * inflation rule, the portfolio management rule) — just the two guardrails
 * themselves, which are what most people mean by "guardrails" in practice.
 */
export type SpendingStrategy = 'fixed' | 'guardrails'

export interface GuardrailsSettings {
  strategy: SpendingStrategy
  /** If the current withdrawal rate rises above the initial rate by more than this
   * fraction (e.g. `0.2` for Guyton-Klinger's classic 20%), spending is cut. */
  upperGuardrailPct: number
  /** Fraction to cut spending by when the upper guardrail is breached (e.g. `0.1` for 10%). */
  cutPct: number
  /** If the current withdrawal rate falls below the initial rate by more than this
   * fraction, spending is raised. */
  lowerGuardrailPct: number
  /** Fraction to raise spending by when the lower guardrail is breached. */
  raisePct: number
}

/**
 * Given this year's planned (pre-check) spending and the portfolio value it's
 * measured against, cuts or raises that spending if it's drifted outside the
 * guardrails around `initialWithdrawalRate` — otherwise returns it unchanged. A
 * zero or negative portfolio value has no sensible rate to compute against, so
 * spending passes through unchanged rather than dividing by zero.
 */
export function applyGuardrails(
  plannedSpending: number,
  initialWithdrawalRate: number,
  portfolioValueAtStartOfYear: number,
  settings: GuardrailsSettings,
): number {
  if (portfolioValueAtStartOfYear <= 0) return plannedSpending

  const currentRate = plannedSpending / portfolioValueAtStartOfYear
  if (currentRate > initialWithdrawalRate * (1 + settings.upperGuardrailPct)) {
    return plannedSpending * (1 - settings.cutPct)
  }
  if (currentRate < initialWithdrawalRate * (1 - settings.lowerGuardrailPct)) {
    return plannedSpending * (1 + settings.raisePct)
  }
  return plannedSpending
}
