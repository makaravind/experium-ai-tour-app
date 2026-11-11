'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'

import { createParkMap, destroyParkMap } from '@/components/admin/tour/parkMap'
import type { AdminTourExhibit } from '@/lib/admin/tour-types'
import type { TourNode } from '@/lib/tour'

interface LinkMapProps {
  nodes: TourNode[]
  exhibits: AdminTourExhibit[]
  /** Proposed (not yet accepted) links: exhibit id → node id. */
  pending: Record<string, string>
}

const EMPTY = { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection

export default function LinkMap({ nodes, exhibits, pending }: LinkMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef(new Map<string, maplibregl.Marker>())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const map = createParkMap(containerRef.current!)
    mapRef.current = map
    const markers = markersRef.current

    map.on('load', () => {
      map.addSource('links', { type: 'geojson', data: EMPTY })
      map.addSource('exhibits', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'links-linked',
        type: 'line',
        source: 'links',
        filter: ['==', ['get', 'kind'], 'linked'],
        paint: { 'line-color': '#22c55e', 'line-width': 3 },
      })
      map.addLayer({
        id: 'links-pending',
        type: 'line',
        source: 'links',
        filter: ['==', ['get', 'kind'], 'pending'],
        paint: { 'line-color': '#facc15', 'line-width': 3, 'line-dasharray': [2, 1.5] },
      })
      map.addLayer({
        id: 'exhibits',
        type: 'circle',
        source: 'exhibits',
        paint: {
          'circle-radius': 4,
          'circle-color': ['case', ['get', 'linked'], '#22c55e', '#f97316'],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
        },
      })
      setReady(true)
    })

    return () => {
      markers.forEach((m) => m.remove())
      markers.clear()
      destroyParkMap(map)
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const placed = new Map(
      nodes.filter((n) => n.lat !== null && n.lng !== null).map((n) => [n.id, n])
    )
    const withGps = exhibits.filter((x) => x.gps_lat !== null && x.gps_lng !== null)
    const lines: GeoJSON.Feature[] = []
    for (const x of withGps) {
      const nodeId = pending[x.id] ?? x.tour_node_id
      const n = nodeId ? placed.get(nodeId) : undefined
      if (!n) continue
      lines.push({
        type: 'Feature',
        properties: { kind: pending[x.id] ? 'pending' : 'linked' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [x.gps_lng!, x.gps_lat!],
            [n.lng!, n.lat!],
          ],
        },
      })
    }
    ;(map.getSource('links') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: lines,
    })
    ;(map.getSource('exhibits') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: withGps.map((x) => ({
        type: 'Feature',
        properties: { linked: x.tour_node_id !== null },
        geometry: { type: 'Point', coordinates: [x.gps_lng!, x.gps_lat!] },
      })),
    })

    const markers = markersRef.current
    for (const [id, m] of markers) {
      if (!placed.has(id)) {
        m.remove()
        markers.delete(id)
      }
    }
    for (const n of placed.values()) {
      let m = markers.get(n.id)
      if (!m) {
        const el = document.createElement('div')
        el.dataset.nodeMarker = n.pano_ref
        el.title = n.label
        el.className =
          'flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-sky-500 px-1 text-[10px] font-semibold text-white shadow'
        el.textContent = n.pano_ref
        m = new maplibregl.Marker({ element: el }).setLngLat([n.lng!, n.lat!]).addTo(map)
        markers.set(n.id, m)
      }
      m.setLngLat([n.lng!, n.lat!])
    }
  }, [ready, nodes, exhibits, pending])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
