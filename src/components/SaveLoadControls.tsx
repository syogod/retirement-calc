import { useRef, useState } from 'react'
import {
  deserializeInputs,
  InvalidImportError,
  saveServerPlan,
  serializeInputs,
  ServerPlanError,
} from '../state/persistence'
import type { AppInputs } from '../state/appInputs'

export interface SaveLoadControlsProps {
  inputs: AppInputs
  onImport: (inputs: AppInputs) => void
  hasUnsavedChanges: boolean
  /** Called with exactly the inputs that were written, once the server confirms. */
  onSaved: (inputs: AppInputs) => void
}

/** "Save" overwrites the one plan kept on the server (loaded automatically at
 * startup). Export/Import move a copy to or from a JSON file on your own computer. */
export function SaveLoadControls({ inputs, onImport, hasUnsavedChanges, onSaved }: SaveLoadControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await saveServerPlan(inputs)
      onSaved(inputs)
      setError(null)
    } catch (err) {
      setError(err instanceof ServerPlanError ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  function handleExport() {
    const blob = new Blob([serializeInputs(inputs)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'retirement-plan.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Let the same file be re-selected later even if this import fails.
    event.target.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        onImport(deserializeInputs(String(reader.result)))
        setError(null)
      } catch (err) {
        setError(err instanceof InvalidImportError ? err.message : 'Could not read that file.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="save-load-controls">
      <span className="save-status" role="status">
        {saving ? 'Saving…' : hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}
      </span>
      <button
        type="button"
        className="save-load-button save-load-button--primary"
        onClick={handleSave}
        disabled={saving || !hasUnsavedChanges}
      >
        Save
      </button>
      <button type="button" className="save-load-button" onClick={handleExport}>
        Export to file
      </button>
      <button type="button" className="save-load-button" onClick={() => fileInputRef.current?.click()}>
        Import from file
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {error && <span className="status-icon status-icon--critical save-load-error">{error}</span>}
    </div>
  )
}
