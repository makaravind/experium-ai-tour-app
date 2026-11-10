'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { Viewer } from '@photo-sphere-viewer/core'
import { EquirectangularTilesAdapter } from '@photo-sphere-viewer/equirectangular-tiles-adapter'
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin'
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin'
import type { EquirectangularMultiTilesPanorama } from '@photo-sphere-viewer/equirectangular-tiles-adapter'
import { fetchManifest } from '@/lib/tour-data'
import {
  manifestToPanorama,
  nodeLinks,
  nodeMarkers,
  type TourGraph,
  type TourNode,
  type TourPin,
} from '@/lib/tour'
import type { CachedExhibit } from '@/lib/types'

const PIN_SIZE = 32
// Same colours as the map's exhibit pins (components/map/marker-layer.ts).
const PIN_COLORS = { unvisited: '#dda15e', visited: '#588157' }

function pinMarker(pin: TourPin) {
  const el = document.createElement('div')
  el.textContent = pin.displayId
  el.style.cssText = `width:${PIN_SIZE}px;height:${PIN_SIZE}px;border-radius:50%;border:3px solid #fff;box-sizing:border-box;text-align:center;color:#fff;font:700 11px sans-serif;line-height:${PIN_SIZE - 6}px;box-shadow:0 2px 6px rgba(0,0,0,.5);background:${pin.visited ? PIN_COLORS.visited : PIN_COLORS.unvisited}`
  return {
    id: pin.exhibitId,
    position: pin.position,
    element: el,
    size: { width: PIN_SIZE, height: PIN_SIZE },
    anchor: 'center center',
  }
}

/** Rejected from getNode when a neighbour's manifest can't be loaded; surfaced as a toast, not a PSV error. */
class NodeLoadError extends Error {}

interface Props {
  graph: TourGraph
  node: TourNode
  panorama: EquirectangularMultiTilesPanorama
  /** initial yaw in radians, applied on entry only */
  yaw: number
  /** cached dataset and the visitor's visited ids: source of the exhibit pins */
  exhibits: CachedExhibit[]
  visitedIds: string[]
  onNodeChange: (node: TourNode) => void
  /** an exhibit pin was tapped */
  onPinSelect: (exhibitId: string) => void
  /** the panorama was tapped, not a pin */
  onPanoClick: () => void
  /** a tapped arrow's node failed to load; the viewer stays on the current node */
  onNodeError: () => void
  /** filled with a getter for the viewer's current yaw (radians) while it is up */
  getYawRef: RefObject<(() => number) | null>
}

/** Loaded via next/dynamic (ssr: false) from app/tour/page.tsx. */
export default function TourViewer({
  graph,
  node,
  panorama,
  yaw,
  exhibits,
  visitedIds,
  onNodeChange,
  onPinSelect,
  onPanoClick,
  onNodeError,
  getYawRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Pins follow the latest dataset/visited set without re-creating the viewer.
  const pinSourceRef = useRef({ exhibits, visitedIds })
  const syncPinsRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    pinSourceRef.current = { exhibits, visitedIds }
    syncPinsRef.current?.()
  }, [exhibits, visitedIds])

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
        MarkersPlugin,
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
    getYawRef.current = () => viewer.getPosition().yaw
    const tour = viewer.getPlugin<VirtualTourPlugin>(VirtualTourPlugin)
    const markers = viewer.getPlugin<MarkersPlugin>(MarkersPlugin)
    // Pins are set on each node-changed (the plugin clears markers on every node switch) rather
    // than via getNode's `markers`, because server mode caches nodes and visited state goes stale.
    let currentId: string | null = null
    syncPinsRef.current = () => {
      if (!currentId) return
      const src = pinSourceRef.current
      markers.setMarkers(nodeMarkers(currentId, src.exhibits, src.visitedIds).map(pinMarker))
    }
    tour.addEventListener('node-changed', ({ node: n }) => {
      currentId = n.id
      syncPinsRef.current?.()
      const current = graph.nodes.find((x) => x.id === n.id)
      if (current) onNodeChange(current)
    })
    markers.addEventListener('select-marker', ({ marker }) => onPinSelect(marker.id))
    viewer.addEventListener('click', ({ data }) => {
      if (data.marker || data.target?.closest?.('.psv-marker')) return
      onPanoClick()
    })
    return () => {
      destroyed = true
      syncPinsRef.current = null
      getYawRef.current = null
      viewer.destroy()
      setTimeout(() => window.removeEventListener('unhandledrejection', onRejection, true), 100)
    }
  }, [graph, node, panorama, yaw, onNodeChange, onPinSelect, onPanoClick, onNodeError, getYawRef])

  return <div ref={containerRef} className="h-full w-full" />
}
