import { useRef, useState } from 'react'
import { deserializeInputs, InvalidImportError, serializeInputs } from '../state/persistence'
import type { AppInputs } from '../state/appInputs'

export interface SaveLoadControlsProps {
  inputs: AppInputs
  onImport: (inputs: AppInputs) => void
}

/** Export the current plan to a downloaded JSON file, or load one back in. No
 * accounts, no server — the file on your own disk is the only copy. */
export function SaveLoadControls({ inputs, onImport }: SaveLoadControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

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
      <button type="button" className="save-load-button" onClick={handleExport}>
        Save to file
      </button>
      <button type="button" className="save-load-button" onClick={() => fileInputRef.current?.click()}>
        Load from file
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
