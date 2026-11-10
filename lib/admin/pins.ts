import { sectionAt } from './geometry'
import { lowestFreeNumber } from './numbering'
import type { AdminExhibit, Section } from './types'

export type PinPatch = Pick<AdminExhibit, 'gps_lat' | 'gps_lng' | 'section' | 'number'>

/** Result of dropping pin `id` at (lng, lat). `code` is never touched. Outside every section → 'snap-back'. */
export function movePin(
  exhibits: AdminExhibit[],
  sections: Section[],
  id: string,
  lng: number,
  lat: number,
): PinPatch | 'snap-back' {
  const target = sectionAt(lng, lat, sections)
  const current = exhibits.find((e) => e.id === id)
  if (!target || !current) return 'snap-back'
  const number =
    current.section === target.id && current.number != null ? current.number : lowestFreeNumber(target.id, exhibits, id)
  return { gps_lng: lng, gps_lat: lat, section: target.id, number }
}

export interface NewExhibitForm {
  name: string
  type: string | null
  tier: string
}

/** New exhibit at the click point, or null if the point is outside every section. `id` is client-generated. */
export function newExhibit(
  exhibits: AdminExhibit[],
  sections: Section[],
  id: string,
  lng: number,
  lat: number,
  form: NewExhibitForm,
): AdminExhibit | null {
  const target = sectionAt(lng, lat, sections)
  if (!target) return null
  return {
    id,
    code: null,
    name: form.name,
    type: form.type,
    tier: form.tier,
    status: 'live',
    description: null,
    facts: [],
    gps_lat: lat,
    gps_lng: lng,
    section: target.id,
    number: lowestFreeNumber(target.id, exhibits, null),
  }
}
