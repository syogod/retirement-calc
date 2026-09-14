/** Fixed categorical order — never cycled, never reassigned by rank. Past 8 series,
 * fold the tail into "Other" rather than generating a 9th hue (see the dataviz skill). */
export const CATEGORICAL_COLORS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
  'var(--series-7)',
  'var(--series-8)',
]

export const MAX_CATEGORICAL_SERIES = CATEGORICAL_COLORS.length

/** Assigns a fixed-order categorical color to each item, folding anything past the
 * token ceiling into a shared "Other" bucket. */
export function assignSeriesColors<T>(
  items: T[],
  getKey: (item: T) => string,
): { key: string; color: string; items: T[] }[] {
  if (items.length <= MAX_CATEGORICAL_SERIES) {
    return items.map((item, i) => ({ key: getKey(item), color: CATEGORICAL_COLORS[i], items: [item] }))
  }
  const kept = items.slice(0, MAX_CATEGORICAL_SERIES - 1)
  const rest = items.slice(MAX_CATEGORICAL_SERIES - 1)
  return [
    ...kept.map((item, i) => ({ key: getKey(item), color: CATEGORICAL_COLORS[i], items: [item] })),
    { key: 'other', color: CATEGORICAL_COLORS[MAX_CATEGORICAL_SERIES - 1], items: rest },
  ]
}
