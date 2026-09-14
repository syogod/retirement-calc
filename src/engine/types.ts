/**
 * `cash` is a zero-real-growth reserve — a checking/savings-style account, drawn
 * from only as a last resort once every other account is exhausted (see
 * `withdrawal.ts`), and never generates tax on withdrawal (there's no gain concept
 * for it — it's already just money). Typically funded by an RMD surplus (see
 * `RmdSurplusSettings` in `rmd.ts`), but also a normal account a user can add
 * directly.
 */
/**
 * `home` tracks the value of a house as an asset — a liability's counterpart (see
 * `mortgage` below), excluded from portfolio totals and the withdrawal waterfall the
 * same way a mortgage is (see `src/engine/home.ts`). Appreciates at its own real
 * rate rather than the portfolio's return, and can optionally be sold at a chosen
 * age, auto-paying off any linked mortgage and depositing the net proceeds.
 */
export type AccountType = 'taxable' | 'tax-deferred' | 'roth' | 'cash' | 'home' | 'mortgage'

/** Identifies which household member owns something — an account, a pension, a
 * Social Security benefit. Only two possible people are modeled (this app's scope
 * is a single household), never a longer list. */
export type PersonId = 'primary' | 'spouse'

/**
 * A spouse or partner's own age — tracked separately because RMD start age (73),
 * catch-up contribution eligibility (50, and 60-63), and Social Security claiming
 * are all genuinely per-person, not household-wide. Retirement date, spending, and
 * mortgage timing stay household-level (`PersonalInputs.retirementAge`) — modeling
 * two fully independent retirement timelines was more than this app needs.
 */
export interface SpouseInputs {
  name: string
  currentAge: number
}

export interface Account {
  id: string
  name: string
  type: AccountType
  /** Who owns this account — defaults to the primary person when omitted. Only
   * matters for age-dependent rules (RMDs, catch-up contribution limits) when a
   * spouse with a different age is present. */
  ownerId?: PersonId
  /**
   * Current balance, today's dollars. For a `mortgage`, this is the remaining loan
   * principal — a liability, not an investable asset (excluded from portfolio totals
   * and the withdrawal waterfall; see `src/engine/mortgage.ts`).
   */
  balance: number
  /** Annual contribution while working, today's dollars. Stops at retirement. Not applicable to mortgages. */
  annualContribution: number
  /**
   * Roth accounts only: total contributions made to date (the portion withdrawable
   * anytime without tax or penalty, as opposed to gains). Defaults to `balance` (i.e.
   * assumes no gains yet) when omitted.
   */
  rothBasis?: number
  /**
   * Taxable accounts only: cost basis still remaining — the portion returned
   * tax-free on withdrawal, as opposed to realized long-term capital gain. Defaults
   * to `balance` (assumes no gain yet) when omitted, same convention as `rothBasis`.
   */
  taxableCostBasis?: number
  /** Mortgage only: nominal annual interest rate, e.g. 0.065 for 6.5%. */
  mortgageInterestRate?: number
  /** Mortgage only: remaining term in years, as of today. */
  mortgageRemainingTermYears?: number
  /**
   * Mortgage only: an extra amount paid toward principal every month, on top of the
   * scheduled payment — pays the loan off faster than `mortgageRemainingTermYears`
   * alone would. Counts toward the freed-up payment once the loan is paid off (see
   * `mortgageSnowballToAccountId`), same as the regular payment.
   */
  mortgageExtraMonthlyPayment?: number
  /**
   * Mortgage only: property tax + homeowners insurance escrowed into the monthly
   * payment, today's dollars. Unlike principal & interest, this does NOT stop once
   * the loan is paid off — owning the home still means paying taxes and insurance —
   * so it's added to spending need for the whole plan, not just while the loan is
   * outstanding, and never counts toward the snowball.
   */
  mortgageEscrowMonthly?: number
  /**
   * Mortgage only: once paid off, redirect the freed-up principal & interest payment
   * (not escrow — see above) as an extra annual contribution to the account with
   * this id, only while still pre-retirement (contributions stop at retirement
   * regardless). Omit to just let it reduce spending.
   */
  mortgageSnowballToAccountId?: string
  /** Home only: real appreciation rate (relative to inflation), e.g. `0` (the
   * default) for "keeps pace with inflation exactly, flat in today's dollars," or
   * `0.01` for 1%/year real appreciation. */
  homeAppreciationRate?: number
  /** Home only: cost basis (purchase price plus improvements) — the portion of a
   * sale's proceeds that isn't a capital gain. Defaults to `balance` (assumes no
   * gain yet) when omitted, same convention as `rothBasis`/`taxableCostBasis`. */
  homeCostBasis?: number
  /** Home only: which mortgage account is secured by this home, if any — netted
   * against home value for equity, and paid off automatically from the proceeds if
   * the home is sold. Omit for a home owned outright. */
  linkedMortgageAccountId?: string
  /** Home only: the age this home is sold at, if ever. Omit to never sell it within
   * the plan (it just keeps appreciating). */
  homeSellAtAge?: number
  /** Home only: selling costs (realtor commission, closing costs) as a fraction of
   * sale price. Defaults to `0.06` (6%) when omitted. */
  homeSellingCostRate?: number
  /** Home only: which account receives the net sale proceeds — must be a taxable
   * or cash account (same restriction as every other deposit target in this app).
   * Required for `homeSellAtAge` to actually deposit anything; a missing or invalid
   * target is a documented no-op, same fallback as an invalid RMD-surplus target. */
  homeSaleTargetAccountId?: string
}

export interface PersonalInputs {
  /** Display name for the primary person, e.g. "You". Purely cosmetic (labels in
   * the UI and exports) — defaults to "You" when omitted. */
  name?: string
  currentAge: number
  /** Age contributions stop and withdrawals begin. */
  retirementAge: number
  /** Age the projection runs through (plan-to age). */
  horizonAge: number
  currentYear: number
  /** A spouse or partner, if any — omit for a single-person household. */
  spouse?: SpouseInputs
}

export interface GrowthInputs {
  /** Assumed nominal investment return, e.g. 0.07 for 7%. */
  nominalReturn: number
  /** Assumed inflation rate, e.g. 0.03 for 3%. */
  inflation: number
}
