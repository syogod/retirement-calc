import { checkContributionLimits } from '../engine/contributionLimits'
import { calculateNominalAnnualPayment } from '../engine/mortgage'
import { makeAgeForOwner, personName } from '../engine/people'
import type { Account, AccountType, PersonalInputs, PersonId } from '../engine/types'
import { createBlankAccount } from '../state/appInputs'
import { NumberField } from './NumberField'
import { PercentField } from './PercentField'

export interface AccountsSectionProps {
  accounts: Account[]
  /** Needed to check 401(k)/Roth contributions against the age-appropriate 2026 IRS
   * limit, resolved per account owner when a spouse is present. */
  personal: PersonalInputs
  onChange: (accounts: Account[]) => void
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  taxable: 'Taxable',
  'tax-deferred': 'Tax-Deferred',
  roth: 'Roth',
  cash: 'Cash',
  home: 'Home',
  mortgage: 'Mortgage',
}

export function AccountsSection({ accounts, personal, onChange }: AccountsSectionProps) {
  const hasSpouse = Boolean(personal.spouse)
  const ageForOwner = makeAgeForOwner(personal, personal.currentAge)
  const limitWarnings = new Map(checkContributionLimits(accounts, ageForOwner).map((w) => [w.accountId, w]))

  function updateAccount(id: string, patch: Partial<Account>) {
    onChange(accounts.map((account) => (account.id === id ? { ...account, ...patch } : account)))
  }

  function switchType(id: string, type: AccountType) {
    const current = accounts.find((account) => account.id === id)
    if (!current) return
    const clearedMortgageFields = {
      mortgageInterestRate: undefined,
      mortgageRemainingTermYears: undefined,
      mortgageExtraMonthlyPayment: undefined,
      mortgageEscrowMonthly: undefined,
      mortgageSnowballToAccountId: undefined,
    }
    const clearedHomeFields = {
      homeAppreciationRate: undefined,
      homeCostBasis: undefined,
      linkedMortgageAccountId: undefined,
      homeSellAtAge: undefined,
      homeSellingCostRate: undefined,
      homeSaleTargetAccountId: undefined,
    }
    if (type === 'mortgage') {
      updateAccount(id, {
        type,
        annualContribution: 0,
        rothBasis: undefined,
        taxableCostBasis: undefined,
        ...clearedHomeFields,
        mortgageInterestRate: current.mortgageInterestRate ?? 0.065,
        mortgageRemainingTermYears: current.mortgageRemainingTermYears ?? 30,
      })
    } else if (type === 'home') {
      updateAccount(id, {
        type,
        annualContribution: 0,
        rothBasis: undefined,
        taxableCostBasis: undefined,
        ...clearedMortgageFields,
      })
    } else {
      updateAccount(id, { type, ...clearedMortgageFields, ...clearedHomeFields })
    }
  }

  function removeAccount(id: string) {
    onChange(accounts.filter((account) => account.id !== id))
  }

  function addAccount() {
    onChange([...accounts, createBlankAccount()])
  }

  return (
    <section className="card">
      <h2>Accounts</h2>
      <div className="accounts-list">
        {accounts.map((account) => {
          const warning = limitWarnings.get(account.id)
          const isMortgage = account.type === 'mortgage'
          const isHome = account.type === 'home'
          const snowballTargets = accounts.filter((a) => a.id !== account.id && a.type !== 'mortgage' && a.type !== 'home')
          const mortgageOptions = accounts.filter((a) => a.type === 'mortgage')
          const saleTargetOptions = accounts.filter((a) => a.id !== account.id && (a.type === 'taxable' || a.type === 'cash'))

          return (
            <div className="account-row" key={account.id}>
              <label className="field account-name">
                <span className="field-label">Name</span>
                <input
                  type="text"
                  value={account.name}
                  onChange={(event) => updateAccount(account.id, { name: event.target.value })}
                />
              </label>

              <label className="field account-type">
                <span className="field-label">Type</span>
                <select value={account.type} onChange={(event) => switchType(account.id, event.target.value as AccountType)}>
                  {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((type) => (
                    <option key={type} value={type}>
                      {ACCOUNT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>

              {hasSpouse && (
                <label className="field">
                  <span className="field-label">Owner</span>
                  <select
                    value={account.ownerId ?? 'primary'}
                    onChange={(event) => updateAccount(account.id, { ownerId: event.target.value as PersonId })}
                  >
                    <option value="primary">{personName(personal, 'primary')}</option>
                    <option value="spouse">{personName(personal, 'spouse')}</option>
                  </select>
                </label>
              )}

              <NumberField
                id={`balance-${account.id}`}
                label={isMortgage ? 'Remaining loan balance' : isHome ? 'Current home value' : 'Balance'}
                value={account.balance}
                onChange={(balance) => updateAccount(account.id, { balance })}
                prefix="$"
              />

              {!isMortgage && !isHome && (
                <NumberField
                  id={`contribution-${account.id}`}
                  label="Annual contribution"
                  value={account.annualContribution}
                  onChange={(annualContribution) => updateAccount(account.id, { annualContribution })}
                  prefix="$"
                  hint={
                    warning
                      ? `Above the 2026 limit of $${warning.limit.toLocaleString('en-US')} for your age`
                      : undefined
                  }
                  hintTone="warning"
                />
              )}

              {account.type === 'roth' && (
                <NumberField
                  id={`basis-${account.id}`}
                  label="Total contributions to date"
                  value={account.rothBasis ?? account.balance}
                  onChange={(rothBasis) => updateAccount(account.id, { rothBasis })}
                  prefix="$"
                  hint="Withdrawable anytime, no tax or penalty"
                />
              )}

              {account.type === 'taxable' && (
                <NumberField
                  id={`cost-basis-${account.id}`}
                  label="Cost basis"
                  value={account.taxableCostBasis ?? account.balance}
                  onChange={(taxableCostBasis) => updateAccount(account.id, { taxableCostBasis })}
                  prefix="$"
                  hint="What you paid for it — the rest is unrealized capital gain, taxed on withdrawal"
                />
              )}

              {isMortgage && (
                <>
                  <PercentField
                    id={`mortgage-rate-${account.id}`}
                    label="Interest rate"
                    value={account.mortgageInterestRate ?? 0.065}
                    onChange={(mortgageInterestRate) => updateAccount(account.id, { mortgageInterestRate })}
                    step={0.01}
                  />
                  <NumberField
                    id={`mortgage-term-${account.id}`}
                    label="Remaining term, years"
                    value={account.mortgageRemainingTermYears ?? 30}
                    onChange={(mortgageRemainingTermYears) => updateAccount(account.id, { mortgageRemainingTermYears })}
                    step={1}
                  />
                  <NumberField
                    id={`mortgage-extra-${account.id}`}
                    label="Extra principal payment, $/month"
                    value={account.mortgageExtraMonthlyPayment ?? 0}
                    onChange={(mortgageExtraMonthlyPayment) => updateAccount(account.id, { mortgageExtraMonthlyPayment })}
                    prefix="$"
                    hint="Optional — pays the loan off sooner"
                  />
                  <NumberField
                    id={`mortgage-escrow-${account.id}`}
                    label="Property tax & insurance (escrow), $/month"
                    value={account.mortgageEscrowMonthly ?? 0}
                    onChange={(mortgageEscrowMonthly) => updateAccount(account.id, { mortgageEscrowMonthly })}
                    prefix="$"
                    hint="Keeps being paid after the loan is paid off — don't also add this to your monthly spend"
                  />
                  <div className="field">
                    <span className="field-label">Principal &amp; interest payment</span>
                    <span className="computed-value">
                      $
                      {(
                        calculateNominalAnnualPayment({
                          balance: account.balance,
                          interestRate: account.mortgageInterestRate ?? 0.065,
                          remainingTermYears: account.mortgageRemainingTermYears ?? 30,
                        }) / 12
                      ).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      /mo
                    </span>
                  </div>
                  <div className="field">
                    <span className="field-label">Total monthly payment (incl. extra + escrow)</span>
                    <span className="computed-value">
                      $
                      {(
                        calculateNominalAnnualPayment({
                          balance: account.balance,
                          interestRate: account.mortgageInterestRate ?? 0.065,
                          remainingTermYears: account.mortgageRemainingTermYears ?? 30,
                        }) /
                          12 +
                        (account.mortgageExtraMonthlyPayment ?? 0) +
                        (account.mortgageEscrowMonthly ?? 0)
                      ).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      /mo
                    </span>
                  </div>
                  <label className="field">
                    <span className="field-label">When paid off, snowball payment into</span>
                    <select
                      value={account.mortgageSnowballToAccountId ?? ''}
                      onChange={(event) =>
                        updateAccount(account.id, { mortgageSnowballToAccountId: event.target.value || undefined })
                      }
                    >
                      <option value="">Just reduce spending</option>
                      {snowballTargets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              {isHome && (
                <>
                  <PercentField
                    id={`home-appreciation-${account.id}`}
                    label="Real appreciation rate"
                    value={account.homeAppreciationRate ?? 0}
                    onChange={(homeAppreciationRate) => updateAccount(account.id, { homeAppreciationRate })}
                    step={0.01}
                    hint="0% keeps pace with inflation exactly — flat in today's dollars"
                  />
                  <NumberField
                    id={`home-cost-basis-${account.id}`}
                    label="Cost basis"
                    value={account.homeCostBasis ?? account.balance}
                    onChange={(homeCostBasis) => updateAccount(account.id, { homeCostBasis })}
                    prefix="$"
                    hint="Purchase price + improvements — the rest is capital gain if sold"
                  />
                  <label className="field">
                    <span className="field-label">Linked mortgage</span>
                    <select
                      value={account.linkedMortgageAccountId ?? ''}
                      onChange={(event) =>
                        updateAccount(account.id, { linkedMortgageAccountId: event.target.value || undefined })
                      }
                    >
                      <option value="">None (owned outright)</option>
                      {mortgageOptions.map((mortgage) => (
                        <option key={mortgage.id} value={mortgage.id}>
                          {mortgage.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <NumberField
                    id={`home-sell-age-${account.id}`}
                    label="Sell at age"
                    value={account.homeSellAtAge ?? 0}
                    onChange={(value) => updateAccount(account.id, { homeSellAtAge: value > 0 ? value : undefined })}
                    hint="0 = never sell within the plan"
                  />
                  {account.homeSellAtAge !== undefined && (
                    <>
                      <PercentField
                        id={`home-selling-cost-${account.id}`}
                        label="Selling costs"
                        value={account.homeSellingCostRate ?? 0.06}
                        onChange={(homeSellingCostRate) => updateAccount(account.id, { homeSellingCostRate })}
                        step={0.01}
                        hint="Realtor commission + closing costs, as a % of sale price"
                      />
                      <label className="field">
                        <span className="field-label">Deposit sale proceeds into</span>
                        <select
                          value={account.homeSaleTargetAccountId ?? ''}
                          onChange={(event) =>
                            updateAccount(account.id, { homeSaleTargetAccountId: event.target.value || undefined })
                          }
                        >
                          <option value="">Select an account…</option>
                          {saleTargetOptions.map((target) => (
                            <option key={target.id} value={target.id}>
                              {target.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                </>
              )}

              <button
                type="button"
                className="remove-button"
                onClick={() => removeAccount(account.id)}
                aria-label={`Remove ${account.name}`}
              >
                Remove
              </button>
            </div>
          )
        })}
      </div>
      <button type="button" className="add-button" onClick={addAccount}>
        + Add account
      </button>
    </section>
  )
}
