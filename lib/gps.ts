export type LatLng = { lat: number; lng: number }

const PERMISSION_DENIED = 1

export function classifyGeoError(code: number): 'denied' | 'unavailable' {
  return code === PERMISSION_DENIED ? 'denied' : 'unavailable'
}

export function lerpPosition(from: LatLng, to: LatLng, t: number): LatLng {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  }
}
