import type { AccountType } from './types'

/** Age below which withdrawing tax-deferred money or Roth gains triggers the 10% early-withdrawal penalty. */
export const EARLY_WITHDRAWAL_AGE = 59.5

export interface AccountBalance {
  id: string
  type: AccountType
  balance: number
  /** Roth only: contributions-to-date still remaining. Defaults to `balance` (assumes
   * no gains yet) when omitted, clamped to [0, balance]. */
  rothBasis?: number
  /** Taxable accounts only: cost basis still remaining (the portion returned tax-free
   * on withdrawal, as opposed to realized capital gain). Defaults to `balance`
   * (assumes no gain yet) when omitted, clamped to [0, balance] — same convention as
   * `rothBasis`. Unlike Roth (which withdraws basis before any gains), a taxable
   * account has no such ordering: each dollar withdrawn realizes gain and returns
   * basis in the same proportion the account currently holds them. */
  taxableCostBasis?: number
}

export interface WithdrawalResult {
  /** Updated balance per account id after this year's withdrawal. */
  balances: Record<string, number>
  /** Updated Roth basis per account id (roth accounts only). */
  rothBasis: Record<string, number>
  /** Updated cost basis per account id (taxable accounts only). */
  taxableCostBasis: Record<string, number>
  /** Amount actually withdrawn — may be less than requested if funds ran out. */
  totalWithdrawn: number
  /** Portion of `totalWithdrawn` that came from tax-deferred accounts — ordinary
   * income for tax purposes (on top of any RMD, which is a separate, earlier draw —
   * see `rmd.ts`). */
  taxDeferredWithdrawn: number
  /** Portion of `totalWithdrawn` that was realized long-term capital gain from
   * taxable accounts (the gain fraction of whatever was drawn from tier 1, per each
   * account's own `taxableCostBasis`) — the rest of that tier's withdrawal is a
   * tax-free return of basis. */
  taxableGainsWithdrawn: number
  /** True if this withdrawal touched tax-deferred money or Roth gains before 59½. */
  earlyWithdrawalPenaltyFlag: boolean
  /** Dollar amount of the 10% early-withdrawal penalty on whatever tax-deferred or
   * Roth-gains money (see `earlyWithdrawalPenaltyFlag`) was withdrawn before 59½. */
  earlyWithdrawalPenaltyAmount: number
  /** True if the requested withdrawal exceeded total available assets. */
  fundsDepleted: boolean
}

/**
 * Withdraws `amountNeeded` from `accounts` following a tax-aware order: taxable
 * accounts, then Roth basis (withdrawable anytime penalty-free), then tax-deferred
 * accounts, then Roth gains — the last two flagged if withdrawn before 59½ — and
 * finally cash accounts as an absolute last resort (already-taxed money, so no tax
 * consequence, but not something you'd normally choose to spend down first). Within
 * each tier, accounts are drawn pro-rata by balance. If the need exceeds total
 * assets, withdrawals are clamped and `fundsDepleted` is set.
 */
