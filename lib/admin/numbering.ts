import type { AdminExhibit } from './types'

/** Lowest positive integer not used in `section`, ignoring the exhibit `excludeId` (itself). */
export function lowestFreeNumber(
  section: string,
  exhibits: Pick<AdminExhibit, 'id' | 'section' | 'number'>[],
  excludeId: string | null,
): number {
  const used = new Set(
    exhibits.filter((e) => e.section === section && e.id !== excludeId && e.number != null).map((e) => e.number),
  )
  let n = 1
  while (used.has(n)) n++
  return n
}
