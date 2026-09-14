import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SaveLoadControls } from './SaveLoadControls'
import { serializeInputs } from '../state/persistence'
import { createDefaultInputs } from '../state/appInputs'

// jsdom doesn't implement these — stub them so the export path is testable.
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  vi.restoreAllMocks()
})

function makeJsonFile(contents: string, name = 'plan.json'): File {
  return new File([contents], name, { type: 'application/json' })
}

describe('SaveLoadControls', () => {
  it('exports the current inputs as a downloaded JSON file', () => {
    const inputs = createDefaultInputs()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<SaveLoadControls inputs={inputs} onImport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /save to file/i }))

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('imports a valid file and calls onImport with the parsed inputs', async () => {
    const inputs = createDefaultInputs()
    const onImport = vi.fn()
    render(<SaveLoadControls inputs={inputs} onImport={onImport} />)

    const file = makeJsonFile(serializeInputs(inputs))
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1))
    expect(onImport).toHaveBeenCalledWith(inputs)
  })

  it('shows an error and does not call onImport for an invalid file', async () => {
    const onImport = vi.fn()
    render(<SaveLoadControls inputs={createDefaultInputs()} onImport={onImport} />)

    const file = makeJsonFile('{ "not": "a plan" }')
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(await screen.findByText(/doesn't look like a retirement plan/i)).toBeInTheDocument()
    expect(onImport).not.toHaveBeenCalled()
  })
})
