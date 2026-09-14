import { useMemo } from 'react'
import { AccountBreakdownChart } from './AccountBreakdownChart'
import { CsvExportButton } from './CsvExportButton'
import { HomeEquityChart } from './HomeEquityChart'
import { IncomeVsSpendingChart } from './IncomeVsSpendingChart'
import { PortfolioChart } from './PortfolioChart'
import { ProjectionTable } from './ProjectionTable'
import { runProjection } from '../engine/projection'
import type { AppInputs } from '../state/appInputs'

export interface ReportPageProps {
  inputs: AppInputs
}

/**
 * A plain, non-interactive, print-friendly layout — no sliders, no "Expand"
 * overlays, nothing that only makes sense on a screen. `@media print` rules (see
 * index.css) hide everything else in the app shell (header, tab bar, this page's
 * own Print/CSV buttons) so what actually prints is just this content.
 */
export function ReportPage({ inputs }: ReportPageProps) {
  const years = useMemo(
    () =>
      runProjection({
        personal: inputs.personal,
        growth: inputs.growth,
        accounts: inputs.accounts,
        spending: inputs.spending,
        pensions: inputs.pensions,
        socialSecurity: inputs.socialSecurity,
        taxes: inputs.taxes,
        rmdSurplus: inputs.rmdSurplus,
        oneTimeEvents: inputs.oneTimeEvents,
        guardrails: inputs.guardrails,
      }),
    [inputs],
  )

  const hasHome = inputs.accounts.some((account) => account.type === 'home')
  const depletedYear = years.find((y) => y.fundsDepleted)

  return (
    <div className="report-page">
      <div className="report-actions">
        <button type="button" className="save-load-button" onClick={() => window.print()}>
          Print
        </button>
        <CsvExportButton years={years} accounts={inputs.accounts} />
      </div>

      <h1>{inputs.personal.name ? `${inputs.personal.name}'s Retirement Plan` : 'Retirement Plan'}</h1>
      <p className="report-summary">
        Retiring at age {inputs.personal.retirementAge}, projected through age {inputs.personal.horizonAge}.
        {depletedYear
          ? ` Funds are projected to run out at age ${depletedYear.age}.`
          : ' Funds are projected to last the full plan.'}
      </p>

      <section className="card">
        <h2>Total Portfolio</h2>
        <PortfolioChart years={years} height={280} />
      </section>

      <section className="card">
        <h2>Account Breakdown</h2>
        <AccountBreakdownChart years={years} accounts={inputs.accounts} height={280} />
      </section>

      <section className="card">
        <h2>Guaranteed Income vs. Spending</h2>
        <IncomeVsSpendingChart years={years} height={280} />
      </section>

      {hasHome && (
        <section className="card">
          <h2>Home Equity</h2>
          <HomeEquityChart years={years} height={280} />
        </section>
      )}

      <section className="card">
        <h2>Year-by-Year Detail</h2>
        <ProjectionTable years={years} />
      </section>
    </div>
  )
}
