import { useState } from 'react'
import { ExpandableChartCard } from './ExpandableChartCard'
import { FanChart } from './charts/FanChart'
import { StatTile } from './charts/StatTile'
import { runMonteCarloProjection } from '../engine/monteCarlo'
import type { MonteCarloResult } from '../engine/monteCarlo'
import type { AppInputs } from '../state/appInputs'

export interface MonteCarloResultsProps {
  inputs: AppInputs
  onInputsChange: (inputs: AppInputs) => void
}

export function MonteCarloResults({ inputs, onInputsChange }: MonteCarloResultsProps) {
  const [result, setResult] = useState<MonteCarloResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  function runSimulation() {
    setIsRunning(true)
    // Let the "Running..." state paint before the (synchronous) simulation blocks the thread.
    setTimeout(() => {
      const nextResult = runMonteCarloProjection({
        personal: inputs.personal,
        accounts: inputs.accounts,
        spending: inputs.spending,
        pensions: inputs.pensions,
        socialSecurity: inputs.socialSecurity,
        taxes: inputs.taxes,
        rmdSurplus: inputs.rmdSurplus,
        oneTimeEvents: inputs.oneTimeEvents,
        guardrails: inputs.guardrails,
        inflation: inputs.growth.inflation,
        numSimulations: inputs.numSimulations,
      })
      setResult(nextResult)
      setIsRunning(false)
    }, 0)
  }

  const successTone = result
    ? result.successRate >= 0.85
      ? 'good'
      : result.successRate >= 0.6
        ? 'warning'
        : 'critical'
    : 'neutral'

  const header = (
    <>
      <p className="section-hint">
        Runs {inputs.numSimulations.toLocaleString()} simulations, each drawing a random historical annual
        return every year instead of one fixed assumption. Doesn't update live — click to (re)run after
        changing inputs.
      </p>
      <button type="button" className="run-simulation-button" onClick={runSimulation} disabled={isRunning}>
        {isRunning ? 'Running...' : result ? 'Re-run simulation' : 'Run simulation'}
      </button>
      {result && (
        <>
          <div className="stat-row">
            <StatTile label="Success rate" value={`${(result.successRate * 100).toFixed(1)}%`} tone={successTone} />
          </div>
          <p className="chart-footnote">
            A line that goes below $0 means that simulation ran out of money — the further below, the more
            cumulative annual spending it couldn't cover.
          </p>
        </>
      )}
    </>
  )

  if (!result) {
    return (
      <section className="card">
        <h2>Monte Carlo</h2>
        {header}
      </section>
    )
  }

  const points = result.percentiles.map((p) => ({ x: p.age, p10: p.p10, p30: p.p30, p50: p.p50, p70: p.p70, p90: p.p90 }))

  return (
    <ExpandableChartCard title="Monte Carlo" inputs={inputs} onInputsChange={onInputsChange} extraHeader={header}>
      {(height) => <FanChart points={points} color="var(--series-1)" height={height} />}
    </ExpandableChartCard>
  )
}
