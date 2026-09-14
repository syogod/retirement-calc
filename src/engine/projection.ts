import { realReturn } from './growth'
import { applyGuardrails } from './guardrails'
import type { GuardrailsSettings } from './guardrails'
import { calculateHomeSale } from './home'
import { totalPensionIncomeForAge } from './pension'
import type { PensionInputs } from './pension'
import { filingStatusForHousehold, makeAgeForOwner, makeBirthYearForOwner } from './people'
import { advanceMortgageYear, calculateNominalAnnualPayment } from './mortgage'
import { applyOneTimeInflows, totalOneTimeOutflowForAge } from './oneTimeEvents'
import type { OneTimeEvent } from './oneTimeEvents'
import { applyRequiredMinimumDistributions } from './rmd'
import type { RmdSurplusSettings } from './rmd'
import { totalSocialSecurityIncomeForAge } from './socialSecurity'
import type { SocialSecurityInputs } from './socialSecurity'
import type { SpendingInputs } from './spending'
import { baseAnnualSpending, totalSpendingNeedForAge } from './spending'
import { solveTaxAwareWithdrawal } from './taxAwareWithdrawal'
import type { TaxSettings } from './tax'
import type { Account, GrowthInputs, PersonalInputs, SpouseInputs } from './types'
import type { AccountBalance } from './withdrawal'

export interface ProjectionInputs {
  personal: PersonalInputs
  growth: GrowthInputs
  accounts: Account[]
  spending: SpendingInputs
  pensions: PensionInputs[]
  socialSecurity: SocialSecurityInputs[]
  taxes: TaxSettings
  rmdSurplus: RmdSurplusSettings
  oneTimeEvents: OneTimeEvent[]
  guardrails: GuardrailsSettings
}

export interface ProjectionYear {
  age: number
  year: number
  /** Balance per (non-mortgage) account id, after this year's growth, contributions, and withdrawal. */
  balances: Record<string, number>
  totalPortfolio: number
  contributionsThisYear: number
  spendingNeed: number
  /**
   * This year's total mortgage cost (real dollars) — principal & interest (while the
   * loan is outstanding) plus any escrowed property tax/insurance (for the whole
   * plan) — already folded into `spendingNeed`.
   */
  mortgagePayment: number
  guaranteedIncome: number
  /** Spending need minus guaranteed income — what the portfolio needs to cover. */
  netWithdrawalNeeded: number
  /** What was actually withdrawn — less than needed only if funds ran out. */
  netWithdrawalTaken: number
  /**
   * The portion of `netWithdrawalTaken` that was a forced Required Minimum
   * Distribution rather than a spending-driven withdrawal — see `rmd.ts`. Can exceed
   * `netWithdrawalNeeded` (an RMD must come out regardless of whether spending needs
   * it), in which case the surplus already left the portfolio without being
   * reinvested anywhere (a documented simplification pending tax modeling).
   */
  rmdWithdrawn: number
  /** How much of `rmdWithdrawn` (after tax and any penalty) exceeded what spending
   * actually needed this year — i.e. a real RMD surplus, routed per
   * `RmdSurplusSettings` (reinvested, spent, or parked in a cash reserve). 0 in any
   * year without a forced RMD, or where the RMD didn't exceed need. */
  rmdSurplus: number
  /** Total federal + state income tax owed this year — on pension income, the
   * taxable portion of Social Security, tax-deferred withdrawals (including any
   * RMD), and realized capital gains from taxable-account withdrawals. Already
   * covered by `netWithdrawalTaken` (see `taxAwareWithdrawal.ts`) — this is exposed
   * separately for transparency, not an additional amount to withdraw. */
  taxOwed: number
  /** The 10% early-withdrawal penalty in dollars, if any (see `earlyWithdrawalPenaltyFlag`). */
  earlyWithdrawalPenaltyAmount: number
  earlyWithdrawalPenaltyFlag: boolean
  fundsDepleted: boolean
  /** Total of this year's one-time outflow events (major expenses) — already folded
   * into `spendingNeed`. See `oneTimeEvents.ts`. */
  oneTimeOutflow: number
  /** Total of this year's one-time inflow events (inheritances, gifts) — already
   * deposited into their target accounts (reflected in `balances`). See
   * `oneTimeEvents.ts`. */
  oneTimeInflow: number
  /** Combined current value of every home account still owned (0 once sold, or if
   * there's no home). Excluded from `totalPortfolio`, same as a mortgage's balance
   * is excluded — see `home.ts`. */
  homeValue: number
  /** `homeValue` minus the balance of whichever mortgage each home is linked to
   * (0 for a home owned outright). A quick "what's the house actually worth you"
   * figure, kept separate from portfolio math. */
  homeEquity: number
  /** Net proceeds from selling a home this year, if `homeSellAtAge` matched — 0 in
   * every other year. Already deposited into the sale's target account (reflected
   * in `balances`); any tax on the taxable portion of the gain is already covered
   * by `taxOwed`/`netWithdrawalTaken`, not an additional amount to withdraw. */
  homeSaleProceeds: number
  /**
   * This year's actual base annual spending (real dollars), before the mortgage,
   * bridge health insurance, and one-time events get added on top of it. Equal to
   * `baseAnnualSpending(spending)` under the fixed strategy (never changes); under
   * `guardrails`, drifts up or down from that starting point over time as the
   * portfolio outperforms or underperforms — see `guardrails.ts`. Comparing this
   * year's value to the previous year's is exactly how a guardrails adjustment
   * shows up (a fixed strategy never changes it, so any change signals one fired).
   */
  discretionarySpending: number
}

