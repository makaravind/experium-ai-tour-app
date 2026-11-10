'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'

import { createParkMap, destroyParkMap } from '@/components/admin/tour/parkMap'
import type { TourNode } from '@/lib/tour'

interface PlaceMapProps {
  nodes: TourNode[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Map click while a node is selected. */
  onPlace: (lat: number, lng: number) => void
}

const markerStyle = (el: HTMLElement, selected: boolean) => {
  el.style.background = selected ? '#f97316' : '#0ea5e9'
  el.style.zIndex = selected ? '2' : '1'
  el.style.boxShadow = selected ? '0 0 0 4px rgba(249,115,22,0.45)' : '' // not transform: MapLibre positions markers with it
}

export default function PlaceMap({ nodes, selectedId, onSelect, onPlace }: PlaceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef(new Map<string, maplibregl.Marker>())
  const [ready, setReady] = useState(false)

  // handlers registered once read the latest props through this
  const latest = useRef({ selectedId, onSelect, onPlace })
  useEffect(() => {
    latest.current = { selectedId, onSelect, onPlace }
  })

  useEffect(() => {
    const map = createParkMap(containerRef.current!)
    mapRef.current = map
    const markers = markersRef.current

    map.on('load', () => setReady(true))
    map.on('click', (e) => {
      if (latest.current.selectedId) latest.current.onPlace(e.lngLat.lat, e.lngLat.lng)
    })

    return () => {
      markers.forEach((m) => m.remove())
      markers.clear()
      destroyParkMap(map)
      mapRef.current = null
    }
  }, [])

  // placed nodes → markers (selected highlighted)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const markers = markersRef.current
    const placed = nodes.filter((n) => n.lat !== null && n.lng !== null)
    const keep = new Set(placed.map((n) => n.id))
    for (const [id, m] of markers) {
      if (!keep.has(id)) {
        m.remove()
        markers.delete(id)
      }
    }
    for (const n of placed) {
      let m = markers.get(n.id)
      if (!m) {
        const el = document.createElement('button')
        el.type = 'button'
        el.dataset.nodeMarker = n.pano_ref
        el.title = n.label
        el.className =
          'flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white px-1 text-[10px] font-semibold text-white shadow'
        el.textContent = n.pano_ref
        el.addEventListener('click', (ev) => {
          ev.stopPropagation() // don't also place the selected node here
          latest.current.onSelect(n.id)
        })
        m = new maplibregl.Marker({ element: el }).setLngLat([n.lng!, n.lat!]).addTo(map)
        markers.set(n.id, m)
      }
      m.setLngLat([n.lng!, n.lat!])
      markerStyle(m.getElement(), n.id === selectedId)
    }
  }, [ready, nodes, selectedId])

  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ cursor: selectedId ? 'crosshair' : '' }}
      />
    </div>
  )
}
