// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createDemoInputs } from './demoInputs'
import { runProjection } from '../engine/projection'

describe('createDemoInputs', () => {
  it('produces a plan that runs through the projection engine without error', () => {
    const inputs = createDemoInputs()
    const years = runProjection({
      personal: inputs.personal,
      growth: inputs.growth,
      accounts: inputs.accounts,
      spending: inputs.spending,
      pensions: inputs.pensions,
      socialSecurity: inputs.socialSecurity,
      taxes: inputs.taxes,
      rmdSurplus: inputs.rmdSurplus,
      oneTimeEvents: inputs.oneTimeEvents,
      guardrails: inputs.guardrails,
    })
    expect(years.length).toBe(inputs.personal.horizonAge - inputs.personal.currentAge + 1)
  })

  it('uses the guardrails (dynamic) spending strategy, to showcase the feature', () => {
    const inputs = createDemoInputs()
    expect(inputs.guardrails.strategy).toBe('guardrails')
  })

  it('includes both a one-time inflow and outflow event, to showcase the feature', () => {
    const inputs = createDemoInputs()
    expect(inputs.oneTimeEvents.some((e) => e.amount > 0)).toBe(true)
    expect(inputs.oneTimeEvents.some((e) => e.amount < 0)).toBe(true)
  })

  it("the mortgage's snowball target references an account that actually exists", () => {
    const inputs = createDemoInputs()
    const mortgage = inputs.accounts.find((a) => a.type === 'mortgage')!
    expect(mortgage.mortgageSnowballToAccountId).toBeTruthy()
    expect(inputs.accounts.some((a) => a.id === mortgage.mortgageSnowballToAccountId)).toBe(true)
  })

  it('includes at least one account of every type, and both pension types, to actually showcase the features', () => {
    const inputs = createDemoInputs()
    const accountTypes = new Set(inputs.accounts.map((a) => a.type))
    expect(accountTypes).toEqual(new Set(['taxable', 'tax-deferred', 'roth', 'cash', 'home', 'mortgage']))

    const pensionTypes = new Set(inputs.pensions.map((p) => p.type))
    expect(pensionTypes).toEqual(new Set(['fers', 'fixed']))
  })
})
