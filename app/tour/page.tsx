'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import type { EquirectangularMultiTilesPanorama } from '@photo-sphere-viewer/equirectangular-tiles-adapter'
import { fetchManifest, fetchTourGraph } from '@/lib/tour-data'
import { manifestToPanorama, parseHeading, resolveNode, type TourNode } from '@/lib/tour'

const TourViewer = dynamic(() => import('@/components/tour/TourViewer'), { ssr: false })

interface Loaded {
  node: TourNode
  panorama: EquirectangularMultiTilesPanorama
}

/** Graph + current node's manifest. Steps 7/8 (splash, empty/error states) build on this. */
function useTourNode(nodeParam: string | null) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { nodes } = await fetchTourGraph()
      const node = resolveNode(nodes, nodeParam)
      if (!node) throw new Error('no tour node')
      const panorama = manifestToPanorama(await fetchManifest(node.tiles_url))
      if (!cancelled) setLoaded({ node, panorama })
    })().catch(() => {
      if (!cancelled) setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [nodeParam])

  return { loaded, failed }
}

function Tour() {
  const router = useRouter()
  const params = useSearchParams()
  const nodeParam = params.get('node')
  const yaw = useMemo(() => parseHeading(params.get('heading')), [params])
  const { loaded, failed } = useTourNode(nodeParam)

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
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
          {failed ? 'Virtual tour unavailable' : 'Loading…'}
        </div>
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
