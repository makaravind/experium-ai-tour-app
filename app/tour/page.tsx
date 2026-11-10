'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import type { EquirectangularMultiTilesPanorama } from '@photo-sphere-viewer/equirectangular-tiles-adapter'
import PreviewSheet from '@/components/exhibit/PreviewSheet'
import ExhibitStrip from '@/components/tour/ExhibitStrip'
import ExitSplash from '@/components/tour/ExitSplash'
import TourSplash from '@/components/tour/TourSplash'
import { toPreviewExhibit } from '@/lib/map-exhibits'
import { useMapStore } from '@/lib/map-store'
import { useStore } from '@/lib/store'
import {
  TOUR_EXIT_SPLASH_MS,
  TOUR_SLOW_TIMEOUT_MS,
  TOUR_SPLASH_MIN_MS,
  TOUR_TOAST_MS,
} from '@/lib/timeouts'
import { fetchManifest, fetchTourGraph, preloadImage } from '@/lib/tour-data'
import {
  isTourSpotEntry,
  manifestToPanorama,
  parseHeading,
  resolveNode,
  splashView,
  type TourGraph,
  type TourNode,
  yawToHeading,
} from '@/lib/tour'
import type { ExhibitAudio, Language } from '@/lib/types'

const TourViewer = dynamic(() => import('@/components/tour/TourViewer'), { ssr: false })

interface Loaded {
  graph: TourGraph
  node: TourNode
  panorama: EquirectangularMultiTilesPanorama
}

class NoTourNodeError extends Error {}

const NEEDS_INTERNET = 'Needs internet'

/**
 * Graph + current node's manifest + base.jpg. `failed` = no node to show (empty state);
 * `offline` = no connection or a load error (splash offers retry). `retry` re-runs the load.
 * The result is tagged with `loadKey` (node + attempt), so a new load starts from a clean slate.
 */
function useTourNode(nodeParam: string | null) {
  const [result, setResult] = useState<{
    key: string
    loaded: Loaded | null
    failed: boolean
    offline: boolean
  } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const loadKey = `${attempt}:${nodeParam}`

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!navigator.onLine) throw new Error('offline')
      const graph = await fetchTourGraph()
      const node = resolveNode(graph.nodes, nodeParam)
      if (!node) throw new NoTourNodeError()
      const manifest = await fetchManifest(node.tiles_url)
      await preloadImage(manifest.baseUrl)
      if (!cancelled) {
        setResult({
          key: loadKey,
          loaded: { graph, node, panorama: manifestToPanorama(manifest) },
          failed: false,
          offline: false,
        })
      }
    })().catch((err) => {
      if (cancelled) return
      const failed = err instanceof NoTourNodeError
      setResult({ key: loadKey, loaded: null, failed, offline: !failed })
    })
    return () => {
      cancelled = true
    }
  }, [nodeParam, loadKey])

  const retry = useCallback(() => setAttempt((a) => a + 1), [])

  const current = result?.key === loadKey ? result : null
  return {
    loaded: current?.loaded ?? null,
    failed: current?.failed ?? false,
    offline: current?.offline ?? false,
    loadKey,
    retry,
  }
}

/** One toast at a time: "Needs internet" when the connection drops after the viewer is up, or a message from `show`. */
function useTourToast(active: boolean) {
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    const show = () => setToast(NEEDS_INTERNET)
    window.addEventListener('offline', show)
    return () => window.removeEventListener('offline', show)
  }, [active])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), TOUR_TOAST_MS)
    return () => clearTimeout(t)
  }, [toast])

  return { toast, showToast: setToast }
}

