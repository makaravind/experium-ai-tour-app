import type { AdminPhoto } from './types'

/** One exhibit's photos in display order. */
export function exhibitPhotos(photos: AdminPhoto[], exhibitId: string): AdminPhoto[] {
  return photos.filter((p) => p.exhibit_id === exhibitId).sort((a, b) => a.sort_order - b.sort_order)
}

/** Enforce the list invariants: `sort_order` = index, exactly one hero (the first flagged, else the first photo) when non-empty. */
function normalize(list: AdminPhoto[]): AdminPhoto[] {
  const heroIdx = Math.max(0, list.findIndex((p) => p.is_hero))
  return list.map((p, i) => ({ ...p, sort_order: i, is_hero: i === heroIdx }))
}

/** Append a new photo; it is the hero only if it is the first. */
export function addPhoto(list: AdminPhoto[], photo: { id: string; exhibit_id: string; url: string }): AdminPhoto[] {
  return normalize([...list, { ...photo, caption: null, is_hero: false, sort_order: list.length }])
}

export function setCaption(list: AdminPhoto[], id: string, caption: string): AdminPhoto[] {
  return list.map((p) => (p.id === id ? { ...p, caption: caption === '' ? null : caption } : p))
}

export function setHero(list: AdminPhoto[], id: string): AdminPhoto[] {
  return normalize(list.map((p) => ({ ...p, is_hero: p.id === id })))
}

/** Move the photo at `from` to index `to`. */
export function reorder(list: AdminPhoto[], from: number, to: number): AdminPhoto[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return normalize(list)
  const next = [...list]
  next.splice(to, 0, next.splice(from, 1)[0])
  return normalize(next)
}

/** Remove a photo; deleting the hero promotes the first remaining photo. */
export function removePhoto(list: AdminPhoto[], id: string): AdminPhoto[] {
  return normalize(list.filter((p) => p.id !== id))
}