/** Running state carried from one projection year to the next: current balances,
 * (for Roth and taxable accounts) remaining contribution/cost basis, (for
 * mortgages) remaining nominal loan balance, (for homes) current value, and (for a
 * `guardrails` spending strategy) the current adjusted spending level and the
 * withdrawal rate it was originally set at. */
export interface ProjectionState {
  balances: Record<string, number>
  rothBasis: Record<string, number>
  taxableCostBasis: Record<string, number>
  mortgageBalances: Record<string, number>
  homeBalances: Record<string, number>
  /** Mortgage ids that have been fully paid off via a linked home's sale — kept
   * permanently inert from that point on (no more payment, escrow, or snowball;
   * see `home.ts`'s note on why that differs from a mortgage paid off through
   * ordinary amortization, where escrow keeps going because you still own the home). */
  soldMortgageIds: string[]
  /** `null` until retirement begins (or if the strategy isn't `guardrails`) — set
   * once, the first retirement year, to that year's base spending and the
   * withdrawal rate it represents against the portfolio entering that year. See
   * `guardrails.ts`. */
  guardrailsCurrentSpending: number | null
  guardrailsInitialRate: number | null
}

export function createInitialProjectionState(accounts: Account[]): ProjectionState {
  const investable = accounts.filter((account) => account.type !== 'mortgage' && account.type !== 'home')
  const mortgages = accounts.filter((account) => account.type === 'mortgage')
  const homes = accounts.filter((account) => account.type === 'home')
  return {
    balances: Object.fromEntries(investable.map((account) => [account.id, account.balance])),
    rothBasis: Object.fromEntries(
      investable
        .filter((account) => account.type === 'roth')
        .map((account) => [account.id, clampBasis(account.balance, account.rothBasis)]),
    ),
    taxableCostBasis: Object.fromEntries(
      investable
        .filter((account) => account.type === 'taxable')
        .map((account) => [account.id, clampBasis(account.balance, account.taxableCostBasis)]),
    ),
    mortgageBalances: Object.fromEntries(mortgages.map((mortgage) => [mortgage.id, mortgage.balance])),
    homeBalances: Object.fromEntries(homes.map((home) => [home.id, home.balance])),
    soldMortgageIds: [],
    guardrailsCurrentSpending: null,
    guardrailsInitialRate: null,
  }
}

