'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'

import {
  assignUnplaced, centroid, nextFreeLetter, renameExhibitsSection, renameSection, strandedExhibits, validateLetter,
} from '@/lib/admin/sections'
import type { AdminExhibit, LngLat, WorkingSection } from '@/lib/admin/types'

interface AdminMapProps {
  sections: WorkingSection[]
  exhibits: AdminExhibit[]
  onSectionsChange: (next: WorkingSection[]) => void
  /** Only called when a section letter rename or a new polygon changes exhibits' `section`/`number`. */
  onExhibitsChange: (next: AdminExhibit[]) => void
}

// Same park extent as components/map/ParkMap.tsx (not imported: that module is coupled to the visitor stores).
const ORTHO_BOUNDS: [number, number, number, number] = [78.187123, 17.378546, 78.196134, 17.383978]
const MAX_BOUNDS: [number, number, number, number] = [
  ORTHO_BOUNDS[0] - 0.001,
  ORTHO_BOUNDS[1] - 0.001,
  ORTHO_BOUNDS[2] + 0.001,
  ORTHO_BOUNDS[3] + 0.001,
]
const COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#fb923c', '#22d3ee', '#a3e635']
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

const sectionsGeoJson = (sections: WorkingSection[]): GeoJSON.FeatureCollection => ({
  type: 'FeatureCollection',
  features: sections.map((s, i) => ({
    type: 'Feature',
    properties: { color: COLORS[i % COLORS.length] },
    geometry: { type: 'Polygon', coordinates: [[...s.polygon, s.polygon[0]]] },
  })),
})

const setData = (map: maplibregl.Map, source: string, data: GeoJSON.FeatureCollection) =>
  (map.getSource(source) as maplibregl.GeoJSONSource | undefined)?.setData(data)

