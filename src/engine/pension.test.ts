// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  annualPensionAfterReduction,
  annualPensionAmount,
  pensionIncomeForAge,
  pensionReductionFactor,
  totalPensionIncomeForAge,
  unreducedAnnualPension,
} from './pension'
import type { FersPensionInputs, FixedPensionInputs, PensionInputs } from './pension'

const fersPension: FersPensionInputs = {
  id: 'p1',
  name: 'FERS Pension',
  type: 'fers',
  high3Salary: 98000,
  yearsOfService: 11.3333,
  annuityMultiplier: 0.01,
  startAge: 60,
}

describe('FERS-style pension', () => {
  it('computes the unreduced annual pension as salary x years of service x multiplier', () => {
    expect(unreducedAnnualPension(fersPension)).toBeCloseTo(11106.634, 3)
  })

  it('computes a 10% reduction factor for starting 2 years before 62 (5% per year)', () => {
    expect(pensionReductionFactor(fersPension)).toBeCloseTo(0.1, 10)
  })

  it('applies the reduction factor to the unreduced pension', () => {
    expect(annualPensionAfterReduction(fersPension)).toBeCloseTo(9995.9706, 3)
  })

  it('applies no reduction when started at or after 62', () => {
    const at62: FersPensionInputs = { ...fersPension, startAge: 62 }
    expect(pensionReductionFactor(at62)).toBe(0)
    expect(annualPensionAfterReduction(at62)).toBeCloseTo(unreducedAnnualPension(at62), 6)
  })

  it('pays nothing before the pension start age', () => {
    expect(pensionIncomeForAge(59, fersPension)).toBe(0)
  })

  it('pays the reduced pension from the start age onward', () => {
    expect(pensionIncomeForAge(60, fersPension)).toBeCloseTo(9995.9706, 3)
    expect(pensionIncomeForAge(90, fersPension)).toBeCloseTo(9995.9706, 3)
  })
})

describe('fixed pension/annuity', () => {
  const fixedPension: FixedPensionInputs = {
    id: 'p2',
    name: 'Old Employer Pension',
    type: 'fixed',
    monthlyBenefit: 2000,
    startAge: 65,
  }

  it('has no formula or reduction — the annual amount is just the monthly benefit times 12', () => {
    expect(annualPensionAmount(fixedPension)).toBe(24000)
  })

  it('pays nothing before its start age', () => {
    expect(pensionIncomeForAge(64, fixedPension)).toBe(0)
  })

  it('pays the full annual amount from its start age onward', () => {
    expect(pensionIncomeForAge(65, fixedPension)).toBe(24000)
    expect(pensionIncomeForAge(90, fixedPension)).toBe(24000)
  })
})

describe('totalPensionIncomeForAge', () => {
  const pensions: PensionInputs[] = [
    { id: 'p1', name: 'FERS Pension', type: 'fers', high3Salary: 98000, yearsOfService: 11.3333, annuityMultiplier: 0.01, startAge: 60 },
    { id: 'p2', name: 'Old Employer Pension', type: 'fixed', monthlyBenefit: 2000, startAge: 65 },
  ]

  it('sums to 0 before any pension has started', () => {
    expect(totalPensionIncomeForAge(() => 59, pensions)).toBe(0)
  })

  it('includes only the pensions that have started', () => {
    expect(totalPensionIncomeForAge(() => 62, pensions)).toBeCloseTo(9995.9706, 3)
  })

  it('sums every pension once all have started', () => {
    expect(totalPensionIncomeForAge(() => 65, pensions)).toBeCloseTo(9995.9706 + 24000, 3)
  })

  it('sums to 0 for an empty list', () => {
    expect(totalPensionIncomeForAge(() => 70, [])).toBe(0)
  })
})
