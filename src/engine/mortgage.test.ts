// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { advanceMortgageYear, calculateNominalAnnualPayment } from './mortgage'

describe('calculateNominalAnnualPayment', () => {
  it('matches the well-known $300,000 / 6% / 30-year monthly payment of ~$1,798.65', () => {
    const annual = calculateNominalAnnualPayment({ balance: 300000, interestRate: 0.06, remainingTermYears: 30 })
    expect(annual / 12).toBeCloseTo(1798.65, 2)
  })

  it('handles a 0% interest rate as a plain balance/term split', () => {
    const annual = calculateNominalAnnualPayment({ balance: 12000, interestRate: 0, remainingTermYears: 1 })
    expect(annual).toBeCloseTo(12000, 6)
  })
})

describe('advanceMortgageYear', () => {
  it('pays the full scheduled annual payment and reduces the balance in a normal year', () => {
    const balance = 300000
    const rate = 0.06
    const annualPayment = calculateNominalAnnualPayment({ balance, interestRate: rate, remainingTermYears: 30 })
    const result = advanceMortgageYear(balance, annualPayment, rate)

    expect(result.nominalPaymentMade).toBeCloseTo(annualPayment, 6)
    expect(result.nominalBalance).toBeLessThan(balance)
    expect(result.nominalBalance).toBeGreaterThan(0)
  })

  it('matches true monthly compounding, not a cruder annual-lump-interest approximation', () => {
    // Hand-computed first month: $300,000 at 6%/yr (0.5%/mo) accrues $1,500 interest;
    // the rest of the $1,798.65 payment (~$298.65) reduces principal.
    const balance = 300000
    const rate = 0.06
    const annualPayment = calculateNominalAnnualPayment({ balance, interestRate: rate, remainingTermYears: 30 })
    const monthlyPayment = annualPayment / 12
    const firstMonthInterest = balance * (rate / 12)
    const firstMonthPrincipal = monthlyPayment - firstMonthInterest

    // After 12 months of shrinking-balance monthly compounding, total principal paid
    // exceeds 12x the first month's principal (later months pay down faster).
    const result = advanceMortgageYear(balance, annualPayment, rate)
    const totalPrincipalPaidThisYear = balance - result.nominalBalance
    expect(totalPrincipalPaidThisYear).toBeGreaterThan(firstMonthPrincipal * 12)
  })

  it('fully amortizes to (approximately) zero after the full term', () => {
    const rate = 0.06
    let balance = 300000
    const annualPayment = calculateNominalAnnualPayment({ balance, interestRate: rate, remainingTermYears: 30 })
    for (let year = 0; year < 30; year++) {
      balance = advanceMortgageYear(balance, annualPayment, rate).nominalBalance
    }
    expect(balance).toBeCloseTo(0, 0)
  })

  it('caps the final payment at the remaining balance plus that month’s interest, never going negative', () => {
    // A tiny remaining balance relative to the scheduled payment — pays off in month 1.
    const result = advanceMortgageYear(500, 21584, 0.06)
    expect(result.nominalBalance).toBe(0)
    expect(result.nominalPaymentMade).toBeCloseTo(500 + 500 * (0.06 / 12), 6)
  })

  it('does nothing once the balance is already 0', () => {
    const result = advanceMortgageYear(0, 21584, 0.06)
    expect(result).toEqual({ nominalBalance: 0, nominalPaymentMade: 0 })
  })
})
