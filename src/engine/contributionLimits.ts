import type { Account, PersonId } from './types'

/**
 * 2026 IRS contribution limits, confirmed directly from irs.gov ("401(k) limit
 * increases to $24,500 for 2026, IRA limit increases to $7,500",
 * https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500).
 * These are the only numbers in this file that should ever need updating for a new
 * tax year.
 */
export const LIMITS_2026 = {
  /** Employee elective deferral limit for 401(k)/403(b)/most 457 plans/TSP. */
  employeeDeferral: 24500,
  /** Additional catch-up for age 50+ (ages 60-63 use the larger SECURE 2.0 catch-up instead). */
  employeeDeferralCatchUp50: 8000,
  /** SECURE 2.0 enhanced catch-up, ages 60-63 only. */
  employeeDeferralCatchUp60to63: 11250,
  /** Traditional/Roth IRA contribution limit (combined across both, per person). */
  ira: 7500,
  /** Additional IRA catch-up for age 50+. */
  iraCatchUp50: 1100,
} as const

/** The 401(k)/403(b)/TSP-style employee deferral limit for a given age. */
export function employeeDeferralLimit(age: number): number {
  if (age >= 60 && age <= 63) return LIMITS_2026.employeeDeferral + LIMITS_2026.employeeDeferralCatchUp60to63
  if (age >= 50) return LIMITS_2026.employeeDeferral + LIMITS_2026.employeeDeferralCatchUp50
  return LIMITS_2026.employeeDeferral
}

/** The IRA/Roth IRA contribution limit for a given age. */
export function iraContributionLimit(age: number): number {
  if (age >= 50) return LIMITS_2026.ira + LIMITS_2026.iraCatchUp50
  return LIMITS_2026.ira
}

export interface ContributionLimitWarning {
  accountId: string
  accountName: string
  /** The 2026 limit that applies, given the age passed in. */
  limit: number
  /** The account's actual configured annual contribution. */
  contribution: number
}

/**
 * Flags any tax-deferred account (checked against the 401(k)/403(b)/TSP employee
 * deferral limit) or Roth account (checked against the IRA limit) whose annual
 * contribution exceeds the 2026 limit at the given age.
 *
 * Simplifications, both reasonable for this app's scope: (1) every tax-deferred
 * account is assumed to be an employer-plan-style account (401(k)/403(b)/TSP) rather
 * than a Traditional IRA, and every Roth account a Roth IRA rather than a Roth
 * 401(k) — matching this app's own default accounts (401(k)s, TSP, Roth IRAs). (2)
 * The limit is checked per account, not aggregated across accounts for the same
 * person — two separate accounts that together exceed the limit won't be caught,
 * only a single account that individually does. (3) Each account's catch-up
 * eligibility uses its own owner's age (via `ageForOwner`, see `people.ts`), not one
 * household-wide age, so a spouse's separate age is honored when present.
 */
export function checkContributionLimits(
  accounts: Account[],
  ageForOwner: (ownerId: PersonId) => number,
): ContributionLimitWarning[] {
  const warnings: ContributionLimitWarning[] = []
  for (const account of accounts) {
    const age = ageForOwner(account.ownerId ?? 'primary')
    const limit =
      account.type === 'tax-deferred'
        ? employeeDeferralLimit(age)
        : account.type === 'roth'
          ? iraContributionLimit(age)
          : null
    if (limit !== null && account.annualContribution > limit) {
      warnings.push({ accountId: account.id, accountName: account.name, limit, contribution: account.annualContribution })
    }
  }
  return warnings
}