export interface AdvanceYearInputs {
  accounts: Account[]
  retirementAge: number
  spending: SpendingInputs
  pensions: PensionInputs[]
  socialSecurity: SocialSecurityInputs[]
  /** The plan's starting age and assumed inflation rate — needed to convert a
   * mortgage's fixed nominal payment into this year's real (today's-dollars) amount. */
  currentAge: number
  inflation: number
  /** A spouse's own age, if any — resolved against `age` via `makeAgeForOwner` for
   * per-person RMD/catch-up/Social Security rules (see `people.ts`). */
  spouse?: SpouseInputs
  /** The plan's starting calendar year — combined with each person's `currentAge`
   * to approximate their birth year, which is all RMDs need it for (which start age,
   * 73 or 75, applies — see `rmd.ts`). */
  currentYear: number
  /** The household's tax settings (currently just the flat state rate) — see `tax.ts`. */
  taxes: TaxSettings
  /** What to do with an RMD surplus (money an RMD forced out beyond what spending
   * needed) — see `rmd.ts`. */
  rmdSurplus: RmdSurplusSettings
  /** Lump-sum inflows/outflows at specific ages — see `oneTimeEvents.ts`. */
  oneTimeEvents: OneTimeEvent[]
  /** Fixed spending, or a dynamic guardrails strategy — see `guardrails.ts`. */
  guardrails: GuardrailsSettings
}

/**
 * Advances one projection year: grows every investable account at `realReturnForYear`
 * and applies contributions (pre-retirement only, plus any mortgage snowball —
 * see below), then withdraws that year's funding gap via the tax-aware waterfall.
 * Takes the year's real return as a parameter (rather than deriving it from a fixed
 * nominal/inflation pair) so this single implementation is shared by the
 * deterministic projection (same return every year) and the Monte Carlo engine (a
 * bootstrapped return each year, see monteCarlo.ts).
 *
 * Mortgages are handled separately from the investable-account loop: a mortgage
 * account's `balance` is a liability (excluded from portfolio totals and the
 * withdrawal waterfall), amortized on its own fixed nominal payment schedule (plus
 * any extra monthly principal payment, which pays it off faster). That
 * principal-and-interest payment (converted from nominal to this year's real
 * dollars) is added to the year's spending need for as long as the loan is
 * outstanding; once paid off, if `mortgageSnowballToAccountId` is set, that freed-up
 * payment becomes an extra contribution to the named account for any remaining
 * pre-retirement years. Escrowed property tax/insurance (`mortgageEscrowMonthly`) is
 * separate: already in today's dollars, added to spending need for the whole plan
 * regardless of payoff status, and never part of the snowball.
 */
