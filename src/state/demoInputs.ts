import type { GuardrailsSettings } from '../engine/guardrails'
import type { OneTimeEvent } from '../engine/oneTimeEvents'
import type { PensionInputs } from '../engine/pension'
import type { RmdSurplusSettings } from '../engine/rmd'
import type { SocialSecurityInputs } from '../engine/socialSecurity'
import type { SpendingInputs } from '../engine/spending'
import type { TaxSettings } from '../engine/tax'
import type { Account, GrowthInputs, PersonalInputs } from '../engine/types'
import type { AppInputs } from './appInputs'

/**
 * A filled-in example plan with clearly fictional, round numbers — exercises every
 * account type (including a mortgage with escrow, an extra principal payment, and a
 * snowball target, plus a cash reserve), both pension types, a two-person household
 * (spouse with her own age, an account and a pension and a Social Security benefit
 * of her own), a real taxable-account cost basis (so capital gains tax has something
 * to compute), an RMD surplus strategy, one-time events of every kind (an
 * inheritance, a one-off major expense, and a recurring expense), a home (linked
 * to the mortgage, appreciating at its own rate, sold partway through retirement),
 * and a dynamic (guardrails) spending strategy — so someone opening this app for
 * the first time (or a test that wants realistic-shaped data) has something
 * concrete to look at without it being anyone's real financial information.
 */
export function createDemoInputs(): AppInputs {
  const personal: PersonalInputs = {
    name: 'Alex',
    currentAge: 45,
    retirementAge: 60,
    horizonAge: 90,
    currentYear: new Date().getFullYear(),
    spouse: { name: 'Jordan', currentAge: 43 },
  }
  const growth: GrowthInputs = { nominalReturn: 0.07, inflation: 0.03 }

  const brokerageId = 'demo-brokerage'
  const four01kId = 'demo-401k'

  const accounts: Account[] = [
    {
      id: brokerageId,
      name: 'Brokerage (Taxable)',
      type: 'taxable',
      balance: 150000,
      annualContribution: 6000,
      taxableCostBasis: 90000,
    },
    { id: four01kId, name: '401(k)', type: 'tax-deferred', balance: 350000, annualContribution: 20000 },
    { id: 'demo-roth', name: 'Roth IRA', type: 'roth', balance: 80000, annualContribution: 7000, rothBasis: 50000 },
    { id: 'demo-cash', name: 'Emergency Fund', type: 'cash', balance: 20000, annualContribution: 0 },
    {
      id: 'demo-spouse-401k',
      name: "Jordan's 401(k)",
      type: 'tax-deferred',
      ownerId: 'spouse',
      balance: 180000,
      annualContribution: 15000,
    },
    {
      id: 'demo-mortgage',
      name: 'Mortgage (Demo House)',
      type: 'mortgage',
      balance: 250000,
      annualContribution: 0,
      mortgageInterestRate: 0.06,
      mortgageRemainingTermYears: 20,
      mortgageExtraMonthlyPayment: 300,
      mortgageEscrowMonthly: 350,
      mortgageSnowballToAccountId: four01kId,
    },
    {
      id: 'demo-home',
      name: 'Home',
      type: 'home',
      balance: 450000,
      annualContribution: 0,
      homeAppreciationRate: 0.005,
      homeCostBasis: 300000,
      linkedMortgageAccountId: 'demo-mortgage',
      homeSellAtAge: 80,
      homeSellingCostRate: 0.06,
      homeSaleTargetAccountId: 'demo-cash',
    },
  ]

  const spending: SpendingInputs = {
    monthlySpendExclMortgage: 5000,
    bridgeHealthInsuranceMonthly: 1200,
    medicareEligibilityAge: 65,
  }

  const pensions: PensionInputs[] = [
    {
      id: 'demo-fers',
      name: 'Federal Pension (FERS-style)',
      type: 'fers',
      high3Salary: 95000,
      yearsOfService: 20,
      annuityMultiplier: 0.01,
      startAge: 62,
    },
    { id: 'demo-fixed-pension', name: 'Former Employer Pension', type: 'fixed', monthlyBenefit: 800, startAge: 65 },
    {
      id: 'demo-spouse-pension',
      name: "Jordan's Pension",
      type: 'fixed',
      ownerId: 'spouse',
      monthlyBenefit: 500,
      startAge: 65,
    },
  ]

  const socialSecurity: SocialSecurityInputs[] = [
    { ownerId: 'primary', monthlyBenefitAt62: 2200, monthlyBenefitAt67: 3100, monthlyBenefitAt70: 3900, claimingAge: 67, haircut: 1 },
    { ownerId: 'spouse', monthlyBenefitAt62: 1400, monthlyBenefitAt67: 2000, monthlyBenefitAt70: 2600, claimingAge: 67, haircut: 1 },
  ]

  const taxes: TaxSettings = { stateRate: 0.05 }
  const rmdSurplus: RmdSurplusSettings = { strategy: 'reinvest', targetAccountId: brokerageId }

  const oneTimeEvents: OneTimeEvent[] = [
    { id: 'demo-inheritance', name: 'Inheritance', age: 68, amount: 50000, targetAccountId: brokerageId },
    { id: 'demo-roof', name: 'New roof', age: 75, amount: -30000 },
    { id: 'demo-car', name: 'New car', age: 65, amount: -25000, repeatEveryYears: 10 },
  ]

  const guardrails: GuardrailsSettings = {
    strategy: 'guardrails',
    upperGuardrailPct: 0.2,
    cutPct: 0.1,
    lowerGuardrailPct: 0.2,
    raisePct: 0.1,
  }

  return {
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
    numSimulations: 1000,
  }
}
