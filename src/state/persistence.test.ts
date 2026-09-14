// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { deserializeInputs, InvalidImportError, serializeInputs } from './persistence'
import { createDefaultInputs } from './appInputs'

describe('serializeInputs / deserializeInputs', () => {
  it('round-trips the default inputs exactly', () => {
    const inputs = createDefaultInputs()
    const restored = deserializeInputs(serializeInputs(inputs))
    expect(restored).toEqual(inputs)
  })

  it('round-trips a plan with a mortgage account and multiple pensions', () => {
    const inputs = createDefaultInputs()
    inputs.accounts.push({
      id: 'house',
      name: 'House',
      type: 'mortgage',
      balance: 300000,
      annualContribution: 0,
      mortgageInterestRate: 0.06,
      mortgageRemainingTermYears: 25,
      mortgageExtraMonthlyPayment: 200,
      mortgageEscrowMonthly: 400,
      mortgageSnowballToAccountId: 'brokerage',
    })
    inputs.pensions.push({ id: 'p2', name: 'Old Employer', type: 'fixed', monthlyBenefit: 500, startAge: 65 })

    const restored = deserializeInputs(serializeInputs(inputs))
    expect(restored).toEqual(inputs)
  })

  it('rejects invalid JSON', () => {
    expect(() => deserializeInputs('{not valid json')).toThrow(InvalidImportError)
  })

  it('rejects valid JSON that is not an object', () => {
    expect(() => deserializeInputs('42')).toThrow(InvalidImportError)
    expect(() => deserializeInputs('null')).toThrow(InvalidImportError)
    expect(() => deserializeInputs('[1,2,3]')).toThrow(InvalidImportError)
  })

  it('rejects an object missing a required top-level field', () => {
    const incomplete = { ...createDefaultInputs() } as Record<string, unknown>
    delete incomplete.pensions
    expect(() => deserializeInputs(JSON.stringify(incomplete))).toThrow(InvalidImportError)
    expect(() => deserializeInputs(JSON.stringify(incomplete))).toThrow(/pensions/)
  })
})
