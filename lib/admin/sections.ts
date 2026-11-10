import { pointInPolygon, sectionAt } from './geometry'
import { lowestFreeNumber } from './numbering'
import type { AdminExhibit, LngLat, WorkingSection } from './types'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Spreadsheet-style letter for index 0,1,… → A…Z, AA, AB… */
function letterAt(i: number): string {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = LETTERS[(n - 1) % 26] + s
  return s
}

/** First letter id (A, B, … Z, AA …) not used by any section. */
export function nextFreeLetter(sections: Pick<WorkingSection, 'id'>[]): string {
  const used = new Set(sections.map((s) => s.id))
  let i = 0
  while (used.has(letterAt(i))) i++
  return letterAt(i)
}

/**
 * Normalizes user input to an upper-case letter id; `error` is set when it is invalid or taken by another section.
 * admin_apply_changes forbids rename swaps/cycles, so a letter that another section still holds in the DB
 * (its `originalId`) is blocked too: free it with a spare letter, Save, then rename. The same goes for the letter
 * of a section deleted this session (`deletedIds`): renames are applied before deletes.
 */
export function validateLetter(
  input: string,
  sections: Pick<WorkingSection, 'id' | 'originalId'>[],
  selfId: string | null,
  deletedIds: string[] = [],
): { id: string; error: string | null } {
  const id = input.trim().toUpperCase()
  if (!/^[A-Z]+$/.test(id)) return { id, error: 'Letters A–Z only' }
  const others = sections.filter((s) => s.id !== selfId)
  if (others.some((s) => s.id === id)) return { id, error: `Section ${id} already exists` }
  if (others.some((s) => s.originalId === id) || deletedIds.includes(id)) {
    return { id, error: `${id} is still the saved letter of another section; Save first, then rename` }
  }
  return { id, error: null }
}

/** Exhibits of `sectionId` whose pin would fall outside `polygon`. */
export function strandedExhibits<T extends Pick<AdminExhibit, 'section' | 'gps_lat' | 'gps_lng'>>(
  exhibits: T[],
  sectionId: string,
  polygon: LngLat[],
) {
  return exhibits.filter(
    (e) =>
      e.section === sectionId &&
      e.gps_lat != null &&
      e.gps_lng != null &&
      !pointInPolygon(e.gps_lng, e.gps_lat, polygon),
  )
}

/** Sections with `fromId` renamed to `toId` (keeps `originalId`). */
export function renameSection(sections: WorkingSection[], fromId: string, toId: string): WorkingSection[] {
  return sections.map((s) => (s.id === fromId ? { ...s, id: toId } : s))
}

/** Exhibits re-pointed from `fromId` to `toId`. */
export function renameExhibitsSection(exhibits: AdminExhibit[], fromId: string, toId: string): AdminExhibit[] {
  return exhibits.map((e) => (e.section === fromId ? { ...e, section: toId } : e))
}

/** Polygon centroid (vertex average, as in the marker-placer) for label placement. */
export function centroid(polygon: LngLat[]): LngLat {
  const [x, y] = polygon.reduce<LngLat>(([ax, ay], [lng, lat]) => [ax + lng, ay + lat], [0, 0])
  return [x / polygon.length, y / polygon.length]
}

/**
 * Places unplaced exhibits (section null) that lie inside the new section `sectionId` (first polygon wins on
 * overlap), numbering them in `code` order from the lowest free numbers. Returns `exhibits` itself if none.
 */
export function assignUnplaced(exhibits: AdminExhibit[], sectionId: string, sections: WorkingSection[]): AdminExhibit[] {
  const targets = exhibits
    .filter(
      (e) =>
        e.section == null &&
        e.gps_lat != null &&
        e.gps_lng != null &&
        sectionAt(e.gps_lng, e.gps_lat, sections)?.id === sectionId,
    )
    .sort((a, b) => (a.code ?? Infinity) - (b.code ?? Infinity))
  if (targets.length === 0) return exhibits
  const placed = new Map<string, AdminExhibit>()
  for (const t of targets) {
    const current = exhibits.map((e) => placed.get(e.id) ?? e)
    placed.set(t.id, { ...t, section: sectionId, number: lowestFreeNumber(sectionId, current, t.id) })
  }
  return exhibits.map((e) => placed.get(e.id) ?? e)
}
