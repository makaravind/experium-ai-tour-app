'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'

import { sectionAt } from '@/lib/admin/geometry'
import { moveAmenityPin, movePin, newAmenity, newExhibit } from '@/lib/admin/pins'
import {
  assignUnplaced, centroid, nextFreeLetter, renameAmenitiesSection, renameExhibitsSection, renameSection, strandedExhibits,
  validateLetter,
} from '@/lib/admin/sections'
import type { AdminAmenity, AdminExhibit, LngLat, WorkingSection } from '@/lib/admin/types'
import type { AmenityType } from '@/lib/types'

interface AdminMapProps {
  sections: WorkingSection[]
  exhibits: AdminExhibit[]
  /** Saved letters of sections deleted in this session (still in the DB until Save). */
  deletedSectionIds?: string[]
  onSectionsChange: (next: WorkingSection[]) => void
  /** Called when a section rename, new polygon, pin drag or new exhibit changes `exhibits`. */
  onExhibitsChange: (next: AdminExhibit[]) => void
  /** Optional controlled selection (clicking or dragging a pin selects it); uncontrolled when `selectedId` is omitted. */
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  /** Amenity pins; defaults to none. Section renames relabel them via `onAmenitiesChange` too. */
  amenities?: AdminAmenity[]
  /** Called when a section rename, pin drag or new amenity changes `amenities`. */
  onAmenitiesChange?: (next: AdminAmenity[]) => void
  /**
   * Original rows of amenities staged for deletion (absent from `amenities`); drawn faded, struck and inert.
   * Rows (not ids) because the map needs their position, which the working list no longer has.
   */
  deletedAmenities?: AdminAmenity[]
  /**
   * Optional controlled amenity selection, mirroring `selectedId`/`onSelect`. The map keeps the two kinds exclusive
   * itself: selecting an exhibit calls `onSelectAmenity(null)` and selecting an amenity calls `onSelect(null)`, so the
   * page only needs both callbacks to set their own state (no coordination).
   */
  selectedAmenityId?: string | null
  onSelectAmenity?: (id: string | null) => void
}

interface NewPinDraft {
  lng: number
  lat: number
  section: string
  kind: 'exhibit' | 'amenity'
  name: string
  type: string
  tier: string
  amenityType: AmenityType
}

// Same park extent as components/map/ParkMap.tsx (not imported: that module is coupled to the visitor stores).
const ORTHO_BOUNDS: [number, number, number, number] = [78.187123, 17.378546, 78.196134, 17.383978]
const MAX_BOUNDS: [number, number, number, number] = [
  ORTHO_BOUNDS[0] - 0.001,
  ORTHO_BOUNDS[1] - 0.001,
  ORTHO_BOUNDS[2] + 0.001,
  ORTHO_BOUNDS[3] + 0.001,
]
// same options as DetailsPanel
const TYPES = ['flora', 'structure', 'water_body', 'landmark']
const TIERS = ['gold', 'silver', 'bronze']
// short pin tag per amenity type; key order = select order
const AMENITY_TAGS: Record<AmenityType, string> = { washroom: 'WC', ticketing: 'TKT', food: 'FOOD', gate: 'GATE', leisure: 'LEI' }
const AMENITY_TYPES = Object.keys(AMENITY_TAGS) as AmenityType[]
const AMENITY_COLOR = '#5a7fa0' // --color-ex-amenity (visitor amenity chips)
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

const NO_AMENITIES: AdminAmenity[] = []
const noop = () => {}

