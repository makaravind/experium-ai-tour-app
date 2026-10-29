import { haversineMetres } from './nearby'
import type { CachedAmenity, MapExhibit } from './types'

export function matchesQuery(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.trim().toLowerCase())
}

export function filterExhibits(
  exhibits: MapExhibit[],
  query: string,
  mustVisit = false
): MapExhibit[] {
  const q = query.trim()
  return exhibits
    .filter(
      (e) =>
        (!mustVisit || e.tier === 'gold') &&
        (matchesQuery(e.name, q) ||
          (e.displayNumber !== null && String(e.displayNumber).startsWith(q)))
    )
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function matchRange(name: string, query: string): { start: number; end: number } | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const start = name.toLowerCase().indexOf(q)
  if (start === -1) return null
  return { start, end: start + q.length }
}

export interface AmenityResult {
  amenity: CachedAmenity
  distanceM: number | null
}

/** Filters by name; sorts by distance when a fix exists, else A–Z (distanceM null). */
export function sortAmenities(
  amenities: CachedAmenity[],
  query: string,
  userPosition: { lat: number; lng: number } | null
): AmenityResult[] {
  return amenities
    .filter((a) => matchesQuery(a.name, query))
    .map((amenity) => ({
      amenity,
      distanceM: userPosition
        ? haversineMetres(userPosition, { lat: amenity.gps_lat, lng: amenity.gps_lng })
        : null,
    }))
    .sort((a, b) =>
      a.distanceM !== null && b.distanceM !== null && a.distanceM !== b.distanceM
        ? a.distanceM - b.distanceM
        : a.amenity.name.localeCompare(b.amenity.name)
    )
}
