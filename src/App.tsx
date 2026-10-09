import { useEffect, useState } from 'react'
import { AccountsSection } from './components/AccountsSection'
import { AdjustablePanel } from './components/AdjustablePanel'
import { GrowthSection } from './components/GrowthSection'
import { GuardrailsSection } from './components/GuardrailsSection'
import { OneTimeEventsSection } from './components/OneTimeEventsSection'
import { PensionsSection } from './components/PensionsSection'
import { PersonalSection } from './components/PersonalSection'
import { ReportPage } from './components/ReportPage'
import { ResultsSection } from './components/ResultsSection'
import { RmdSurplusSection } from './components/RmdSurplusSection'
import { SaveLoadControls } from './components/SaveLoadControls'
import { SocialSecuritySection } from './components/SocialSecuritySection'
import { TaxSection } from './components/TaxSection'
import { createDefaultInputs, type AppInputs } from './state/appInputs'
import { loadServerPlan, ServerPlanError } from './state/persistence'

type Tab = 'dashboard' | 'setup' | 'report'

function App() {
  const [inputs, setInputs] = useState(createDefaultInputs)
  // The inputs as last loaded from / saved to the server. Every edit replaces the
  // `inputs` object, so a reference comparison is enough to spot unsaved changes.
  const [savedInputs, setSavedInputs] = useState<AppInputs | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')

  useEffect(() => {
    let cancelled = false
    loadServerPlan()
      .then((plan) => {
        if (cancelled) return
        const initial = plan ?? createDefaultInputs()
        setInputs(initial)
        setSavedInputs(initial)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof ServerPlanError ? err.message : "Couldn't load your saved plan.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hasUnsavedChanges = inputs !== savedInputs

  // Ask the browser to confirm before closing or reloading the tab with unsaved edits.
  useEffect(() => {
    if (loading || !hasUnsavedChanges) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [loading, hasUnsavedChanges])

  if (loading) {
    return (
      <main className="app">
        <p className="section-hint">Loading your saved plan…</p>
      </main>
    )
  }

  return (
    <main className="app">
      <div className="app-header">
        <div>
          <h1>Retirement Calculator</h1>
          <p className="app-subtitle">
            All dollar amounts are in today's purchasing power (real dollars) — not the actual, larger
            nominal amounts you'd see in future years' statements after inflation.
          </p>
        </div>
        <SaveLoadControls
          inputs={inputs}
          onImport={setInputs}
          hasUnsavedChanges={hasUnsavedChanges}
          onSaved={setSavedInputs}
        />
      </div>

      {loadError && (
        <p className="status-icon status-icon--critical load-error" role="alert">
          {loadError} Starting with a blank plan — saving will overwrite the saved file.
        </p>
      )}

      <div className="tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'dashboard'}
          className={tab === 'dashboard' ? 'tab tab--active' : 'tab'}
          onClick={() => setTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'setup'}
          className={tab === 'setup' ? 'tab tab--active' : 'tab'}
          onClick={() => setTab('setup')}
        >
          Account Setup
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'report'}
          className={tab === 'report' ? 'tab tab--active' : 'tab'}
          onClick={() => setTab('report')}
        >
          Report
        </button>
      </div>

      {tab === 'dashboard' && (
        <div className="dashboard-layout">
          <div className="dashboard-adjust">
            <AdjustablePanel inputs={inputs} onChange={setInputs} />
          </div>
          <div className="dashboard-results">
            <ResultsSection inputs={inputs} onInputsChange={setInputs} />
          </div>
        </div>
      )}

      {tab === 'setup' && (
        <div className="setup-layout">
          <p className="section-hint">
            The facts about your actual finances — balances, benefit amounts, formulas. Ages and spending
            amounts you'd want to explore live on the Dashboard tab instead.
          </p>
          <PersonalSection value={inputs.personal} onChange={(personal) => setInputs({ ...inputs, personal })} />
          <AccountsSection
            accounts={inputs.accounts}
            personal={inputs.personal}
            onChange={(accounts) => setInputs({ ...inputs, accounts })}
          />
          <GrowthSection value={inputs.growth} onChange={(growth) => setInputs({ ...inputs, growth })} />
          <SocialSecuritySection
            value={inputs.socialSecurity}
            personal={inputs.personal}
            onChange={(socialSecurity) => setInputs({ ...inputs, socialSecurity })}
          />
          <PensionsSection
            pensions={inputs.pensions}
            personal={inputs.personal}
            onChange={(pensions) => setInputs({ ...inputs, pensions })}
          />
          <TaxSection value={inputs.taxes} personal={inputs.personal} onChange={(taxes) => setInputs({ ...inputs, taxes })} />
          <GuardrailsSection value={inputs.guardrails} onChange={(guardrails) => setInputs({ ...inputs, guardrails })} />
          <RmdSurplusSection
            value={inputs.rmdSurplus}
            accounts={inputs.accounts}
            onChange={(rmdSurplus) => setInputs({ ...inputs, rmdSurplus })}
          />
          <OneTimeEventsSection
            events={inputs.oneTimeEvents}
            accounts={inputs.accounts}
            personal={inputs.personal}
            onChange={(oneTimeEvents) => setInputs({ ...inputs, oneTimeEvents })}
          />
        </div>
      )}

      {tab === 'report' && <ReportPage inputs={inputs} />}
    </main>
  )
}

export default App
