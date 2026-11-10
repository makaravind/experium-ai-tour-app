import type { Fact } from '@/lib/types'
import type { AdminAmenity, AdminExhibit } from './types'

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string }

/** Parse the facts editor text: a JSON array of `{ "fact": string }` with non-empty strings. */
export function parseFacts(text: string): Validated<Fact[]> {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` }
  }
  if (!Array.isArray(data)) return { ok: false, error: 'Must be a JSON array' }
  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return { ok: false, error: `Item ${i}: must be an object like {"fact": "..."}` }
    }
    const fact = (item as { fact?: unknown }).fact
    if (typeof fact !== 'string' || fact.trim() === '') {
      return { ok: false, error: `Item ${i}: "fact" must be a non-empty string` }
    }
  }
  return { ok: true, value: data.map((item) => ({ fact: (item as Fact).fact })) }
}

/** Parse the number field (positive integer) and reject a number already used by another exhibit in the same section. */
export function validateNumber(
  text: string,
  exhibit: Pick<AdminExhibit, 'id' | 'section'>,
  exhibits: Pick<AdminExhibit, 'id' | 'section' | 'number'>[],
): Validated<number> {
  const t = text.trim()
  if (!/^\d+$/.test(t) || Number(t) < 1) return { ok: false, error: 'Must be a positive whole number' }
  const n = Number(t)
  const clash = exhibits.some((e) => e.id !== exhibit.id && e.section === exhibit.section && e.number === n)
  if (clash) return { ok: false, error: `Number ${n} is already used in section ${exhibit.section}` }
  return { ok: true, value: n }
}

/** Save blocker: null if every exhibit is placed (section + number), else a message naming the unplaced ones. */
export function unplacedMessage(exhibits: Pick<AdminExhibit, 'name' | 'section' | 'number'>[]): string | null {
  const unplaced = exhibits.filter((e) => e.section === null || e.number === null)
  if (!unplaced.length) return null
  const names = unplaced.map((e) => e.name || 'Untitled exhibit').join(', ')
  return `${unplaced.length} unplaced exhibit(s): fix before saving (${names})`
}

/** Save blocker: null if every amenity is in a section, else a message naming the unplaced ones. */
export function unplacedAmenityMessage(amenities: Pick<AdminAmenity, 'name' | 'section'>[]): string | null {
  const unplaced = amenities.filter((a) => a.section === null)
  if (!unplaced.length) return null
  const names = unplaced.map((a) => a.name || 'Untitled amenity').join(', ')
  return `${unplaced.length} unplaced ${unplaced.length === 1 ? 'amenity' : 'amenities'}: fix before saving (${names})`
}
