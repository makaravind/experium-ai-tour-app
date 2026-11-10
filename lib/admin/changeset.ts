import type {
  AdminAudio, AdminExhibit, AdminPhoto, AdminState, AudioChange, Changeset, ExhibitChange, PhotoUpdate, WorkingState,
} from './types'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Keys of `w` whose value differs from `o`, with `w`'s values. */
const changed = <T extends object, K extends keyof T>(o: T, w: T, keys: K[]) =>
  Object.fromEntries(keys.filter((k) => !same(o[k], w[k])).map((k) => [k, w[k]])) as Partial<Pick<T, K>>

const EDIT_FIELDS = ['name', 'type', 'status', 'description', 'facts'] as const satisfies readonly (keyof AdminExhibit)[]
const AUDIO_FIELDS = ['script', 'status'] as const satisfies readonly (keyof AdminAudio)[]
const PHOTO_FIELDS = ['url', 'caption', 'is_hero', 'sort_order'] as const satisfies readonly (keyof AdminPhoto)[]

/** Diff original vs working state into the save payload plus a human summary ('' when nothing changed). */
export function buildChangeset(
  original: AdminState,
  working: WorkingState,
): { changeset: Changeset; summary: string; isEmpty: boolean } {
  const cs: Changeset = {
    sections: { rename: [], upsert: [], delete: [] },
    exhibits: [],
    audio: [],
    photos: { insert: [], update: [], delete: [] },
  }
  const n = { sectionAdded: 0, sectionRenamed: 0, sectionReshaped: 0, sectionDeleted: 0,
    exhibitAdded: 0, moved: 0, tier: 0, renumbered: 0, edited: 0,
    audio: 0, photoAdded: 0, photoChanged: 0, photoRemoved: 0 }

  // sections
  const origSections = new Map(original.sections.map((s) => [s.id, s]))
  const renamed = new Map<string, string>() // original id → new id
  const keptOriginalIds = new Set<string>()
  for (const s of working.sections) {
    const orig = s.originalId == null ? undefined : origSections.get(s.originalId)
    if (!orig) {
      cs.sections.upsert.push({ id: s.id, polygon: s.polygon })
      n.sectionAdded++
      continue
    }
    keptOriginalIds.add(orig.id)
    if (orig.id !== s.id) {
      renamed.set(orig.id, s.id)
      cs.sections.rename.push({ from: orig.id, to: s.id })
      n.sectionRenamed++
    }
    if (!same(orig.polygon, s.polygon)) {
      cs.sections.upsert.push({ id: s.id, polygon: s.polygon })
      n.sectionReshaped++
    }
  }
  // a deleted letter that was re-drawn is covered by the upsert above
  const finalIds = new Set(working.sections.map((s) => s.id))
  for (const s of original.sections) {
    if (!keptOriginalIds.has(s.id) && !finalIds.has(s.id)) {
      cs.sections.delete.push(s.id)
      n.sectionDeleted++
    }
  }

  // exhibits
  const origExhibits = new Map(original.exhibits.map((e) => [e.id, e]))
  for (const e of working.exhibits) {
    const o = origExhibits.get(e.id)
    if (!o) {
      const row: Partial<AdminExhibit> = { ...e }
      delete row.code // assigned server-side
      cs.exhibits.push(row as ExhibitChange)
      n.exhibitAdded++
      continue
    }
    // a section rename alone is not an exhibit change (ON UPDATE CASCADE)
    const oSection = o.section == null ? null : (renamed.get(o.section) ?? o.section)
    const sectionChanged = oSection !== e.section
    const gpsChanged = o.gps_lat !== e.gps_lat || o.gps_lng !== e.gps_lng
    const renumbered = !sectionChanged && o.number !== e.number
    const edit = changed(o, e, [...EDIT_FIELDS])
    const tier = o.tier !== e.tier
    const hasEdit = Object.keys(edit).length > 0
    if (!(sectionChanged || gpsChanged || renumbered || tier || hasEdit)) continue

    const patch: ExhibitChange = { id: e.id, ...edit, ...changed(o, e, ['tier', 'gps_lat', 'gps_lng']) }
    if (sectionChanged || renumbered) {
      patch.number = e.number
      if (sectionChanged) patch.section = e.section
    }
    cs.exhibits.push(patch)
    if (sectionChanged || gpsChanged) n.moved++
    if (renumbered) n.renumbered++
    if (tier) n.tier++
    if (hasEdit) n.edited++
  }

  // audio
  const origAudio = new Map(original.audio.map((a) => [`${a.exhibit_id}:${a.language}`, a]))
  for (const a of working.audio) {
    const o = origAudio.get(`${a.exhibit_id}:${a.language}`)
    const row: AudioChange = { exhibit_id: a.exhibit_id, language: a.language }
    if (!o) {
      Object.assign(row, { script: a.script, status: a.status, url: a.audio_url })
    } else {
      const patch = changed(o, a, [...AUDIO_FIELDS])
      if (!same(o.audio_url, a.audio_url)) row.url = a.audio_url
      Object.assign(row, patch)
      if (Object.keys(row).length === 2) continue
    }
    cs.audio.push(row)
    n.audio++
  }

  // photos
  const origPhotos = new Map(original.photos.map((p) => [p.id, p]))
  const workingPhotoIds = new Set(working.photos.map((p) => p.id))
  for (const p of working.photos) {
    const o = origPhotos.get(p.id)
    if (!o) {
      cs.photos.insert.push(p)
      n.photoAdded++
      continue
    }
    const patch = changed(o, p, [...PHOTO_FIELDS])
    if (Object.keys(patch).length === 0) continue
    cs.photos.update.push({ id: p.id, ...patch } satisfies PhotoUpdate)
    n.photoChanged++
  }
  for (const p of original.photos) {
    if (!workingPhotoIds.has(p.id)) {
      cs.photos.delete.push(p.id)
      n.photoRemoved++
    }
  }

  const noun = (c: number, one: string, many: string) => `${c} ${c === 1 ? one : many}`
  const parts: [number, string][] = [
    [n.exhibitAdded, noun(n.exhibitAdded, 'exhibit added', 'exhibits added')],
    [n.moved, `${n.moved} moved`],
    [n.renumbered, `${n.renumbered} renumbered`],
    [n.tier, `${n.tier} tier changed`],
    [n.edited, `${n.edited} edited`],
    [n.sectionAdded, noun(n.sectionAdded, 'section added', 'sections added')],
    [n.sectionRenamed, noun(n.sectionRenamed, 'section renamed', 'sections renamed')],
    [n.sectionReshaped, noun(n.sectionReshaped, 'section reshaped', 'sections reshaped')],
    [n.sectionDeleted, noun(n.sectionDeleted, 'section deleted', 'sections deleted')],
    [n.audio, `${n.audio} audio changed`],
    [n.photoAdded, noun(n.photoAdded, 'photo added', 'photos added')],
    [n.photoChanged, noun(n.photoChanged, 'photo changed', 'photos changed')],
    [n.photoRemoved, noun(n.photoRemoved, 'photo removed', 'photos removed')],
  ]
  const summary = parts.filter(([c]) => c > 0).map(([, s]) => s).join(', ')

  return { changeset: cs, summary, isEmpty: summary === '' }
}
