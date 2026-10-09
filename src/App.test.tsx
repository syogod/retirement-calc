import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createDemoInputs } from './state/demoInputs'
import { serializeInputs } from './state/persistence'

/** Stands in for the server's /api/plan: holds one saved file (or none). */
function mockServer(initial: string | null = null) {
  let saved = initial
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      saved = String(init.body)
      return new Response(null, { status: 204 })
    }
    return saved === null ? new Response('', { status: 404 }) : new Response(saved, { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, saved: () => saved }
}

/** Renders the app and waits for the startup load from the server to finish. */
async function renderApp() {
  render(<App />)
  await screen.findByRole('heading', { name: /retirement calculator/i })
}

beforeEach(() => {
  mockServer()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('renders the app heading', async () => {
    await renderApp()
    expect(screen.getByRole('heading', { name: /retirement calculator/i })).toBeInTheDocument()
  })

  it('defaults to the Dashboard tab, showing the Explore panel and results', async () => {
    await renderApp()
    expect(screen.getByRole('heading', { name: /explore/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /total portfolio/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^accounts$/i })).not.toBeInTheDocument()
  })

  it('opens on a clean slate — no accounts, no pensions, nothing pre-filled', async () => {
    await renderApp()
    fireEvent.click(screen.getByRole('tab', { name: /account setup/i }))

    expect(screen.getByRole('heading', { name: /^accounts$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /pensions & annuities/i })).toBeInTheDocument()
    // No account/pension rows exist yet, so there's nothing to remove.
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
  })

  it('switches to Account Setup and back', async () => {
    await renderApp()
    fireEvent.click(screen.getByRole('tab', { name: /account setup/i }))
    expect(screen.getByRole('heading', { name: /^accounts$/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /explore/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /dashboard/i }))
    expect(screen.getByRole('heading', { name: /explore/i })).toBeInTheDocument()
  })

  it('updates the computed real return on the Setup tab when growth inputs change', async () => {
    await renderApp()
    fireEvent.click(screen.getByRole('tab', { name: /account setup/i }))

    expect(screen.getByText(/real return used for every account/i).textContent).toMatch(/3\.88%/)

    fireEvent.change(screen.getByLabelText(/assumed nominal investment return/i), {
      target: { value: '5' },
    })

    expect(screen.getByText(/real return used for every account/i).textContent).toMatch(/1\.94%/)
  })

  it('adding an account on the Setup tab creates the first row', async () => {
    await renderApp()
    fireEvent.click(screen.getByRole('tab', { name: /account setup/i }))

    // The only textbox on a blank slate is the "Your name" field on Personal — no
    // accounts or pensions yet.
    expect(screen.queryAllByRole('textbox')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /add account/i }))
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    expect(screen.getByDisplayValue('New account')).toBeInTheDocument()
  })

  it('adding a pension defaults to a fixed-amount type, not FERS', async () => {
    await renderApp()
    fireEvent.click(screen.getByRole('tab', { name: /account setup/i }))
    fireEvent.click(screen.getByRole('button', { name: /add pension/i }))
    expect(screen.getByDisplayValue('New pension')).toBeInTheDocument()

    const pensionsSection = screen.getByRole('heading', { name: /pensions & annuities/i }).closest('section')!
    expect(within(pensionsSection).getByLabelText(/monthly benefit/i)).toBeInTheDocument()
  })

  it('switches to the Report tab, showing the printable layout with no Explore panel', async () => {
    await renderApp()
    fireEvent.click(screen.getByRole('tab', { name: /^report$/i }))

    expect(screen.getByRole('heading', { name: /retirement plan/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /total portfolio/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /year-by-year detail/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /explore/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^print$/i })).toBeInTheDocument()
  })

  it('sliding retirement age in Explore updates the results table live', async () => {
    await renderApp()
    // Give it a nonzero spend so there's something for retirement age to gate.
    fireEvent.change(screen.getByRole('spinbutton', { name: /monthly spend/i }), { target: { value: '3000' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: /^retirement age$/i }), { target: { value: '40' } })

    function spendingNeedAtAge(age: number): string {
      const row = screen.getAllByRole('row').find((r) => within(r).queryByRole('cell', { name: String(age) }))
      return within(row!).getAllByRole('cell')[3].textContent!
    }

    // Age 45 is already retired (retirement age 40): full spending need.
    expect(spendingNeedAtAge(45)).toBe('$36,000')

    fireEvent.change(screen.getByRole('spinbutton', { name: /^retirement age$/i }), { target: { value: '50' } })

    // Now age 45 is still working: no spending need yet.
    expect(spendingNeedAtAge(45)).toBe('$0')
  })

  it('loads the saved plan from the server at startup', async () => {
    mockServer(serializeInputs(createDemoInputs()))
    await renderApp()
    fireEvent.click(screen.getByRole('tab', { name: /account setup/i }))

    expect(screen.getByDisplayValue('Roth IRA')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/all changes saved/i)
  })

  it('Save overwrites the server plan and clears the unsaved-changes state', async () => {
    const server = mockServer()
    await renderApp()
    const saveButton = screen.getByRole('button', { name: /^save$/i })
    expect(saveButton).toBeDisabled()

    fireEvent.click(screen.getByRole('tab', { name: /account setup/i }))
    fireEvent.click(screen.getByRole('button', { name: /add account/i }))
    expect(screen.getByRole('status')).toHaveTextContent(/unsaved changes/i)

    fireEvent.click(saveButton)

    expect(await screen.findByText(/all changes saved/i)).toBeInTheDocument()
    expect(saveButton).toBeDisabled()
    expect(server.saved()).toContain('"New account"')
  })

  it('starts blank with a warning when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await renderApp()

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't reach the server/i)
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled()
  })
})
