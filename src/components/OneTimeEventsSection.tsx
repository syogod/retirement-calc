import { NumberField } from './NumberField'
import type { OneTimeEvent } from '../engine/oneTimeEvents'
import { personName } from '../engine/people'
import type { Account, PersonalInputs, PersonId } from '../engine/types'
import { createBlankOneTimeEvent } from '../state/appInputs'

export interface OneTimeEventsSectionProps {
  events: OneTimeEvent[]
  accounts: Account[]
  personal: PersonalInputs
  onChange: (events: OneTimeEvent[]) => void
}

type EventDirection = 'inflow' | 'outflow'

export function OneTimeEventsSection({ events, accounts, personal, onChange }: OneTimeEventsSectionProps) {
  const hasSpouse = Boolean(personal.spouse)
  const targetAccounts = accounts.filter((account) => account.type === 'taxable' || account.type === 'cash')

  function updateEvent(id: string, patch: Partial<OneTimeEvent>) {
    onChange(events.map((event) => (event.id === id ? { ...event, ...patch } : event)))
  }

  function setDirection(event: OneTimeEvent, direction: EventDirection) {
    const magnitude = Math.abs(event.amount)
    if (direction === 'outflow') {
      updateEvent(event.id, { amount: -magnitude, targetAccountId: undefined, taxable: undefined })
    } else {
      updateEvent(event.id, { amount: magnitude, repeatEveryYears: undefined, repeatUntilAge: undefined })
    }
  }

  function setRepeats(event: OneTimeEvent, repeats: boolean) {
    updateEvent(event.id, { repeatEveryYears: repeats ? 10 : undefined, repeatUntilAge: undefined })
  }

  function setAmount(event: OneTimeEvent, magnitude: number) {
    const direction: EventDirection = event.amount < 0 ? 'outflow' : 'inflow'
    updateEvent(event.id, { amount: direction === 'outflow' ? -Math.abs(magnitude) : Math.abs(magnitude) })
  }

  function removeEvent(id: string) {
    onChange(events.filter((event) => event.id !== id))
  }

  function addEvent() {
    onChange([...events, createBlankOneTimeEvent()])
  }

  return (
    <section className="card">
      <h2>One-Time Events</h2>
      <p className="section-hint">
        A lump sum at a specific age — an inheritance, a major expense (a wedding, a new roof), or estimated
        net proceeds from a home sale. An expense can also repeat on a schedule (e.g. a new car every 10
        years). Add one row per event.
      </p>
      <div className="accounts-list">
        {events.map((event) => {
          const direction: EventDirection = event.amount < 0 ? 'outflow' : 'inflow'
          const isInflow = direction === 'inflow'

          return (
            <div className="account-row" key={event.id}>
              <label className="field account-name">
                <span className="field-label">Name</span>
                <input
                  type="text"
                  value={event.name}
                  onChange={(changeEvent) => updateEvent(event.id, { name: changeEvent.target.value })}
                />
              </label>

              <label className="field account-type">
                <span className="field-label">Type</span>
                <select value={direction} onChange={(changeEvent) => setDirection(event, changeEvent.target.value as EventDirection)}>
                  <option value="inflow">Inflow (inheritance, home sale, gift)</option>
                  <option value="outflow">Outflow (major expense)</option>
                </select>
              </label>

              {hasSpouse && (
                <label className="field">
                  <span className="field-label">Owner</span>
                  <select
                    value={event.ownerId ?? 'primary'}
                    onChange={(changeEvent) => updateEvent(event.id, { ownerId: changeEvent.target.value as PersonId })}
                  >
                    <option value="primary">{personName(personal, 'primary')}</option>
                    <option value="spouse">{personName(personal, 'spouse')}</option>
                  </select>
                </label>
              )}

              <NumberField
                id={`event-age-${event.id}`}
                label="At age"
                value={event.age}
                onChange={(age) => updateEvent(event.id, { age })}
              />

              <NumberField
                id={`event-amount-${event.id}`}
                label="Amount"
                value={Math.abs(event.amount)}
                onChange={(amount) => setAmount(event, amount)}
                prefix="$"
              />

              {isInflow ? (
                <>
                  <label className="field">
                    <span className="field-label">Deposit into</span>
                    <select
                      value={event.targetAccountId ?? ''}
                      onChange={(changeEvent) => updateEvent(event.id, { targetAccountId: changeEvent.target.value || undefined })}
                    >
                      <option value="">Select an account…</option>
                      {targetAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(event.taxable)}
                      onChange={(changeEvent) => updateEvent(event.id, { taxable: changeEvent.target.checked })}
                    />
                    <span>Taxable as ordinary income (most inheritances/gifts aren't)</span>
                  </label>
                </>
              ) : (
                <>
                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={event.repeatEveryYears !== undefined}
                      onChange={(changeEvent) => setRepeats(event, changeEvent.target.checked)}
                    />
                    <span>Repeats</span>
                  </label>

                  {event.repeatEveryYears !== undefined && (
                    <>
                      <NumberField
                        id={`event-repeat-every-${event.id}`}
                        label="Every N years"
                        value={event.repeatEveryYears}
                        onChange={(repeatEveryYears) => updateEvent(event.id, { repeatEveryYears })}
                      />
                      <NumberField
                        id={`event-repeat-until-${event.id}`}
                        label="Until age"
                        value={event.repeatUntilAge ?? 0}
                        onChange={(value) => updateEvent(event.id, { repeatUntilAge: value > 0 ? value : undefined })}
                        hint="0 = for the rest of the plan"
                      />
                    </>
                  )}
                </>
              )}

              <button
                type="button"
                className="remove-button"
                onClick={() => removeEvent(event.id)}
                aria-label={`Remove ${event.name}`}
              >
                Remove
              </button>
            </div>
          )
        })}
      </div>
      <button type="button" className="add-button" onClick={addEvent}>
        + Add event
      </button>
    </section>
  )
}
