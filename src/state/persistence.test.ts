// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deserializeInputs, InvalidImportError, loadServerPlan, serializeInputs, ServerPlanError } from './persistence'
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

describe('loadServerPlan', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when nothing has been saved yet (404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })))
    await expect(loadServerPlan()).resolves.toBeNull()
  })

  it('returns the saved plan', async () => {
    const inputs = createDefaultInputs()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(serializeInputs(inputs), { status: 200 })))
    await expect(loadServerPlan()).resolves.toEqual(inputs)
  })

  it('rejects a corrupt saved file rather than silently starting blank', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{ truncated', { status: 200 })))
    await expect(loadServerPlan()).rejects.toThrow(/couldn't be read/i)
  })

  it('rejects on a server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))
    await expect(loadServerPlan()).rejects.toThrow(ServerPlanError)
  })
})
