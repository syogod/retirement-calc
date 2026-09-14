import type { FilingStatus } from './tax'

/**
 * Section 121 primary-residence capital-gains exclusion — the first $250,000
 * (single) / $500,000 (married filing jointly) of gain on the sale of a primary
 * home is excluded from capital gains tax. This app doesn't model the underlying
 * ownership/use-test eligibility rules (2 of the last 5 years, one exclusion per 2
 * years, etc.) — it assumes the exclusion is always available, a reasonable
 * simplification for a personal planning tool modeling one home sale.
 */
const PRIMARY_RESIDENCE_EXCLUSION: Record<FilingStatus, number> = {
  single: 250000,
  marriedFilingJointly: 500000,
}

export interface HomeSaleResult {
  /** The full pre-tax amount to deposit into the sale's target account: sale value,
   * minus selling costs, minus paying off any linked mortgage balance. Any tax owed
   * on `taxableGain` is paid via a separate, grossed-up withdrawal — not netted out
   * of this deposit — same convention as every other taxable inflow in this app
   * (see `oneTimeEvents.ts`). */
  netProceeds: number
  /** The portion of the gain still taxable as a long-term capital gain after the
   * Section 121 exclusion above. */
  taxableGain: number
}

/**
 * Computes what selling a home this year actually produces: the amount realized
 * (sale value minus selling costs) minus cost basis is the gain; the exclusion
 * shields the first $250k/$500k of that from tax. `mortgageBalanceAtSale` (if any)
 * is paid off directly from the proceeds before anything is deposited anywhere.
 */
export function calculateHomeSale(
  saleValue: number,
  costBasis: number,
  sellingCostRate: number,
  mortgageBalanceAtSale: number,
  filingStatus: FilingStatus,
): HomeSaleResult {
  const amountRealized = saleValue * (1 - sellingCostRate)
  const gain = Math.max(0, amountRealized - costBasis)
  const taxableGain = Math.max(0, gain - PRIMARY_RESIDENCE_EXCLUSION[filingStatus])
  const netProceeds = amountRealized - mortgageBalanceAtSale
  return { netProceeds, taxableGain }
}
