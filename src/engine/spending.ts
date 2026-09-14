export interface SpendingInputs {
  /** Current monthly spend, excluding mortgage, today's dollars. */
  monthlySpendExclMortgage: number
  /** Bridge-year health insurance, $/month, for ages between retirement and Medicare eligibility. */
  bridgeHealthInsuranceMonthly: number
  /** Age Medicare eligibility begins (health insurance add-on stops). */
  medicareEligibilityAge: number
}

export function baseAnnualSpending(spending: SpendingInputs): number {
  return spending.monthlySpendExclMortgage * 12
}

export function bridgeHealthInsuranceAnnual(spending: SpendingInputs): number {
  return spending.bridgeHealthInsuranceMonthly * 12
}

/** Total annual spending need at a given age: 0 before retirement, base spending plus
 * the bridge health insurance add-on between retirement and Medicare eligibility.
 * `baseAnnualSpendingOverride` substitutes for `baseAnnualSpending(spending)` when
 * given — used by a dynamic withdrawal strategy (see `guardrails.ts`) to spend a
 * guardrails-adjusted amount instead of the fixed configured one, without
 * duplicating the health-insurance-bridge logic here. */
export function totalSpendingNeedForAge(
  age: number,
  retirementAge: number,
  spending: SpendingInputs,
  baseAnnualSpendingOverride?: number,
): number {
  if (age < retirementAge) return 0
  const healthInsurance =
    age < spending.medicareEligibilityAge ? bridgeHealthInsuranceAnnual(spending) : 0
  return (baseAnnualSpendingOverride ?? baseAnnualSpending(spending)) + healthInsurance
}