export default function AdminMap({
  sections, exhibits, deletedSectionIds, onSectionsChange, onExhibitsChange, selectedId, onSelect,
  amenities = NO_AMENITIES, onAmenitiesChange = noop, deletedAmenities = NO_AMENITIES, selectedAmenityId, onSelectAmenity,
}: AdminMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const labelsRef = useRef(new Map<string, maplibregl.Marker>())
  const pinsRef = useRef(new Map<string, maplibregl.Marker>())
  const amenityPinsRef = useRef(new Map<string, maplibregl.Marker>())
  const handlesRef = useRef<{ id: string; markers: maplibregl.Marker[] } | null>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [ready, setReady] = useState(false)
  const [drawing, setDrawing] = useState<LngLat[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  const [hint, setHint] = useState('')
  const [newForm, setNewForm] = useState<NewPinDraft | null>(null)
  const [localSelected, setLocalSelected] = useState<string | null>(null)
  const selected = selectedId !== undefined ? selectedId : localSelected
  const [localSelectedAmenity, setLocalSelectedAmenity] = useState<string | null>(null)
  const selectedAmenity = selectedAmenityId !== undefined ? selectedAmenityId : localSelectedAmenity
  // exhibit and amenity selection are exclusive: picking one clears the other
  const select = (id: string | null) => {
    setLocalSelected(id)
    onSelect?.(id)
    if (id !== null) {
      setLocalSelectedAmenity(null)
      onSelectAmenity?.(null)
    }
  }
  const selectAmenity = (id: string | null) => {
    setLocalSelectedAmenity(id)
    onSelectAmenity?.(id)
    if (id !== null) {
      setLocalSelected(null)
      onSelect?.(null)
    }
  }

  // handlers registered on the map/markers once read the latest props through this
  const latest = useRef({ sections, exhibits, amenities, onSectionsChange, onExhibitsChange, onAmenitiesChange, select, selectAmenity })
  useEffect(() => {
    latest.current = { sections, exhibits, amenities, onSectionsChange, onExhibitsChange, onAmenitiesChange, select, selectAmenity }
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
    const pins = pinsRef.current
    const amenityPins = amenityPinsRef.current

    map.on('load', () => {
      map.addSource('sections', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'sections-fill', type: 'fill', source: 'sections', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.18 } })
      map.addLayer({ id: 'sections-line', type: 'line', source: 'sections', paint: { 'line-color': ['get', 'color'], 'line-width': 2 } })
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
      pins.forEach((m) => m.remove())
      pins.clear()
      amenityPins.forEach((m) => m.remove())
      amenityPins.clear()
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

  // exhibit pins: draggable markers labelled with the display ID (code when unplaced)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const pins = pinsRef.current
    const placed = exhibits.filter((e) => e.gps_lat != null && e.gps_lng != null)
    const ids = new Set(placed.map((e) => e.id))
    for (const [id, marker] of pins) {
      if (!ids.has(id)) {
        marker.remove()
        pins.delete(id)
      }
    }
    for (const e of placed) {
      let marker = pins.get(e.id)
      if (!marker) {
        const el = document.createElement('div')
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          latest.current.select(e.id)
        })
        marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'center' }).setLngLat([e.gps_lng!, e.gps_lat!]).addTo(map)
        marker.on('dragstart', () => latest.current.select(e.id))
        marker.on('dragend', () => {
          const { exhibits: all, sections: secs, onExhibitsChange: emit } = latest.current
          const prev = all.find((x) => x.id === e.id)
          if (!prev || prev.gps_lng == null || prev.gps_lat == null) return
          const { lng, lat } = marker!.getLngLat()
          const result = movePin(all, secs, e.id, lng, lat)
          if (result === 'snap-back') {
            marker!.setLngLat([prev.gps_lng, prev.gps_lat])
            flash('Outside every section; pin returned')
            return
          }
          emit(all.map((x) => (x.id === e.id ? { ...x, ...result } : x)))
        })
        pins.set(e.id, marker)
      }
      marker.setLngLat([e.gps_lng!, e.gps_lat!])
      marker.setDraggable(!isDrawing)
      const el = marker.getElement()
      const isSel = e.id === selected
      el.textContent = e.section ? `${e.section}${e.number}` : String(e.code ?? '?')
      // per-property (not cssText): MapLibre positions the marker through el.style.transform
      Object.assign(el.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '28px',
        height: '28px',
        padding: '0 6px',
        borderRadius: '14px',
        fontSize: '11px',
        fontWeight: '700',
        color: '#fff',
        cursor: isDrawing ? 'crosshair' : 'grab',
        pointerEvents: isDrawing ? 'none' : 'auto',
        background: e.section ? '#ef4444' : '#94a3b8',
        border: `2px solid ${isSel ? '#fde047' : '#fff'}`,
        boxShadow: isSel ? '0 0 0 3px rgba(253,224,71,.5)' : '0 1px 4px rgba(0,0,0,.6)',
        zIndex: isSel ? '2' : '1',
      })
    }
  }, [exhibits, selected, isDrawing, ready, flash])

  // amenity pins: square, amenity colour, labelled `WC · G` (type tag + section); staged deletes are faded and inert
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const pins = amenityPinsRef.current
    const rows = [...amenities.map((a) => ({ a, deleted: false })), ...deletedAmenities.map((a) => ({ a, deleted: true }))]
    const ids = new Set(rows.map((r) => r.a.id))
    for (const [id, marker] of pins) {
      if (!ids.has(id)) {
        marker.remove()
        pins.delete(id)
      }
    }
    for (const { a, deleted } of rows) {
      let marker = pins.get(a.id)
      if (!marker) {
        const el = document.createElement('div')
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          latest.current.selectAmenity(a.id)
        })
        marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'center' }).setLngLat([a.gps_lng, a.gps_lat]).addTo(map)
        marker.on('dragstart', () => latest.current.selectAmenity(a.id))
        marker.on('dragend', () => {
          const { amenities: all, sections: secs, onAmenitiesChange: emit } = latest.current
          const prev = all.find((x) => x.id === a.id)
          if (!prev) return
          const { lng, lat } = marker!.getLngLat()
          const result = moveAmenityPin(all, secs, a.id, lng, lat)
          if (result === 'snap-back') {
            marker!.setLngLat([prev.gps_lng, prev.gps_lat])
            flash('Outside every section; pin returned')
            return
          }
          emit(all.map((x) => (x.id === a.id ? { ...x, ...result } : x)))
        })
        pins.set(a.id, marker)
      }
      marker.setLngLat([a.gps_lng, a.gps_lat])
      marker.setDraggable(!isDrawing && !deleted)
      const el = marker.getElement()
      const isSel = !deleted && a.id === selectedAmenity
      el.textContent = `${AMENITY_TAGS[a.type]} · ${a.section ?? '?'}`
      // per-property (not cssText): MapLibre positions the marker through el.style.transform
      Object.assign(el.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '28px',
        height: '28px',
        padding: '0 6px',
        borderRadius: '8px',
        fontSize: '10px',
        fontWeight: '700',
        whiteSpace: 'nowrap',
        color: '#fff',
        cursor: isDrawing ? 'crosshair' : 'grab',
        pointerEvents: isDrawing || deleted ? 'none' : 'auto',
        filter: deleted ? 'grayscale(1) opacity(.4)' : 'none', // not `opacity`: MapLibre owns the marker's
        textDecoration: deleted ? 'line-through' : 'none',
        background: a.section ? AMENITY_COLOR : '#94a3b8',
        border: `2px solid ${isSel ? '#fde047' : 'rgba(255,255,255,.75)'}`,
        boxShadow: isSel ? '0 0 0 3px rgba(253,224,71,.5)' : '0 1px 4px rgba(0,0,0,.6)',
        zIndex: isSel ? '2' : '1',
      })
    }
  }, [amenities, deletedAmenities, selectedAmenity, isDrawing, ready, flash])

  // click on empty map inside a section → "new exhibit" form (not while drawing / reshaping)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || isDrawing || editingId) return
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat
      const section = sectionAt(lng, lat, latest.current.sections)
      if (section) setNewForm({ lng, lat, section: section.id, kind: 'exhibit', name: '', type: '', tier: 'silver', amenityType: 'washroom' })
    }
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
    }
  }, [isDrawing, editingId, ready])

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
        const stranded = [
          ...strandedExhibits(latest.current.exhibits, id, m.polygon),
          ...strandedExhibits(latest.current.amenities, id, m.polygon),
        ]
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
    setNewForm(null)
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
        setNewForm(null)
        latest.current.select(null)
        latest.current.selectAmenity(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isDrawing])

  const addExhibit = () => {
    if (!newForm || !newForm.name.trim()) return
    const created = newExhibit(exhibits, sections, crypto.randomUUID(), newForm.lng, newForm.lat, {
      name: newForm.name.trim(),
      type: newForm.type || null,
      tier: newForm.tier,
    })
    if (!created) return
    onExhibitsChange([...exhibits, created])
    select(created.id)
    flash(`Added ${created.section}${created.number}`)
    setNewForm(null)
  }

  const addAmenityPin = () => {
    if (!newForm || !newForm.name.trim()) return
    const created = newAmenity(sections, crypto.randomUUID(), newForm.lng, newForm.lat, {
      name: newForm.name.trim(),
      type: newForm.amenityType,
    })
    if (!created) return
    onAmenitiesChange([...amenities, created])
    selectAmenity(created.id)
    flash(`Added ${AMENITY_TAGS[created.type]} · ${created.section}`)
    setNewForm(null)
  }
  const addNew = () => (newForm?.kind === 'amenity' ? addAmenityPin() : addExhibit())

  const commitRename = () => {
    if (!renaming) return
    const { id, error } = validateLetter(renaming.value, sections, renaming.id, deletedSectionIds)
    if (error) return flash(error)
    if (id !== renaming.id) {
      onSectionsChange(renameSection(sections, renaming.id, id))
      const renamed = renameExhibitsSection(exhibits, renaming.id, id)
      if (renamed.some((e, i) => e !== exhibits[i])) onExhibitsChange(renamed)
      const relabeled = renameAmenitiesSection(amenities, renaming.id, id)
      if (relabeled.some((a, i) => a !== amenities[i])) onAmenitiesChange(relabeled)
      if (editingId === renaming.id) setEditingId(id)
    }
    setRenaming(null)
  }

  const deleteSection = (id: string) => {
    if (exhibits.some((e) => e.section === id)) return flash(`Section ${id} still has exhibits; move them first`)
    if (amenities.some((a) => a.section === id)) return flash(`Section ${id} still has amenities; move them first`)
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
                : 'Click inside a section to add an exhibit; drag a pin to move it')}
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
                  onClick={() => {
                    setNewForm(null)
                    setEditingId(editingId === s.id ? null : s.id)
                  }}
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
        {newForm && (
          <div className="mt-3 rounded bg-slate-800 p-2">
            <div className="flex gap-1">
              {(['exhibit', 'amenity'] as const).map((k) => (
                <button key={k} className={`${btn} capitalize ${newForm.kind === k ? 'bg-sky-700' : ''}`} onClick={() => setNewForm({ ...newForm, kind: k })}>
                  {k}
                </button>
              ))}
            </div>
            <p className="mt-2 font-bold">New {newForm.kind} in section {newForm.section}</p>
            {newForm.kind === 'exhibit' && <p className="text-xs text-slate-400">Code: assigned on save</p>}
            <input
              autoFocus
              className="mt-2 w-full rounded bg-slate-700 px-2 py-1 text-white"
              placeholder="Name (required)"
              value={newForm.name}
              onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addNew()
                if (e.key === 'Escape') setNewForm(null)
              }}
            />
            <div className="mt-2 flex gap-2">
              {newForm.kind === 'amenity' ? (
                <select className="flex-1 rounded bg-slate-700 px-1 py-1" value={newForm.amenityType} onChange={(e) => setNewForm({ ...newForm, amenityType: e.target.value as AmenityType })}>
                  {AMENITY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              ) : (
                <>
                  <select className="flex-1 rounded bg-slate-700 px-1 py-1" value={newForm.type} onChange={(e) => setNewForm({ ...newForm, type: e.target.value })}>
                    <option value="">— type —</option>
                    {TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <select className="flex-1 rounded bg-slate-700 px-1 py-1" value={newForm.tier} onChange={(e) => setNewForm({ ...newForm, tier: e.target.value })}>
                    {TIERS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <button className={`${btn} px-3 py-1 text-sm`} disabled={!newForm.name.trim()} onClick={addNew}>
                Add
              </button>
              <button className={`${btn} px-3 py-1 text-sm`} onClick={() => setNewForm(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
