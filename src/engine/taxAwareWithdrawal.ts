import { computeTax } from './tax'
import type { FilingStatus, TaxResult } from './tax'
import { applyWithdrawal } from './withdrawal'
import type { AccountBalance, WithdrawalResult } from './withdrawal'

/**
 * How many rounds to solve for. Each round's remaining error shrinks by roughly the
 * marginal tax rate (well under 1), so this converges geometrically — 15 rounds gets
 * well within a cent for any realistic combined federal+state marginal rate, without
 * a while-loop's risk of not terminating.
 */
const GROSS_UP_ITERATIONS = 15

export interface TaxAwareWithdrawalInputs {
  accounts: AccountBalance[]
  age: number
  /**
   * How much spending need this year isn't already covered by guaranteed income
   * (pension + Social Security) — i.e. `spendingNeed - guaranteedIncome`. Deliberately
   * NOT floored at 0 by the caller: even when guaranteed income alone would cover
   * spending, tax owed on that guaranteed income (and on any forced RMD) can still
   * create a real shortfall that the portfolio has to cover — see `computeTax`.
   */
  preTaxGap: number
  /** Ordinary income that happens regardless of this withdrawal: pension income
   * plus any forced RMD (RMD is itself a tax-deferred withdrawal, so it's ordinary
   * income — see `rmd.ts`) — added to whatever ordinary income this withdrawal
   * itself generates (tax-deferred tier withdrawals) before computing tax. */
  ordinaryIncomeBeforeWithdrawal: number
  /** Capital gains that happen regardless of this withdrawal — currently just the
   * taxable portion of a home sale gain (see `home.ts`), after the primary-residence
   * exclusion. Added to whatever capital gains this withdrawal itself generates
   * (a taxable-account draw) before computing tax. Defaults to 0. */
  capitalGainsBeforeWithdrawal?: number
  /** Gross Social Security benefit received this year (before determining how much
   * of it is actually taxable — see `computeTax`). */
  socialSecurityBenefits: number
  filingStatus: FilingStatus
  inflationFactor: number
  stateRate: number
}

export interface TaxAwareWithdrawalResult {
  withdrawal: WithdrawalResult
  tax: TaxResult
  /** The 10% early-withdrawal penalty, if any — not part of `tax` (it isn't an
   * income tax), but grossed into the withdrawal the same way. */
  earlyWithdrawalPenaltyAmount: number
  /** The final gross amount the waterfall was asked to withdraw — larger than
   * `preTaxGap` whenever there's tax or an early-withdrawal penalty to cover. */
  grossWithdrawalTarget: number
}

/**
 * Solves for how much must actually be withdrawn from the portfolio so that, after
 * paying federal + state tax (and any 10% early-withdrawal penalty) on the resulting
 * income, the household nets exactly `preTaxGap` in spendable cash — rather than
 * assuming every withdrawn dollar is spendable. This is circular (how much tax is
 * owed depends on which accounts get drawn from, which depends on how much needs to
 * be withdrawn, which depends on the tax...), so it's solved by fixed-point
 * iteration: withdraw an amount, see what tax that generates, ask for that much
 * more, repeat. Converges quickly since a marginal tax rate is always well under
 * 100% (see `GROSS_UP_ITERATIONS`).
 */
export function solveTaxAwareWithdrawal(inputs: TaxAwareWithdrawalInputs): TaxAwareWithdrawalResult {
  const {
    accounts,
    age,
    preTaxGap,
    ordinaryIncomeBeforeWithdrawal,
    capitalGainsBeforeWithdrawal = 0,
    socialSecurityBenefits,
    filingStatus,
    inflationFactor,
    stateRate,
  } = inputs

  let target = Math.max(0, preTaxGap)
  let withdrawal: WithdrawalResult = applyWithdrawal(accounts, target, age)
  let tax: TaxResult = computeTax({
    filingStatus,
    ordinaryIncome: ordinaryIncomeBeforeWithdrawal + withdrawal.taxDeferredWithdrawn,
    socialSecurityBenefits,
    capitalGains: capitalGainsBeforeWithdrawal + withdrawal.taxableGainsWithdrawn,
    inflationFactor,
    stateRate,
  })

  for (let i = 1; i < GROSS_UP_ITERATIONS; i++) {
    target = Math.max(0, preTaxGap + tax.totalTax + withdrawal.earlyWithdrawalPenaltyAmount)
    withdrawal = applyWithdrawal(accounts, target, age)
    tax = computeTax({
      filingStatus,
      ordinaryIncome: ordinaryIncomeBeforeWithdrawal + withdrawal.taxDeferredWithdrawn,
      socialSecurityBenefits,
      capitalGains: capitalGainsBeforeWithdrawal + withdrawal.taxableGainsWithdrawn,
      inflationFactor,
      stateRate,
    })
  }

  return {
    withdrawal,
    tax,
    earlyWithdrawalPenaltyAmount: withdrawal.earlyWithdrawalPenaltyAmount,
    grossWithdrawalTarget: target,
  }
}
