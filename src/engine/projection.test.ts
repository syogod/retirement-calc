// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { projectAccountGrowth } from './growth'
import { totalGuaranteedIncomeForAge } from './guaranteedIncome'
import { calculateNominalAnnualPayment } from './mortgage'
import type { PensionInputs } from './pension'
import { runProjection } from './projection'
import type { ProjectionInputs } from './projection'
import type { SocialSecurityInputs } from './socialSecurity'
import { totalSpendingNeedForAge } from './spending'
import type { GuardrailsSettings } from './guardrails'
import type { OneTimeEvent } from './oneTimeEvents'
import type { RmdSurplusSettings } from './rmd'
import type { TaxSettings } from './tax'
import type { Account, GrowthInputs, PersonalInputs } from './types'

// No state tax and (via a $0 combined-income baseline) no unusual federal tax
// interactions — most of this file's tests predate the tax engine and just want
// the pre-existing withdrawal-need math untouched.
const taxes: TaxSettings = { stateRate: 0 }
const rmdSurplus: RmdSurplusSettings = { strategy: 'spend' }
const oneTimeEvents: OneTimeEvent[] = []
// Fixed strategy everywhere in this file — guardrails behavior has its own dedicated tests.
const guardrails: GuardrailsSettings = {
  strategy: 'fixed',
  upperGuardrailPct: 0.2,
  cutPct: 0.1,
  lowerGuardrailPct: 0.2,
  raisePct: 0.1,
}

describe('runProjection — multi-account household scenario', () => {
  const personal: PersonalInputs = { currentAge: 42, retirementAge: 52, horizonAge: 95, currentYear: 2026 }
  const growth: GrowthInputs = { nominalReturn: 0.07, inflation: 0.03 }
  const accounts: Account[] = [
    { id: 'espp', name: 'ESPP', type: 'taxable', balance: 45000, annualContribution: 13000 / (1 - 0.15) },
    { id: 'tsp', name: 'TSP', type: 'tax-deferred', balance: 360000, annualContribution: 0 },
    { id: 'brokerage', name: 'Brokerage', type: 'taxable', balance: 70000, annualContribution: 100 * 12 },
    { id: 'four01k-sam', name: '401(k) - Sam', type: 'tax-deferred', balance: 95000, annualContribution: 650 * 26 },
    { id: 'four01k-robin', name: '401(k) - Robin', type: 'tax-deferred', balance: 125000, annualContribution: 0 },
    { id: 'roth-sam', name: 'Roth IRA - Sam', type: 'roth', balance: 45000, annualContribution: 0 },
    { id: 'roth-robin', name: 'Roth IRA - Robin', type: 'roth', balance: 47000, annualContribution: 0 },
  ]
  const spending = { monthlySpendExclMortgage: 5500, bridgeHealthInsuranceMonthly: 1300, medicareEligibilityAge: 65 }
  const pensions: PensionInputs[] = [
    {
      id: 'p1',
      name: 'FERS Pension',
      type: 'fers',
      high3Salary: 98000,
      yearsOfService: 11.3333,
      annuityMultiplier: 0.01,
      startAge: 60,
    },
  ]
  const socialSecurity: SocialSecurityInputs[] = [
    { monthlyBenefitAt62: 2400, monthlyBenefitAt67: 3600, monthlyBenefitAt70: 4500, claimingAge: 67, haircut: 0.9 },
  ]
  const inputs: ProjectionInputs = {
    personal,
    growth,
    accounts,
    spending,
    pensions,
    socialSecurity,
    taxes,
    rmdSurplus,
    oneTimeEvents,
    guardrails,
  }

  it('matches the pure growth engine before retirement (no withdrawals yet)', () => {
    const growthOnly = projectAccountGrowth(accounts, personal, growth)
    const projected = runProjection(inputs)

    for (const age of [42, 43, 45, 51]) {
      const expected = growthOnly.find((y) => y.age === age)!.total
      const actual = projected.find((y) => y.age === age)!.totalPortfolio
      expect(actual).toBeCloseTo(expected, 4)
    }
  })

  it('withdraws exactly the funding gap in the first retirement year, matching pure growth minus the withdrawal', () => {
    const growthOnly = projectAccountGrowth(accounts, personal, growth)
    const projected = runProjection(inputs)

    const age52 = projected.find((y) => y.age === 52)!
    const age52GrowthOnly = growthOnly.find((y) => y.age === 52)!.total

    expect(age52.spendingNeed).toBeCloseTo(totalSpendingNeedForAge(52, personal.retirementAge, spending), 6)
    expect(age52.guaranteedIncome).toBeCloseTo(
      totalGuaranteedIncomeForAge(() => 52, pensions, socialSecurity),
      6,
    )
    expect(age52.netWithdrawalNeeded).toBeCloseTo(age52.spendingNeed - age52.guaranteedIncome, 6)
    // Not depleted, so the full need was taken from the growth-only balance.
    expect(age52.netWithdrawalTaken).toBeCloseTo(age52.netWithdrawalNeeded, 6)
    expect(age52.totalPortfolio).toBeCloseTo(age52GrowthOnly - age52.netWithdrawalNeeded, 4)
  })

  it('wires spending need and guaranteed income through for a later retirement year', () => {
    const projected = runProjection(inputs)
    const age70 = projected.find((y) => y.age === 70)!

    expect(age70.spendingNeed).toBeCloseTo(totalSpendingNeedForAge(70, personal.retirementAge, spending), 6)
    expect(age70.guaranteedIncome).toBeCloseTo(
      totalGuaranteedIncomeForAge(() => 70, pensions, socialSecurity),
      6,
    )
  })

  it('never depletes and always fully covers the withdrawal need for this plan', () => {
    const projected = runProjection(inputs)
    for (const y of projected) {
      expect(y.fundsDepleted).toBe(false)
      expect(y.totalPortfolio).toBeGreaterThanOrEqual(0)
      // The fundamental tax-aware-withdrawal invariant: guaranteed income plus
      // everything withdrawn, minus tax and any early-withdrawal penalty, nets AT
      // LEAST the spending need — never less (since nothing here depletes). It can
      // be more: a forced RMD (from age 75 on, for this 1984-born household) or a
      // guaranteed-income surplus can leave extra spendable cash that this app
      // doesn't reinvest anywhere (a documented simplification).
      const netSpendable = y.guaranteedIncome + y.netWithdrawalTaken - y.taxOwed - y.earlyWithdrawalPenaltyAmount
      expect(netSpendable).toBeGreaterThanOrEqual(y.spendingNeed - 0.01)
    }
  })

  it("forces an RMD once the household's birth year (1984) reaches its RMD start age (75), not before", () => {
    const projected = runProjection(inputs)
    for (const y of projected.filter((y) => y.age < 75)) {
      expect(y.rmdWithdrawn).toBe(0)
    }
    const age75 = projected.find((y) => y.age === 75)!
    expect(age75.rmdWithdrawn).toBeGreaterThan(0)
  })

  it('never flags an early withdrawal penalty before retirement (nothing is withdrawn)', () => {
    const projected = runProjection(inputs)
    for (const y of projected.filter((y) => y.age < personal.retirementAge)) {
      expect(y.earlyWithdrawalPenaltyFlag).toBe(false)
    }
  })
})

