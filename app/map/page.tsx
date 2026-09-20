'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MapStub from '@/components/exhibit/MapStub'
import TabBar from '@/components/exhibit/TabBar'
import ParkMapbox from '@/components/map/ParkMapbox'
import PreviewSheet from '@/components/map/PreviewSheet'
import type { MapExhibit } from '@/lib/types'

export default function MapPage() {
  const router = useRouter()
  const [mapFailed, setMapFailed] = useState(false)
  const [selectedExhibit, setSelectedExhibit] = useState<MapExhibit | null>(null)
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
          onPinTap={(exhibit) => setSelectedExhibit(exhibit)}
          flyToTarget={flyToTarget}
        />
      )}
      <PreviewSheet
        exhibit={selectedExhibit}
        onClose={() => setSelectedExhibit(null)}
        onListen={() => {
          if (!selectedExhibit?.qr_code) return
          router.push(`/s/${selectedExhibit.qr_code}?from=map`)
        }}
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
