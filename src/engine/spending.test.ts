// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { baseAnnualSpending, bridgeHealthInsuranceAnnual, totalSpendingNeedForAge } from './spending'
import type { SpendingInputs } from './spending'

const spending: SpendingInputs = {
  monthlySpendExclMortgage: 5500,
  bridgeHealthInsuranceMonthly: 1300,
  medicareEligibilityAge: 65,
}
const retirementAge = 52

describe('spending', () => {
  it('multiplies monthly spending and bridge health insurance out to annual totals', () => {
    expect(baseAnnualSpending(spending)).toBe(66000)
    expect(bridgeHealthInsuranceAnnual(spending)).toBe(15600)
  })

  it('needs nothing before retirement', () => {
    expect(totalSpendingNeedForAge(51, retirementAge, spending)).toBe(0)
  })

  it('needs base spending plus the health insurance bridge between retirement and Medicare', () => {
    expect(totalSpendingNeedForAge(52, retirementAge, spending)).toBe(66000 + 15600)
    expect(totalSpendingNeedForAge(64, retirementAge, spending)).toBe(66000 + 15600)
  })

  it('drops the health insurance bridge once Medicare eligibility is reached', () => {
    expect(totalSpendingNeedForAge(65, retirementAge, spending)).toBe(66000)
    expect(totalSpendingNeedForAge(90, retirementAge, spending)).toBe(66000)
  })
})
