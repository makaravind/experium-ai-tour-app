'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import MapStub from '@/components/exhibit/MapStub'
import ParkMapbox from '@/components/map/ParkMapbox'
import PreviewSheet from '@/components/exhibit/PreviewSheet'
import TabBar from '@/components/exhibit/TabBar'
import { CompassIcon, SearchIcon } from '@/components/icons'
import { useStore } from '@/lib/store'
import { useMapStore } from '@/lib/map-store'
import type { MapExhibit, PreviewExhibit } from '@/lib/types'

export default function MapShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isExhibitPage = pathname.startsWith('/s/')

  const [mapSelectedExhibit, setMapSelectedExhibit] = useState<PreviewExhibit | null>(null)
  const [flyToTarget, setFlyToTarget] = useState<string | null>(null)
  const [navigateEnabled, setNavigateEnabled] = useState(false)
  const [mapFailed, setMapFailed] = useState(false)

  const listenedCurrentExhibit = useStore((s) => s.listenedCurrentExhibit)
  const exhibitPageData = useMapStore((s) => s.exhibitPageData)

  // Clear map-page state when leaving exhibit page
   
  useEffect(() => {
    if (!isExhibitPage) {
      setMapSelectedExhibit(null) // eslint-disable-line react-hooks/set-state-in-effect
      setFlyToTarget(null)  
      setNavigateEnabled(false)  
    }
  }, [isExhibitPage])

  // Fly to exhibit when page data arrives or changes
   
  useEffect(() => {
    if (exhibitPageData) {
      setFlyToTarget(exhibitPageData.exhibit.id) // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [exhibitPageData?.exhibit.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Which exhibit and audio to show in sheet
  const sheetExhibit =
    mapSelectedExhibit ?? (isExhibitPage ? (exhibitPageData?.exhibit ?? null) : null)
  const isShowingCurrentExhibit =
    isExhibitPage && exhibitPageData != null && sheetExhibit?.id === exhibitPageData.exhibit.id
  const sheetAudio = isShowingCurrentExhibit ? exhibitPageData!.audio : []
  const sheetAutoPlay = isShowingCurrentExhibit ? exhibitPageData!.autoPlay || undefined : undefined
  const sheetOnFirstPlay = isShowingCurrentExhibit ? exhibitPageData!.onFirstPlay : undefined
  const sheetOnQuartile = isShowingCurrentExhibit ? exhibitPageData!.onQuartile : undefined

  const handlePinTap = (pin: MapExhibit) => {
    setMapSelectedExhibit({
      id: pin.id,
      name: pin.name,
      type: pin.type,
      tier: pin.tier,
      qr_code: pin.qr_code,
    })
    setNavigateEnabled(true)
  }

  const handleMapTap = () => {
    if (isExhibitPage) {
      setMapSelectedExhibit(null)
      router.push('/map')
    } else {
      setMapSelectedExhibit(null)
    }
  }

  const handleNavigate = () => {
    const target = mapSelectedExhibit ?? exhibitPageData?.exhibit ?? null
    if (!target) return
    setFlyToTarget(target.id)
    if (!isExhibitPage) setMapSelectedExhibit(null)
  }

  const showClose = !isExhibitPage && mapSelectedExhibit !== null

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ fontFamily: 'var(--font-body)' }}>
      {mapFailed ? (
        <MapStub discovered={isExhibitPage ? listenedCurrentExhibit : false} />
      ) : (
        <ParkMapbox
          onLoadError={() => setMapFailed(true)}
          onPinTap={handlePinTap}
          flyToTarget={flyToTarget}
          onMapTap={handleMapTap}
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
        exhibit={sheetExhibit}
        audio={sheetAudio}
        autoPlay={sheetAutoPlay}
        onClose={showClose ? () => setMapSelectedExhibit(null) : undefined}
        onNavigate={navigateEnabled ? handleNavigate : undefined}
        onFirstPlay={sheetOnFirstPlay}
        onQuartile={sheetOnQuartile}
      />

      <TabBar />
      {children}
    </div>
  )
}
