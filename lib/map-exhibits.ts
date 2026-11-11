import type { CachedExhibit, MapExhibit, PreviewExhibit } from '@/lib/types'

/** Map pins and search rows from the persisted dataset; exhibits without GPS can't be placed. */
export function toMapExhibits(cached: CachedExhibit[]): MapExhibit[] {
  return cached.flatMap((e) =>
    e.gps_lat == null || e.gps_lng == null
      ? []
      : [
          {
            id: e.id,
            name: e.name,
            type: e.type,
            tier: e.tier,
            gps_lat: e.gps_lat,
            gps_lng: e.gps_lng,
            qr_code: e.status === 'active' ? e.code : null,
            languages: Object.keys(e.audio),
            status: e.exhibitStatus,
            displayId: e.displayId,
            facts: e.facts,
            tour_node_id: e.tour_node_id,
            tour_heading: e.tour_heading,
            tour_pitch: e.tour_pitch,
            tour_preview_url: e.tour_preview_url,
          },
        ]
  )
}

/** PreviewSheet shape for a cached exhibit; unlike `toMapExhibits` it doesn't need GPS. */
export function toPreviewExhibit(e: CachedExhibit): PreviewExhibit {
  return {
    id: e.id,
    name: e.name,
    type: e.type,
    tier: e.tier,
    qr_code: e.status === 'active' ? e.code : null,
    languages: Object.keys(e.audio),
    displayId: e.displayId,
    facts: e.facts,
    tour_node_id: e.tour_node_id,
    tour_heading: e.tour_heading,
    tour_pitch: e.tour_pitch,
    tour_preview_url: e.tour_preview_url,
  }
}
