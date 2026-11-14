import { track } from '@vercel/analytics'
import { DEFAULT_CAMPAIGN_ID, useStore } from '@/lib/store'
import { useMapStore } from '@/lib/map-store'
import { enqueueScan } from '@/lib/scan-queue'

type Position = { lat: number; lng: number; accuracyM: number }

/** Only POSTs at quartile >= 50 can match audio_half_near, so only those carry location. */
export function positionFields(quartile: number, position: Position | null) {
  if (!position || quartile < 50) return {}
  return { lat: position.lat, lng: position.lng, accuracyM: position.accuracyM }
}

/**
 * First-play (no `progress`) and quartile reporting for one exhibit, shared by the exhibit page
 * and the preview sheet. On a quartile it also runs the local discovery evaluation, publishing a
 * new discovery as pendingDiscovery for handleAudioEnded to celebrate once the audio ends.
 */
export function reportPlayback(
  exhibit: { id: string; qrCode: string },
  scanSrc: string | null,
  progress?: { sec: number; quartile: number }
): void {
  const { language, cachedExhibits, discoveredByCampaign, markVisited, setListenedCurrentExhibit } =
    useStore.getState()
  const scan_src = scanSrc ? { scan_src: scanSrc } : {}

  if (!progress) {
    setListenedCurrentExhibit(true)
    track('playback_start', { exhibit: exhibit.qrCode })
    enqueueScan(exhibit.qrCode, { listened: true, ...scan_src, language })
    markVisited(exhibit.id)
    return
  }

  const { sec, quartile } = progress
  const position = useMapStore.getState().userPosition
  track('playback_progress', { exhibit: exhibit.qrCode, quartile })
  enqueueScan(exhibit.qrCode, {
    listened: true,
    listen_duration_sec: sec,
    listen_quartile: quartile,
    ...scan_src,
    ...positionFields(quartile, position),
    language,
  })

  if (discoveredByCampaign[DEFAULT_CAMPAIGN_ID]?.codes.includes(exhibit.qrCode)) return
  const gps = cachedExhibits.find((e) => e.id === exhibit.id)
  const result = useStore.getState().discoverCode(exhibit.qrCode, {
    scanSrc: null,
    quartile,
    position,
    exhibit: { lat: gps?.gps_lat ?? null, lng: gps?.gps_lng ?? null },
  })
  if (result) useMapStore.getState().setPendingDiscovery({ exhibitId: exhibit.id, ...result })
}
