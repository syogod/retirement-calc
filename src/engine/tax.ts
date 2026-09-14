/**
 * Federal income tax, 2026 figures — ordinary brackets, standard deduction, and
 * long-term capital gains brackets — verified directly from IRS sources (see below),
 * plus the Social Security taxability formula from Pub 915. All figures held constant
 * in REAL (today's) dollars across the whole projection: bracket thresholds and the
 * standard deduction are inflation-adjusted by the IRS every year, so treating their
 * *real* value as roughly constant is consistent with this app's real-dollar
 * accounting everywhere else (same reasoning as spending/pension/SS figures held
 * flat in real terms). The Social Security base amounts are the deliberate
 * exception — see `taxableSocialSecurity` below.
 *
 * This module only computes what tax would be owed on a given year's income — it
 * does not yet feed back into how much a plan needs to withdraw (that's a later
 * phase, "tax-aware withdrawals").
 */

export type FilingStatus = 'single' | 'marriedFilingJointly'

/** The one tax assumption this app asks the user for directly — everything else
 * (federal brackets, standard deduction, filing status) is derived automatically. */
export interface TaxSettings {
  /** A flat state income tax rate, e.g. 0.05 for 5%. 0 for a no-income-tax state.
   * Applied to both ordinary and capital-gains income alike — a simplification,
   * since most states don't tax long-term capital gains at a separate preferential
   * rate the way federal does. */
  stateRate: number
}

export interface TaxBracket {
  rate: number
  /** Upper bound of this bracket's taxable-income range (Infinity for the top bracket). */
  upTo: number
}

/**
 * 2026 ordinary income tax brackets. Source: IRS newsroom announcement of the 2026
 * annual inflation adjustments (Revenue Procedure 2025-32),
 * https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill
 */
const ORDINARY_BRACKETS_2026: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { rate: 0.1, upTo: 12400 },
    { rate: 0.12, upTo: 50400 },
    { rate: 0.22, upTo: 105700 },
    { rate: 0.24, upTo: 201775 },
    { rate: 0.32, upTo: 256225 },
    { rate: 0.35, upTo: 640600 },
    { rate: 0.37, upTo: Infinity },
  ],
  marriedFilingJointly: [
    { rate: 0.1, upTo: 24800 },
    { rate: 0.12, upTo: 100800 },
    { rate: 0.22, upTo: 211400 },
    { rate: 0.24, upTo: 403550 },
    { rate: 0.32, upTo: 512450 },
    { rate: 0.35, upTo: 768700 },
    { rate: 0.37, upTo: Infinity },
  ],
}

/** 2026 standard deduction. Same source as the brackets above. */
const STANDARD_DEDUCTION_2026: Record<FilingStatus, number> = {
  single: 16100,
  marriedFilingJointly: 32200,
}

/**
 * 2026 long-term capital gains brackets. Source: IRS Rev. Proc. 2025-32 §3.03, cross-
 * checked against two independent secondary summaries since the IRS's own newsroom
 * announcement page didn't render this specific table when fetched.
 */
const LONG_TERM_CAPITAL_GAINS_BRACKETS_2026: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { rate: 0, upTo: 49450 },
    { rate: 0.15, upTo: 545500 },
    { rate: 0.2, upTo: Infinity },
  ],
  marriedFilingJointly: [
    { rate: 0, upTo: 98900 },
    { rate: 0.15, upTo: 613700 },
    { rate: 0.2, upTo: Infinity },
  ],
}

/**
 * Social Security taxability "base amounts" (IRS Pub 915) — unlike every other
 * figure in this file, these have been FIXED in nominal dollars since 1984 and are
 * never inflation-adjusted by law. In this app's real-dollar accounting, that means
 * their real value shrinks every year of the projection (a well-known "stealth tax":
 * an ever-larger share of benefits becomes taxable over time purely from inflation).
 * `taxableSocialSecurity` divides these by the year's cumulative inflation factor to
 * model that shrinkage, rather than holding them flat like the brackets above.
 */
const SOCIAL_SECURITY_BASE_AMOUNTS_1984: Record<FilingStatus, { lower: number; upper: number }> = {
  single: { lower: 25000, upper: 34000 },
  marriedFilingJointly: { lower: 32000, upper: 44000 },
}

/** Total tax owed on `taxableIncome`, applying `brackets` from $0 — standard
 * marginal-bracket math (each dollar taxed at its own bracket's rate, not the whole
 * amount at the top rate). */
function cumulativeTax(taxableIncome: number, brackets: TaxBracket[]): number {
  if (taxableIncome <= 0) return 0
  let tax = 0
  let lowerBound = 0
  for (const { rate, upTo } of brackets) {
    const amountInBracket = Math.min(taxableIncome, upTo) - lowerBound
    if (amountInBracket <= 0) break
    tax += amountInBracket * rate
    lowerBound = upTo
  }
  return tax
}

