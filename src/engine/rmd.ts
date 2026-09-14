import type { Account, PersonId } from './types'

/**
 * IRS Uniform Lifetime Table (Table III), Appendix B of Publication 590-B — verified
 * directly against the IRS's own PDF (irs.gov/pub/irs-pdf/p590b.pdf), not a secondary
 * summary. Unchanged since the 2022 final regulations, so this isn't a per-tax-year
 * fetch the way the 401(k)/IRA contribution limits are. Ages below 72 never look this
 * up (nobody's RMD start age is that low); 120 and over all use 2.0.
 */
const UNIFORM_LIFETIME_DIVISORS: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
  80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
  88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
  96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2,
  104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4,
  112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3,
}
const MAX_AGE_DIVISOR = 2.0 // 120 and over

function uniformLifetimeDivisor(age: number): number {
  const flooredAge = Math.floor(age)
  if (flooredAge >= 120) return MAX_AGE_DIVISOR
  return UNIFORM_LIFETIME_DIVISORS[Math.max(72, flooredAge)] ?? MAX_AGE_DIVISOR
}

/**
 * The age RMDs must begin, per SECURE 2.0's phase-in: 73 for anyone born in 1959 or
 * earlier, 75 for anyone born in 1960 or later. (SECURE 2.0's text had a drafting
 * ambiguity for the 1959 birth year specifically; the final IRS regulations resolved
 * it in favor of 73.)
 */
export function rmdStartAge(birthYear: number): number {
  return birthYear >= 1960 ? 75 : 73
}

/**
 * This year's required minimum distribution for a single tax-deferred account: 0
 * before the owner's RMD start age (see `rmdStartAge`) or once the balance is
 * exhausted, otherwise `balance / divisor` from the Uniform Lifetime Table. Uses this
 * year's balance *after* growth and contributions, *before* withdrawal — consistent
 * with how every other withdrawal in this app is already sized off the post-growth
 * balance (see PLAN.md's "within a projection year..." decision), rather than the
 * technically-correct prior-December-31 balance. Never applies to Roth accounts (no
 * RMDs on Roth IRAs since SECURE 2.0) — callers should only pass tax-deferred
 * balances in.
 */
export function requiredMinimumDistribution(balance: number, age: number, birthYear: number): number {
  if (balance <= 0 || age < rmdStartAge(birthYear)) return 0
  return balance / uniformLifetimeDivisor(age)
}

export interface RmdResult {
  /** Updated balance per (tax-deferred) account id, after this year's forced RMD. */
  balances: Record<string, number>
  /** Total RMD amount actually withdrawn across every account this year. */
  totalWithdrawn: number
}

/**
 * Forces this year's RMD out of every tax-deferred account whose owner has reached
 * their RMD start age, applied *before* the normal spending-driven withdrawal
 * waterfall — an RMD must come out of that specific account regardless of whether the
 * household actually needs the cash for spending that year (a supply-side floor, not
 * a demand-side one). Whatever the RMD produces beyond spending need is a surplus —
 * see `RmdSurplusSettings` for what happens to it.
 */
export function applyRequiredMinimumDistributions(
  accounts: Account[],
  balances: Record<string, number>,
  ageForOwner: (ownerId: PersonId) => number,
  birthYearForOwner: (ownerId: PersonId) => number,
): RmdResult {
  const nextBalances = { ...balances }
  let totalWithdrawn = 0
  for (const account of accounts) {
    if (account.type !== 'tax-deferred') continue
    const ownerId = account.ownerId ?? 'primary'
    const amount = requiredMinimumDistribution(
      nextBalances[account.id],
      ageForOwner(ownerId),
      birthYearForOwner(ownerId),
    )
    nextBalances[account.id] -= amount
    totalWithdrawn += amount
  }
  return { balances: nextBalances, totalWithdrawn }
}

/** What to do with the after-tax surplus when a forced RMD produces more cash than
 * spending needs that year. */
export type RmdSurplusStrategy =
  /** Reinvest into a taxable account (`targetAccountId`) — keeps compounding, and
   * (since it's already been taxed) becomes new cost basis in that account. */
  | 'reinvest'
  /** Treated as extra spending that year — gone, no effect on future balances. */
  | 'spend'
  /** Deposited into a cash account (`targetAccountId`) — a zero-growth reserve that
   * carries forward and can be drawn on again later (see the withdrawal waterfall's
   * last-resort cash tier in `withdrawal.ts`), without any further tax since it's
   * already after-tax money. */
  | 'cashReserve'

export interface RmdSurplusSettings {
  strategy: RmdSurplusStrategy
  /** Required for `reinvest` (must be a taxable account) and `cashReserve` (must be
   * a cash account) — ignored for `spend`. If the account can't be found (or isn't
   * the right type), the surplus falls back to behaving like `spend`. */
  targetAccountId?: string
}
