import { pointInPolygon, sectionAt } from './geometry'
import { lowestFreeNumber } from './numbering'
import type { AdminAmenity, AdminExhibit, LngLat, Section } from './types'

/** One pin that changes section because of a polygon edit. `from`/`to` are display IDs (exhibits) or letters (amenities). */
export interface RegroupMove {
  kind: 'exhibit' | 'amenity'
  id: string
  name: string
  from: string
  to: string
}

export type RegroupPlan =
  | { ok: false; stranded: string[] }
  | { ok: true; moves: RegroupMove[]; exhibits: AdminExhibit[]; amenities: AdminAmenity[] }

// spreadsheet-letter order: A < B < … < Z < AA
const cmpLetters = (a: string, b: string) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)
const cmpNullLast = (a: number | null, b: number | null) =>
  a === b ? 0 : a == null ? 1 : b == null ? -1 : a - b

/**
 * Effect of replacing section `editedId`'s polygon with `polygon`. On overlap the edited section wins, so every pin
 * inside the new polygon joins it; pins that were inside the old polygon but are no longer go to the section that
 * contains them now. Pins that were already outside their section before the edit are left alone. If a pin would end
 * up in no section the edit is rejected (`stranded` = their names).
 * Moved exhibits take the lowest free number in the target, in old display-ID order (`code` as tiebreak); amenities
 * only change `section`. `exhibits`/`amenities` are returned as-is when nothing moves.
 */
export function planRegroup(
  editedId: string,
  polygon: LngLat[],
  sections: Section[],
  exhibits: AdminExhibit[],
  amenities: AdminAmenity[]
): RegroupPlan {
  const old = sections.find((s) => s.id === editedId)?.polygon
  const others = sections.filter((s) => s.id !== editedId)

  /** New section for a pin: `undefined` = stays, `null` = stranded. */
  const retarget = (
    lng: number,
    lat: number,
    current: string | null
  ): string | null | undefined => {
    if (pointInPolygon(lng, lat, polygon)) return current === editedId ? undefined : editedId
    if (current !== editedId || !old || !pointInPolygon(lng, lat, old)) return undefined
    return sectionAt(lng, lat, others)?.id ?? null
  }

  const stranded: string[] = []
  const exMovers: { e: AdminExhibit; to: string }[] = []
  for (const e of exhibits) {
    if (e.gps_lng == null || e.gps_lat == null) continue
    const to = retarget(e.gps_lng, e.gps_lat, e.section)
    if (to === null) stranded.push(e.name)
    else if (to !== undefined) exMovers.push({ e, to })
  }
  const amMovers: { a: AdminAmenity; to: string }[] = []
  for (const a of amenities) {
    const to = retarget(a.gps_lng, a.gps_lat, a.section)
    if (to === null) stranded.push(a.name)
    else if (to !== undefined) amMovers.push({ a, to })
  }
  if (stranded.length) return { ok: false, stranded }
  if (!exMovers.length && !amMovers.length) return { ok: true, moves: [], exhibits, amenities }

  // numbering sees the movers as unplaced so numbers they free up (in the edited section) can be reused
  const moving = new Set(exMovers.map((m) => m.e.id))
  const base = exhibits.map((e) => (moving.has(e.id) ? { ...e, section: null, number: null } : e))
  const sorted = [...exMovers].sort(
    (x, y) =>
      (x.e.section == null
        ? y.e.section == null
          ? 0
          : 1
        : y.e.section == null
          ? -1
          : cmpLetters(x.e.section, y.e.section)) ||
      cmpNullLast(x.e.number, y.e.number) ||
      cmpNullLast(x.e.code, y.e.code)
  )
  const placed = new Map<string, AdminExhibit>()
  const moves: RegroupMove[] = []
  for (const { e, to } of sorted) {
    const current = base.map((x) => placed.get(x.id) ?? x)
    const next = { ...e, section: to, number: lowestFreeNumber(to, current, e.id) }
    placed.set(e.id, next)
    moves.push({
      kind: 'exhibit',
      id: e.id,
      name: e.name,
      from: e.section && e.number != null ? `${e.section}${e.number}` : '—',
      to: `${to}${next.number}`,
    })
  }
  const amPlaced = new Map(amMovers.map(({ a, to }) => [a.id, { ...a, section: to }]))
  for (const { a, to } of amMovers)
    moves.push({ kind: 'amenity', id: a.id, name: a.name, from: a.section ?? '—', to })

  return {
    ok: true,
    moves,
    exhibits: exhibits.map((e) => placed.get(e.id) ?? e),
    amenities: amenities.map((a) => amPlaced.get(a.id) ?? a),
  }
}

/** Polygon with `point` inserted between vertex `after` and the next one. */
export function insertVertex(polygon: LngLat[], after: number, point: LngLat): LngLat[] {
  return [...polygon.slice(0, after + 1), point, ...polygon.slice(after + 1)]
}

/** Polygon without vertex `index`, or null if that would leave fewer than 3 vertices. */
export function removeVertex(polygon: LngLat[], index: number): LngLat[] | null {
  return polygon.length <= 3 ? null : polygon.filter((_, i) => i !== index)
}
