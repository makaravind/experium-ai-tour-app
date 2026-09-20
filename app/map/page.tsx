'use client'

import { useEffect, useState } from 'react'
import MapStub from '@/components/exhibit/MapStub'
import TabBar from '@/components/exhibit/TabBar'
import ParkMapbox from '@/components/map/ParkMapbox'

export default function MapPage() {
  const [mapFailed, setMapFailed] = useState(false)

  useEffect(() => {
    if (!navigator.onLine) setMapFailed(true)
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ fontFamily: 'var(--font-body)' }}>
      {mapFailed ? (
        <MapStub discovered={false} />
      ) : (
        <ParkMapbox onLoadError={() => setMapFailed(true)} />
      )}
      <TabBar />
    </div>
  )
}
