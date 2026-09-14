export interface StatTileProps {
  label: string
  value: string
  tone?: 'good' | 'warning' | 'critical' | 'neutral'
}

const TONE_CLASS: Record<NonNullable<StatTileProps['tone']>, string> = {
  good: 'stat-tile--good',
  warning: 'stat-tile--warning',
  critical: 'stat-tile--critical',
  neutral: '',
}

export function StatTile({ label, value, tone = 'neutral' }: StatTileProps) {
  return (
    <div className={`stat-tile ${TONE_CLASS[tone]}`}>
      <span className="stat-tile-label">{label}</span>
      <span className="stat-tile-value">{value}</span>
    </div>
  )
}