export default function AdminMap({ sections, exhibits, onSectionsChange, onExhibitsChange }: AdminMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const labelsRef = useRef(new Map<string, maplibregl.Marker>())
  const handlesRef = useRef<{ id: string; markers: maplibregl.Marker[] } | null>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [ready, setReady] = useState(false)
  const [drawing, setDrawing] = useState<LngLat[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  const [hint, setHint] = useState('')

  // handlers registered on the map/markers once read the latest props through this
  const latest = useRef({ sections, exhibits, onSectionsChange })
  useEffect(() => {
    latest.current = { sections, exhibits, onSectionsChange }
  })

  const isDrawing = drawing !== null
  const editingPolygon = sections.find((s) => s.id === editingId)?.polygon

  const flash = useCallback((msg: string) => {
    setHint(msg)
    if (hintTimer.current) clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(''), 4000)
  }, [])

  // map + basemap
  useEffect(() => {
    const protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile.bind(protocol))
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: {
        version: 8,
        sources: {
          park: { type: 'raster', url: 'pmtiles:///park.pmtiles', tileSize: 256, minzoom: 15, maxzoom: 21 },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#0f172a' } },
          { id: 'park', type: 'raster', source: 'park' },
        ],
      },
      center: [(ORTHO_BOUNDS[0] + ORTHO_BOUNDS[2]) / 2, (ORTHO_BOUNDS[1] + ORTHO_BOUNDS[3]) / 2],
      zoom: 18,
      maxBounds: MAX_BOUNDS,
      minZoom: 15,
    })
    mapRef.current = map
    const labels = labelsRef.current

    map.on('load', () => {
      map.addSource('sections', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'sections-fill', type: 'fill', source: 'sections', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.18 } })
      map.addLayer({ id: 'sections-line', type: 'line', source: 'sections', paint: { 'line-color': ['get', 'color'], 'line-width': 2 } })
      map.addSource('exhibits', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'exhibits-dot', type: 'circle', source: 'exhibits', paint: { 'circle-radius': 4, 'circle-color': '#ef4444', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } })
      map.addSource('draft', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'draft-line', type: 'line', source: 'draft', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#fff', 'line-width': 2, 'line-dasharray': [2, 2] } })
      map.addLayer({ id: 'draft-pts', type: 'circle', source: 'draft', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': '#0ea5e9', 'circle-stroke-width': 2 } })
      setReady(true)
    })

    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current)
      handlesRef.current?.markers.forEach((m) => m.remove())
      handlesRef.current = null
      labels.forEach((m) => m.remove())
      labels.clear()
      map.remove()
      maplibregl.removeProtocol('pmtiles')
      mapRef.current = null
    }
  }, [])

  // sections → fill/line layers + letter labels
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    setData(map, 'sections', sectionsGeoJson(sections))
    const labels = labelsRef.current
    const ids = new Set(sections.map((s) => s.id))
    for (const [id, marker] of labels) {
      if (!ids.has(id)) {
        marker.remove()
        labels.delete(id)
      }
    }
    for (const s of sections) {
      let marker = labels.get(s.id)
      if (!marker) {
        const el = document.createElement('div')
        el.textContent = s.id
        el.style.cssText = 'pointer-events:none;font-size:14px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.9)'
        marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(centroid(s.polygon)).addTo(map)
        labels.set(s.id, marker)
      }
      marker.setLngLat(centroid(s.polygon))
    }
  }, [sections, ready])

  // exhibit positions (read-only dots; draggable pins come with the pins step)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    setData(map, 'exhibits', {
      type: 'FeatureCollection',
      features: exhibits.flatMap((e) =>
        e.gps_lat != null && e.gps_lng != null
          ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [e.gps_lng, e.gps_lat] } }]
          : [],
      ),
    })
  }, [exhibits, ready])

  // draw mode: draft layer + click to add vertices
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const pts = drawing ?? []
    const features: GeoJSON.Feature[] = pts.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }))
    if (pts.length > 1) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } })
    setData(map, 'draft', { type: 'FeatureCollection', features })
  }, [drawing, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !isDrawing) return
    const onClick = (e: maplibregl.MapMouseEvent) =>
      setDrawing((d) => d && [...d, [e.lngLat.lng, e.lngLat.lat]])
    map.doubleClickZoom.disable()
    map.getCanvas().style.cursor = 'crosshair'
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
      map.doubleClickZoom.enable()
      map.getCanvas().style.cursor = ''
    }
  }, [isDrawing, ready])

  // reshape mode: draggable vertex handles for the section being edited
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const current = handlesRef.current
    if (!editingId || !editingPolygon) {
      current?.markers.forEach((m) => m.remove())
      handlesRef.current = null
      return
    }
    if (current && current.id === editingId && current.markers.length === editingPolygon.length) {
      current.markers.forEach((m, i) => m.setLngLat(editingPolygon[i]))
      return
    }
    current?.markers.forEach((m) => m.remove())
    const id = editingId
    const markers = editingPolygon.map((coord, i) => {
      const el = document.createElement('div')
      el.style.cssText = 'width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid #0ea5e9;box-shadow:0 1px 4px rgba(0,0,0,.6);cursor:grab'
      el.addEventListener('click', (e) => e.stopPropagation())
      const handle = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(coord).addTo(map)
      const moved = () => {
        const { lng, lat } = handle.getLngLat()
        const sec = latest.current.sections.find((s) => s.id === id)
        return sec ? { sec, polygon: sec.polygon.map((p, j): LngLat => (j === i ? [lng, lat] : p)) } : null
      }
      handle.on('drag', () => {
        const m = moved()
        if (!m) return
        setData(map, 'sections', sectionsGeoJson(latest.current.sections.map((s) => (s.id === id ? { ...s, polygon: m.polygon } : s))))
        labelsRef.current.get(id)?.setLngLat(centroid(m.polygon))
      })
      handle.on('dragend', () => {
        const m = moved()
        if (!m) return
        const stranded = strandedExhibits(latest.current.exhibits, id, m.polygon)
        if (stranded.length) {
          handle.setLngLat(m.sec.polygon[i])
          setData(map, 'sections', sectionsGeoJson(latest.current.sections))
          labelsRef.current.get(id)?.setLngLat(centroid(m.sec.polygon))
          flash(`Rejected: would leave ${stranded.map((e) => e.name).join(', ')} outside ${id}`)
          return
        }
        latest.current.onSectionsChange(latest.current.sections.map((s) => (s.id === id ? { ...s, polygon: m.polygon } : s)))
      })
      return handle
    })
    handlesRef.current = { id, markers }
  }, [editingId, editingPolygon, ready, flash])

  const startDrawing = () => {
    setEditingId(null)
    setRenaming(null)
    setDrawing([])
  }

  const finishDrawing = () => {
    if (!drawing) return
    if (drawing.length < 3) return flash('Need at least 3 points')
    const id = nextFreeLetter(sections)
    const next = [...sections, { id, originalId: null, polygon: drawing }]
    setDrawing(null)
    onSectionsChange(next)
    const placed = assignUnplaced(exhibits, id, next)
    if (placed !== exhibits) onExhibitsChange(placed)
    flash(`Added section ${id}`)
  }
  const finishRef = useRef(finishDrawing)
  useEffect(() => {
    finishRef.current = finishDrawing
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (isDrawing) {
        if (e.key === 'Enter') finishRef.current()
        if (e.key === 'Escape') setDrawing(null)
      } else if (e.key === 'Escape') {
        setEditingId(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isDrawing])

  const commitRename = () => {
    if (!renaming) return
    const { id, error } = validateLetter(renaming.value, sections, renaming.id)
    if (error) return flash(error)
    if (id !== renaming.id) {
      onSectionsChange(renameSection(sections, renaming.id, id))
      const renamed = renameExhibitsSection(exhibits, renaming.id, id)
      if (renamed.some((e, i) => e !== exhibits[i])) onExhibitsChange(renamed)
      if (editingId === renaming.id) setEditingId(id)
    }
    setRenaming(null)
  }

  const deleteSection = (id: string) => {
    if (exhibits.some((e) => e.section === id)) return flash(`Section ${id} still has exhibits; move them first`)
    if (editingId === id) setEditingId(null)
    onSectionsChange(sections.filter((s) => s.id !== id))
  }

  const fitSection = (s: WorkingSection) => {
    const lngs = s.polygon.map((p) => p[0])
    const lats = s.polygon.map((p) => p[1])
    mapRef.current?.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60 })
  }

  const btn = 'rounded bg-slate-700 px-2 py-0.5 text-xs hover:bg-slate-600 disabled:opacity-40'

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute left-3 top-3 z-10 w-72 rounded-lg bg-slate-900/90 p-3 text-sm text-white shadow-lg">
        <div className="flex gap-2">
          <button className={`${btn} px-3 py-1 text-sm`} onClick={isDrawing ? finishDrawing : startDrawing}>
            {isDrawing ? 'Finish' : 'Draw section'}
          </button>
          {isDrawing && (
            <button className={`${btn} px-3 py-1 text-sm`} onClick={() => setDrawing(null)}>
              Cancel
            </button>
          )}
        </div>
        <p className="mt-2 min-h-4 text-xs text-amber-300">
          {hint ||
            (isDrawing
              ? `Click to add points (${drawing.length}). Enter = finish, Esc = cancel`
              : editingId
                ? `Reshaping ${editingId}: drag the white handles. Esc = stop`
                : '')}
        </p>
        <ul className="mt-2 space-y-1">
          {sections.map((s, i) => (
            <li key={s.id} className="rounded bg-slate-800 px-2 py-1">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <button className="font-bold" onClick={() => fitSection(s)} title="Zoom to section">
                  {s.id}
                </button>
                <span className="text-xs text-slate-400">{exhibits.filter((e) => e.section === s.id).length}</span>
                <span className="flex-1" />
                <button className={btn} disabled={isDrawing} onClick={() => setRenaming({ id: s.id, value: s.id })}>
                  Rename
                </button>
                <button
                  className={`${btn} ${editingId === s.id ? 'bg-sky-700' : ''}`}
                  disabled={isDrawing}
                  onClick={() => setEditingId(editingId === s.id ? null : s.id)}
                >
                  Reshape
                </button>
                <button className={btn} disabled={isDrawing} onClick={() => deleteSection(s.id)}>
                  ✕
                </button>
              </div>
              {renaming?.id === s.id && (
                <div className="mt-1">
                  <div className="flex gap-1">
                    <input
                      autoFocus
                      className="w-16 rounded bg-slate-700 px-1 text-white uppercase"
                      value={renaming.value}
                      onChange={(e) => setRenaming({ id: s.id, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') setRenaming(null)
                      }}
                    />
                    <button className={btn} onClick={commitRename}>OK</button>
                    <button className={btn} onClick={() => setRenaming(null)}>Cancel</button>
                  </div>
                  <p className="mt-1 text-xs text-amber-300">
                    Visitors will see the new letter on every exhibit in this section (A3 → new letter + 3) after Save. QR URLs are unchanged.
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
