import type { LngLat, Section } from './types'

/** Ray-casting point-in-polygon. Ported from sample-map/marker-placer.html. */
export function pointInPolygon(lng: number, lat: number, poly: LngLat[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Section containing the point; on overlap the first one in the list wins. */
export function sectionAt(lng: number, lat: number, sections: Section[]): Section | null {
  return sections.find((s) => pointInPolygon(lng, lat, s.polygon)) ?? null
}
