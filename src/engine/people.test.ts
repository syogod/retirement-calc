// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { filingStatusForHousehold, makeAgeForOwner, makeBirthYearForOwner, personName } from './people'

describe('makeAgeForOwner', () => {
  it("resolves the primary person's age directly", () => {
    const ageForOwner = makeAgeForOwner({ currentAge: 45 }, 50)
    expect(ageForOwner('primary')).toBe(50)
  })

  it("ages the spouse in lockstep from their own starting age, not the primary's", () => {
    // 5 years have elapsed since plan start (primary: 45 -> 50); spouse started at 43.
    const ageForOwner = makeAgeForOwner({ currentAge: 45, spouse: { name: 'Jordan', currentAge: 43 } }, 50)
    expect(ageForOwner('spouse')).toBe(48)
  })

  it('falls back to the primary age when a spouse is requested but none is configured', () => {
    const ageForOwner = makeAgeForOwner({ currentAge: 45 }, 50)
    expect(ageForOwner('spouse')).toBe(50)
  })
})

describe('makeBirthYearForOwner', () => {
  it("derives the primary person's birth year from current age and year", () => {
    const birthYearForOwner = makeBirthYearForOwner({ currentAge: 45, currentYear: 2026 })
    expect(birthYearForOwner('primary')).toBe(1981)
  })

  it("derives the spouse's birth year from their own current age, not the primary's", () => {
    const birthYearForOwner = makeBirthYearForOwner({
      currentAge: 45,
      currentYear: 2026,
      spouse: { name: 'Jordan', currentAge: 43 },
    })
    expect(birthYearForOwner('spouse')).toBe(1983)
  })

  it('falls back to the primary birth year when a spouse is requested but none is configured', () => {
    const birthYearForOwner = makeBirthYearForOwner({ currentAge: 45, currentYear: 2026 })
    expect(birthYearForOwner('spouse')).toBe(1981)
  })
})

describe('filingStatusForHousehold', () => {
  it('is single with no spouse', () => {
    expect(filingStatusForHousehold({})).toBe('single')
  })

  it('is married filing jointly once a spouse is present', () => {
    expect(filingStatusForHousehold({ spouse: { name: 'Jordan', currentAge: 40 } })).toBe('marriedFilingJointly')
  })
})

describe('personName', () => {
  it('defaults to "You" and "Spouse" when no names are given', () => {
    expect(personName({}, 'primary')).toBe('You')
    expect(personName({ spouse: { name: '', currentAge: 40 } }, 'spouse')).toBe('Spouse')
  })

  it('uses the configured names when present', () => {
    const household = { name: 'Alex', spouse: { name: 'Jordan', currentAge: 40 } }
    expect(personName(household, 'primary')).toBe('Alex')
    expect(personName(household, 'spouse')).toBe('Jordan')
  })
})
