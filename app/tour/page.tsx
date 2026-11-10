'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import type { EquirectangularMultiTilesPanorama } from '@photo-sphere-viewer/equirectangular-tiles-adapter'
import TourSplash from '@/components/tour/TourSplash'
import { useStore } from '@/lib/store'
import { TOUR_SLOW_TIMEOUT_MS, TOUR_SPLASH_MIN_MS } from '@/lib/timeouts'
import { fetchManifest, fetchTourGraph, preloadImage } from '@/lib/tour-data'
import {
  manifestToPanorama,
  parseHeading,
  resolveNode,
  splashView,
  type TourNode,
} from '@/lib/tour'

const TourViewer = dynamic(() => import('@/components/tour/TourViewer'), { ssr: false })

interface Loaded {
  node: TourNode
  panorama: EquirectangularMultiTilesPanorama
}

class NoTourNodeError extends Error {}

/**
 * Graph + current node's manifest + base.jpg. `failed` = no node to show (step 8);
 * `offline` = no connection or a load error (splash offers retry). `retry` re-runs the load.
 */
function useTourNode(nodeParam: string | null) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  const [offline, setOffline] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!navigator.onLine) throw new Error('offline')
      const { nodes } = await fetchTourGraph()
      const node = resolveNode(nodes, nodeParam)
      if (!node) throw new NoTourNodeError()
      const manifest = await fetchManifest(node.tiles_url)
      await preloadImage(manifest.baseUrl)
      if (!cancelled) setLoaded({ node, panorama: manifestToPanorama(manifest) })
    })().catch((err) => {
      if (cancelled) return
      if (err instanceof NoTourNodeError) setFailed(true)
      else setOffline(true)
    })
    return () => {
      cancelled = true
    }
  }, [nodeParam, attempt])

  const retry = useCallback(() => {
    setOffline(false)
    setAttempt((a) => a + 1)
  }, [])

  return { loaded, failed, offline, retry }
}

function Tour() {
  const router = useRouter()
  const params = useSearchParams()
  const nodeParam = params.get('node')
  const yaw = useMemo(() => parseHeading(params.get('heading')), [params])
  const exhibitId = params.get('exhibitId')
  const exhibit = useStore((st) => st.cachedExhibits.find((e) => e.id === exhibitId))
  const { loaded, failed, offline, retry } = useTourNode(nodeParam)

  // Splash timers: min display (per load attempt) and the slow state (restarted by Keep waiting)
  const [minElapsed, setMinElapsed] = useState(false)
  const [slow, setSlow] = useState(false)
  const [waitRound, setWaitRound] = useState(0)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), TOUR_SPLASH_MIN_MS)
    return () => clearTimeout(t)
  }, [attempt])

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), TOUR_SLOW_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [attempt, waitRound])

  const view = splashView({ loaded: !!loaded, minElapsed, offline, slow })

  const cancel = () => {
    if (exhibit?.code) router.push(`/s/${exhibit.code}`)
    else router.back()
  }
  const keepWaiting = () => {
    setSlow(false)
    setWaitRound((r) => r + 1)
  }
  const tryAgain = () => {
    setMinElapsed(false)
    setSlow(false)
    setAttempt((a) => a + 1)
    retry()
  }

  return (
    <div className="relative h-dvh w-full bg-black">
      {loaded && (
        <TourViewer
          nodeId={loaded.node.id}
          name={loaded.node.label}
          panorama={loaded.panorama}
          yaw={yaw}
        />
      )}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
          Virtual tour unavailable
        </div>
      )}
      {!failed && view !== 'hidden' && (
        <TourSplash
          view={view}
          title={exhibit?.name ?? loaded?.node.label ?? null}
          backdropUrl={exhibit?.tour_preview_url ?? loaded?.node.preview_url ?? null}
          onCancel={cancel}
          onKeepWaiting={keepWaiting}
          onRetry={tryAgain}
          onBackToMap={() => router.push('/map')}
        />
      )}
      <button
        onClick={() => router.push('/map')}
        className="absolute top-4 left-4 z-10 flex items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur-sm"
      >
        ← Map
      </button>
      {loaded && (
        <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur-sm">
          {loaded.node.label}
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