describe('runProjection — tax-aware withdrawal gross-up (isolated from RMD/surplus effects)', () => {
  it('grosses up a tax-deferred withdrawal so net-of-tax proceeds exactly match the spending need', () => {
    const personal: PersonalInputs = { currentAge: 60, retirementAge: 61, horizonAge: 65, currentYear: 2026 }
    const growth: GrowthInputs = { nominalReturn: 0.07, inflation: 0.03 }
    const accounts: Account[] = [
      { id: 'ira', name: 'IRA', type: 'tax-deferred', balance: 2_000_000, annualContribution: 0 },
    ]
    const spending = { monthlySpendExclMortgage: 5000, bridgeHealthInsuranceMonthly: 0, medicareEligibilityAge: 999 }
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending,
      pensions: [],
      socialSecurity: [],
      taxes: { stateRate: 0.05 },
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    const age62 = projected.find((y) => y.age === 62)!
    expect(age62.taxOwed).toBeGreaterThan(0)
    expect(age62.netWithdrawalTaken).toBeGreaterThan(age62.spendingNeed) // grossed up beyond the raw need
    const netSpendable =
      age62.guaranteedIncome + age62.netWithdrawalTaken - age62.taxOwed - age62.earlyWithdrawalPenaltyAmount
    expect(netSpendable).toBeCloseTo(age62.spendingNeed, 1)
  })
})

