'use client'

import { useCallback, useEffect, useRef } from 'react'
import BottomSheet from '@/components/exhibit/BottomSheet'
import MapStub from '@/components/exhibit/MapStub'
import TabBar from '@/components/exhibit/TabBar'
import { CompassIcon, SearchIcon } from '@/components/icons'
import { useStore } from '@/lib/store'
import { getDeviceInfo } from '@/lib/utils'
import type { ExhibitAudio, ExhibitData } from '@/lib/types'

export default function ExhibitView({
  exhibit,
  audio,
  qrCode,
  exhibitId,
}: {
  exhibit: ExhibitData
  audio: ExhibitAudio[]
  qrCode: string
  exhibitId: string
}) {
  const visitorId = useStore((s) => s.visitorId)
  const language = useStore((s) => s.language)
  const listenedCurrentExhibit = useStore((s) => s.listenedCurrentExhibit)
  const setListenedCurrentExhibit = useStore((s) => s.setListenedCurrentExhibit)
  const setTotalDiscovered = useStore((s) => s.setTotalDiscovered)
  const markVisited = useStore((s) => s.markVisited)
  const deviceRef = useRef(getDeviceInfo())

  const postScan = useCallback(
    (fields: object) =>
      fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId, code: qrCode, ...fields }),
      }),
    [visitorId, qrCode]
  )

  // Page land — fires once on mount
  useEffect(() => {
    postScan({
      listened: false,
      discovered: true,
      listen_duration_sec: 0,
      device_info: { language, ...deviceRef.current },
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFirstPlay = useCallback(async () => {
    setListenedCurrentExhibit(true)
    try {
      const res = await postScan({
        listened: true,
        device_info: { language, ...deviceRef.current },
      })
      const data = await res.json()
      setTotalDiscovered(data.total_discovered ?? 0)
      markVisited(exhibitId)
    } catch {}
  }, [language, postScan, exhibitId, setListenedCurrentExhibit, setTotalDiscovered, markVisited])

  const handleQuartile = useCallback(
    (sec: number) => {
      postScan({
        listened: true,
        listen_duration_sec: sec,
        device_info: { language, ...deviceRef.current },
      })
    },
    [language, postScan]
  )

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ fontFamily: 'var(--font-body)' }}>
      <MapStub discovered={listenedCurrentExhibit} />

      {/* Search bar */}
      <div
        className="absolute left-4 right-4 flex gap-2.5 items-center"
        style={{ top: 60, zIndex: 20 }}
      >
        <div
          className="flex-1 h-11 flex items-center gap-2 px-4 rounded-full font-semibold text-sm bg-ex-paper border border-ex-border text-ex-muted"
          style={{ boxShadow: 'var(--ex-shadow-soft)' }}
        >
          <SearchIcon size={17} strokeWidth={2.2} />
          Search
        </div>
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center bg-ex-paper border border-ex-border text-ex-forest"
          style={{ boxShadow: 'var(--ex-shadow-soft)' }}
        >
          <CompassIcon size={20} strokeWidth={2.2} />
        </div>
      </div>

      {/* Bottom sheet — expands to fullscreen and doubles as the audio player */}
      <BottomSheet
        exhibit={exhibit}
        audio={audio}
        onFirstPlay={handleFirstPlay}
        onQuartile={handleQuartile}
      />

      <TabBar />
    </div>
  )
}
