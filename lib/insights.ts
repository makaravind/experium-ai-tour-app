export type InsightsRange = 'today' | '7d' | 'all'

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Lower bound (ISO) for an insights range; null = no bound. "Today" starts at IST midnight. */
export function sinceFor(range: InsightsRange, now = new Date()): string | null {
  if (range === 'all') return null
  if (range === '7d') return new Date(now.getTime() - 7 * DAY_MS).toISOString()
  // IST has no DST: shift to IST wall-clock, floor to the day, shift back.
  const istMs = now.getTime() + IST_OFFSET_MS
  return new Date(istMs - (istMs % DAY_MS) - IST_OFFSET_MS).toISOString()
}
