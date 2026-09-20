'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import MapStub from '@/components/exhibit/MapStub'
import ParkMapbox from '@/components/map/ParkMapbox'
import PreviewSheet from '@/components/exhibit/PreviewSheet'
import TabBar from '@/components/exhibit/TabBar'
import { CompassIcon, SearchIcon } from '@/components/icons'
import { useStore } from '@/lib/store'
import { getDeviceInfo } from '@/lib/utils'
import type { ExhibitAudio, ExhibitData, MapExhibit, PreviewExhibit } from '@/lib/types'

export default function ExhibitView({
  exhibit,
  audio,
  qrCode,
  exhibitId,
  isQrScan,
  scanSrc,
  autoPlay,
}: {
  exhibit: ExhibitData
  audio: ExhibitAudio[]
  qrCode: string
  exhibitId: string
  isQrScan: boolean
  scanSrc: string | null
  autoPlay: boolean
}) {
  const router = useRouter()
  const [mapFailed, setMapFailed] = useState(false)
  const [flyToTarget, setFlyToTarget] = useState<string | null>(null)
  const [navigateEnabled, setNavigateEnabled] = useState(false)
  const [selectedExhibit, setSelectedExhibit] = useState<PreviewExhibit>(() => ({
    id: exhibitId,
    name: exhibit.name,
    type: exhibit.type,
    tier: exhibit.tier,
    qr_code: qrCode,
    facts: exhibit.facts,
  }))

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
      listen_duration_sec: 0,
      is_qr_scan: isQrScan,
      ...(scanSrc ? { scan_src: scanSrc } : {}),
      device_info: { language, ...deviceRef.current },
    })
      .then((res) => res.json())
      .then((data) => setTotalDiscovered(data.total_discovered ?? 0))
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFirstPlay = useCallback(async () => {
    setListenedCurrentExhibit(true)
    try {
      const res = await postScan({
        listened: true,
        ...(scanSrc ? { scan_src: scanSrc } : {}),
        device_info: { language, ...deviceRef.current },
      })
      const data = await res.json()
      setTotalDiscovered(data.total_discovered ?? 0)
      markVisited(exhibitId)
    } catch {}
  }, [
    language,
    postScan,
    exhibitId,
    scanSrc,
    setListenedCurrentExhibit,
    setTotalDiscovered,
    markVisited,
  ])

  const handleQuartile = useCallback(
    (sec: number, quartile: number) => {
      postScan({
        listened: true,
        listen_duration_sec: sec,
        listen_quartile: quartile,
        ...(scanSrc ? { scan_src: scanSrc } : {}),
        device_info: { language, ...deviceRef.current },
      })
    },
    [language, postScan, scanSrc]
  )

  const handlePinTap = (pin: MapExhibit) => {
    setSelectedExhibit({
      id: pin.id,
      name: pin.name,
      type: pin.type,
      tier: pin.tier,
      qr_code: pin.qr_code,
    })
    setNavigateEnabled(true)
  }

  const handleNavigate = () => setFlyToTarget(selectedExhibit.id)

  const sheetAudio = selectedExhibit.id === exhibitId ? audio : []

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ fontFamily: 'var(--font-body)' }}>
      {mapFailed ? (
        <MapStub discovered={listenedCurrentExhibit} />
      ) : (
        <ParkMapbox
          onLoadError={() => setMapFailed(true)}
          onPinTap={handlePinTap}
          flyToTarget={flyToTarget}
          onMapTap={() => router.push('/map')}
        />
      )}

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

      <PreviewSheet
        exhibit={selectedExhibit}
        audio={sheetAudio}
        autoPlay={autoPlay}
        onNavigate={navigateEnabled ? handleNavigate : undefined}
        onFirstPlay={selectedExhibit.id === exhibitId ? handleFirstPlay : undefined}
        onQuartile={selectedExhibit.id === exhibitId ? handleQuartile : undefined}
      />

      <TabBar />
    </div>
  )
}
