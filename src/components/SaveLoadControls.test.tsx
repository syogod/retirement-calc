import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SaveLoadControls } from './SaveLoadControls'
import { serializeInputs } from '../state/persistence'
import type { AppInputs } from '../state/appInputs'
import { createDefaultInputs } from '../state/appInputs'

// jsdom doesn't implement these — stub them so the export path is testable.
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderControls(inputs: AppInputs, overrides: { onImport?: () => void; onSaved?: () => void } = {}) {
  render(
    <SaveLoadControls
      inputs={inputs}
      onImport={overrides.onImport ?? vi.fn()}
      hasUnsavedChanges
      onSaved={overrides.onSaved ?? vi.fn()}
    />,
  )
}

function makeJsonFile(contents: string, name = 'plan.json'): File {
  return new File([contents], name, { type: 'application/json' })
}

describe('SaveLoadControls', () => {
  it('exports the current inputs as a downloaded JSON file', () => {
    const inputs = createDefaultInputs()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderControls(inputs)
    fireEvent.click(screen.getByRole('button', { name: /export to file/i }))

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('imports a valid file and calls onImport with the parsed inputs', async () => {
    const inputs = createDefaultInputs()
    const onImport = vi.fn()
    renderControls(inputs, { onImport })

    const file = makeJsonFile(serializeInputs(inputs))
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1))
    expect(onImport).toHaveBeenCalledWith(inputs)
  })

  it('shows an error and does not call onImport for an invalid file', async () => {
    const onImport = vi.fn()
    renderControls(createDefaultInputs(), { onImport })

    const file = makeJsonFile('{ "not": "a plan" }')
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(await screen.findByText(/doesn't look like a retirement plan/i)).toBeInTheDocument()
    expect(onImport).not.toHaveBeenCalled()
  })

  it('Save PUTs the plan to the server and reports exactly what was saved', async () => {
    const inputs = createDefaultInputs()
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const onSaved = vi.fn()
    renderControls(inputs, { onSaved })

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(inputs))
    expect(fetchMock).toHaveBeenCalledWith('/api/plan', expect.objectContaining({ method: 'PUT', body: serializeInputs(inputs) }))
  })

  it('shows an error and does not report a save when the server rejects it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })))
    const onSaved = vi.fn()
    renderControls(createDefaultInputs(), { onSaved })

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/save failed \(server error 403\)/i)).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })
})
