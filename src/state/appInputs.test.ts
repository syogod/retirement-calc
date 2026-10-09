// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBlankAccount, makeId } from './appInputs'

describe('makeId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('still produces unique ids when randomUUID is unavailable (plain-HTTP LAN access)', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })

    const ids = new Set(Array.from({ length: 100 }, () => makeId()))

    expect(ids.size).toBe(100)
    expect(createBlankAccount().id).toMatch(/^[0-9a-f]{32}$/)
  })
})
