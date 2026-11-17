'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'

import { sectionAt } from '@/lib/admin/geometry'
import { moveAmenityPin, movePin, newAmenity, newExhibit } from '@/lib/admin/pins'
import { insertVertex, planRegroup, removeVertex } from '@/lib/admin/regroup'
import {
  assignUnplaced,
  centroid,
  nextFreeLetter,
  renameAmenitiesSection,
  renameExhibitsSection,
  renameSection,
  strandedExhibits,
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
const AMENITY_TAGS: Record<AmenityType, string> = {
  washroom: 'WC',
  ticketing: 'TKT',
  food: 'FOOD',
  gate: 'GATE',
  leisure: 'LEI',
}
const AMENITY_TYPES = Object.keys(AMENITY_TAGS) as AmenityType[]
const AMENITY_COLOR = '#5a7fa0' // --color-ex-amenity (visitor amenity chips)
const COLORS = [
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#fbbf24',
  '#f472b6',
  '#fb923c',
  '#22d3ee',
  '#a3e635',
]
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

const midpoint = (a: LngLat, b: LngLat): LngLat => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

const NO_AMENITIES: AdminAmenity[] = []
const noop = () => {}

export default function AdminMap({
  sections,
  exhibits,
  deletedSectionIds,
  onSectionsChange,
  onExhibitsChange,
  selectedId,
  onSelect,
  amenities = NO_AMENITIES,
  onAmenitiesChange = noop,
  deletedAmenities = NO_AMENITIES,
  selectedAmenityId,
  onSelectAmenity,
}: AdminMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const labelsRef = useRef(new Map<string, maplibregl.Marker>())
  const pinsRef = useRef(new Map<string, maplibregl.Marker>())
  const amenityPinsRef = useRef(new Map<string, maplibregl.Marker>())
  const handlesRef = useRef<{
    id: string
    markers: maplibregl.Marker[]
    mids: maplibregl.Marker[]
  } | null>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [ready, setReady] = useState(false)
  const [drawing, setDrawing] = useState<LngLat[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState<'reshape' | 'regroup'>('reshape')
  // Regroup edit awaiting Apply/Cancel: the polygon is shown on the map but not yet committed
  const [pending, setPending] = useState<{ id: string; polygon: LngLat[] } | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  const [hint, setHint] = useState('')
  const [pinsLocked, setPinsLocked] = useState(false)
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

  const editingPolygon =
    pending && pending.id === editingId
      ? pending.polygon
      : sections.find((s) => s.id === editingId)?.polygon
  // sections as drawn: the pending regroup polygon replaces the committed one
  const shown = useMemo(
    () =>
      pending
        ? sections.map((s) => (s.id === pending.id ? { ...s, polygon: pending.polygon } : s))
        : sections,
    [sections, pending]
  )
  // recomputed from live pins/sections so the preview never drifts from what Apply commits
  const pendingPlan = useMemo(
    () =>
      pending ? planRegroup(pending.id, pending.polygon, sections, exhibits, amenities) : null,
    [pending, sections, exhibits, amenities]
  )

  // handlers registered on the map/markers once read the latest props through this
  const latest = useRef({
    shown,
    displayPolygon: editingPolygon,
    sections,
    exhibits,
    amenities,
    onSectionsChange,
    onExhibitsChange,
    onAmenitiesChange,
    select,
    selectAmenity,
  })
  useEffect(() => {
    latest.current = {
      shown,
      displayPolygon: editingPolygon,
      sections,
      exhibits,
      amenities,
      onSectionsChange,
      onExhibitsChange,
      onAmenitiesChange,
      select,
      selectAmenity,
    }
  })

  const isDrawing = drawing !== null

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
          park: {
            type: 'raster',
            url: 'pmtiles:///park.pmtiles',
            tileSize: 256,
            minzoom: 15,
            maxzoom: 21,
          },
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
      map.addLayer({
        id: 'sections-fill',
        type: 'fill',
        source: 'sections',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.18 },
      })
      map.addLayer({
        id: 'sections-line',
        type: 'line',
        source: 'sections',
        paint: { 'line-color': ['get', 'color'], 'line-width': 2 },
      })
      map.addSource('draft', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'draft-line',
        type: 'line',
        source: 'draft',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': '#fff', 'line-width': 2, 'line-dasharray': [2, 2] },
      })
      map.addLayer({
        id: 'draft-pts',
        type: 'circle',
        source: 'draft',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#fff',
          'circle-stroke-color': '#0ea5e9',
          'circle-stroke-width': 2,
        },
      })
      setReady(true)
    })

    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current)
      handlesRef.current?.markers.forEach((m) => m.remove())
      handlesRef.current?.mids.forEach((m) => m.remove())
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
    setData(map, 'sections', sectionsGeoJson(shown))
    const labels = labelsRef.current
    const ids = new Set(shown.map((s) => s.id))
    for (const [id, marker] of labels) {
      if (!ids.has(id)) {
        marker.remove()
        labels.delete(id)
      }
    }
    for (const s of shown) {
      let marker = labels.get(s.id)
      if (!marker) {
        const el = document.createElement('div')
        el.textContent = s.id
        el.style.cssText =
          'pointer-events:none;font-size:14px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.9)'
        marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(centroid(s.polygon))
          .addTo(map)
        labels.set(s.id, marker)
      }
      marker.setLngLat(centroid(s.polygon))
    }
  }, [shown, ready])

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
        marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'center' })
          .setLngLat([e.gps_lng!, e.gps_lat!])
          .addTo(map)
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
      marker.setDraggable(!isDrawing && !pinsLocked)
      const el = marker.getElement()
      const isSel = e.id === selected
      el.textContent = e.section ? `${e.section}${e.number}` : String(e.code ?? '?')
      if (e.status === 'live') {
        // green check badge, top-right corner (textContent above cleared any previous one)
        const badge = document.createElement('span')
        badge.textContent = '✓'
        badge.setAttribute('data-testid', 'live-badge')
        Object.assign(badge.style, {
          position: 'absolute',
          top: '-6px',
          right: '-6px',
          width: '14px',
          height: '14px',
          borderRadius: '7px',
          background: '#22c55e',
          border: '1.5px solid #fff',
          fontSize: '9px',
          lineHeight: '11px',
          textAlign: 'center',
        })
        el.appendChild(badge)
      }
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
        cursor: isDrawing ? 'crosshair' : pinsLocked ? 'pointer' : 'grab',
        pointerEvents: isDrawing ? 'none' : 'auto',
        filter: e.status === 'disabled' ? 'grayscale(1) opacity(.5)' : 'none',
        textDecoration: e.status === 'disabled' ? 'line-through' : 'none',
        background: e.section ? '#ef4444' : '#94a3b8',
        border: `2px solid ${isSel ? '#fde047' : '#fff'}`,
        boxShadow: isSel ? '0 0 0 3px rgba(253,224,71,.5)' : '0 1px 4px rgba(0,0,0,.6)',
        zIndex: isSel ? '2' : '1',
      })
    }
  }, [exhibits, selected, isDrawing, pinsLocked, ready, flash])

  // amenity pins: square, amenity colour, labelled `WC · G` (type tag + section); staged deletes are faded and inert
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const pins = amenityPinsRef.current
    const rows = [
      ...amenities.map((a) => ({ a, deleted: false })),
      ...deletedAmenities.map((a) => ({ a, deleted: true })),
    ]
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
        marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'center' })
          .setLngLat([a.gps_lng, a.gps_lat])
          .addTo(map)
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
      marker.setDraggable(!isDrawing && !pinsLocked && !deleted)
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
        cursor: isDrawing ? 'crosshair' : pinsLocked ? 'pointer' : 'grab',
        pointerEvents: isDrawing || deleted ? 'none' : 'auto',
        filter: deleted ? 'grayscale(1) opacity(.4)' : 'none', // not `opacity`: MapLibre owns the marker's
        textDecoration: deleted ? 'line-through' : 'none',
        background: a.section ? AMENITY_COLOR : '#94a3b8',
        border: `2px solid ${isSel ? '#fde047' : 'rgba(255,255,255,.75)'}`,
        boxShadow: isSel ? '0 0 0 3px rgba(253,224,71,.5)' : '0 1px 4px rgba(0,0,0,.6)',
        zIndex: isSel ? '2' : '1',
      })
    }
  }, [amenities, deletedAmenities, selectedAmenity, isDrawing, pinsLocked, ready, flash])

  // click on empty map inside a section → "new exhibit" form (not while drawing / reshaping)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || isDrawing || editingId) return
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat
      const section = sectionAt(lng, lat, latest.current.sections)
      if (section)
        setNewForm({
          lng,
          lat,
          section: section.id,
          kind: 'exhibit',
          name: '',
          type: '',
          tier: 'silver',
          amenityType: 'washroom',
        })
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
    const features: GeoJSON.Feature[] = pts.map((c) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: c },
    }))
    if (pts.length > 1)
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: pts },
      })
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

  // Commits (or, in regroup mode, stages) a new polygon for section `id`; callers revert their handle on 'rejected'.
  const propose = (id: string, polygon: LngLat[]): 'applied' | 'pending' | 'rejected' => {
    const { sections: secs, exhibits: exs, amenities: ams } = latest.current
    if (editMode === 'regroup') {
      const plan = planRegroup(id, polygon, secs, exs, ams)
      if (!plan.ok) {
        flash(`Rejected: would leave ${plan.stranded.join(', ')} outside every section`)
        return 'rejected'
      }
      if (plan.moves.length) {
        setPending({ id, polygon })
        return 'pending'
      }
    } else {
      const stranded = [
        ...strandedExhibits(exs, id, polygon),
        ...strandedExhibits(ams, id, polygon),
      ]
      if (stranded.length) {
        flash(`Rejected: would leave ${stranded.map((e) => e.name).join(', ')} outside ${id}`)
        return 'rejected'
      }
    }
    setPending(null)
    latest.current.onSectionsChange(secs.map((s) => (s.id === id ? { ...s, polygon } : s)))
    return 'applied'
  }
  const proposeRef = useRef(propose)
  useEffect(() => {
    proposeRef.current = propose
  })

  // reshape/regroup mode: draggable corner handles (double-click removes one) and edge-midpoint handles (drag adds one)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const clear = () => {
      handlesRef.current?.markers.forEach((m) => m.remove())
      handlesRef.current?.mids.forEach((m) => m.remove())
      handlesRef.current = null
    }
    if (!editingId || !editingPolygon) return clear()
    const poly = editingPolygon
    const current = handlesRef.current
    if (current && current.id === editingId && current.markers.length === poly.length) {
      current.markers.forEach((m, i) => m.setLngLat(poly[i]))
      current.mids.forEach((m, k) => m.setLngLat(midpoint(poly[k], poly[(k + 1) % poly.length])))
      return
    }
    clear()
    const id = editingId
    const live = (polygon: LngLat[]) => {
      setData(
        map,
        'sections',
        sectionsGeoJson(latest.current.sections.map((s) => (s.id === id ? { ...s, polygon } : s)))
      )
      labelsRef.current.get(id)?.setLngLat(centroid(polygon))
    }
    const restore = () => {
      const base = latest.current.displayPolygon
      if (!base) return
      setData(map, 'sections', sectionsGeoJson(latest.current.shown))
      labelsRef.current.get(id)?.setLngLat(centroid(base))
      mids.forEach((m, k) => m.setLngLat(midpoint(base[k], base[(k + 1) % base.length])))
    }
    const mids: maplibregl.Marker[] = []

    const markers = poly.map((coord, i) => {
      const el = document.createElement('div')
      el.style.cssText =
        'width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid #0ea5e9;box-shadow:0 1px 4px rgba(0,0,0,.6);cursor:grab'
      el.addEventListener('click', (e) => e.stopPropagation())
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation()
        const base = latest.current.displayPolygon
        const next = base && removeVertex(base, i)
        if (!next) return flash('A section needs at least 3 corners')
        proposeRef.current(id, next)
      })
      const handle = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(coord)
        .addTo(map)
      const dragged = () => {
        const { lng, lat } = handle.getLngLat()
        return (
          latest.current.displayPolygon?.map((p, j): LngLat => (j === i ? [lng, lat] : p)) ?? null
        )
      }
      handle.on('drag', () => {
        const next = dragged()
        if (!next) return
        live(next)
        mids.forEach((m, k) => m.setLngLat(midpoint(next[k], next[(k + 1) % next.length])))
      })
      handle.on('dragend', () => {
        const next = dragged()
        if (!next) return
        if (proposeRef.current(id, next) === 'rejected') {
          handle.setLngLat(latest.current.displayPolygon![i])
          restore()
        }
      })
      return handle
    })

    poly.forEach((_, k) => {
      const el = document.createElement('div')
      el.style.cssText =
        'width:9px;height:9px;border-radius:50%;background:#0ea5e9;border:1px solid #fff;opacity:.85;cursor:copy'
      el.addEventListener('click', (e) => e.stopPropagation())
      el.addEventListener('dblclick', (e) => e.stopPropagation())
      const mid = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(midpoint(poly[k], poly[(k + 1) % poly.length]))
        .addTo(map)
      const inserted = () => {
        const { lng, lat } = mid.getLngLat()
        const base = latest.current.displayPolygon
        return base ? insertVertex(base, k, [lng, lat]) : null
      }
      mid.on('drag', () => {
        const next = inserted()
        if (next) live(next)
      })
      mid.on('dragend', () => {
        const next = inserted()
        if (next && proposeRef.current(id, next) === 'rejected') restore()
      })
      mids.push(mid)
    })
    handlesRef.current = { id, markers, mids }
  }, [editingId, editingPolygon, ready, flash])

  const applyPending = () => {
    if (!pending || !pendingPlan?.ok) return
    const { id, polygon } = pending
    const plan = pendingPlan
    setPending(null)
    onSectionsChange(sections.map((s) => (s.id === id ? { ...s, polygon } : s)))
    if (plan.exhibits !== exhibits) onExhibitsChange(plan.exhibits)
    if (plan.amenities !== amenities) onAmenitiesChange(plan.amenities)
    flash(`Regrouped ${id}: ${plan.moves.length} moved`)
  }

  const startDrawing = () => {
    setNewForm(null)
    setEditingId(null)
    setPending(null)
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
        setPending(null)
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
      if (editingId === renaming.id) {
        setEditingId(id)
        setPending(null)
      }
    }
    setRenaming(null)
  }

  const deleteSection = (id: string) => {
    if (exhibits.some((e) => e.section === id))
      return flash(`Section ${id} still has exhibits; move them first`)
    if (amenities.some((a) => a.section === id))
      return flash(`Section ${id} still has amenities; move them first`)
    if (editingId === id) {
      setEditingId(null)
      setPending(null)
    }
    onSectionsChange(sections.filter((s) => s.id !== id))
  }

  const fitSection = (s: WorkingSection) => {
    const lngs = s.polygon.map((p) => p[0])
    const lats = s.polygon.map((p) => p[1])
    mapRef.current?.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 60 }
    )
  }

  const btn = 'rounded bg-slate-700 px-2 py-0.5 text-xs hover:bg-slate-600 disabled:opacity-40'

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute left-3 top-3 z-10 w-80 rounded-lg bg-slate-900/90 p-3 text-sm text-white shadow-lg">
        <div className="flex gap-2">
          <button
            className={`${btn} px-3 py-1 text-sm`}
            onClick={isDrawing ? finishDrawing : startDrawing}
          >
            {isDrawing ? 'Finish' : 'Draw section'}
          </button>
          {isDrawing && (
            <button className={`${btn} px-3 py-1 text-sm`} onClick={() => setDrawing(null)}>
              Cancel
            </button>
          )}
          <button
            className={`${btn} ml-auto px-3 py-1 text-sm`}
            aria-pressed={pinsLocked}
            onClick={() => setPinsLocked((v) => !v)}
            title="Lock pins so they can't be dragged"
          >
            {pinsLocked ? '🔒 Pins locked' : '🔓 Pins unlocked'}
          </button>
        </div>
        <p className="mt-2 min-h-4 text-xs text-amber-300">
          {hint ||
            (isDrawing
              ? `Click to add points (${drawing.length}). Enter = finish, Esc = cancel`
              : editingId
                ? `${editMode === 'regroup' ? 'Regrouping' : 'Reshaping'} ${editingId}: drag corners, drag a small dot to add one, double-click a corner to remove. Esc = stop`
                : 'Click inside a section to add an exhibit; drag a pin to move it')}
        </p>
        {pending && pendingPlan && (
          <div className="mt-2 rounded bg-slate-800 p-2">
            {pendingPlan.ok ? (
              <>
                <p className="font-bold">
                  Regroup {pending.id}: {pendingPlan.moves.length} move
                  {pendingPlan.moves.length === 1 ? '' : 's'}
                </p>
                <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs">
                  {pendingPlan.moves.map((m) => (
                    <li key={`${m.kind}-${m.id}`}>
                      <span className="font-mono">
                        {m.from} → {m.to}
                      </span>{' '}
                      <span className="text-slate-400">
                        {m.kind === 'amenity' ? 'amenity ' : ''}
                        {m.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-xs text-amber-300">
                Can&apos;t apply: would leave {pendingPlan.stranded.join(', ')} outside every
                section
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                className={`${btn} px-3 py-1 text-sm`}
                disabled={!pendingPlan.ok}
                onClick={applyPending}
              >
                Apply
              </button>
              <button className={`${btn} px-3 py-1 text-sm`} onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        <ul className="mt-2 space-y-1">
          {sections.map((s, i) => (
            <li key={s.id} className="rounded bg-slate-800 px-2 py-1">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <button className="font-bold" onClick={() => fitSection(s)} title="Zoom to section">
                  {s.id}
                </button>
                <span className="text-xs text-slate-400">
                  {exhibits.filter((e) => e.section === s.id).length}
                </span>
                <span className="flex-1" />
                <button
                  className={btn}
                  disabled={isDrawing}
                  onClick={() => setRenaming({ id: s.id, value: s.id })}
                >
                  Rename
                </button>
                {(['reshape', 'regroup'] as const).map((m) => (
                  <button
                    key={m}
                    className={`${btn} capitalize ${editingId === s.id && editMode === m ? 'bg-sky-700' : ''}`}
                    disabled={isDrawing}
                    onClick={() => {
                      setNewForm(null)
                      setPending(null)
                      if (editingId === s.id && editMode === m) return setEditingId(null)
                      setEditMode(m)
                      setEditingId(s.id)
                    }}
                  >
                    {m}
                  </button>
                ))}
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
                    <button className={btn} onClick={commitRename}>
                      OK
                    </button>
                    <button className={btn} onClick={() => setRenaming(null)}>
                      Cancel
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-amber-300">
                    Visitors will see the new letter on every exhibit in this section (A3 → new
                    letter + 3) after Save. QR URLs are unchanged.
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
                <button
                  key={k}
                  className={`${btn} capitalize ${newForm.kind === k ? 'bg-sky-700' : ''}`}
                  onClick={() => setNewForm({ ...newForm, kind: k })}
                >
                  {k}
                </button>
              ))}
            </div>
            <p className="mt-2 font-bold">
              New {newForm.kind} in section {newForm.section}
            </p>
            {newForm.kind === 'exhibit' && (
              <p className="text-xs text-slate-400">Code: assigned on save</p>
            )}
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
                <select
                  className="flex-1 rounded bg-slate-700 px-1 py-1"
                  value={newForm.amenityType}
                  onChange={(e) =>
                    setNewForm({ ...newForm, amenityType: e.target.value as AmenityType })
                  }
                >
                  {AMENITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <select
                    className="flex-1 rounded bg-slate-700 px-1 py-1"
                    value={newForm.type}
                    onChange={(e) => setNewForm({ ...newForm, type: e.target.value })}
                  >
                    <option value="">— type —</option>
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    className="flex-1 rounded bg-slate-700 px-1 py-1"
                    value={newForm.tier}
                    onChange={(e) => setNewForm({ ...newForm, tier: e.target.value })}
                  >
                    {TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                className={`${btn} px-3 py-1 text-sm`}
                disabled={!newForm.name.trim()}
                onClick={addNew}
              >
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
