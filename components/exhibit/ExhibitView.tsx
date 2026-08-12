'use client'

import { useCallback, useState } from 'react'
import BottomSheet from '@/components/exhibit/BottomSheet'
import MapStub from '@/components/exhibit/MapStub'
import TabBar from '@/components/exhibit/TabBar'
import { CompassIcon, SearchIcon } from '@/components/icons'
import { useStore } from '@/lib/store'
import type { ExhibitAudio, ExhibitData } from '@/lib/types'

export default function ExhibitView({
  exhibit,
  audio,
  qrCodeId,
  exhibitId,
}: {
  exhibit: ExhibitData
  audio: ExhibitAudio[]
  qrCodeId: string
  exhibitId: string
}) {
  const visitorId = useStore((s) => s.visitorId)
  const setTotalDiscovered = useStore((s) => s.setTotalDiscovered)
  const markVisited = useStore((s) => s.markVisited)
  const [discovered, setDiscovered] = useState(false)

  const handleAudioEnd = useCallback(
    async (listenDurationSec: number) => {
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorId: visitorId ?? `anon-${Date.now()}`,
            qrCodeId,
            exhibitId,
            listenDurationSec,
          }),
        })
        const data = await res.json()
        setTotalDiscovered(data.total_discovered ?? 0)
        markVisited(exhibitId)
      } catch {
        // Non-fatal. The pin still flips, so the visitor sees the scan landed.
      }
      setDiscovered(true)
    },
    [qrCodeId, exhibitId, visitorId, setTotalDiscovered, markVisited]
  )

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ fontFamily: 'var(--font-body)' }}>
      <MapStub discovered={discovered} />

      {/* Search bar */}
      <div
        className="absolute left-4 right-4 flex gap-2.5 items-center"
        style={{ top: 60, zIndex: 20 }}
      >
        <div
          className="flex-1 h-11 flex items-center gap-2 px-4 rounded-full font-semibold text-sm"
          style={{
            background: '#fff',
            border: '1px solid #e8e5df',
            boxShadow: '0 2px 10px rgba(43,43,43,.08)',
            color: '#8a8a8a',
          }}
        >
          <SearchIcon size={17} color="#8a8a8a" strokeWidth={2.2} />
          Search
        </div>
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{
            background: '#fff',
            border: '1px solid #e8e5df',
            boxShadow: '0 2px 10px rgba(43,43,43,.08)',
            color: '#588157',
          }}
        >
          <CompassIcon size={20} color="currentColor" strokeWidth={2.2} />
        </div>
      </div>

      {/* Bottom sheet — expands to fullscreen and doubles as the audio player */}
      <BottomSheet exhibit={exhibit} audio={audio} onEnded={handleAudioEnd} />

      <TabBar />
    </div>
  )
}