export function advanceProjectionYear(
  state: ProjectionState,
  age: number,
  realReturnForYear: number,
  inputs: AdvanceYearInputs,
): { state: ProjectionState; year: Omit<ProjectionYear, 'age' | 'year'> } {
  const {
    accounts,
    retirementAge,
    spending,
    pensions,
    socialSecurity,
    currentAge,
    inflation,
    taxes,
    rmdSurplus,
    oneTimeEvents,
    guardrails,
  } = inputs

  const inflationFactor = (1 + inflation) ** (age - currentAge)
  const mortgageBalances = { ...state.mortgageBalances }
  let mortgagePaymentReal = 0
  const snowballContributions: Record<string, number> = {}

  for (const mortgage of accounts.filter((account) => account.type === 'mortgage')) {
    // Fully paid off via a linked home's sale in some earlier year — permanently
    // inert from that point on (no more payment, escrow, or snowball). See the
    // note on `soldMortgageIds` for why this differs from an ordinary payoff.
    if (state.soldMortgageIds.includes(mortgage.id)) continue

    const scheduledAnnualPayment = calculateNominalAnnualPayment({
      balance: mortgage.balance,
      interestRate: mortgage.mortgageInterestRate ?? 0.065,
      remainingTermYears: mortgage.mortgageRemainingTermYears ?? 30,
    })
    const extraAnnualPayment = (mortgage.mortgageExtraMonthlyPayment ?? 0) * 12
    const totalAnnualPayment = scheduledAnnualPayment + extraAnnualPayment
    const currentNominalBalance = mortgageBalances[mortgage.id]

    if (currentNominalBalance > 0) {
      const result = advanceMortgageYear(currentNominalBalance, totalAnnualPayment, mortgage.mortgageInterestRate ?? 0.065)
      mortgageBalances[mortgage.id] = result.nominalBalance
      mortgagePaymentReal += result.nominalPaymentMade / inflationFactor
    } else if (mortgage.mortgageSnowballToAccountId && age < retirementAge) {
      // Only the principal & interest (plus any extra payment) is "freed up" —
      // escrow (below) never stops, so it never joins the snowball.
      const freedReal = totalAnnualPayment / inflationFactor
      snowballContributions[mortgage.mortgageSnowballToAccountId] =
        (snowballContributions[mortgage.mortgageSnowballToAccountId] ?? 0) + freedReal
    }

    // Property tax & insurance: already in today's dollars, and unlike principal &
    // interest, keeps going for the whole plan — owning the home doesn't end when
    // the loan does.
    mortgagePaymentReal += (mortgage.mortgageEscrowMonthly ?? 0) * 12
  }

  let contributionsThisYear = 0
  const grownBalances: Record<string, number> = {}
  const rothBasis = { ...state.rothBasis }
  const taxableCostBasis = { ...state.taxableCostBasis }
  const investableAccounts = accounts.filter((account) => account.type !== 'mortgage' && account.type !== 'home')
  for (const account of investableAccounts) {
    const contribution =
      (age < retirementAge ? account.annualContribution : 0) + (snowballContributions[account.id] ?? 0)
    contributionsThisYear += contribution
    // Cash is a zero-real-growth reserve — it neither grows nor shrinks in today's
    // dollars, unlike every other account type here.
    const growthRate = account.type === 'cash' ? 0 : realReturnForYear
    grownBalances[account.id] = state.balances[account.id] * (1 + growthRate) + contribution
    if (account.type === 'roth') {
      rothBasis[account.id] += contribution
    }
    if (account.type === 'taxable') {
      taxableCostBasis[account.id] += contribution
    }
  }

  const ageForOwner = makeAgeForOwner(inputs, age)
  const filingStatus = filingStatusForHousehold(inputs)

  // One-time inflow events (inheritances, gifts) are deposited into their target
  // accounts *before* this year's withdrawal is solved, so a same-year expense can
  // draw on newly-arrived cash if the target account is high enough in the
  // withdrawal order — see oneTimeEvents.ts.
  const inflows = applyOneTimeInflows(oneTimeEvents, ageForOwner, investableAccounts, grownBalances, taxableCostBasis)
  Object.assign(grownBalances, inflows.balances)
  Object.assign(taxableCostBasis, inflows.taxableCostBasis)

  // Homes appreciate at their own real rate (not the portfolio's return), are
  // excluded from portfolio totals and the withdrawal waterfall (like a mortgage's
  // balance), and can optionally be sold at a chosen age — see home.ts. A sale pays
  // off any linked mortgage directly from the proceeds (permanently retiring it via
  // `soldMortgageIds`, above) and deposits the rest into its target account, same
  // timing as a one-time inflow (so it too can cover a same-year expense).
  const homeBalances = { ...state.homeBalances }
  let homeValueThisYear = 0
  let homeEquityThisYear = 0
  let homeSaleProceedsThisYear = 0
  let homeSaleTaxableGain = 0
  const newlySoldMortgageIds: string[] = []
  for (const home of accounts.filter((account) => account.type === 'home')) {
    const currentValue = homeBalances[home.id]
    if (currentValue <= 0) continue // already sold, or started at 0

    const grownValue = currentValue * (1 + (home.homeAppreciationRate ?? 0))
    const linkedMortgageId = home.linkedMortgageAccountId
    const linkedMortgageBalance = linkedMortgageId ? mortgageBalances[linkedMortgageId] ?? 0 : 0

    if (home.homeSellAtAge !== undefined && age === home.homeSellAtAge) {
      const sale = calculateHomeSale(
        grownValue,
        home.homeCostBasis ?? home.balance,
        home.homeSellingCostRate ?? 0.06,
        linkedMortgageBalance,
        filingStatus,
      )
      homeBalances[home.id] = 0
      if (linkedMortgageId) {
        mortgageBalances[linkedMortgageId] = 0
        newlySoldMortgageIds.push(linkedMortgageId)
      }
      homeSaleProceedsThisYear += sale.netProceeds
      homeSaleTaxableGain += sale.taxableGain

      const targetId = home.homeSaleTargetAccountId
      const targetAccount = targetId ? investableAccounts.find((a) => a.id === targetId) : undefined
      if (targetId && (targetAccount?.type === 'taxable' || targetAccount?.type === 'cash') && targetId in grownBalances) {
        grownBalances[targetId] += sale.netProceeds
        if (targetAccount.type === 'taxable') {
          taxableCostBasis[targetId] = (taxableCostBasis[targetId] ?? 0) + sale.netProceeds
        }
      }
    } else {
      homeBalances[home.id] = grownValue
      homeValueThisYear += grownValue
      homeEquityThisYear += grownValue - linkedMortgageBalance
    }
  }

  // Mortgage payments (and escrow) are assumed to come out of your paycheck while
  // still working, same as every other living expense in this model (see
  // totalSpendingNeedForAge) — the loan still amortizes every year regardless (above),
  // but it only pulls from the portfolio once retired. One-time outflow events (major
  // expenses) are added the same way, regardless of retirement status — an
  // unexpected expense doesn't wait for retirement.
  const oneTimeOutflow = totalOneTimeOutflowForAge(oneTimeEvents, ageForOwner)

  // A dynamic ("guardrails") spending strategy drifts the base spending amount up
  // or down over time instead of holding it fixed — see guardrails.ts. The rate
  // check uses the portfolio value *entering* this year (last year's ending
  // balance, before this year's growth/withdrawal), same as a real retiree would
  // see on their year-start statement.
  let guardrailsCurrentSpending = state.guardrailsCurrentSpending
  let guardrailsInitialRate = state.guardrailsInitialRate
  if (guardrails.strategy === 'guardrails' && age >= retirementAge) {
    const portfolioValueAtStartOfYear = sum(Object.values(state.balances))
    if (guardrailsInitialRate === null) {
      // The first retirement year: establish the baseline rate this plan is judged against.
      guardrailsCurrentSpending = baseAnnualSpending(spending)
      guardrailsInitialRate = portfolioValueAtStartOfYear > 0 ? guardrailsCurrentSpending / portfolioValueAtStartOfYear : 0
    } else {
      guardrailsCurrentSpending = applyGuardrails(
        guardrailsCurrentSpending ?? baseAnnualSpending(spending),
        guardrailsInitialRate,
        portfolioValueAtStartOfYear,
        guardrails,
      )
    }
  }
  const discretionarySpending =
    age < retirementAge
      ? 0
      : guardrails.strategy === 'guardrails' && guardrailsCurrentSpending !== null
        ? guardrailsCurrentSpending
        : baseAnnualSpending(spending)

  const spendingNeed =
    totalSpendingNeedForAge(age, retirementAge, spending, discretionarySpending) +
    (age >= retirementAge ? mortgagePaymentReal : 0) +
    oneTimeOutflow
  const pensionIncome = totalPensionIncomeForAge(ageForOwner, pensions)
  const socialSecurityBenefits = totalSocialSecurityIncomeForAge(ageForOwner, socialSecurity)
  const guaranteedIncome = pensionIncome + socialSecurityBenefits
  const netWithdrawalNeeded = Math.max(0, spendingNeed - guaranteedIncome)

  // RMDs are forced out of specific tax-deferred accounts regardless of spending
  // need (a supply-side floor), *before* the spending-driven waterfall runs — see
  // rmd.ts. The waterfall below only needs to cover whatever spending need remains
  // after crediting RMD proceeds against it (`preTaxGap` below), and it draws from
  // the post-RMD balances so those accounts aren't double-counted.
  const birthYearForOwner = makeBirthYearForOwner(inputs)
  const rmd = applyRequiredMinimumDistributions(investableAccounts, grownBalances, ageForOwner, birthYearForOwner)

  const accountStates: AccountBalance[] = investableAccounts.map((account) => ({
    id: account.id,
    type: account.type,
    balance: rmd.balances[account.id],
    rothBasis: account.type === 'roth' ? rothBasis[account.id] : undefined,
    taxableCostBasis: account.type === 'taxable' ? taxableCostBasis[account.id] : undefined,
  }))

  // Withdrawals are grossed up so the household actually nets `spendingNeed -
  // guaranteedIncome - rmd.totalWithdrawn` in spendable cash after tax — not floored
  // at 0 here (unlike `netWithdrawalNeeded` above, which is the display figure):
  // even when guaranteed income and RMD proceeds together would cover spending, tax
  // owed on them can still create a real shortfall the portfolio has to cover. See
  // taxAwareWithdrawal.ts.
  const solved = solveTaxAwareWithdrawal({
    accounts: accountStates,
    age,
    preTaxGap: spendingNeed - guaranteedIncome - rmd.totalWithdrawn,
    ordinaryIncomeBeforeWithdrawal: pensionIncome + rmd.totalWithdrawn + inflows.taxableOrdinaryIncome,
    capitalGainsBeforeWithdrawal: homeSaleTaxableGain,
    socialSecurityBenefits,
    filingStatus,
    inflationFactor,
    stateRate: taxes.stateRate,
  })
  const withdrawal = solved.withdrawal

  // Any RMD-driven surplus (after tax) beyond spending need gets routed per
  // `rmdSurplus` — reinvested, parked in a cash reserve, or just spent (no further
  // effect). Only ever attributed to an actual RMD year; a guaranteed-income-only
  // surplus (no RMD) is untouched, same as before this feature existed.
  let balancesAfterSurplus = withdrawal.balances
  let taxableCostBasisAfterSurplus = { ...taxableCostBasis, ...withdrawal.taxableCostBasis }
  let rmdSurplusAmount = 0
  if (rmd.totalWithdrawn > 0) {
    const totalAfterTaxCash =
      guaranteedIncome + rmd.totalWithdrawn + withdrawal.totalWithdrawn - solved.tax.totalTax - solved.earlyWithdrawalPenaltyAmount
    rmdSurplusAmount = Math.max(0, totalAfterTaxCash - spendingNeed)

    if (rmdSurplusAmount > 0 && rmdSurplus.strategy !== 'spend' && rmdSurplus.targetAccountId) {
      const targetId = rmdSurplus.targetAccountId
      const targetAccount = investableAccounts.find((a) => a.id === targetId)
      const validTarget =
        (rmdSurplus.strategy === 'reinvest' && targetAccount?.type === 'taxable') ||
        (rmdSurplus.strategy === 'cashReserve' && targetAccount?.type === 'cash')
      if (validTarget && targetId in balancesAfterSurplus) {
        balancesAfterSurplus = { ...balancesAfterSurplus, [targetId]: balancesAfterSurplus[targetId] + rmdSurplusAmount }
        if (rmdSurplus.strategy === 'reinvest') {
          taxableCostBasisAfterSurplus = {
            ...taxableCostBasisAfterSurplus,
            [targetId]: (taxableCostBasisAfterSurplus[targetId] ?? 0) + rmdSurplusAmount,
          }
        }
      }
    }
  }

  const nextState: ProjectionState = {
    balances: balancesAfterSurplus,
    rothBasis: { ...rothBasis, ...withdrawal.rothBasis },
    taxableCostBasis: taxableCostBasisAfterSurplus,
    mortgageBalances,
    homeBalances,
    soldMortgageIds: [...state.soldMortgageIds, ...newlySoldMortgageIds],
    guardrailsCurrentSpending,
    guardrailsInitialRate,
  }

  return {
    state: nextState,
    year: {
      balances: { ...nextState.balances },
      totalPortfolio: sum(Object.values(nextState.balances)),
      contributionsThisYear,
      spendingNeed,
      mortgagePayment: mortgagePaymentReal,
      guaranteedIncome,
      netWithdrawalNeeded,
      netWithdrawalTaken: rmd.totalWithdrawn + withdrawal.totalWithdrawn,
      rmdWithdrawn: rmd.totalWithdrawn,
      rmdSurplus: rmdSurplusAmount,
      taxOwed: solved.tax.totalTax,
      earlyWithdrawalPenaltyAmount: solved.earlyWithdrawalPenaltyAmount,
      earlyWithdrawalPenaltyFlag: withdrawal.earlyWithdrawalPenaltyFlag,
      fundsDepleted: withdrawal.fundsDepleted,
      oneTimeOutflow,
      oneTimeInflow: inflows.totalInflow,
      homeValue: homeValueThisYear,
      homeEquity: homeEquityThisYear,
      homeSaleProceeds: homeSaleProceedsThisYear,
      discretionarySpending,
    },
  }
}

