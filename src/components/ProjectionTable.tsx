import { formatWholeDollars } from './charts/chartMath'
import type { ProjectionYear } from '../engine/projection'

export interface ProjectionTableProps {
  years: ProjectionYear[]
}

export function ProjectionTable({ years }: ProjectionTableProps) {
  return (
    <div className="results-table-wrap">
      <table className="results-table">
        <thead>
          <tr>
            <th>Age</th>
            <th>Year</th>
            <th>Total portfolio</th>
            <th>Spending need</th>
            <th>Guaranteed income</th>
            <th>Net withdrawal</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {years.map((year, i) => {
            // A change in discretionary spending from one year to the next only ever
            // happens under the guardrails strategy (it's invariant under "fixed") —
            // except the very first retirement year's 0 → base-spending jump, which
            // is retirement starting, not a guardrails adjustment.
            const previousYear = years[i - 1]
            const guardrailsAdjustment =
              previousYear && previousYear.discretionarySpending > 0 && !previousYear.fundsDepleted
                ? year.discretionarySpending - previousYear.discretionarySpending
                : 0

            return (
              <tr key={year.age}>
                <td>{year.age}</td>
                <td>{year.year}</td>
                <td>{formatWholeDollars(year.totalPortfolio)}</td>
                <td>{formatWholeDollars(year.spendingNeed)}</td>
                <td>{formatWholeDollars(year.guaranteedIncome)}</td>
                <td>{formatWholeDollars(year.netWithdrawalTaken)}</td>
                <td>
                  {year.fundsDepleted && <span className="status-icon status-icon--critical">&#10007; Depleted</span>}
                  {!year.fundsDepleted && year.earlyWithdrawalPenaltyFlag && (
                    <span className="status-icon status-icon--warning">&#9888; Early withdrawal</span>
                  )}
                  {!year.fundsDepleted && year.rmdWithdrawn > year.netWithdrawalNeeded && (
                    <span
                      className="status-icon status-icon--info"
                      title="A Required Minimum Distribution forced more out of a tax-deferred account than spending needed this year"
                    >
                      &#8505; RMD exceeds need
                    </span>
                  )}
                  {(year.oneTimeInflow > 0 || year.oneTimeOutflow > 0) && (
                    <span
                      className="status-icon status-icon--info"
                      title={[
                        year.oneTimeInflow > 0 ? `+${formatWholeDollars(year.oneTimeInflow)} inflow` : null,
                        year.oneTimeOutflow > 0 ? `-${formatWholeDollars(year.oneTimeOutflow)} outflow` : null,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    >
                      &#8505; One-time event
                    </span>
                  )}
                  {year.homeSaleProceeds > 0 && (
                    <span
                      className="status-icon status-icon--info"
                      title={`Home sold — ${formatWholeDollars(year.homeSaleProceeds)} net proceeds deposited`}
                    >
                      &#8505; Home sold
                    </span>
                  )}
                  {Math.abs(guardrailsAdjustment) > 0.01 && (
                    <span
                      className="status-icon status-icon--info"
                      title={`Discretionary spending ${guardrailsAdjustment < 0 ? 'cut' : 'raised'} from ${formatWholeDollars(previousYear.discretionarySpending)} to ${formatWholeDollars(year.discretionarySpending)}`}
                    >
                      &#8505; Spending {guardrailsAdjustment < 0 ? 'cut' : 'raised'}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
