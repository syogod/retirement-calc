import type { FilingStatus } from './tax'
import type { PersonId, SpouseInputs } from './types'

/** The subset of `PersonalInputs` needed to resolve either person's age in a given
 * projection year — accepted structurally so callers with just these two fields
 * (e.g. `AdvanceYearInputs`) don't need a full `PersonalInputs`. */
export interface HouseholdAges {
  currentAge: number
  spouse?: SpouseInputs
}

/**
 * Builds a lookup from person id to that person's age in the same projection year as
 * `primaryAge` (the age the projection loop is actually iterating on). A spouse ages
 * in lockstep with the primary person — same number of years elapsed since the plan
 * start — just from a different starting age. Requesting the spouse's age when no
 * spouse is configured falls back to the primary's age, a harmless default since
 * nothing should be querying a spouse that doesn't exist.
 */
export function makeAgeForOwner(household: HouseholdAges, primaryAge: number): (ownerId: PersonId) => number {
  const yearsElapsed = primaryAge - household.currentAge
  return (ownerId) => (ownerId === 'spouse' && household.spouse ? household.spouse.currentAge + yearsElapsed : primaryAge)
}

/** Display name for a person id, given the household. */
export function personName(household: { name?: string; spouse?: SpouseInputs }, ownerId: PersonId): string {
  if (ownerId === 'spouse') return household.spouse?.name || 'Spouse'
  return household.name || 'You'
}

/** The subset of `PersonalInputs` needed to derive either person's birth year. */
export interface HouseholdBirthYears extends HouseholdAges {
  currentYear: number
}

/**
 * Builds a lookup from person id to that person's approximate birth year
 * (`currentYear - currentAge`), used only to determine which RMD start age (73 or
 * 75, depending on the 1959/1960 SECURE 2.0 cutoff — see `rmd.ts`) applies. This is
 * an approximation, same precision the rest of the app already uses ages at: it
 * doesn't know whether this year's birthday has passed yet, so it can be off by one
 * for someone whose birthday falls later in the year than `currentYear` implies.
 */
export function makeBirthYearForOwner(household: HouseholdBirthYears): (ownerId: PersonId) => number {
  return (ownerId) =>
    household.currentYear - (ownerId === 'spouse' && household.spouse ? household.spouse.currentAge : household.currentAge)
}

/**
 * The tax filing status assumed for a household: Married Filing Jointly if a spouse
 * is present, Single otherwise. A real simplification — this app doesn't model Head
 * of Household, Married Filing Separately, or Qualifying Surviving Spouse — but a
 * reasonable one given the two-person household model the rest of this app uses.
 */
export function filingStatusForHousehold(household: { spouse?: SpouseInputs }): FilingStatus {
  return household.spouse ? 'marriedFilingJointly' : 'single'
}
