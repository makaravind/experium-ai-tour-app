'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import MapStub from '@/components/exhibit/MapStub'
import ParkMap from '@/components/map/ParkMap'
import AmenitiesPill from '@/components/amenity/AmenitiesPill'
import AmenitySheet from '@/components/amenity/AmenitySheet'
import PreviewSheet from '@/components/exhibit/PreviewSheet'
import SearchOverlay from '@/components/exhibit/SearchOverlay'
import TabBar from '@/components/exhibit/TabBar'
import UserMenu from '@/components/more/UserMenu'
import InfoModal from '@/components/onboarding/InfoModal'
import { CompassIcon, HomeIcon, SearchIcon } from '@/components/icons'
import { useStore } from '@/lib/store'
import { useMapStore } from '@/lib/map-store'
import { getCrossedMilestone } from '@/lib/trail'
import { toMapExhibits } from '@/lib/map-exhibits'
import type { MapExhibit, PreviewExhibit } from '@/lib/types'

function toPreviewExhibit(exhibit: MapExhibit): PreviewExhibit {
  return {
    id: exhibit.id,
    name: exhibit.name,
    type: exhibit.type,
    tier: exhibit.tier,
    qr_code: exhibit.qr_code,
    languages: exhibit.languages,
  }
}

export default function MapShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isExhibitPage = pathname.startsWith('/s/')

  const [mapSelectedExhibit, setMapSelectedExhibit] = useState<PreviewExhibit | null>(null)
  const [flyToTarget, setFlyToTarget] = useState<string | null>(null)
  const [navigateEnabled, setNavigateEnabled] = useState(false)
  const [mapFailed, setMapFailed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchMode, setSearchMode] = useState<'exhibits' | 'amenities'>('exhibits')
  const pendingSearchSelectRef = useRef<MapExhibit | null>(null)
  const audioEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [toast, setToast] = useState<{ total: number; saved: boolean } | null>(null)

  const listenedCurrentExhibit = useStore((s) => s.listenedCurrentExhibit)
  const userInfo = useStore((s) => s.userInfo)
  const cachedExhibits = useStore((s) => s.cachedExhibits)
  const mapExhibits = useMemo(() => toMapExhibits(cachedExhibits), [cachedExhibits])
  const profileModalOpen = useStore((s) => s.profileModalOpen)
  const setProfileModalOpen = useStore((s) => s.setProfileModalOpen)
  const exhibitPageData = useMapStore((s) => s.exhibitPageData)
  const recenterTrigger = useMapStore((s) => s.recenterTrigger)
  const followMode = useMapStore((s) => s.followMode)
  const geoError = useMapStore((s) => s.geoError)
  const retryGpsTrigger = useMapStore((s) => s.retryGpsTrigger)
  const nearbyExhibitIds = useMapStore((s) => s.nearbyExhibitIds)
  const userPosition = useMapStore((s) => s.userPosition)
  const activeAmenityId = useMapStore((s) => s.activeAmenityId)

  // Clear map-page state when leaving exhibit page

  useEffect(() => {
    if (!isExhibitPage) {
      const pending = pendingSearchSelectRef.current
      pendingSearchSelectRef.current = null
      if (pending) {
        setMapSelectedExhibit(toPreviewExhibit(pending))
        setFlyToTarget(pending.id)
        setNavigateEnabled(true)
      } else {
        setMapSelectedExhibit(null)
        setFlyToTarget(null)
        setNavigateEnabled(false)
      }
    } else {
      useMapStore.getState().setActiveAmenityId(null)
    }
  }, [isExhibitPage])

  // Fly to exhibit when page data arrives or changes

  useEffect(() => {
    if (exhibitPageData) {
      setFlyToTarget(exhibitPageData.exhibit.id) // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [exhibitPageData?.exhibit.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Which exhibit and audio to show in sheet.
  const sheetExhibit =
    mapSelectedExhibit ?? (isExhibitPage ? (exhibitPageData?.exhibit ?? null) : null)

  // Drive the 3D marker layer's rise-and-spin: the sheet's exhibit is the map's "active" pin.
  useEffect(() => {
    useMapStore.getState().setActiveExhibitId(sheetExhibit?.id ?? null)
  }, [sheetExhibit?.id])
  const isShowingCurrentExhibit =
    isExhibitPage && exhibitPageData != null && sheetExhibit?.id === exhibitPageData.exhibit.id
  const sheetAudio = isShowingCurrentExhibit ? exhibitPageData!.audio : []
  const sheetAutoPlay = isShowingCurrentExhibit ? exhibitPageData!.autoPlay || undefined : undefined
  const sheetOnFirstPlay = isShowingCurrentExhibit ? exhibitPageData!.onFirstPlay : undefined
  const sheetOnQuartile = isShowingCurrentExhibit ? exhibitPageData!.onQuartile : undefined

  const handleAudioEnded = () => {
    const currentExhibit = exhibitPageData?.exhibit
    const { pendingDiscovery, clearPendingDiscovery } = useMapStore.getState()
    if (!pendingDiscovery) return
    clearPendingDiscovery()
    if (pendingDiscovery.exhibitId !== currentExhibit?.id) return
    const { prevTotal, newTotal } = pendingDiscovery
    if (audioEndTimerRef.current) clearTimeout(audioEndTimerRef.current)
    audioEndTimerRef.current = setTimeout(() => {
      if (newTotal > prevTotal) {
        const crossed = getCrossedMilestone(prevTotal, newTotal)
        if (crossed) router.push(`/collection?reveal=${crossed}`)
        else {
          const saved = useStore
            .getState()
            .scanQueue.some((e) => e.code === currentExhibit?.qr_code)
          setToast({ total: newTotal, saved })
        }
      }
    }, 500)
  }

  useEffect(() => {
    return () => {
      if (audioEndTimerRef.current) clearTimeout(audioEndTimerRef.current)
    }
  }, [])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const handlePinTap = (pin: MapExhibit) => {
    useMapStore.getState().setActiveAmenityId(null)
    setMapSelectedExhibit(toPreviewExhibit(pin))
    setNavigateEnabled(true)
  }

  const handleAmenityTap = (id: string) => {
    setMapSelectedExhibit(null)
    useMapStore.getState().setActiveAmenityId(id)
  }

  const handleMapTap = () => {
    useMapStore.getState().setActiveAmenityId(null)
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

  const handleOpenSearch = () => {
    if (mapFailed) {
      setMapSelectedExhibit(null)
    } else {
      handleMapTap()
    }
    setSearchMode('exhibits')
    setSearchOpen(true)
  }

  // Unlike the search bar, keeps the amenity selection
  const handleOpenAmenitySearch = () => {
    if (isExhibitPage) {
      setMapSelectedExhibit(null)
      router.push('/map')
    }
    setSearchMode('amenities')
    setSearchOpen(true)
  }

  const handleSearchSelect = (exhibit: MapExhibit) => {
    useMapStore.getState().setActiveAmenityId(null)
    setSearchOpen(false)
    if (mapFailed) {
      if (exhibit.qr_code) router.push(`/s/${exhibit.qr_code}`)
      return
    }
    if (isExhibitPage) {
      // handleOpenSearch's navigation hasn't resolved yet; the clear-on-leave effect applies this
      pendingSearchSelectRef.current = exhibit
      return
    }
    setMapSelectedExhibit(toPreviewExhibit(exhibit))
    setFlyToTarget(exhibit.id)
    setNavigateEnabled(true)
  }

  const showClose = !isExhibitPage && mapSelectedExhibit !== null

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ fontFamily: 'var(--font-body)' }}>
      {mapFailed ? (
        <MapStub discovered={isExhibitPage ? listenedCurrentExhibit : false} />
      ) : (
        <ParkMap
          onLoadError={() => setMapFailed(true)}
          onPinTap={handlePinTap}
          onAmenityTap={handleAmenityTap}
          hideAmenities={isExhibitPage}
          flyToTarget={flyToTarget}
          onMapTap={handleMapTap}
        />
      )}

      {/* GPS error banner — persists until geoError clears (not a toast) */}
      {geoError && (
        <div
          role="alert"
          className="absolute left-0 right-0 top-0 flex items-center justify-center gap-3 px-4 py-2 text-sm font-semibold bg-yellow-300 text-black"
          style={{ zIndex: 30 }}
        >
          {geoError === 'denied' ? (
            <>
              <span>Location access denied — tap to enable</span>
              <button
                type="button"
                onClick={() => retryGpsTrigger?.()}
                className="px-3 py-1 rounded-full bg-black text-white"
              >
                Retry
              </button>
            </>
          ) : (
            <span>Location isn&apos;t available on this device</span>
          )}
        </div>
      )}

      {/* Search bar */}
      <div
        className="absolute left-4 right-4 flex gap-2.5 items-center"
        style={{ top: 60, zIndex: 20 }}
      >
        <button
          type="button"
          onClick={() => router.push('/')}
          className="w-11 h-11 rounded-full flex items-center justify-center border bg-ex-paper border-ex-border text-ex-forest"
          style={{ boxShadow: 'var(--ex-shadow-soft)' }}
          aria-label="Home"
        >
          <HomeIcon size={20} strokeWidth={2.2} />
        </button>
        <div
          role="button"
          tabIndex={0}
          onClick={handleOpenSearch}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleOpenSearch()
          }}
          className="flex-1 h-11 flex items-center gap-2 px-4 rounded-full font-semibold text-sm bg-ex-paper border border-ex-border text-ex-muted cursor-pointer"
          style={{ boxShadow: 'var(--ex-shadow-soft)' }}
        >
          <SearchIcon size={17} strokeWidth={2.2} />
          Search
        </div>
        <button
          type="button"
          onClick={() => recenterTrigger?.()}
          className={`w-11 h-11 rounded-full flex items-center justify-center border ${
            followMode === 'following'
              ? 'bg-ex-forest border-ex-forest text-white'
              : 'bg-ex-paper border-ex-border text-ex-forest'
          }`}
          style={{ boxShadow: 'var(--ex-shadow-soft)' }}
        >
          <CompassIcon size={20} strokeWidth={2.2} />
        </button>
      </div>

      {!mapFailed && (
        <div className="absolute left-4" style={{ top: 112, zIndex: 20 }}>
          <AmenitiesPill onClick={handleOpenAmenitySearch} />
        </div>
      )}

      <PreviewSheet
        exhibit={sheetExhibit}
        audio={sheetAudio}
        autoPlay={sheetAutoPlay}
        onClose={showClose ? () => setMapSelectedExhibit(null) : undefined}
        onNavigate={navigateEnabled ? handleNavigate : undefined}
        onFirstPlay={sheetOnFirstPlay}
        onQuartile={sheetOnQuartile}
        onAudioEnded={isShowingCurrentExhibit ? handleAudioEnded : undefined}
      />

      <AmenitySheet
        amenityId={activeAmenityId}
        onClose={() => useMapStore.getState().setActiveAmenityId(null)}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            key="discovery-toast"
            role="status"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute left-1/2 px-4 py-2 rounded-full text-sm font-semibold bg-ex-forest text-white"
            style={{ top: 60, x: '-50%', zIndex: 55, boxShadow: 'var(--ex-shadow-soft)' }}
          >
            {`+1 🌿 · ${toast.total}/50 discovered${toast.saved ? ' · saved offline' : ''}`}
          </motion.div>
        )}
      </AnimatePresence>

      {searchOpen && (
        <SearchOverlay
          exhibits={mapExhibits}
          nearbyExhibitIds={nearbyExhibitIds}
          userPosition={userPosition}
          mapFailed={mapFailed}
          initialMode={searchMode}
          onClose={() => setSearchOpen(false)}
          onSelect={handleSearchSelect}
          onSelectAmenity={(amenity) => {
            setSearchOpen(false)
            handleAmenityTap(amenity.id)
          }}
        />
      )}

      <TabBar />
      <UserMenu />
      {profileModalOpen && (
        <InfoModal
          initialValues={{
            name: userInfo?.name ?? '',
            phone: userInfo?.phone ?? '',
            email: userInfo?.email ?? '',
          }}
          onDone={() => setProfileModalOpen(false)}
          onCancel={() => setProfileModalOpen(false)}
        />
      )}
      {children}
    </div>
  )
}