function Tour() {
  const router = useRouter()
  const params = useSearchParams()
  const nodeParam = params.get('node')
  const yaw = useMemo(() => parseHeading(params.get('heading')), [params])
  const exhibitId = params.get('exhibitId')
  const exhibit = useStore((st) => st.cachedExhibits.find((e) => e.id === exhibitId))
  const cachedExhibits = useStore((st) => st.cachedExhibits)
  const visitedIds = useStore((st) => st.visitedExhibits)
  const { loaded, failed, offline, loadKey, retry } = useTourNode(nodeParam)

  // Any entry other than the 360° map pin replaces the old spot (the next exit writes a fresh one).
  const headingParam = params.get('heading')
  useEffect(() => {
    const { tourSpot, clearTourSpot } = useStore.getState()
    if (tourSpot && !isTourSpotEntry(tourSpot, nodeParam, headingParam, exhibitId)) clearTourSpot()
  }, [nodeParam, headingParam, exhibitId])
  const { toast, showToast } = useTourToast(!!loaded)

  // Node the visitor has walked to, tagged with the load it belongs to so a new
  // entry node (URL change) or retry starts from the entry node again.
  const [walked, setWalked] = useState<{ key: string; node: TourNode } | null>(null)
  // Exhibit whose PreviewSheet is open, tagged with its load like `walked`; walking to another node closes it.
  const [pinned, setPinned] = useState<{ key: string; id: string } | null>(null)
  const onNodeChange = useCallback(
    (n: TourNode) => {
      setWalked({ key: loadKey, node: n })
      setPinned(null)
    },
    [loadKey]
  )
  const onPinSelect = useCallback((id: string) => setPinned({ key: loadKey, id }), [loadKey])
  const onPanoClick = useCallback(() => setPinned(null), [])
  const pinnedCached =
    pinned?.key === loadKey ? cachedExhibits.find((e) => e.id === pinned.id) : null
  const sheetExhibit = useMemo(
    // Already in the tour: drop the sheet's own 360° badge / "enter tour" slide.
    () =>
      pinnedCached
        ? {
            ...toPreviewExhibit(pinnedCached),
            tour_node_id: null,
            tour_heading: null,
            tour_pitch: null,
            tour_preview_url: null,
          }
        : null,
    [pinnedCached]
  )
  const sheetAudio = useMemo<ExhibitAudio[]>(
    () =>
      (Object.entries(pinnedCached?.audio ?? {}) as [Language, string][]).map(
        ([language, audio_url]) => ({ language, audio_url, status: 'published' })
      ),
    [pinnedCached]
  )
  const currentNode = walked?.key === loadKey ? walked.node : (loaded?.node ?? null)

  // Leaving for /map: save where the visitor stands (the map recentres on it and later pins it),
  // show the exit splash, then go. `focusExhibitId` (Navigate) makes the map open that exhibit instead.
  const getYawRef = useRef<(() => number) | null>(null)
  const [exiting, setExiting] = useState<{ label: string; spotSaved: boolean } | null>(null)
  const exitToMap = (focusExhibitId: string | null) => {
    if (exiting) return
    // Still loading: no node to save, nothing to splash
    if (!currentNode) return router.push('/map')
    const { id, lat, lng, label } = currentNode
    // A node not yet placed has no coords: skip the spot, the map keeps its own viewport
    const spotSaved = lat != null && lng != null
    if (spotSaved) {
      const heading = yawToHeading(getYawRef.current?.() ?? yaw)
      useStore.getState().setTourSpot({ nodeId: id, lat, lng, heading, label, at: Date.now() })
    }
    useMapStore.getState().setTourFocusExhibitId(focusExhibitId)
    setExiting({ label, spotSaved })
  }
  useEffect(() => {
    if (!exiting) return
    const t = setTimeout(() => router.push('/map'), TOUR_EXIT_SPLASH_MS)
    return () => clearTimeout(t)
  }, [exiting, router])
  const handleNavigate = () => exitToMap(pinnedCached?.id ?? null)
  const onNodeError = useCallback(
    () => showToast(navigator.onLine ? "Couldn't load that spot" : NEEDS_INTERNET),
    [showToast]
  )
  const pillLabel = currentNode?.label

  // Splash timers record the load (and wait round) they fired for, so a new load (node change or
  // retry) starts with min-display and slow cleared. Slow stops once loaded; Keep waiting restarts it.
  const isLoaded = !!loaded
  const [minDoneKey, setMinDoneKey] = useState<string | null>(null)
  const [slowKey, setSlowKey] = useState<string | null>(null)
  const [waitRound, setWaitRound] = useState(0)
  const waitKey = `${loadKey}:${waitRound}`

  useEffect(() => {
    const t = setTimeout(() => setMinDoneKey(loadKey), TOUR_SPLASH_MIN_MS)
    return () => clearTimeout(t)
  }, [loadKey])

  useEffect(() => {
    if (isLoaded) return
    const t = setTimeout(() => setSlowKey(waitKey), TOUR_SLOW_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [waitKey, isLoaded])

  const view = splashView({
    loaded: isLoaded,
    minElapsed: minDoneKey === loadKey,
    offline,
    slow: !isLoaded && slowKey === waitKey,
  })

  const cancel = () => {
    if (exhibit?.code) router.push(`/s/${exhibit.code}`)
    else router.back()
  }
  const keepWaiting = () => setWaitRound((r) => r + 1)

  return (
    <div className="relative h-dvh w-full bg-black">
      {loaded && (
        <TourViewer
          graph={loaded.graph}
          node={loaded.node}
          panorama={loaded.panorama}
          yaw={yaw}
          exhibits={cachedExhibits}
          visitedIds={visitedIds}
          onNodeChange={onNodeChange}
          onPinSelect={onPinSelect}
          onPanoClick={onPanoClick}
          onNodeError={onNodeError}
          getYawRef={getYawRef}
        />
      )}
      {failed && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black px-8 text-center text-white"
          role="status"
        >
          <p className="text-lg font-medium">Virtual tour isn&apos;t available yet</p>
          <button
            onClick={() => router.push('/map')}
            className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black"
          >
            Back to map
          </button>
        </div>
      )}
      {!failed && view !== 'hidden' && (
        <TourSplash
          view={view}
          title={exhibit?.name ?? loaded?.node.label ?? null}
          backdropUrl={exhibit?.tour_preview_url ?? loaded?.node.preview_url ?? null}
          onCancel={cancel}
          onKeepWaiting={keepWaiting}
          onRetry={retry}
          onBackToMap={() => router.push('/map')}
        />
      )}
      {loaded && view === 'hidden' && exhibit?.code && (
        <ExhibitStrip name={exhibit.name} code={exhibit.code} />
      )}
      {loaded && (
        <PreviewSheet
          exhibit={sheetExhibit}
          audio={sheetAudio}
          onNavigate={handleNavigate}
          onSwipeClose={onPanoClick}
        />
      )}
      {exiting && <ExitSplash label={exiting.label} spotSaved={exiting.spotSaved} />}
      {toast && (
        <div
          role="status"
          className="absolute inset-x-8 bottom-8 z-30 rounded-xl border border-white/20 bg-black/80 px-4 py-3 text-center text-sm text-white"
        >
          {toast}
        </div>
      )}
      {!failed && (
        <button
          onClick={() => exitToMap(null)}
          className="absolute top-4 left-4 z-10 flex items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur-sm"
        >
          ← Map
        </button>
      )}
      {loaded && (
        <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur-sm">
          {pillLabel}
        </div>
      )}
    </div>
  )
}

export default function TourPage() {
  return (
    <Suspense>
      <Tour />
    </Suspense>
  )
}
