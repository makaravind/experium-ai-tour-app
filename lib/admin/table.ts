import type { AdminAmenity, AdminAudio, AdminExhibit, AdminPhoto, AdminState } from './types'

export type ChecklistKey = 'name' | 'description' | 'facts' | 'audio' | 'photos'
export const EXHIBIT_CHECKLIST: ChecklistKey[] = ['name', 'description', 'facts', 'audio', 'photos']
export const AMENITY_CHECKLIST: ChecklistKey[] = ['name', 'description']

export type TableTab = 'exhibits' | 'amenities'
export type SortDir = 'asc' | 'desc'

/** Filter/sort state of the table view; mirrored in the URL (`q`, `section`, …). Empty string = no filter. */
export interface TableParams {
  tab: TableTab
  q: string
  section: string // a letter, 'unplaced', or ''
  status: string
  type: string
  tier: string
  missing: ChecklistKey | ''
  sort: string
  dir: SortDir
}

type Params = { get(key: string): string | null }

export function parseParams(sp: Params): TableParams {
  const missing = sp.get('missing') as ChecklistKey | null
  return {
    tab: sp.get('tab') === 'amenities' ? 'amenities' : 'exhibits',
    q: sp.get('q') ?? '',
    section: sp.get('section') ?? '',
    status: sp.get('status') ?? '',
    type: sp.get('type') ?? '',
    tier: sp.get('tier') ?? '',
    missing: missing && EXHIBIT_CHECKLIST.includes(missing) ? missing : '',
    sort: sp.get('sort') ?? '',
    dir: sp.get('dir') === 'desc' ? 'desc' : 'asc',
  }
}

const filled = (s: string | null | undefined) => !!s && s.trim() !== ''

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Exhibit audio counts as filled only when both EN and HI have a URL (TE is shown separately). */
export function hasAudio(audio: AdminAudio[], exhibitId: string, language: AdminAudio['language']) {
  return audio.some((a) => a.exhibit_id === exhibitId && a.language === language && !!a.audio_url)
}

export function exhibitChecklist(
  e: AdminExhibit,
  audio: AdminAudio[],
  photos: AdminPhoto[]
): Record<ChecklistKey, boolean> {
  return {
    name: filled(e.name),
    description: filled(e.description),
    facts: e.facts.some((f) => filled(f.fact)),
    audio: hasAudio(audio, e.id, 'en') && hasAudio(audio, e.id, 'hi'),
    photos: photos.some((p) => p.exhibit_id === e.id),
  }
}

export function amenityChecklist(a: AdminAmenity): Record<ChecklistKey, boolean> {
  return {
    name: filled(a.name),
    description: filled(a.description),
    facts: false,
    audio: false,
    photos: false,
  }
}

export interface ExhibitRow {
  exhibit: AdminExhibit
  displayId: string // 'K1' or 'Unplaced'
  checklist: Record<ChecklistKey, boolean>
  done: number
  total: number
  te: boolean
  changed: boolean
}

export interface AmenityRow {
  amenity: AdminAmenity
  checklist: Record<ChecklistKey, boolean>
  done: number
  total: number
  changed: boolean
}

const count = (c: Record<ChecklistKey, boolean>, keys: ChecklistKey[]) =>
  keys.filter((k) => c[k]).length

/** Rows for the exhibits tab; `changed` = new or edited (incl. its audio/photos) versus the loaded state. */
export function exhibitRows(
  working: Pick<AdminState, 'exhibits' | 'audio' | 'photos'>,
  original: Pick<AdminState, 'exhibits' | 'audio' | 'photos'>
): ExhibitRow[] {
  const orig = new Map(original.exhibits.map((e) => [e.id, e]))
  const forExhibit = <T extends { exhibit_id: string }>(rows: T[], id: string) =>
    rows.filter((r) => r.exhibit_id === id)
  return working.exhibits.map((exhibit) => {
    const checklist = exhibitChecklist(exhibit, working.audio, working.photos)
    const o = orig.get(exhibit.id)
    return {
      exhibit,
      displayId:
        exhibit.section && exhibit.number !== null
          ? `${exhibit.section}${exhibit.number}`
          : 'Unplaced',
      checklist,
      done: count(checklist, EXHIBIT_CHECKLIST),
      total: EXHIBIT_CHECKLIST.length,
      te: hasAudio(working.audio, exhibit.id, 'te'),
      changed:
        !o ||
        !same(o, exhibit) ||
        !same(forExhibit(original.audio, exhibit.id), forExhibit(working.audio, exhibit.id)) ||
        !same(forExhibit(original.photos, exhibit.id), forExhibit(working.photos, exhibit.id)),
    }
  })
}

