'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { track } from '@vercel/analytics'
import { Viewer } from '@photo-sphere-viewer/core'
import { EquirectangularTilesAdapter } from '@photo-sphere-viewer/equirectangular-tiles-adapter'
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin'
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin'
import type { EquirectangularMultiTilesPanorama } from '@photo-sphere-viewer/equirectangular-tiles-adapter'
import { fetchManifest } from '@/lib/tour-data'
import { thumbUrl } from '@/lib/exhibit-photos'
import { FOCUS_RADIUS_DEG, FOCUS_SETTLE_MS, pickFocus } from '@/lib/focus-pick'
import FocusBubble from '@/components/map/FocusBubble'
import {
  angularDistance,
  degToRad,
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
const FOCUS_ID = '__focus__'
// FocusBubble card (164 wide, 100 image + 50 text) plus the half of its tail that hangs below.
const FOCUS_SIZE = { width: 164, height: 156 }

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

function focusMarker(pin: TourPin, element: HTMLElement) {
  return {
    id: FOCUS_ID,
    position: pin.position,
    element,
    size: FOCUS_SIZE,
    anchor: 'bottom center',
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
  /** false while a sheet is open: the focus bubble hides */
  focusEnabled: boolean
  /** the focus bubble was tapped */
  onPeekTap: (exhibitId: string) => void
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
  focusEnabled,
  onPeekTap,
  onPanoClick,
  onNodeError,
  getYawRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Pins follow the latest dataset/visited set without re-creating the viewer.
  const pinSourceRef = useRef({ exhibits, visitedIds })
  const syncPinsRef = useRef<(() => void) | null>(null)
  // Focus bubble: a PSV marker whose element is a portal host; the exhibit id drives the card.
  const [focusHost] = useState(() => {
    const el = document.createElement('div')
    // .psv-marker is pointer-events:auto; only the visible card should take taps.
    el.style.pointerEvents = 'none'
    return el
  })
  const [focus, setFocus] = useState<{
    exhibitId: string | null
    visible: boolean
    popKey: number
  }>({
    exhibitId: null,
    visible: false,
    popKey: 0,
  })
  const focusEnabledRef = useRef(focusEnabled)
  const refocusRef = useRef<(() => void) | null>(null)
  const hideFocusRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    pinSourceRef.current = { exhibits, visitedIds }
    syncPinsRef.current?.()
  }, [exhibits, visitedIds])

  useEffect(() => {
    focusEnabledRef.current = focusEnabled
    if (focusEnabled) refocusRef.current?.()
    else hideFocusRef.current?.()
  }, [focusEnabled])

  useEffect(() => {
    if (!containerRef.current) return
    // The viewer is rebuilt: the old marker host is detached, so drop any stale card.
    setFocus({ exhibitId: null, visible: false, popKey: 0 })
    // Tapping an arrow runs setCurrentNode with no catch, so a failed getNode surfaces as an
    // unhandled rejection (after PSV shows its blocking error overlay). Turn that into a toast.
    // Also swallow the rejection PSV's start-node load throws if the viewer is destroyed in the same
    // tick (StrictMode remount): the plugin's datasource is gone by then, so it rejects with a TypeError
    // naming it (Chrome/Safari: "...loadNode", Firefox: "this.datasource is undefined").
    // Any other rejection is left alone.
    let destroyed = false
    const onRejection = (e: PromiseRejectionEvent) => {
      const failedNode = e.reason instanceof NodeLoadError
      const tornDownStart =
        destroyed && e.reason instanceof TypeError && /loadNode|datasource/.test(e.reason.message)
      if (!failedNode && !tornDownStart) return
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
    // The pin nearest the view centre (inside FOCUS_RADIUS_DEG) gets the bubble once the camera settles.
    let focusedId: string | null = null
    let focusTimer: ReturnType<typeof setTimeout> | undefined
    const hideFocus = () => setFocus((f) => (f.visible ? { ...f, visible: false } : f))
    syncPinsRef.current = () => {
      if (!currentId) return
      const src = pinSourceRef.current
      markers.setMarkers(nodeMarkers(currentId, src.exhibits, src.visitedIds).map(pinMarker))
      // setMarkers also dropped the focus marker: hide its card and re-pick on the next settle.
      hideFocus()
      clearTimeout(focusTimer)
      focusTimer = setTimeout(() => refocusRef.current?.(), FOCUS_SETTLE_MS)
    }
    const refocus = () => {
      if (!currentId || !focusEnabledRef.current) return
      const pos = viewer.getPosition()
      const pins = nodeMarkers(
        currentId,
        pinSourceRef.current.exhibits,
        pinSourceRef.current.visitedIds
      )
      const id = pickFocus(
        pins.map((p) => ({ id: p.exhibitId, distance: angularDistance(pos, p.position) })),
        degToRad(FOCUS_RADIUS_DEG)
      )
      const pin = pins.find((p) => p.exhibitId === id)
      if (!pin) return
      const config = focusMarker(pin, focusHost)
      if (markers.getMarkers().some((m) => m.id === FOCUS_ID)) markers.removeMarker(FOCUS_ID)
      markers.addMarker(config)
      focusedId = pin.exhibitId
      setFocus((f) => ({ exhibitId: pin.exhibitId, visible: true, popKey: f.popKey + 1 }))
    }
    refocusRef.current = refocus
    hideFocusRef.current = () => {
      clearTimeout(focusTimer)
      hideFocus()
    }
    // position-updated fires for drag, inertia and animation alike: a debounce is the settle signal.
    viewer.addEventListener('position-updated', () => {
      hideFocus()
      clearTimeout(focusTimer)
      focusTimer = setTimeout(refocus, FOCUS_SETTLE_MS)
    })
    tour.addEventListener('node-changed', ({ node: n }) => {
      currentId = n.id
      clearTimeout(focusTimer)
      focusedId = null
      setFocus({ exhibitId: null, visible: false, popKey: 0 })
      // Sets the new node's pins and starts the settle timer, so the entry bubble needs no rotate.
      syncPinsRef.current?.()
      const current = graph.nodes.find((x) => x.id === n.id)
      if (current) onNodeChange(current)
    })
    markers.addEventListener('select-marker', ({ marker }) => {
      const exhibitId = marker.id === FOCUS_ID ? focusedId : marker.id
      if (!exhibitId) return
      const visited = pinSourceRef.current.visitedIds.includes(exhibitId)
      if (marker.id === FOCUS_ID) {
        track('peek_tap', { exhibitId, surface: 'tour', visited })
        onPeekTap(exhibitId)
      } else {
        track('pin_tap', { exhibitId, surface: 'tour', visited })
        onPinSelect(exhibitId)
      }
    })
    viewer.addEventListener('click', ({ data }) => {
      if (data.marker || data.target?.closest?.('.psv-marker')) return
      onPanoClick()
    })
    return () => {
      destroyed = true
      syncPinsRef.current = null
      refocusRef.current = null
      hideFocusRef.current = null
      clearTimeout(focusTimer)
      getYawRef.current = null
      viewer.destroy()
      setTimeout(() => window.removeEventListener('unhandledrejection', onRejection, true), 100)
    }
  }, [
    graph,
    node,
    panorama,
    yaw,
    focusHost,
    onNodeChange,
    onPinSelect,
    onPeekTap,
    onPanoClick,
    onNodeError,
    getYawRef,
  ])

  const focused = focus.exhibitId ? exhibits.find((e) => e.id === focus.exhibitId) : undefined

  return (
    <>
      <div ref={containerRef} className="h-full w-full" />
      {focused &&
        createPortal(
          <FocusBubble
            displayId={focused.displayId}
            name={focused.name}
            thumb={thumbUrl(focused)}
            state={visitedIds.includes(focused.id) ? 'visited' : 'unvisited'}
            // The tap arrives through PSV's select-marker, not this button.
            onTap={() => {}}
            popKey={focus.popKey}
            visible={focus.visible}
          />,
          focusHost
        )}
    </>
  )
}