/**
 * Runs the full deterministic year-by-year projection from the current age through
 * the horizon age, using the same fixed real return every year.
 */
export function runProjection(inputs: ProjectionInputs): ProjectionYear[] {
  const { personal, growth, accounts, spending, pensions, socialSecurity, taxes, rmdSurplus, oneTimeEvents, guardrails } = inputs
  const r = realReturn(growth)

  let state = createInitialProjectionState(accounts)
  const initialHome = computeHomeValueAndEquity(accounts, state.homeBalances, state.mortgageBalances)
  const years: ProjectionYear[] = [
    {
      age: personal.currentAge,
      year: personal.currentYear,
      balances: { ...state.balances },
      totalPortfolio: sum(Object.values(state.balances)),
      contributionsThisYear: 0,
      spendingNeed: 0,
      mortgagePayment: 0,
      guaranteedIncome: 0,
      netWithdrawalNeeded: 0,
      netWithdrawalTaken: 0,
      rmdWithdrawn: 0,
      rmdSurplus: 0,
      taxOwed: 0,
      earlyWithdrawalPenaltyAmount: 0,
      earlyWithdrawalPenaltyFlag: false,
      fundsDepleted: false,
      oneTimeOutflow: 0,
      oneTimeInflow: 0,
      homeValue: initialHome.homeValue,
      homeEquity: initialHome.homeEquity,
      homeSaleProceeds: 0,
      discretionarySpending: 0,
    },
  ]

  const advanceInputs: AdvanceYearInputs = {
    accounts,
    retirementAge: personal.retirementAge,
    spending,
    pensions,
    socialSecurity,
    guardrails,
    currentAge: personal.currentAge,
    inflation: growth.inflation,
    spouse: personal.spouse,
    currentYear: personal.currentYear,
    taxes,
    rmdSurplus,
    oneTimeEvents,
  }

  for (let age = personal.currentAge + 1; age <= personal.horizonAge; age++) {
    const year = personal.currentYear + (age - personal.currentAge)
    const step = advanceProjectionYear(state, age, r, advanceInputs)
    state = step.state
    years.push({ age, year, ...step.year })
  }

  return years
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function computeHomeValueAndEquity(
  accounts: Account[],
  homeBalances: Record<string, number>,
  mortgageBalances: Record<string, number>,
): { homeValue: number; homeEquity: number } {
  let homeValue = 0
  let homeEquity = 0
  for (const home of accounts.filter((account) => account.type === 'home')) {
    const value = homeBalances[home.id] ?? 0
    if (value <= 0) continue
    homeValue += value
    const linkedBalance = home.linkedMortgageAccountId ? mortgageBalances[home.linkedMortgageAccountId] ?? 0 : 0
    homeEquity += value - linkedBalance
  }
  return { homeValue, homeEquity }
}

function clampBasis(balance: number, basis: number | undefined): number {
  return Math.min(Math.max(basis ?? balance, 0), balance)
}
