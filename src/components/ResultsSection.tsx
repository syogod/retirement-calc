import { useMemo } from 'react'
import { AccountBreakdownChart } from './AccountBreakdownChart'
import { CsvExportButton } from './CsvExportButton'
import { ExpandableChartCard } from './ExpandableChartCard'
import { HomeEquityChart } from './HomeEquityChart'
import { IncomeVsSpendingChart } from './IncomeVsSpendingChart'
import { MonteCarloResults } from './MonteCarloResults'
import { PortfolioChart } from './PortfolioChart'
import { ProjectionTable } from './ProjectionTable'
import { runProjection } from '../engine/projection'
import type { AppInputs } from '../state/appInputs'

export interface ResultsSectionProps {
  inputs: AppInputs
  onInputsChange: (inputs: AppInputs) => void
}

export function ResultsSection({ inputs, onInputsChange }: ResultsSectionProps) {
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

  const depletedYear = years.find((y) => y.fundsDepleted)
  const hasHome = inputs.accounts.some((account) => account.type === 'home')

  return (
    <>
      <ExpandableChartCard
        title="Total Portfolio"
        inputs={inputs}
        onInputsChange={onInputsChange}
        extraHeader={
          depletedYear && (
            <p className="section-hint">
              <span className="status-icon status-icon--critical">
                &#10007; Funds run out at age {depletedYear.age}
              </span>
            </p>
          )
        }
      >
        {(height) => <PortfolioChart years={years} height={height} />}
      </ExpandableChartCard>

      <ExpandableChartCard title="Account Breakdown" inputs={inputs} onInputsChange={onInputsChange}>
        {(height) => <AccountBreakdownChart years={years} accounts={inputs.accounts} height={height} />}
      </ExpandableChartCard>

      <ExpandableChartCard title="Guaranteed Income vs. Spending" inputs={inputs} onInputsChange={onInputsChange}>
        {(height) => <IncomeVsSpendingChart years={years} height={height} />}
      </ExpandableChartCard>

      {hasHome && (
        <ExpandableChartCard title="Home Equity" inputs={inputs} onInputsChange={onInputsChange}>
          {(height) => <HomeEquityChart years={years} height={height} />}
        </ExpandableChartCard>
      )}

      <section className="card">
        <div className="results-header">
          <h2>Year-by-Year Detail</h2>
          <CsvExportButton years={years} accounts={inputs.accounts} />
        </div>
        <ProjectionTable years={years} />
      </section>

      <MonteCarloResults inputs={inputs} onInputsChange={onInputsChange} />
    </>
  )
}
