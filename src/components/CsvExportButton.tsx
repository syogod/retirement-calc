import { projectionToCsv } from '../state/csvExport'
import type { ProjectionYear } from '../engine/projection'
import type { Account } from '../engine/types'

export interface CsvExportButtonProps {
  years: ProjectionYear[]
  accounts: Account[]
}

/** Downloads the year-by-year table as a CSV file — same Blob + `<a download>`
 * pattern `SaveLoadControls` uses for the JSON save file, no server involved. */
export function CsvExportButton({ years, accounts }: CsvExportButtonProps) {
  function handleExport() {
    const blob = new Blob([projectionToCsv(years, accounts)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'retirement-projection.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button type="button" className="save-load-button" onClick={handleExport}>
      Download CSV
    </button>
  )
}
