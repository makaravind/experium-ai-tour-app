'use client'

import { useEffect, useState } from 'react'
import MapStub from '@/components/exhibit/MapStub'
import TabBar from '@/components/exhibit/TabBar'
import PreviewSheet from '@/components/exhibit/PreviewSheet'
import ParkMapbox from '@/components/map/ParkMapbox'
import type { PreviewExhibit } from '@/lib/types'

export default function MapPage() {
  const [mapFailed, setMapFailed] = useState(false)
  const [selectedExhibit, setSelectedExhibit] = useState<PreviewExhibit | null>(null)
  const [flyToTarget, setFlyToTarget] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- navigator.onLine is unavailable during SSR/initial render
    if (!navigator.onLine) setMapFailed(true)
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ fontFamily: 'var(--font-body)' }}>
      {mapFailed ? (
        <MapStub discovered={false} />
      ) : (
        <ParkMapbox
          onLoadError={() => setMapFailed(true)}
          onPinTap={(exhibit) =>
            setSelectedExhibit({
              id: exhibit.id,
              name: exhibit.name,
              type: exhibit.type,
              tier: exhibit.tier,
              qr_code: exhibit.qr_code,
            })
          }
          flyToTarget={flyToTarget}
        />
      )}
      <PreviewSheet
        exhibit={selectedExhibit}
        onClose={() => setSelectedExhibit(null)}
        onNavigate={() => {
          if (!selectedExhibit) return
          setFlyToTarget(selectedExhibit.id)
          setSelectedExhibit(null)
        }}
      />
      <TabBar />
    </div>
  )
}
