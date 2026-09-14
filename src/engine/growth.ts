import type { Account, GrowthInputs, PersonalInputs } from './types'

/** Everything runs in today's dollars, so growth uses the real (inflation-adjusted) return. */
export function realReturn(growth: GrowthInputs): number {
  return (1 + growth.nominalReturn) / (1 + growth.inflation) - 1
}

export interface AccountYear {
  age: number
  year: number
  /** Balance per account id, after this year's growth and contribution. */
  balances: Record<string, number>
  total: number
}

/**
 * Projects each account's balance from the current age through the horizon age,
 * applying real-return growth every year and each account's contribution for every
 * year before retirement. Does not model withdrawals — see the Phase 3/4 engine for
 * the full accumulation + decumulation projection.
 */
export function projectAccountGrowth(
  accounts: Account[],
  personal: PersonalInputs,
  growth: GrowthInputs,
): AccountYear[] {
  const r = realReturn(growth)
  const years: AccountYear[] = []

  let balances: Record<string, number> = Object.fromEntries(
    accounts.map((account) => [account.id, account.balance]),
  )
  years.push({
    age: personal.currentAge,
    year: personal.currentYear,
    balances: { ...balances },
    total: sum(Object.values(balances)),
  })

  for (let age = personal.currentAge + 1; age <= personal.horizonAge; age++) {
    const year = personal.currentYear + (age - personal.currentAge)
    const nextBalances: Record<string, number> = {}
    for (const account of accounts) {
      const priorBalance = balances[account.id]
      const contribution = age < personal.retirementAge ? account.annualContribution : 0
      nextBalances[account.id] = priorBalance * (1 + r) + contribution
    }
    balances = nextBalances
    years.push({
      age,
      year,
      balances: { ...balances },
      total: sum(Object.values(balances)),
    })
  }

  return years
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