export function amenityRows(
  working: Pick<AdminState, 'amenities'>,
  original: Pick<AdminState, 'amenities'>
): AmenityRow[] {
  const orig = new Map(original.amenities.map((a) => [a.id, a]))
  return working.amenities.map((amenity) => {
    const checklist = amenityChecklist(amenity)
    return {
      amenity,
      checklist,
      done: count(checklist, AMENITY_CHECKLIST),
      total: AMENITY_CHECKLIST.length,
      changed: !same(orig.get(amenity.id), amenity),
    }
  })
}

const includes = (hay: string | null | undefined, needle: string) =>
  (hay ?? '').toLowerCase().includes(needle)

const matchesSection = (section: string | null, filter: string) =>
  !filter || (filter === 'unplaced' ? section === null : section === filter)

export function filterExhibitRows(rows: ExhibitRow[], p: TableParams): ExhibitRow[] {
  const q = p.q.trim().toLowerCase()
  return rows.filter(
    ({ exhibit: e, displayId, checklist }) =>
      (!q || includes(e.name, q) || includes(displayId, q) || String(e.code ?? '') === q) &&
      matchesSection(e.section, p.section) &&
      (!p.status || e.status === p.status) &&
      (!p.type || e.type === p.type) &&
      (!p.tier || e.tier === p.tier) &&
      (!p.missing || !checklist[p.missing])
  )
}

export function filterAmenityRows(rows: AmenityRow[], p: TableParams): AmenityRow[] {
  const q = p.q.trim().toLowerCase()
  const missing = p.missing && AMENITY_CHECKLIST.includes(p.missing) ? p.missing : '' // facts/audio/photos don't apply
  return rows.filter(
    ({ amenity: a, checklist }) =>
      (!q || includes(a.name, q)) &&
      matchesSection(a.section, p.section) &&
      (!p.type || a.type === p.type) &&
      (!missing || !checklist[missing])
  )
}

export const EXHIBIT_SORT_KEYS = [
  'id',
  'code',
  'name',
  'section',
  'type',
  'tier',
  'status',
  'checklist',
] as const
export const AMENITY_SORT_KEYS = ['name', 'type', 'section', 'checklist'] as const

const cmp = (a: string | number, b: string | number) => (a < b ? -1 : a > b ? 1 : 0)
// unplaced (null) sorts after every letter
const sectionKey = (s: string | null) => s ?? '￿'

export function sortExhibitRows(rows: ExhibitRow[], p: TableParams): ExhibitRow[] {
  const key = (EXHIBIT_SORT_KEYS as readonly string[]).includes(p.sort) ? p.sort : 'id'
  const dir = p.dir === 'desc' ? -1 : 1
  const by = ({ exhibit: e, done }: ExhibitRow): string | number => {
    switch (key) {
      case 'code':
        return e.code ?? Number.MAX_SAFE_INTEGER
      case 'name':
        return e.name.toLowerCase()
      case 'section':
        return sectionKey(e.section)
      case 'type':
        return e.type ?? ''
      case 'tier':
        return e.tier
      case 'status':
        return e.status
      case 'checklist':
        return done
      default:
        return sectionKey(e.section)
    }
  }
  // 'id' (default) and 'section' tie-break on number, then name
  return [...rows].sort(
    (a, b) =>
      dir * cmp(by(a), by(b)) ||
      cmp(
        a.exhibit.number ?? Number.MAX_SAFE_INTEGER,
        b.exhibit.number ?? Number.MAX_SAFE_INTEGER
      ) ||
      cmp(a.exhibit.name.toLowerCase(), b.exhibit.name.toLowerCase())
  )
}

export function sortAmenityRows(rows: AmenityRow[], p: TableParams): AmenityRow[] {
  const key = (AMENITY_SORT_KEYS as readonly string[]).includes(p.sort) ? p.sort : 'section'
  const dir = p.dir === 'desc' ? -1 : 1
  const by = ({ amenity: a, done }: AmenityRow): string | number => {
    switch (key) {
      case 'name':
        return a.name.toLowerCase()
      case 'type':
        return a.type
      case 'checklist':
        return done
      default:
        return sectionKey(a.section)
    }
  }
  return [...rows].sort(
    (a, b) =>
      dir * cmp(by(a), by(b)) || cmp(a.amenity.name.toLowerCase(), b.amenity.name.toLowerCase())
  )
}
