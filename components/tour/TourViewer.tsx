'use client'

import { useEffect, useRef } from 'react'
import { Viewer } from '@photo-sphere-viewer/core'
import { EquirectangularTilesAdapter } from '@photo-sphere-viewer/equirectangular-tiles-adapter'
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin'
import type { EquirectangularMultiTilesPanorama } from '@photo-sphere-viewer/equirectangular-tiles-adapter'
import { fetchManifest } from '@/lib/tour-data'
import { manifestToPanorama, nodeLinks, type TourGraph, type TourNode } from '@/lib/tour'

/** Rejected from getNode when a neighbour's manifest can't be loaded; surfaced as a toast, not a PSV error. */
class NodeLoadError extends Error {}

interface Props {
  graph: TourGraph
  node: TourNode
  panorama: EquirectangularMultiTilesPanorama
  /** initial yaw in radians, applied on entry only */
  yaw: number
  onNodeChange: (node: TourNode) => void
  /** a tapped arrow's node failed to load; the viewer stays on the current node */
  onNodeError: () => void
}

/** Loaded via next/dynamic (ssr: false) from app/tour/page.tsx. */
export default function TourViewer({
  graph,
  node,
  panorama,
  yaw,
  onNodeChange,
  onNodeError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    // Tapping an arrow runs setCurrentNode with no catch, so a failed getNode surfaces as an
    // unhandled rejection (after PSV shows its blocking error overlay). Turn that into a toast.
    // Also swallow the rejection PSV's start-node load throws if the viewer is destroyed first
    // (StrictMode remount, leaving /tour early).
    let destroyed = false
    const onRejection = (e: PromiseRejectionEvent) => {
      const failedNode = e.reason instanceof NodeLoadError
      if (!destroyed && !failedNode) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (destroyed) return
      viewer.hideError()
      onNodeError()
    }
    window.addEventListener('unhandledrejection', onRejection, true)

    const viewer = new Viewer({
      container: containerRef.current,
      adapter: [EquirectangularTilesAdapter, { showErrorTile: false }],
      defaultYaw: yaw,
      navbar: false,
      plugins: [
        [
          VirtualTourPlugin,
          {
            // Server mode: a node and its arrows resolve on demand, so a neighbour's manifest is
            // only fetched when it's preloaded or tapped (not all 42 up front).
            dataMode: 'server',
            getNode: async (id: string) => {
              const target = graph.nodes.find((n) => n.id === id)
              if (!target) throw new NodeLoadError(id)
              let pano = panorama
              if (id !== node.id) {
                try {
                  pano = manifestToPanorama(await fetchManifest(target.tiles_url))
                } catch {
                  throw new NodeLoadError(id)
                }
              }
              return { id, name: target.label, panorama: pano, links: nodeLinks(id, graph) }
            },
            startNodeId: node.id,
            // With the tiles adapter this preloads each neighbour's base.jpg only (the adapter's
            // supportsPreload is `!!baseUrl`), not its first tiles. Verified on 5.15.1.
            preload: true,
            showLinkTooltip: false,
          },
        ],
      ],
    })
    const tour = viewer.getPlugin<VirtualTourPlugin>(VirtualTourPlugin)
    tour.addEventListener('node-changed', ({ node: n }) => {
      const current = graph.nodes.find((x) => x.id === n.id)
      if (current) onNodeChange(current)
    })
    return () => {
      destroyed = true
      viewer.destroy()
      setTimeout(() => window.removeEventListener('unhandledrejection', onRejection, true), 100)
    }
  }, [graph, node, panorama, yaw, onNodeChange, onNodeError])

  return <div ref={containerRef} className="h-full w-full" />
}
