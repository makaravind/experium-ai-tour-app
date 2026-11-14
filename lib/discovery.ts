import { haversineMetres } from '@/lib/nearby'

export type DiscoveryVia = 'onsite_scan' | 'audio_complete' | 'audio_half_near'

export type Ctx = {
  scanSrc: string | null // only set for QR scans; map plays pass null
  quartile: number | null
  position: { lat: number; lng: number; accuracyM: number } | null
  exhibit: { lat: number | null; lng: number | null }
}

/** Stricter than nearestWithin's 60 m: this grants credit, not just a map highlight. */
export const MAX_ACCURACY_M = 40
const NEAR_RADIUS_M = 50

/** First matching rule wins. Position only gates audio_half_near. */
export function discoverVia(ctx: Ctx): DiscoveryVia | null {
  if (ctx.scanSrc === 'onsite') return 'onsite_scan'
  if (typeof ctx.quartile === 'number' && ctx.quartile >= 100) return 'audio_complete'

  const { quartile, position, exhibit } = ctx
  if (
    typeof quartile === 'number' &&
    quartile >= 50 &&
    position &&
    position.accuracyM <= MAX_ACCURACY_M &&
    exhibit.lat !== null &&
    exhibit.lng !== null &&
    haversineMetres(position, { lat: exhibit.lat, lng: exhibit.lng }) <= NEAR_RADIUS_M
  ) {
    return 'audio_half_near'
  }
  return null
}
