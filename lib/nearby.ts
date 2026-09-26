const EARTH_RADIUS_M = 6371000

const PIN_TARGET_HEIGHT_M = 12
const PIN_MIN_PX = 24
const PIN_MAX_PX = 96

/** Great-circle distance between two lat/lng points, in metres. */
export function haversineMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180

  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/** Nearest exhibit ids within radius, nearest-first, capped at maxCount. Empty if the fix is too inaccurate. */
export function nearestWithin(
  position: { lat: number; lng: number; accuracyM: number },
  exhibits: Array<{ id: string; lat: number; lng: number }>,
  opts?: { radiusM?: number; maxCount?: number; maxAccuracyM?: number }
): string[] {
  const radiusM = opts?.radiusM ?? 50
  const maxCount = opts?.maxCount ?? 5
  const maxAccuracyM = opts?.maxAccuracyM ?? 60

  if (position.accuracyM > maxAccuracyM) return []

  return exhibits
    .map((e) => ({ id: e.id, distance: haversineMetres(position, e) }))
    .filter((e) => e.distance <= radiusM)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxCount)
    .map((e) => e.id)
}

/**
 * Metres per pixel at a given zoom/lat. 78271.517, not 156543.034, because Mapbox GL
 * uses 512px tiles — one Mapbox zoom level covers the ground span of a 256-tile zoom
 * level one step finer. Do not change this constant to the 256-tile value.
 */
export function metresPerPixel(zoom: number, lat: number): number {
  return (78271.517 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
}

/** On-screen pin height for a world-anchored 12 m target, clamped to 24–96 px. */
export function pinPixelHeight(zoom: number, lat: number): number {
  const px = PIN_TARGET_HEIGHT_M / metresPerPixel(zoom, lat)
  return Math.min(Math.max(px, PIN_MIN_PX), PIN_MAX_PX)
}