/**
 * Tax owed on `incrementalAmount` of income that sits *on top of* `baseAmount` of
 * already-taxed income, under the same bracket table — the standard "stacking"
 * method real returns use (e.g. long-term capital gains stack on top of ordinary
 * taxable income and take whichever rate(s) that combined total falls into, rather
 * than being taxed from $0 in isolation). Passing `baseAmount = 0` computes ordinary
 * tax on `incrementalAmount` alone.
 */
export function stackedTax(baseAmount: number, incrementalAmount: number, brackets: TaxBracket[]): number {
  if (incrementalAmount <= 0) return 0
  return cumulativeTax(Math.max(0, baseAmount) + incrementalAmount, brackets) - cumulativeTax(Math.max(0, baseAmount), brackets)
}

/**
 * The taxable portion of Social Security benefits, per the IRS Pub 915 worksheet's
 * closed-form calculation: up to 50% of benefits become taxable once combined income
 * (other income + tax-exempt interest + half of benefits) exceeds the lower base
 * amount, and up to 85% once it exceeds the upper base amount. `otherIncome` should
 * include every other source of income that would appear in AGI (ordinary income
 * plus any capital gains) — tax-exempt interest isn't modeled by this app, so it's
 * omitted. `inflationFactor` shrinks the (nominally fixed) base amounts to their real
 * value in this projection year — see the constant's own comment above.
 */
export function taxableSocialSecurity(
  otherIncome: number,
  benefits: number,
  filingStatus: FilingStatus,
  inflationFactor: number,
): number {
  if (benefits <= 0) return 0
  const { lower, upper } = SOCIAL_SECURITY_BASE_AMOUNTS_1984[filingStatus]
  const realLowerBase = lower / inflationFactor
  const realUpperBase = upper / inflationFactor

  const combinedIncome = otherIncome + 0.5 * benefits
  if (combinedIncome <= realLowerBase) return 0

  const tier1 = Math.min(0.5 * benefits, 0.5 * (combinedIncome - realLowerBase))
  if (combinedIncome <= realUpperBase) return tier1

  const tier2 = 0.85 * (combinedIncome - realUpperBase) + tier1
  return Math.min(0.85 * benefits, tier2)
}

export interface TaxInputs {
  filingStatus: FilingStatus
  /** Fully taxable ordinary income for the year: pension income plus tax-deferred
   * account withdrawals (including any RMD). Excludes Social Security (handled via
   * `socialSecurityBenefits` below) and Roth withdrawals (never taxable here). */
  ordinaryIncome: number
  /** Gross Social Security benefit received this year, before determining how much
   * of it is actually taxable. */
  socialSecurityBenefits: number
  /** Long-term capital gains realized this year (the gain portion of a taxable
   * account withdrawal, not the whole withdrawal). */
  capitalGains: number
  /** Cumulative inflation factor since the plan's start year — see
   * `taxableSocialSecurity`. */
  inflationFactor: number
  /** A flat state income tax rate, e.g. 0.05 for 5%. Applied to combined ordinary +
   * capital gains taxable income — a simplification, since most states don't tax
   * long-term capital gains at a separate preferential rate the way federal does. */
  stateRate: number
}

export interface TaxResult {
  taxableSocialSecurity: number
  /** Ordinary income plus taxable Social Security, minus the standard deduction, floored at 0. */
  taxableOrdinaryIncome: number
  federalOrdinaryTax: number
  federalCapitalGainsTax: number
  stateTax: number
  totalTax: number
}

/** Computes this year's total federal + state tax on the given income. Doesn't (yet)
 * change how much a plan withdraws — see the module comment above. */
export function computeTax(inputs: TaxInputs): TaxResult {
  const { filingStatus, ordinaryIncome, socialSecurityBenefits, capitalGains, inflationFactor, stateRate } = inputs
  const gains = Math.max(0, capitalGains)

  const taxableSS = taxableSocialSecurity(ordinaryIncome + gains, socialSecurityBenefits, filingStatus, inflationFactor)
  const taxableOrdinaryIncome = Math.max(0, ordinaryIncome + taxableSS - STANDARD_DEDUCTION_2026[filingStatus])

  const federalOrdinaryTax = stackedTax(0, taxableOrdinaryIncome, ORDINARY_BRACKETS_2026[filingStatus])
  const federalCapitalGainsTax = stackedTax(
    taxableOrdinaryIncome,
    gains,
    LONG_TERM_CAPITAL_GAINS_BRACKETS_2026[filingStatus],
  )
  const stateTax = stateRate * (taxableOrdinaryIncome + gains)

  return {
    taxableSocialSecurity: taxableSS,
    taxableOrdinaryIncome,
    federalOrdinaryTax,
    federalCapitalGainsTax,
    stateTax,
    totalTax: federalOrdinaryTax + federalCapitalGainsTax + stateTax,
  }
}