export function applyWithdrawal(
  accounts: AccountBalance[],
  amountNeeded: number,
  age: number,
): WithdrawalResult {
  const balances: Record<string, number> = {}
  const rothBasis: Record<string, number> = {}
  const taxableCostBasis: Record<string, number> = {}
  for (const account of accounts) {
    balances[account.id] = account.balance
    if (account.type === 'roth') {
      rothBasis[account.id] = clampBasis(account.balance, account.rothBasis)
    }
    if (account.type === 'taxable') {
      taxableCostBasis[account.id] = clampBasis(account.balance, account.taxableCostBasis)
    }
  }

  const totalNeeded = Math.max(0, amountNeeded)
  let remaining = totalNeeded
  let earlyWithdrawalPenaltyFlag = false
  let earlyWithdrawalPenaltyAmount = 0
  let taxableGainsWithdrawn = 0

  const taxableIds = accounts.filter((a) => a.type === 'taxable').map((a) => a.id)
  const taxDeferredIds = accounts.filter((a) => a.type === 'tax-deferred').map((a) => a.id)
  const rothIds = accounts.filter((a) => a.type === 'roth').map((a) => a.id)
  const cashIds = accounts.filter((a) => a.type === 'cash').map((a) => a.id)

  // Tier 1: taxable accounts. Each dollar withdrawn realizes gain and returns basis
  // in whatever proportion the account currently holds them — no basis-first
  // ordering like Roth, since a typical (non-lot-selected) taxable account can't do
  // that.
  remaining -= drawTier(
    taxableIds.map((id) => ({ id, amount: balances[id] })),
    remaining,
    (id, amount) => {
      const currentBalance = balances[id]
      const currentBasis = taxableCostBasis[id]
      const gainFraction = currentBalance > 0 ? Math.max(0, currentBalance - currentBasis) / currentBalance : 0
      taxableGainsWithdrawn += amount * gainFraction
      taxableCostBasis[id] = currentBasis - amount * (1 - gainFraction)
      balances[id] -= amount
    },
  )

  // Tier 2: Roth basis (withdrawable anytime, no tax or penalty).
  remaining -= drawTier(
    rothIds.map((id) => ({ id, amount: rothBasis[id] })),
    remaining,
    (id, amount) => {
      balances[id] -= amount
      rothBasis[id] -= amount
    },
  )

  // Tier 3: tax-deferred accounts — fully taxable as ordinary income.
  const taxDeferredTaken = drawTier(
    taxDeferredIds.map((id) => ({ id, amount: balances[id] })),
    remaining,
    (id, amount) => {
      balances[id] -= amount
    },
  )
  if (taxDeferredTaken > 0 && age < EARLY_WITHDRAWAL_AGE) {
    earlyWithdrawalPenaltyFlag = true
    earlyWithdrawalPenaltyAmount += 0.1 * taxDeferredTaken
  }
  remaining -= taxDeferredTaken

  // Tier 4: Roth gains (balance beyond basis).
  const rothGainsTaken = drawTier(
    rothIds.map((id) => ({ id, amount: balances[id] - rothBasis[id] })),
    remaining,
    (id, amount) => {
      balances[id] -= amount
    },
  )
  if (rothGainsTaken > 0 && age < EARLY_WITHDRAWAL_AGE) {
    earlyWithdrawalPenaltyFlag = true
    earlyWithdrawalPenaltyAmount += 0.1 * rothGainsTaken
  }
  remaining -= rothGainsTaken

  // Tier 5: cash reserve — last resort. Already-taxed money, so no tax or penalty
  // consequence either way.
  remaining -= drawTier(
    cashIds.map((id) => ({ id, amount: balances[id] })),
    remaining,
    (id, amount) => {
      balances[id] -= amount
    },
  )

  for (const id of Object.keys(balances)) {
    balances[id] = Math.max(0, balances[id])
  }
  for (const id of Object.keys(rothBasis)) {
    rothBasis[id] = Math.min(Math.max(0, rothBasis[id]), balances[id])
  }
  for (const id of Object.keys(taxableCostBasis)) {
    taxableCostBasis[id] = Math.min(Math.max(0, taxableCostBasis[id]), balances[id])
  }

  return {
    balances,
    rothBasis,
    taxableCostBasis,
    totalWithdrawn: totalNeeded - Math.max(0, remaining),
    taxDeferredWithdrawn: taxDeferredTaken,
    taxableGainsWithdrawn,
    earlyWithdrawalPenaltyFlag,
    earlyWithdrawalPenaltyAmount,
    fundsDepleted: remaining > 1e-6,
  }
}

function clampBasis(balance: number, basis: number | undefined): number {
  return Math.min(Math.max(basis ?? balance, 0), balance)
}

/** Draws `need` pro-rata across `entries` by their `amount`, applying each account's
 * share via `apply`, and returns the total actually taken (capped at total available). */
function drawTier(
  entries: Array<{ id: string; amount: number }>,
  need: number,
  apply: (id: string, amount: number) => void,
): number {
  if (need <= 0) return 0
  const total = entries.reduce((sum, e) => sum + e.amount, 0)
  if (total <= 0) return 0
  const take = Math.min(total, need)
  for (const entry of entries) {
    apply(entry.id, (entry.amount / total) * take)
  }
  return take
}