describe('runProjection — household with a spouse (per-person ages)', () => {
  it("resolves each pension/SS entry against its own owner's age, not the primary's", () => {
    const personal: PersonalInputs = {
      currentAge: 60,
      retirementAge: 60,
      horizonAge: 63,
      currentYear: 2026,
      spouse: { name: 'Jordan', currentAge: 58 }, // 2 years younger, ages in lockstep
    }
    const growth: GrowthInputs = { nominalReturn: 0.03, inflation: 0.03 } // 0% real return, easy to hand-check
    const accounts: Account[] = [
      { id: 'a', name: 'Savings', type: 'taxable', balance: 10_000_000, annualContribution: 0 },
    ]
    const spending = { monthlySpendExclMortgage: 0, bridgeHealthInsuranceMonthly: 0, medicareEligibilityAge: 999 }
    const pensions: PensionInputs[] = [
      { id: 'p1', name: "Primary's Pension", type: 'fixed', monthlyBenefit: 1000, startAge: 62 },
      { id: 'p2', name: "Spouse's Pension", type: 'fixed', ownerId: 'spouse', monthlyBenefit: 500, startAge: 61 },
    ]
    const socialSecurity: SocialSecurityInputs[] = [
      {
        ownerId: 'primary',
        monthlyBenefitAt62: 0,
        monthlyBenefitAt67: 2000,
        monthlyBenefitAt70: 0,
        claimingAge: 67,
        haircut: 1,
      },
      {
        ownerId: 'spouse',
        monthlyBenefitAt62: 0,
        monthlyBenefitAt67: 1500,
        monthlyBenefitAt70: 0,
        claimingAge: 67,
        haircut: 1,
      },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    // Age 60 (primary 60, spouse 58): nobody's pension or SS has started yet.
    expect(projected.find((y) => y.age === 60)!.guaranteedIncome).toBe(0)
    // Age 61 (primary 61, spouse 59): still nobody — primary's pension starts at
    // 62, spouse's own pension needs the SPOUSE to be 61 (spouse is only 59 here).
    expect(projected.find((y) => y.age === 61)!.guaranteedIncome).toBe(0)
    // Age 62 (primary 62, spouse 60): primary's pension (started at 62) is the
    // only thing on — spouse's pension needs the spouse to be 61, and she's 60.
    expect(projected.find((y) => y.age === 62)!.guaranteedIncome).toBeCloseTo(1000 * 12, 6)
    // Age 63 (primary 63, spouse 61): primary's pension plus spouse's pension
    // (spouse just turned 61) — neither person's SS has started (both claim at 67).
    expect(projected.find((y) => y.age === 63)!.guaranteedIncome).toBeCloseTo(1000 * 12 + 500 * 12, 6)
  })
})

describe('runProjection — synthetic scenario for penalty flag and depletion', () => {
  const personal: PersonalInputs = { currentAge: 50, retirementAge: 51, horizonAge: 55, currentYear: 2026 }
  const growth: GrowthInputs = { nominalReturn: 0.05, inflation: 0.02 }
  const spending = { monthlySpendExclMortgage: 500, bridgeHealthInsuranceMonthly: 0, medicareEligibilityAge: 999 }
  // Never trigger, so all funding comes from the portfolio.
  const pensions: PensionInputs[] = []
  const socialSecurity: SocialSecurityInputs[] = [
    { monthlyBenefitAt62: 0, monthlyBenefitAt67: 0, monthlyBenefitAt70: 0, claimingAge: 999, haircut: 1 },
  ]

  it('flags every retirement year that dips into tax-deferred money before 59.5', () => {
    const accounts: Account[] = [
      { id: 'taxable', name: 'Taxable', type: 'taxable', balance: 1000, annualContribution: 0 },
      { id: 'taxDeferred', name: 'Tax-Deferred', type: 'tax-deferred', balance: 100000, annualContribution: 0 },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    // Annual need is 6000; taxable (1000) covers only the first year's opening gap,
    // so every retirement year here dips into tax-deferred money before 59.5.
    for (const y of projected.filter((y) => y.age >= personal.retirementAge)) {
      expect(y.earlyWithdrawalPenaltyFlag).toBe(true)
      expect(y.fundsDepleted).toBe(false)
    }
  })

  it('flags depletion once the portfolio cannot cover the need', () => {
    const accounts: Account[] = [
      { id: 'taxable', name: 'Taxable', type: 'taxable', balance: 500, annualContribution: 0 },
    ]
    const projected = runProjection({
      personal: { ...personal, horizonAge: 51 },
      growth,
      accounts,
      spending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    const age51 = projected.find((y) => y.age === 51)!
    const realReturn = 1.05 / 1.02 - 1
    expect(age51.fundsDepleted).toBe(true)
    // Balance grows for the year before the withdrawal is applied.
    expect(age51.netWithdrawalTaken).toBeCloseTo(500 * (1 + realReturn), 6)
    expect(age51.totalPortfolio).toBeCloseTo(0, 6)
  })
})

describe('runProjection — mortgage', () => {
  // 0% inflation keeps nominal and real dollars identical, so the mortgage math is
  // easy to check by hand against the standalone mortgage.ts functions.
  const personal: PersonalInputs = { currentAge: 40, retirementAge: 65, horizonAge: 44, currentYear: 2026 }
  const growth: GrowthInputs = { nominalReturn: 0.05, inflation: 0 }
  const pensions: PensionInputs[] = []
  const socialSecurity: SocialSecurityInputs[] = [
    { monthlyBenefitAt62: 0, monthlyBenefitAt67: 0, monthlyBenefitAt70: 0, claimingAge: 999, haircut: 1 },
  ]
  const noOtherSpending = { monthlySpendExclMortgage: 0, bridgeHealthInsuranceMonthly: 0, medicareEligibilityAge: 999 }

  it('excludes the loan balance from the portfolio, but does NOT draw from it pre-retirement (assumed paid from income)', () => {
    const accounts: Account[] = [
      { id: 'savings', name: 'Savings', type: 'taxable', balance: 1_000_000, annualContribution: 0 },
      {
        id: 'house',
        name: 'House',
        type: 'mortgage',
        balance: 300000,
        annualContribution: 0,
        mortgageInterestRate: 0.06,
        mortgageRemainingTermYears: 30,
      },
    ]
    // personal.retirementAge (65) is well after age 41, so this is a pre-retirement year.
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })
    const year1 = projected.find((y) => y.age === 41)!

    const expectedAnnualPayment = calculateNominalAnnualPayment({
      balance: 300000,
      interestRate: 0.06,
      remainingTermYears: 30,
    })
    // The mortgage still amortizes (it's being paid, just not out of savings)...
    expect(year1.mortgagePayment).toBeCloseTo(expectedAnnualPayment, 2)
    // ...but pre-retirement that payment is assumed to come from your paycheck, same
    // as every other living expense in this model, so it creates no withdrawal need.
    expect(year1.spendingNeed).toBe(0)
    expect(year1.balances['house']).toBeUndefined()
    expect(year1.totalPortfolio).toBeCloseTo(1_000_000 * 1.05, 2) // grew, untouched by the mortgage
  })

  it('does draw from the portfolio once retired', () => {
    const accounts: Account[] = [
      { id: 'savings', name: 'Savings', type: 'taxable', balance: 1_000_000, annualContribution: 0 },
      {
        id: 'house',
        name: 'House',
        type: 'mortgage',
        balance: 300000,
        annualContribution: 0,
        mortgageInterestRate: 0.06,
        mortgageRemainingTermYears: 30,
      },
    ]
    const alreadyRetired = { ...personal, retirementAge: personal.currentAge }
    const projected = runProjection({
      personal: alreadyRetired,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })
    const year1 = projected.find((y) => y.age === 41)!

    const expectedAnnualPayment = calculateNominalAnnualPayment({
      balance: 300000,
      interestRate: 0.06,
      remainingTermYears: 30,
    })
    expect(year1.spendingNeed).toBeCloseTo(expectedAnnualPayment, 2)
    expect(year1.totalPortfolio).toBeCloseTo(1_000_000 * 1.05 - expectedAnnualPayment, 2)
  })

  it('stops charging the payment once the mortgage is paid off, dropping spending need accordingly (once retired)', () => {
    const accounts: Account[] = [
      { id: 'savings', name: 'Savings', type: 'taxable', balance: 1_000_000, annualContribution: 0 },
      {
        id: 'house',
        name: 'House',
        type: 'mortgage',
        balance: 10000,
        annualContribution: 0,
        mortgageInterestRate: 0.05,
        mortgageRemainingTermYears: 1, // pays off within the first projected year
      },
    ]
    const alreadyRetired = { ...personal, retirementAge: personal.currentAge }
    const projected = runProjection({
      personal: alreadyRetired,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    expect(projected.find((y) => y.age === 41)!.mortgagePayment).toBeGreaterThan(0)
    expect(projected.find((y) => y.age === 41)!.spendingNeed).toBeGreaterThan(0)
    expect(projected.find((y) => y.age === 42)!.mortgagePayment).toBe(0)
    expect(projected.find((y) => y.age === 42)!.spendingNeed).toBe(0)
  })

  it('snowballs the freed-up payment into the designated account, starting the year after payoff', () => {
    const accounts: Account[] = [
      { id: 'savings', name: 'Savings', type: 'taxable', balance: 1_000_000, annualContribution: 0 },
      {
        id: 'house',
        name: 'House',
        type: 'mortgage',
        balance: 10000,
        annualContribution: 0,
        mortgageInterestRate: 0.05,
        mortgageRemainingTermYears: 1,
        mortgageSnowballToAccountId: 'savings',
      },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    const payoffYear = projected.find((y) => y.age === 41)!
    const yearAfterPayoff = projected.find((y) => y.age === 42)!
    const expectedFreedPayment = calculateNominalAnnualPayment({
      balance: 10000,
      interestRate: 0.05,
      remainingTermYears: 1,
    })

    // No snowball yet in the payoff year itself — that year still paid the mortgage.
    expect(payoffYear.contributionsThisYear).toBe(0)
    // The year after, the freed-up payment becomes an extra contribution.
    expect(yearAfterPayoff.contributionsThisYear).toBeCloseTo(expectedFreedPayment, 2)
  })

  it('snowballs the extra principal payment along with the base payment, not just the base', () => {
    const accounts: Account[] = [
      { id: 'savings', name: 'Savings', type: 'taxable', balance: 1_000_000, annualContribution: 0 },
      {
        id: 'house',
        name: 'House',
        type: 'mortgage',
        balance: 10000,
        annualContribution: 0,
        mortgageInterestRate: 0.05,
        mortgageRemainingTermYears: 1,
        mortgageExtraMonthlyPayment: 500,
        mortgageSnowballToAccountId: 'savings',
      },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    const basePayment = calculateNominalAnnualPayment({ balance: 10000, interestRate: 0.05, remainingTermYears: 1 })
    const expectedFreedPayment = basePayment + 500 * 12 // base + extra, not base alone

    expect(projected.find((y) => y.age === 42)!.contributionsThisYear).toBeCloseTo(expectedFreedPayment, 2)
  })

  it('does not snowball once retirement age is reached, even if the mortgage is already paid off', () => {
    const accounts: Account[] = [
      { id: 'savings', name: 'Savings', type: 'taxable', balance: 1_000_000, annualContribution: 0 },
      {
        id: 'house',
        name: 'House',
        type: 'mortgage',
        balance: 10000,
        annualContribution: 0,
        mortgageInterestRate: 0.05,
        mortgageRemainingTermYears: 1,
        mortgageSnowballToAccountId: 'savings',
      },
    ]
    const retiredEarly = { ...personal, retirementAge: 41 }
    const projected = runProjection({
      personal: retiredEarly,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    expect(projected.find((y) => y.age === 42)!.contributionsThisYear).toBe(0)
  })

  it('pays off faster with an extra monthly principal payment, and snowballs the full (base + extra) amount', () => {
    const longHorizonPersonal = { ...personal, horizonAge: 70 }
    const withoutExtra: Account[] = [
      {
        id: 'house',
        name: 'House',
        type: 'mortgage',
        balance: 300000,
        annualContribution: 0,
        mortgageInterestRate: 0.06,
        mortgageRemainingTermYears: 30,
      },
    ]
    const withExtra: Account[] = [{ ...withoutExtra[0], mortgageExtraMonthlyPayment: 1000 }]

    const projectedWithout = runProjection({
      personal: longHorizonPersonal,
      growth,
      accounts: withoutExtra,
      spending: noOtherSpending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })
    const projectedWith = runProjection({
      personal: longHorizonPersonal,
      growth,
      accounts: withExtra,
      spending: noOtherSpending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    // Year 1: the extra $1,000/month shows up on top of the base scheduled payment.
    const basePayment = calculateNominalAnnualPayment({ balance: 300000, interestRate: 0.06, remainingTermYears: 30 })
    expect(projectedWith.find((y) => y.age === 41)!.mortgagePayment).toBeCloseTo(basePayment + 12000, 2)
    expect(projectedWithout.find((y) => y.age === 41)!.mortgagePayment).toBeCloseTo(basePayment, 2)

    // By year 20, the extra-payment loan is paid off; the scheduled 30-year loan isn't.
    expect(projectedWith.find((y) => y.age === 60)!.mortgagePayment).toBe(0)
    expect(projectedWithout.find((y) => y.age === 60)!.mortgagePayment).toBeGreaterThan(0)
  })

  it('escrow (property tax/insurance) applies before and after payoff, and is excluded from the snowball', () => {
    const accounts: Account[] = [
      { id: 'savings', name: 'Savings', type: 'taxable', balance: 1_000_000, annualContribution: 0 },
      {
        id: 'house',
        name: 'House',
        type: 'mortgage',
        balance: 10000,
        annualContribution: 0,
        mortgageInterestRate: 0.05,
        mortgageRemainingTermYears: 1, // pays off within the first projected year
        mortgageEscrowMonthly: 400,
        mortgageSnowballToAccountId: 'savings',
      },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    const beforePayoff = projected.find((y) => y.age === 41)!
    const afterPayoff = projected.find((y) => y.age === 42)!
    const escrowAnnual = 400 * 12
    const basePayment = calculateNominalAnnualPayment({ balance: 10000, interestRate: 0.05, remainingTermYears: 1 })

    // Escrow applies on top of the P&I payment before payoff...
    expect(beforePayoff.mortgagePayment).toBeCloseTo(basePayment + escrowAnnual, 2)
    // ...and continues as the ONLY mortgage cost after payoff (P&I is gone).
    expect(afterPayoff.mortgagePayment).toBeCloseTo(escrowAnnual, 2)
    // The snowball only gets the freed-up P&I, never the escrow.
    expect(afterPayoff.contributionsThisYear).toBeCloseTo(basePayment, 2)
  })

  it('starts drawing from the portfolio for the mortgage exactly at retirement, if the loan is still outstanding', () => {
    const stillOwesAtRetirement: PersonalInputs = {
      currentAge: 50,
      retirementAge: 52,
      horizonAge: 55,
      currentYear: 2026,
    }
    const accounts: Account[] = [
      { id: 'savings', name: 'Savings', type: 'taxable', balance: 1_000_000, annualContribution: 0 },
      {
        id: 'house',
        name: 'House',
        type: 'mortgage',
        balance: 50000,
        annualContribution: 0,
        mortgageInterestRate: 0.05,
        mortgageRemainingTermYears: 10, // won't be paid off within this short horizon
        mortgageEscrowMonthly: 100,
      },
    ]
    const projected = runProjection({
      personal: stillOwesAtRetirement,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions,
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    // Pre-retirement (ages 51): no paycheck needed, the mortgage quietly amortizes.
    const preRetirement = projected.find((y) => y.age === 51)!
    expect(preRetirement.mortgagePayment).toBeGreaterThan(0)
    expect(preRetirement.spendingNeed).toBe(0)

    // At retirement (age 52) the loan is still outstanding — there's no paycheck to
    // cover it anymore, so it becomes a real withdrawal need from day one of retirement.
    const atRetirement = projected.find((y) => y.age === 52)!
    expect(atRetirement.mortgagePayment).toBeGreaterThan(0)
    expect(atRetirement.spendingNeed).toBeCloseTo(atRetirement.mortgagePayment, 2)
    expect(atRetirement.netWithdrawalNeeded).toBeCloseTo(atRetirement.mortgagePayment, 2)
  })
})

describe('runProjection — RMD surplus handling and cash accounts', () => {
  // A large tax-deferred balance forces a big RMD relative to a small spending
  // need, so most of the RMD is a genuine surplus every year in this range.
  const personal: PersonalInputs = { currentAge: 74, retirementAge: 60, horizonAge: 76, currentYear: 2026 } // born 1952: RMD age 73, already active
  const growth: GrowthInputs = { nominalReturn: 0.03, inflation: 0.03 } // 0% real return, easy to hand-check
  const spending = { monthlySpendExclMortgage: 1000, bridgeHealthInsuranceMonthly: 0, medicareEligibilityAge: 999 }
  const taxes: TaxSettings = { stateRate: 0 }

  it('regression: crediting the RMD against spending need (not double-withdrawing on top of it)', () => {
    const accounts: Account[] = [
      { id: 'ira', name: 'IRA', type: 'tax-deferred', balance: 3_000_000, annualContribution: 0 },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending,
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus: { strategy: 'spend' },
      oneTimeEvents: [],
      guardrails,
    })
    const age75 = projected.find((y) => y.age === 75)!
    expect(age75.rmdWithdrawn).toBeGreaterThan(age75.spendingNeed) // RMD alone dwarfs the modest spending need
    // The total withdrawn should be (very close to) just the RMD itself — not the
    // RMD *plus* a second, separate withdrawal sized to spendingNeed + its own tax.
    expect(age75.netWithdrawalTaken).toBeCloseTo(age75.rmdWithdrawn, 1)
  })

  it("'spend' strategy: the surplus has no effect on any other account's balance", () => {
    const accounts: Account[] = [
      { id: 'ira', name: 'IRA', type: 'tax-deferred', balance: 3_000_000, annualContribution: 0 },
      {
        id: 'brokerage',
        name: 'Brokerage',
        type: 'taxable',
        balance: 10000,
        taxableCostBasis: 10000,
        annualContribution: 0,
      },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending,
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus: { strategy: 'spend' },
      oneTimeEvents: [],
      guardrails,
    })
    const age75 = projected.find((y) => y.age === 75)!
    expect(age75.rmdSurplus).toBeGreaterThan(0)
    // Untouched brokerage account: no growth assumed (0% real return), no withdrawal drawn from it.
    expect(age75.balances.brokerage).toBeCloseTo(10000, 2)
  })

  it("'reinvest' strategy: the after-tax surplus is added to the target taxable account's balance and cost basis", () => {
    const accounts: Account[] = [
      { id: 'ira', name: 'IRA', type: 'tax-deferred', balance: 3_000_000, annualContribution: 0 },
      {
        id: 'brokerage',
        name: 'Brokerage',
        type: 'taxable',
        balance: 10000,
        taxableCostBasis: 10000,
        annualContribution: 0,
      },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending,
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus: { strategy: 'reinvest', targetAccountId: 'brokerage' },
      oneTimeEvents: [],
      guardrails,
    })
    const age75 = projected.find((y) => y.age === 75)!
    expect(age75.rmdSurplus).toBeGreaterThan(0)
    // 0% real return, so absent the reinvestment the balance would stay at 10000.
    expect(age75.balances.brokerage).toBeCloseTo(10000 + age75.rmdSurplus, 2)
  })

  it("'cashReserve' strategy: the surplus is deposited into the target cash account and persists (0% growth) into the next year", () => {
    const accounts: Account[] = [
      { id: 'ira', name: 'IRA', type: 'tax-deferred', balance: 3_000_000, annualContribution: 0 },
      { id: 'reserve', name: 'Cash Reserve', type: 'cash', balance: 0, annualContribution: 0 },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending,
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus: { strategy: 'cashReserve', targetAccountId: 'reserve' },
      oneTimeEvents: [],
      guardrails,
    })
    const age75 = projected.find((y) => y.age === 75)!
    expect(age75.rmdSurplus).toBeGreaterThan(0)
    expect(age75.balances.reserve).toBeCloseTo(age75.rmdSurplus, 2)

    // Next year: no growth (cash is zero-real-growth) and (since the account itself
    // isn't tax-deferred) no new RMD-driven deposit is required to explain it still
    // being there — it simply persists at exactly last year's ending balance plus
    // whatever new surplus arrived.
    const age76 = projected.find((y) => y.age === 76)!
    expect(age76.balances.reserve).toBeCloseTo(age75.balances.reserve + age76.rmdSurplus, 2)
  })

  it('falls back to leaving the surplus unrouted if the configured target account is missing or the wrong type', () => {
    const accounts: Account[] = [
      { id: 'ira', name: 'IRA', type: 'tax-deferred', balance: 3_000_000, annualContribution: 0 },
      { id: 'roth', name: 'Roth', type: 'roth', balance: 10000, rothBasis: 10000, annualContribution: 0 },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending,
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus: { strategy: 'reinvest', targetAccountId: 'roth' }, // wrong type for 'reinvest'
      oneTimeEvents: [],
      guardrails,
    })
    const age75 = projected.find((y) => y.age === 75)!
    expect(age75.rmdSurplus).toBeGreaterThan(0)
    expect(age75.balances.roth).toBeCloseTo(10000, 2) // untouched, fell back to "spend"
  })

  it('a cash account earns no growth (0% real return) when left untouched', () => {
    const accounts: Account[] = [
      { id: 'reserve', name: 'Cash Reserve', type: 'cash', balance: 5000, annualContribution: 0 },
    ]
    const projected = runProjection({
      personal: { ...personal, currentAge: 60, retirementAge: 60, horizonAge: 62 },
      growth: { nominalReturn: 0.07, inflation: 0.02 }, // a real (non-zero) return assumption, to prove cash ignores it
      accounts,
      spending: { monthlySpendExclMortgage: 0, bridgeHealthInsuranceMonthly: 0, medicareEligibilityAge: 999 },
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus: { strategy: 'spend' },
      oneTimeEvents: [],
      guardrails,
    })
    for (const y of projected) {
      expect(y.balances.reserve).toBeCloseTo(5000, 6)
    }
  })

  it('draws from a cash account as an absolute last resort once every other account is exhausted', () => {
    const accounts: Account[] = [
      { id: 'taxable', name: 'Taxable', type: 'taxable', balance: 500, taxableCostBasis: 500, annualContribution: 0 },
      { id: 'reserve', name: 'Cash Reserve', type: 'cash', balance: 5000, annualContribution: 0 },
    ]
    const projected = runProjection({
      personal: { currentAge: 60, retirementAge: 60, horizonAge: 61, currentYear: 2026 },
      growth: { nominalReturn: 0.03, inflation: 0.03 }, // 0% real return
      accounts,
      spending: { monthlySpendExclMortgage: 200, bridgeHealthInsuranceMonthly: 0, medicareEligibilityAge: 999 }, // $2400/yr
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus: { strategy: 'spend' },
      oneTimeEvents: [],
      guardrails,
    })
    const year1 = projected.find((y) => y.age === 61)!
    // Taxable (500) covers part of the $2400 need; the rest comes from cash.
    expect(year1.balances.taxable).toBeCloseTo(0, 2)
    expect(year1.balances.reserve).toBeCloseTo(5000 - (2400 - 500), 2)
    expect(year1.fundsDepleted).toBe(false)
  })
})

describe('runProjection — one-time events', () => {
  const growth: GrowthInputs = { nominalReturn: 0.03, inflation: 0.03 } // 0% real return, easy to hand-check
  const noOtherSpending = { monthlySpendExclMortgage: 0, bridgeHealthInsuranceMonthly: 0, medicareEligibilityAge: 999 }
  const taxes: TaxSettings = { stateRate: 0 }
  const rmdSurplus: RmdSurplusSettings = { strategy: 'spend' }

  it('adds an outflow event to spending need only in the exact year it fires', () => {
    const personal: PersonalInputs = { currentAge: 60, retirementAge: 61, horizonAge: 63, currentYear: 2026 }
    const accounts: Account[] = [
      {
        id: 'taxable',
        name: 'Taxable',
        type: 'taxable',
        balance: 1_000_000,
        taxableCostBasis: 1_000_000,
        annualContribution: 0,
      },
    ]
    const oneTimeEvents: OneTimeEvent[] = [{ id: 'e1', name: 'Wedding', age: 62, amount: -10000 }]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    expect(projected.find((y) => y.age === 61)!.spendingNeed).toBe(0)
    expect(projected.find((y) => y.age === 62)!.spendingNeed).toBe(10000)
    expect(projected.find((y) => y.age === 62)!.oneTimeOutflow).toBe(10000)
    expect(projected.find((y) => y.age === 63)!.spendingNeed).toBe(0)
    // No ordinary income, no capital gains (basis = balance), 0% state rate -> no tax at all.
    expect(projected.find((y) => y.age === 62)!.netWithdrawalTaken).toBeCloseTo(10000, 2)
  })

  it('a recurring outflow (repeatEveryYears) fires at every scheduled age through the plan, and stops at repeatUntilAge', () => {
    const personal: PersonalInputs = { currentAge: 60, retirementAge: 60, horizonAge: 95, currentYear: 2026 }
    const accounts: Account[] = [
      {
        id: 'taxable',
        name: 'Taxable',
        type: 'taxable',
        balance: 5_000_000,
        taxableCostBasis: 5_000_000,
        annualContribution: 0,
      },
    ]
    const oneTimeEvents: OneTimeEvent[] = [
      { id: 'e1', name: 'New car', age: 65, amount: -25000, repeatEveryYears: 10, repeatUntilAge: 85 },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    for (const age of [65, 75, 85]) {
      expect(projected.find((y) => y.age === age)!.oneTimeOutflow).toBe(25000)
    }
    for (const age of [60, 64, 70, 80, 95]) {
      expect(projected.find((y) => y.age === age)!.oneTimeOutflow).toBe(0)
    }
  })

  it("fires an event at the spouse's own age, not the primary's", () => {
    const personal: PersonalInputs = {
      currentAge: 60,
      retirementAge: 60,
      horizonAge: 63,
      currentYear: 2026,
      spouse: { name: 'Jordan', currentAge: 58 },
    }
    const accounts: Account[] = [
      {
        id: 'taxable',
        name: 'Taxable',
        type: 'taxable',
        balance: 1_000_000,
        taxableCostBasis: 1_000_000,
        annualContribution: 0,
      },
    ]
    // Spouse turns 60 when the primary is 62 (2-year gap).
    const oneTimeEvents: OneTimeEvent[] = [
      { id: 'e1', name: "Spouse's expense", age: 60, ownerId: 'spouse', amount: -5000 },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    expect(projected.find((y) => y.age === 61)!.spendingNeed).toBe(0)
    expect(projected.find((y) => y.age === 62)!.spendingNeed).toBe(5000)
  })

  it('deposits an inflow event into its target account, then lets it grow normally afterward', () => {
    const personal: PersonalInputs = { currentAge: 60, retirementAge: 60, horizonAge: 66, currentYear: 2026 }
    const accounts: Account[] = [
      {
        id: 'brokerage',
        name: 'Brokerage',
        type: 'taxable',
        balance: 100000,
        taxableCostBasis: 100000,
        annualContribution: 0,
      },
    ]
    const oneTimeEvents: OneTimeEvent[] = [
      { id: 'e1', name: 'Inheritance', age: 65, amount: 50000, targetAccountId: 'brokerage' },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    expect(projected.find((y) => y.age === 64)!.balances.brokerage).toBeCloseTo(100000, 2) // 0% real growth, no deposit yet
    expect(projected.find((y) => y.age === 65)!.balances.brokerage).toBeCloseTo(150000, 2) // deposit lands
    expect(projected.find((y) => y.age === 65)!.oneTimeInflow).toBe(50000)
    expect(projected.find((y) => y.age === 66)!.balances.brokerage).toBeCloseTo(150000, 2) // persists, still 0% real growth
  })

  it('counts a taxable inflow event as ordinary income, generating a real tax bill', () => {
    const personal: PersonalInputs = { currentAge: 60, retirementAge: 60, horizonAge: 66, currentYear: 2026 }
    const accounts: Account[] = [
      {
        id: 'brokerage',
        name: 'Brokerage',
        type: 'taxable',
        balance: 500000,
        taxableCostBasis: 500000,
        annualContribution: 0,
      },
    ]
    const oneTimeEvents: OneTimeEvent[] = [
      { id: 'e1', name: 'Bonus', age: 65, amount: 50000, taxable: true, targetAccountId: 'brokerage' },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions: [],
      socialSecurity: [],
      taxes: { stateRate: 0.05 },
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    const age65 = projected.find((y) => y.age === 65)!
    expect(age65.taxOwed).toBeGreaterThan(0)
    // The full pre-tax $50,000 was deposited; the resulting tax bill was paid via a
    // separate withdrawal, not netted out of the deposit itself.
    expect(age65.oneTimeInflow).toBe(50000)
  })

  it("respects each account's withdrawal-tier priority even when new cash arrives the same year — an existing higher-priority account is drained first", () => {
    const personal: PersonalInputs = { currentAge: 60, retirementAge: 60, horizonAge: 61, currentYear: 2026 }
    const accounts: Account[] = [
      { id: 'taxable', name: 'Taxable', type: 'taxable', balance: 3000, taxableCostBasis: 3000, annualContribution: 0 },
      { id: 'reserve', name: 'Cash Reserve', type: 'cash', balance: 0, annualContribution: 0 },
    ]
    const oneTimeEvents: OneTimeEvent[] = [
      { id: 'inflow', name: 'Inheritance', age: 61, amount: 10000, targetAccountId: 'reserve' },
      { id: 'outflow', name: 'Expense', age: 61, amount: -5000 },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    const year1 = projected.find((y) => y.age === 61)!
    // Taxable (tier 1, pre-existing $3000) is drained first; only the remaining
    // $2000 of need comes from the newly-arrived cash reserve (tier 5, last resort).
    expect(year1.balances.taxable).toBeCloseTo(0, 2)
    expect(year1.balances.reserve).toBeCloseTo(10000 - 2000, 2)
  })
})

describe('runProjection — home equity and sale', () => {
  const noOtherSpending = { monthlySpendExclMortgage: 0, bridgeHealthInsuranceMonthly: 0, medicareEligibilityAge: 999 }
  const taxes: TaxSettings = { stateRate: 0 }
  const rmdSurplus: RmdSurplusSettings = { strategy: 'spend' }
  const oneTimeEvents: OneTimeEvent[] = []

  it("a home appreciates at its own rate, not the portfolio's, and is excluded from totalPortfolio", () => {
    const personal: PersonalInputs = { currentAge: 60, retirementAge: 60, horizonAge: 62, currentYear: 2026 }
    const growth: GrowthInputs = { nominalReturn: 0.1, inflation: 0.03 }
    const realPortfolioReturn = 1.1 / 1.03 - 1
    const accounts: Account[] = [
      { id: 'home', name: 'House', type: 'home', balance: 500000, annualContribution: 0, homeAppreciationRate: 0.02 },
      {
        id: 'savings',
        name: 'Savings',
        type: 'taxable',
        balance: 100000,
        taxableCostBasis: 100000,
        annualContribution: 0,
      },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    const age61 = projected.find((y) => y.age === 61)!
    expect(age61.homeValue).toBeCloseTo(500000 * 1.02, 2) // its own 2% real rate
    expect(age61.homeEquity).toBeCloseTo(500000 * 1.02, 2) // no linked mortgage -> equity = value
    expect(age61.totalPortfolio).toBeCloseTo(100000 * (1 + realPortfolioReturn), 4) // portfolio grows at its own (different) rate
  })

  it('tracks home equity as value minus the linked mortgage balance, as the mortgage amortizes', () => {
    const personal: PersonalInputs = { currentAge: 60, retirementAge: 60, horizonAge: 62, currentYear: 2026 }
    const growth: GrowthInputs = { nominalReturn: 0.03, inflation: 0.03 } // 0% real, easy to hand-check
    const accounts: Account[] = [
      {
        id: 'house',
        name: 'House',
        type: 'home',
        balance: 400000,
        annualContribution: 0,
        homeAppreciationRate: 0,
        linkedMortgageAccountId: 'mortgage',
      },
      {
        id: 'mortgage',
        name: 'Mortgage',
        type: 'mortgage',
        balance: 300000,
        annualContribution: 0,
        mortgageInterestRate: 0.06,
        mortgageRemainingTermYears: 30,
      },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    const age61 = projected.find((y) => y.age === 61)!
    expect(age61.homeValue).toBeCloseTo(400000, 2) // 0% appreciation
    const remainingMortgage = age61.homeValue - age61.homeEquity
    expect(remainingMortgage).toBeGreaterThan(0)
    expect(remainingMortgage).toBeLessThan(300000) // amortizing down from the original balance
  })

  it('selling a home pays off the linked mortgage, deposits net proceeds, and permanently retires the mortgage (no more payment, escrow, or snowball)', () => {
    // retirementAge is well after the sale so the mortgage's own payments come
    // from "paycheck" (not the portfolio) right up to the sale, isolating the
    // sale's own deposit from any incidental withdrawal.
    const personal: PersonalInputs = { currentAge: 60, retirementAge: 70, horizonAge: 65, currentYear: 2026 }
    const growth: GrowthInputs = { nominalReturn: 0.03, inflation: 0.03 } // 0% real
    const accounts: Account[] = [
      {
        id: 'house',
        name: 'House',
        type: 'home',
        balance: 500000,
        annualContribution: 0,
        homeAppreciationRate: 0,
        homeCostBasis: 500000, // no gain, keeps the tax side out of this test
        linkedMortgageAccountId: 'mortgage',
        homeSellAtAge: 62,
        homeSellingCostRate: 0.06,
        homeSaleTargetAccountId: 'savings',
      },
      {
        id: 'mortgage',
        name: 'Mortgage',
        type: 'mortgage',
        balance: 300000,
        annualContribution: 0,
        mortgageInterestRate: 0.06,
        mortgageRemainingTermYears: 30,
        mortgageEscrowMonthly: 400,
      },
      {
        id: 'savings',
        name: 'Savings',
        type: 'taxable',
        balance: 10000,
        taxableCostBasis: 10000,
        annualContribution: 0,
      },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    const saleYear = projected.find((y) => y.age === 62)!
    const mortgageBalanceJustBeforePayoff = saleYear.homeValue - saleYear.homeEquity // 0 here since sold -> read from prior year instead
    const priorYear = projected.find((y) => y.age === 61)!
    const outstandingMortgage = priorYear.homeValue - priorYear.homeEquity

    expect(saleYear.homeSaleProceeds).toBeGreaterThan(0)
    expect(saleYear.homeValue).toBe(0) // sold
    expect(saleYear.homeEquity).toBe(0)
    expect(saleYear.balances.savings).toBeCloseTo(10000 + saleYear.homeSaleProceeds, 2)

    // Sanity: proceeds are less than the pre-sale value by roughly selling costs + the payoff.
    expect(saleYear.homeSaleProceeds).toBeLessThan(500000)
    expect(mortgageBalanceJustBeforePayoff).toBe(0)
    expect(outstandingMortgage).toBeGreaterThan(0)

    // The year after the sale: no mortgage payment, no escrow — fully inert.
    const afterSale = projected.find((y) => y.age === 63)!
    expect(afterSale.mortgagePayment).toBe(0)
    expect(afterSale.homeSaleProceeds).toBe(0) // one-time, not repeated
  })

  it('taxes the portion of a home-sale gain beyond the primary-residence exclusion, via the normal tax-aware withdrawal', () => {
    const personal: PersonalInputs = { currentAge: 60, retirementAge: 60, horizonAge: 62, currentYear: 2026 }
    const growth: GrowthInputs = { nominalReturn: 0.03, inflation: 0.03 }
    const accounts: Account[] = [
      {
        id: 'house',
        name: 'House',
        type: 'home',
        balance: 1_200_000,
        annualContribution: 0,
        homeAppreciationRate: 0,
        homeCostBasis: 300000, // big gain, will exceed the $250k single exclusion
        homeSellAtAge: 61,
        homeSellingCostRate: 0,
        homeSaleTargetAccountId: 'savings',
      },
      {
        id: 'savings',
        name: 'Savings',
        type: 'taxable',
        balance: 10000,
        taxableCostBasis: 10000,
        annualContribution: 0,
      },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions: [],
      socialSecurity: [],
      taxes: { stateRate: 0.05 },
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    const saleYear = projected.find((y) => y.age === 61)!
    expect(saleYear.taxOwed).toBeGreaterThan(0)
    // Full proceeds still deposited (not net of tax) — same convention as every
    // other taxable inflow in this app. The resulting tax bill (there's no other
    // spending need at all here) gets paid via a same-year withdrawal from the only
    // other account there is — 'savings', which is also where the proceeds landed,
    // so its final balance nets the deposit minus that withdrawal.
    expect(saleYear.balances.savings).toBeCloseTo(10000 + saleYear.homeSaleProceeds - saleYear.netWithdrawalTaken, 1)
  })

  it('a home with no linked mortgage sells cleanly for its full value minus selling costs', () => {
    const personal: PersonalInputs = { currentAge: 60, retirementAge: 60, horizonAge: 62, currentYear: 2026 }
    const growth: GrowthInputs = { nominalReturn: 0.03, inflation: 0.03 }
    const accounts: Account[] = [
      {
        id: 'house',
        name: 'House',
        type: 'home',
        balance: 500000,
        annualContribution: 0,
        homeAppreciationRate: 0,
        homeCostBasis: 500000,
        homeSellAtAge: 61,
        homeSellingCostRate: 0.06,
        homeSaleTargetAccountId: 'savings',
      },
      { id: 'savings', name: 'Savings', type: 'taxable', balance: 0, taxableCostBasis: 0, annualContribution: 0 },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    const saleYear = projected.find((y) => y.age === 61)!
    expect(saleYear.homeSaleProceeds).toBeCloseTo(500000 * 0.94, 2)
  })

  it('a home that is never sold keeps appreciating and contributing equity through the whole horizon', () => {
    const personal: PersonalInputs = { currentAge: 60, retirementAge: 60, horizonAge: 90, currentYear: 2026 }
    const growth: GrowthInputs = { nominalReturn: 0.03, inflation: 0.03 }
    const accounts: Account[] = [
      { id: 'house', name: 'House', type: 'home', balance: 400000, annualContribution: 0, homeAppreciationRate: 0.01 },
    ]
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: noOtherSpending,
      pensions: [],
      socialSecurity: [],
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails,
    })

    expect(projected.find((y) => y.age === 90)!.homeValue).toBeCloseTo(400000 * 1.01 ** 30, 0)
  })
})

describe('runProjection — dynamic (guardrails) spending strategy', () => {
  const personal: PersonalInputs = { currentAge: 65, retirementAge: 65, horizonAge: 75, currentYear: 2026 }
  const accounts: Account[] = [
    { id: 'a', name: 'Roth', type: 'roth', balance: 1_000_000, annualContribution: 0, rothBasis: 1_000_000 },
  ]
  const spending = { monthlySpendExclMortgage: 40000 / 12, bridgeHealthInsuranceMonthly: 0, medicareEligibilityAge: 0 }
  const socialSecurity: SocialSecurityInputs[] = [
    { monthlyBenefitAt62: 0, monthlyBenefitAt67: 0, monthlyBenefitAt70: 0, claimingAge: 999, haircut: 1 },
  ]
  const dynamicGuardrails: GuardrailsSettings = {
    strategy: 'guardrails',
    upperGuardrailPct: 0.2,
    cutPct: 0.1,
    lowerGuardrailPct: 0.2,
    raisePct: 0.1,
  }

  it('establishes the initial withdrawal rate from the first retirement year, unadjusted', () => {
    const growth: GrowthInputs = { nominalReturn: 0.03, inflation: 0.03 } // flat real return — no drift
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending,
      pensions: [],
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails: dynamicGuardrails,
    })
    // First year processed under the guardrails strategy: the baseline itself, unadjusted.
    expect(projected.find((y) => y.age === 66)!.discretionarySpending).toBeCloseTo(40000, 2)
  })

  it('cuts discretionary spending once a market downturn drives the withdrawal rate above the upper guardrail', () => {
    const growth: GrowthInputs = { nominalReturn: 0, inflation: 0.05 } // strongly negative real return
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending,
      pensions: [],
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails: dynamicGuardrails,
    })

    const initialSpending = projected.find((y) => y.age === 66)!.discretionarySpending
    const laterSpending = projected.find((y) => y.age === 75)!.discretionarySpending
    expect(laterSpending).toBeLessThan(initialSpending)
  })

  it('raises discretionary spending once strong growth drives the withdrawal rate below the lower guardrail', () => {
    const growth: GrowthInputs = { nominalReturn: 0.15, inflation: 0.02 } // strongly positive real return
    const lightSpending = { ...spending, monthlySpendExclMortgage: 20000 / 12 } // a modest initial rate, room to fall further
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending: lightSpending,
      pensions: [],
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails: dynamicGuardrails,
    })

    const initialSpending = projected.find((y) => y.age === 66)!.discretionarySpending
    const laterSpending = projected.find((y) => y.age === 75)!.discretionarySpending
    expect(laterSpending).toBeGreaterThan(initialSpending)
  })

  it('never adjusts discretionary spending under the fixed strategy, even as the portfolio drifts sharply', () => {
    const growth: GrowthInputs = { nominalReturn: 0, inflation: 0.05 } // same downturn as the cut scenario above
    const fixedGuardrails: GuardrailsSettings = { ...dynamicGuardrails, strategy: 'fixed' }
    const projected = runProjection({
      personal,
      growth,
      accounts,
      spending,
      pensions: [],
      socialSecurity,
      taxes,
      rmdSurplus,
      oneTimeEvents,
      guardrails: fixedGuardrails,
    })

    for (const y of projected.filter((y) => y.age >= personal.retirementAge + 1)) {
      expect(y.discretionarySpending).toBeCloseTo(40000, 2)
    }
  })
})
