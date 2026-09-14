import type { AppInputs } from './appInputs'

const REQUIRED_KEYS: (keyof AppInputs)[] = [
  'personal',
  'growth',
  'accounts',
  'spending',
  'pensions',
  'socialSecurity',
  'numSimulations',
]

export class InvalidImportError extends Error {}

export function serializeInputs(inputs: AppInputs): string {
  return JSON.stringify(inputs, null, 2)
}

/** Parses and lightly validates an exported plan: valid JSON, an object, with every
 * top-level field this app expects. Doesn't deep-validate every field — the engine
 * already tolerates missing optional fields (e.g. mortgage-specific ones) with
 * sensible defaults. */
export function deserializeInputs(json: string): AppInputs {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new InvalidImportError('That file is not valid JSON.')
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new InvalidImportError("That file doesn't contain a retirement plan.")
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in (parsed as Record<string, unknown>))) {
      throw new InvalidImportError(`That file is missing "${key}" — it doesn't look like a retirement plan export.`)
    }
  }

  return migrateLegacyShapes(parsed as Record<string, unknown>) as unknown as AppInputs
}

/**
 * Upgrades fields from older export formats in place, so a plan file saved before a
 * later change can still be loaded.
 * - `socialSecurity` used to be a single object (one household-wide benefit) before
 *   Social Security became a per-person list — an old file's single object becomes a
 *   one-entry array owned by the primary person.
 * - `taxes` didn't exist before the tax engine was added — an old file without it
 *   gets a default 0% state rate (not a required key, so old files don't need
 *   regenerating just to keep loading).
 * - `rmdSurplus` didn't exist before RMD-surplus routing was added — an old file
 *   without it defaults to "spend" (no account reference to validate, so it's
 *   always a safe default regardless of what accounts the file has).
 * - `oneTimeEvents` didn't exist before one-time events were added — an old file
 *   without it defaults to an empty list.
 * - `guardrails` didn't exist before the dynamic withdrawal strategy was added —
 *   an old file without it defaults to "fixed" (today's behavior, unchanged).
 */
function migrateLegacyShapes(parsed: Record<string, unknown>): Record<string, unknown> {
  if (parsed.socialSecurity && !Array.isArray(parsed.socialSecurity)) {
    parsed.socialSecurity = [{ ownerId: 'primary', ...(parsed.socialSecurity as object) }]
  }
  if (!('taxes' in parsed)) {
    parsed.taxes = { stateRate: 0 }
  }
  if (!('rmdSurplus' in parsed)) {
    parsed.rmdSurplus = { strategy: 'spend' }
  }
  if (!('oneTimeEvents' in parsed)) {
    parsed.oneTimeEvents = []
  }
  if (!('guardrails' in parsed)) {
    parsed.guardrails = { strategy: 'fixed', upperGuardrailPct: 0.2, cutPct: 0.1, lowerGuardrailPct: 0.2, raisePct: 0.1 }
  }
  return parsed
}
