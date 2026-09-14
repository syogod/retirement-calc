import type { RmdSurplusSettings, RmdSurplusStrategy } from '../engine/rmd'
import type { Account } from '../engine/types'

export interface RmdSurplusSectionProps {
  value: RmdSurplusSettings
  accounts: Account[]
  onChange: (value: RmdSurplusSettings) => void
}

const STRATEGY_LABELS: Record<RmdSurplusStrategy, string> = {
  reinvest: 'Reinvest into a taxable account',
  spend: 'Spend it',
  cashReserve: 'Move to a cash reserve',
}

export function RmdSurplusSection({ value, accounts, onChange }: RmdSurplusSectionProps) {
  const taxableAccounts = accounts.filter((a) => a.type === 'taxable')
  const cashAccounts = accounts.filter((a) => a.type === 'cash')
  const targetAccounts = value.strategy === 'reinvest' ? taxableAccounts : value.strategy === 'cashReserve' ? cashAccounts : []

  function updateStrategy(strategy: RmdSurplusStrategy) {
    const firstTarget = strategy === 'reinvest' ? taxableAccounts[0]?.id : strategy === 'cashReserve' ? cashAccounts[0]?.id : undefined
    onChange({ strategy, targetAccountId: firstTarget })
  }

  return (
    <section className="card">
      <h2>Required Minimum Distributions</h2>
      <p className="section-hint">
        Once RMDs begin (age 73 or 75, depending on birth year), some tax-deferred accounts must distribute
        money every year regardless of whether you need it for spending. What should happen to that surplus,
        after tax?
      </p>
      <div className="field-grid">
        <label className="field">
          <span className="field-label">If an RMD exceeds spending need</span>
          <select value={value.strategy} onChange={(event) => updateStrategy(event.target.value as RmdSurplusStrategy)}>
            {(Object.keys(STRATEGY_LABELS) as RmdSurplusStrategy[]).map((strategy) => (
              <option key={strategy} value={strategy}>
                {STRATEGY_LABELS[strategy]}
              </option>
            ))}
          </select>
        </label>

        {value.strategy !== 'spend' && (
          <label className="field">
            <span className="field-label">{value.strategy === 'reinvest' ? 'Reinvest into' : 'Cash reserve account'}</span>
            <select
              value={value.targetAccountId ?? ''}
              onChange={(event) => onChange({ ...value, targetAccountId: event.target.value || undefined })}
            >
              <option value="">Select an account…</option>
              {targetAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {value.strategy !== 'spend' && targetAccounts.length === 0 && (
        <p className="section-hint">
          {value.strategy === 'reinvest'
            ? 'Add a taxable account under Accounts to reinvest into.'
            : 'Add a cash account under Accounts to use as a reserve.'}
        </p>
      )}
    </section>
  )
}
