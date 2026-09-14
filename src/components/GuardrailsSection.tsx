import { PercentField } from './PercentField'
import type { GuardrailsSettings, SpendingStrategy } from '../engine/guardrails'

export interface GuardrailsSectionProps {
  value: GuardrailsSettings
  onChange: (value: GuardrailsSettings) => void
}

const STRATEGY_LABELS: Record<SpendingStrategy, string> = {
  fixed: 'Fixed spending',
  guardrails: 'Dynamic (guardrails)',
}

export function GuardrailsSection({ value, onChange }: GuardrailsSectionProps) {
  return (
    <section className="card">
      <h2>Spending Strategy</h2>
      <p className="section-hint">
        A dynamic strategy sets your withdrawal rate the year you retire, then checks it every year after: if
        the portfolio has underperformed enough that you're now withdrawing well above that rate, spending is
        cut; if it's outperformed enough that you're withdrawing well below it, spending is raised. Otherwise
        spending holds at its current level. Based on the Guyton-Klinger guardrails method.
      </p>
      <div className="field-grid">
        <label className="field">
          <span className="field-label">Strategy</span>
          <select
            value={value.strategy}
            onChange={(event) => onChange({ ...value, strategy: event.target.value as SpendingStrategy })}
          >
            {(Object.keys(STRATEGY_LABELS) as SpendingStrategy[]).map((strategy) => (
              <option key={strategy} value={strategy}>
                {STRATEGY_LABELS[strategy]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {value.strategy === 'guardrails' && (
        <div className="field-grid">
          <PercentField
            id="guardrailsUpperPct"
            label="Upper guardrail"
            value={value.upperGuardrailPct}
            onChange={(upperGuardrailPct) => onChange({ ...value, upperGuardrailPct })}
            hint="Cut spending once the withdrawal rate rises this far above the initial rate"
          />
          <PercentField
            id="guardrailsCutPct"
            label="Cut by"
            value={value.cutPct}
            onChange={(cutPct) => onChange({ ...value, cutPct })}
            hint="How much to cut spending when that happens"
          />
          <PercentField
            id="guardrailsLowerPct"
            label="Lower guardrail"
            value={value.lowerGuardrailPct}
            onChange={(lowerGuardrailPct) => onChange({ ...value, lowerGuardrailPct })}
            hint="Raise spending once the withdrawal rate falls this far below the initial rate"
          />
          <PercentField
            id="guardrailsRaisePct"
            label="Raise by"
            value={value.raisePct}
            onChange={(raisePct) => onChange({ ...value, raisePct })}
            hint="How much to raise spending when that happens"
          />
        </div>
      )}
    </section>
  )
}
