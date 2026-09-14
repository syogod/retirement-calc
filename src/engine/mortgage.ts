export interface MortgageAmortizationInputs {
  /** Current remaining principal balance. */
  balance: number
  /** Nominal annual interest rate, e.g. 0.065 for 6.5%. Mortgage payments are fixed
   * in nominal dollars, unlike the rest of this model (which runs in real dollars) —
   * see `mortgageYearsElapsedFactor` for how that gets reconciled. */
  interestRate: number
  /** Remaining term in years, as of today. */
  remainingTermYears: number
}

/** Standard fixed-rate amortization formula: the nominal annual payment (principal +
 * interest) that fully pays off the loan over its remaining term. */
export function calculateNominalAnnualPayment(mortgage: MortgageAmortizationInputs): number {
  const monthlyRate = mortgage.interestRate / 12
  const numPayments = mortgage.remainingTermYears * 12
  if (numPayments <= 0) return 0
  if (monthlyRate === 0) return (mortgage.balance / numPayments) * 12
  const monthlyPayment = (mortgage.balance * monthlyRate) / (1 - (1 + monthlyRate) ** -numPayments)
  return monthlyPayment * 12
}

export interface MortgageYearResult {
  /** Remaining nominal principal balance after this year's payment. */
  nominalBalance: number
  /** Nominal dollars actually paid this year — equal to the scheduled annual payment,
   * except in the final year, when it's just enough to clear the remaining balance. */
  nominalPaymentMade: number
}

/**
 * Advances a mortgage by one year: steps through 12 monthly compounding periods
 * (matching the monthly-rate formula `calculateNominalAnnualPayment` uses to derive
 * the payment, so a loan run for its full remaining term lands on exactly $0 rather
 * than a residual balance) and returns the year-end balance and the nominal dollars
 * actually paid — equal to the full scheduled payment except in the payoff year.
 */
export function advanceMortgageYear(
  nominalBalance: number,
  nominalAnnualPayment: number,
  nominalInterestRate: number,
): MortgageYearResult {
  const monthlyRate = nominalInterestRate / 12
  const monthlyPayment = nominalAnnualPayment / 12

  let balance = nominalBalance
  let paid = 0
  for (let month = 0; month < 12 && balance > 0; month++) {
    const interest = balance * monthlyRate
    const principalPortion = monthlyPayment - interest
    if (principalPortion >= balance) {
      paid += balance + interest
      balance = 0
    } else {
      balance -= principalPortion
      paid += monthlyPayment
    }
  }
  return { nominalBalance: balance, nominalPaymentMade: paid }
}
