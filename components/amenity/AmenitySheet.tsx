'use client'

import BottomSheet from '@/components/common/BottomSheet'
import SheetSummary from '@/components/common/SheetSummary'
import { AmenityTypeIcon } from '@/components/icons'
import type { Palette } from '@/components/exhibit/Gallery'
import { haversineMetres } from '@/lib/nearby'
import { useMapStore } from '@/lib/map-store'
import { useStore } from '@/lib/store'

const AMENITY_PALETTE: Palette = {
  hero: 'linear-gradient(160deg, #7ba8c0, #4a7090)',
  blank: 'linear-gradient(135deg, #5a90a8, #3d7090)',
  blankIcon: '#a9c4d6',
}

const typeLabel = (type: string) => type.charAt(0).toUpperCase() + type.slice(1)

export default function AmenitySheet({
  amenityId,
  onClose,
}: {
  amenityId: string | null
  onClose: () => void
}) {
  const amenity = useStore((s) => s.cachedAmenities.find((a) => a.id === amenityId))
  const userPosition = useMapStore((s) => s.userPosition)
  const distanceM =
    amenity && userPosition
      ? haversineMetres(userPosition, { lat: amenity.gps_lat, lng: amenity.gps_lng })
      : null

  return (
    <BottomSheet itemId={amenity?.id ?? null} onClose={onClose}>
      {({ expanded, collapse, expand }) => (
        <div className="px-4">
          <SheetSummary
            expanded={expanded}
            onExpand={expand}
            thumb={
              <div
                className="w-14 h-14 rounded-xl grid place-items-center bg-ex-amenity"
                style={{ overflow: 'hidden' }}
              >
                {amenity && <AmenityTypeIcon type={amenity.type} size={26} color="#fff" />}
              </div>
            }
            name={amenity?.name}
            badge={
              amenity &&
              `${typeLabel(amenity.type)}${distanceM !== null ? ` · ${Math.round(distanceM)}m away` : ''}`
            }
            onCollapse={collapse}
            count={Math.max(1, amenity?.photos.length ?? 0)}
            palette={AMENITY_PALETTE}
          />
          {/* Always rendered one line tall: BottomSheet measures the peek height once, while empty */}
          <p className={`mt-3 min-h-5 text-sm text-ex-muted ${expanded ? '' : 'truncate'}`}>
            {amenity?.description}
          </p>
        </div>
      )}
    </BottomSheet>
  )
}
