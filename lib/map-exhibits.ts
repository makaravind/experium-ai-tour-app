import type { CachedExhibit, MapExhibit } from '@/lib/types'

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
          },
        ]
  )
}
