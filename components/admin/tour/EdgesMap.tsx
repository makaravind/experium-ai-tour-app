'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'

import { createParkMap, destroyParkMap } from '@/components/admin/tour/parkMap'
import { pairKey, type EdgePair } from '@/lib/admin/tour-edges'
import type { ParkPaths } from '@/lib/park-paths'
import type { TourNode } from '@/lib/tour'

interface EdgesMapProps {
  nodes: TourNode[]
  paths: ParkPaths
  existing: EdgePair[]
  proposed: EdgePair[]
  /** `pairKey` of the picked edge. */
  pickedKey: string | null
  selectedId: string | null
  onNodeClick: (id: string) => void
  onPickEdge: (key: string | null) => void
}

const EMPTY = { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection
const HIT_PX = 6

export default function EdgesMap({
  nodes,
  paths,
  existing,
  proposed,
  pickedKey,
  selectedId,
  onNodeClick,
  onPickEdge,
}: EdgesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef(new Map<string, maplibregl.Marker>())
  const [ready, setReady] = useState(false)

  const latest = useRef({ onNodeClick, onPickEdge })
  useEffect(() => {
    latest.current = { onNodeClick, onPickEdge }
  })

  useEffect(() => {
    const map = createParkMap(containerRef.current!)
    mapRef.current = map
    const markers = markersRef.current

    map.on('load', () => {
      map.addSource('paths', { type: 'geojson', data: EMPTY })
      map.addSource('edges', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'paths',
        type: 'line',
        source: 'paths',
        paint: { 'line-color': '#e2e8f0', 'line-opacity': 0.5, 'line-width': 1.5 },
      })
      const width = ['case', ['get', 'picked'], 7, 4] as maplibregl.ExpressionSpecification
      map.addLayer({
        id: 'edges-existing',
        type: 'line',
        source: 'edges',
        filter: ['==', ['get', 'kind'], 'existing'],
        paint: { 'line-color': '#22c55e', 'line-width': width },
      })
      map.addLayer({
        id: 'edges-proposed',
        type: 'line',
        source: 'edges',
        filter: ['==', ['get', 'kind'], 'proposed'],
        paint: { 'line-color': '#facc15', 'line-width': width, 'line-dasharray': [2, 1.5] },
      })
      setReady(true)
    })
    map.on('click', (e) => {
      const { x, y } = e.point
      const hit = map.queryRenderedFeatures(
        [
          [x - HIT_PX, y - HIT_PX],
          [x + HIT_PX, y + HIT_PX],
        ],
        { layers: ['edges-existing', 'edges-proposed'] }
      )
      latest.current.onPickEdge((hit[0]?.properties?.key as string | undefined) ?? null)
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
    const line = (coords: [number, number][], props: Record<string, unknown>) =>
      ({
        type: 'Feature',
        properties: props,
        geometry: { type: 'LineString', coordinates: coords },
      }) as GeoJSON.Feature
    const edgeFeatures = (pairs: EdgePair[], kind: string) =>
      pairs.flatMap((p) => {
        const a = placed.get(p.a)
        const b = placed.get(p.b)
        if (!a || !b) return []
        const key = pairKey(p.a, p.b)
        return [
          line(
            [
              [a.lng!, a.lat!],
              [b.lng!, b.lat!],
            ],
            { key, kind, picked: key === pickedKey }
          ),
        ]
      })
    ;(map.getSource('edges') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: [...edgeFeatures(existing, 'existing'), ...edgeFeatures(proposed, 'proposed')],
    })
    ;(map.getSource('paths') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: Object.entries(paths).flatMap(([id, p]) =>
        p.coords.length >= 2
          ? [
              line(
                p.coords.map(([lat, lng]) => [lng, lat]),
                { id }
              ),
            ]
          : []
      ),
    })
  }, [ready, nodes, paths, existing, proposed, pickedKey])

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
          ev.stopPropagation() // don't also clear the picked edge
          latest.current.onNodeClick(n.id)
        })
        m = new maplibregl.Marker({ element: el }).setLngLat([n.lng!, n.lat!]).addTo(map)
        markers.set(n.id, m)
      }
      m.setLngLat([n.lng!, n.lat!])
      const el = m.getElement()
      el.style.background = n.id === selectedId ? '#f97316' : '#0ea5e9'
      el.style.zIndex = n.id === selectedId ? '2' : '1'
      el.style.boxShadow = n.id === selectedId ? '0 0 0 4px rgba(249,115,22,0.45)' : ''
    }
  }, [ready, nodes, selectedId])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
