import { NumberField } from './NumberField'
import { PercentField } from './PercentField'
import { personName } from '../engine/people'
import type { SocialSecurityInputs } from '../engine/socialSecurity'
import type { PersonalInputs, PersonId } from '../engine/types'
import { createBlankSocialSecurity } from '../state/appInputs'

export interface SocialSecuritySectionProps {
  value: SocialSecurityInputs[]
  personal: PersonalInputs
  onChange: (value: SocialSecurityInputs[]) => void
}

/** One person's Social Security benefit — its own card when a spouse is present, so
 * each person's own SSA statement numbers and claiming age stay clearly separate. */
function PersonSocialSecurity({
  ownerId,
  label,
  entry,
  onChange,
}: {
  ownerId: PersonId
  label: string
  entry: SocialSecurityInputs
  onChange: (entry: SocialSecurityInputs) => void
}) {
  return (
    <div className="social-security-person">
      <h3>{label}</h3>
      <div className="field-grid">
        <NumberField
          id={`ssAt62-${ownerId}`}
          label="Monthly benefit if claimed at 62"
          value={entry.monthlyBenefitAt62}
          onChange={(monthlyBenefitAt62) => onChange({ ...entry, monthlyBenefitAt62 })}
          prefix="$"
        />
        <NumberField
          id={`ssAt67-${ownerId}`}
          label="Monthly benefit if claimed at 67 (FRA)"
          value={entry.monthlyBenefitAt67}
          onChange={(monthlyBenefitAt67) => onChange({ ...entry, monthlyBenefitAt67 })}
          prefix="$"
        />
        <NumberField
          id={`ssAt70-${ownerId}`}
          label="Monthly benefit if claimed at 70"
          value={entry.monthlyBenefitAt70}
          onChange={(monthlyBenefitAt70) => onChange({ ...entry, monthlyBenefitAt70 })}
          prefix="$"
        />
        <PercentField
          id={`ssHaircut-${ownerId}`}
          label="Haircut for stopping work before claiming age"
          value={entry.haircut}
          onChange={(haircut) => onChange({ ...entry, haircut })}
          hint="1 = no reduction, e.g. 90% for a 10% cut"
        />
      </div>
    </div>
  )
}

export function SocialSecuritySection({ value, personal, onChange }: SocialSecuritySectionProps) {
  const hasSpouse = Boolean(personal.spouse)
  const primaryEntry = value.find((entry) => (entry.ownerId ?? 'primary') === 'primary') ?? createBlankSocialSecurity('primary')
  const spouseEntry = value.find((entry) => entry.ownerId === 'spouse') ?? createBlankSocialSecurity('spouse')

  function updateEntry(ownerId: PersonId, entry: SocialSecurityInputs) {
    const others = value.filter((e) => (e.ownerId ?? 'primary') !== ownerId)
    onChange([...others, { ...entry, ownerId }])
  }

  return (
    <section className="card">
      <h2>Social Security</h2>
      <p className="section-hint">
        From your ssa.gov statement, today's dollars. Claiming age is a "what if" knob — find it in Explore.
      </p>
      <PersonSocialSecurity
        ownerId="primary"
        label={personName(personal, 'primary')}
        entry={primaryEntry}
        onChange={(entry) => updateEntry('primary', entry)}
      />
      {hasSpouse && (
        <PersonSocialSecurity
          ownerId="spouse"
          label={personName(personal, 'spouse')}
          entry={spouseEntry}
          onChange={(entry) => updateEntry('spouse', entry)}
        />
      )}
    </section>
  )
}
