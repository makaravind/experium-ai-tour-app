'use client'

import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'
import { useDebugStore } from '@/lib/debug-store'
import { useMapStore } from '@/lib/map-store'
import { useStore } from '@/lib/store'
import { toMapExhibits } from '@/lib/map-exhibits'
import { classifyGeoError, lerpPosition, type LatLng } from '@/lib/gps'
import { nearestWithin, pinPixelHeight } from '@/lib/nearby'
import { AmenityTypeIcon } from '@/components/icons'
import type { CachedAmenity, ExhibitStatus, MapExhibit } from '@/lib/types'

interface ParkMapProps {
  onLoadError: () => void
  onPinTap: (exhibit: MapExhibit) => void
  onAmenityTap: (id: string) => void
  hideAmenities?: boolean
  flyToTarget?: string | null
  onMapTap?: () => void
}

const ORTHO_BOUNDS: [number, number, number, number] = [
  78.45778053580075, 17.934780490162368, 78.46515161551673, 17.940598787066882,
]
const MAX_BOUNDS: [number, number, number, number] = [
  ORTHO_BOUNDS[0] - 0.001,
  ORTHO_BOUNDS[1] - 0.001,
  ORTHO_BOUNDS[2] + 0.001,
  ORTHO_BOUNDS[3] + 0.001,
]
const STARTING_CENTER: [number, number] = [
  (ORTHO_BOUNDS[0] + ORTHO_BOUNDS[2]) / 2,
  (ORTHO_BOUNDS[1] + ORTHO_BOUNDS[3]) / 2,
]
const STARTING_ZOOM = 18
const POSITION_UNAVAILABLE = 2
const MOCK_WALK_MS = 5000
const MOCK_ACCURACY_M = 15

// The `exhibit-pins` circle layer is invisible (opacity 0) once the 3D marker layer loads, but
// stays the hit target — sized/translated to sit over the drawn pin, which is tip-anchored and
// grows upward. Sampled at min/starting/max zoom using pinPixelHeight's own clamp curve; a
// generous (not tight) target, so radius is half the pin's on-screen height and the disc is
// translated up by that same amount.
const HIT_CIRCLE_RADIUS_MIN = 0.5 * pinPixelHeight(14, STARTING_CENTER[1])
const HIT_CIRCLE_RADIUS_START = 0.5 * pinPixelHeight(STARTING_ZOOM, STARTING_CENTER[1])
const HIT_CIRCLE_RADIUS_MAX = 0.5 * pinPixelHeight(22, STARTING_CENTER[1])

function isOutOfOrthoBounds(center: maplibregl.LngLat): boolean {
  return (
    center.lng < ORTHO_BOUNDS[0] ||
    center.lat < ORTHO_BOUNDS[1] ||
    center.lng > ORTHO_BOUNDS[2] ||
    center.lat > ORTHO_BOUNDS[3]
  )
}

type PeekChip = {
  id: string
  name: string
  visited: boolean
  status?: ExhibitStatus
  edge: 'left' | 'right' | 'top' | 'bottom'
  offset: number // px along the edge: y-coord for left/right, x-coord for top/bottom
}
export type { PeekChip }

export function calcPeekChips(
  map: maplibregl.Map,
  exhibits: MapExhibit[],
  visitedIds: string[]
): PeekChip[] {
  const bounds = map.getBounds()!
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()

  const W = map.getCanvas().width
  const H = map.getCanvas().height

  // Extended bounds: 50% expansion in each direction
  const lngSpan = ne.lng - sw.lng
  const latSpan = ne.lat - sw.lat
  const extSw = { lng: sw.lng - lngSpan * 0.5, lat: sw.lat - latSpan * 0.5 }
  const extNe = { lng: ne.lng + lngSpan * 0.5, lat: ne.lat + latSpan * 0.5 }

  const chips: PeekChip[] = []

  for (const exhibit of exhibits) {
    const { gps_lng: lng, gps_lat: lat } = exhibit

    // Skip if inside viewport
    if (lng >= sw.lng && lng <= ne.lng && lat >= sw.lat && lat <= ne.lat) continue
    // Skip if outside extended bounds
    if (lng < extSw.lng || lng > extNe.lng || lat < extSw.lat || lat > extNe.lat) continue

    const { x, y } = map.project([lng, lat])

    const dx = x < 0 ? x : x > W ? x - W : 0
    const dy = y < 0 ? y : y > H ? y - H : 0

    let edge: PeekChip['edge']
    let offset: number

    if (Math.abs(dx) >= Math.abs(dy)) {
      edge = dx < 0 ? 'left' : 'right'
      offset = Math.min(Math.max(y, 16), H - 16)
    } else {
      edge = dy < 0 ? 'top' : 'bottom'
      offset = Math.min(Math.max(x, 16), W - 16)
    }

    chips.push({
      id: exhibit.id,
      name: exhibit.name,
      visited: visitedIds.includes(exhibit.id),
      status: exhibit.status,
      edge,
      offset,
    })
  }

  return chips
}

const EDGE_ROTATION: Record<PeekChip['edge'], number> = {
  bottom: 0,
  top: 180,
  left: 90,
  right: -90,
}

const MARGIN = 8

function PeekChipEl({ chip }: { chip: PeekChip }) {
  const style: React.CSSProperties =
    chip.edge === 'left'
      ? { position: 'absolute', left: MARGIN, top: chip.offset - 14 }
      : chip.edge === 'right'
        ? { position: 'absolute', right: MARGIN, top: chip.offset - 14 }
        : chip.edge === 'top'
          ? { position: 'absolute', top: MARGIN, left: chip.offset - 14 }
          : { position: 'absolute', bottom: MARGIN, left: chip.offset - 14 }

  return (
    <div style={style}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        style={{
          transform: `rotate(${EDGE_ROTATION[chip.edge]}deg)`,
          display: 'block',
          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))',
        }}
        fill={
          chip.status === 'coming_soon'
            ? 'var(--color-ex-coming-soon)'
            : chip.visited
              ? 'var(--color-ex-forest)'
              : 'var(--color-ex-orange)'
        }
      >
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
        <circle cx="12" cy="9" r="2.5" fill="white" />
      </svg>
    </div>
  )
}

function AmenityChipEl({ amenity, selected }: { amenity: CachedAmenity; selected: boolean }) {
  return (
    <>
      <div
        className="grid place-items-center bg-ex-amenity"
        data-selected={selected}
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          border: '2px solid rgba(255,255,255,0.75)',
          boxShadow: `${selected ? '0 0 0 3px rgba(90,127,160,0.4), ' : ''}0 2px 6px rgba(0,0,0,0.28)`,
        }}
      >
        <AmenityTypeIcon type={amenity.type} size={14} color="#fff" />
      </div>
      <span
        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-ex-amenity"
        style={{
          top: '100%',
          marginTop: 3,
          fontSize: 8,
          fontWeight: 800,
          background: 'rgba(255,255,255,0.9)',
          borderRadius: 5,
          padding: '1.5px 5px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        }}
      >
        {amenity.name}
      </span>
    </>
  )
}

export default function ParkMap({
  onLoadError,
  onPinTap,
  onAmenityTap,
  hideAmenities,
  flyToTarget,
  onMapTap,
}: ParkMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const exhibitsRef = useRef<MapExhibit[]>([])
  const mapRef = useRef<maplibregl.Map | null>(null)
  const flyToTargetRef = useRef(flyToTarget)
  const onPinTapRef = useRef(onPinTap)
  const onAmenityTapRef = useRef(onAmenityTap)
  const onMapTapRef = useRef(onMapTap)
  // Keep refs current so stale-closure handlers always call the latest callbacks
  // eslint-disable-next-line react-hooks/refs
  flyToTargetRef.current = flyToTarget
  // eslint-disable-next-line react-hooks/refs
  onPinTapRef.current = onPinTap
  // eslint-disable-next-line react-hooks/refs
  onAmenityTapRef.current = onAmenityTap
  // eslint-disable-next-line react-hooks/refs
  onMapTapRef.current = onMapTap
  const [peekChips, setPeekChips] = useState<PeekChip[]>([])
  const [mapReady, setMapReady] = useState(false)
  const [amenityChips, setAmenityChips] = useState<
    { amenity: CachedAmenity; el: HTMLDivElement }[]
  >([])
  const cachedAmenities = useStore((s) => s.cachedAmenities)
  const activeAmenityId = useMapStore((s) => s.activeAmenityId)
  const setMapDebug = useDebugStore((s) => s.setMapDebug)

  useEffect(() => {
    let cancelled = false
    let watchId: number | null = null
    let mockFrame: number | null = null
    let stopWatcherRef: (() => void) | null = null
    let unsubscribeMock: (() => void) | null = null

    const savedViewport = useStore.getState().mapViewport
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
            minzoom: 14,
            maxzoom: 19,
          },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#0f172a' } },
          { id: 'park', type: 'raster', source: 'park' },
        ],
      },
      center: savedViewport?.center ?? STARTING_CENTER,
      zoom: savedViewport?.zoom ?? STARTING_ZOOM,
      maxBounds: MAX_BOUNDS,
      minZoom: 14,
    })

    mapRef.current = map

    map.on('load', async () => {
      if (cancelled) return
      exhibitsRef.current = toMapExhibits(useStore.getState().cachedExhibits)

      const visitedExhibits = useStore.getState().visitedExhibits
      const exhibitPinsGeoJson = {
        type: 'FeatureCollection' as const,
        features: exhibitsRef.current.map((exhibit) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [exhibit.gps_lng, exhibit.gps_lat],
          },
          properties: {
            id: exhibit.id,
            discovered: visitedExhibits.includes(exhibit.id),
          },
        })),
      }

      map.addSource('exhibit-pins', {
        type: 'geojson',
        data: exhibitPinsGeoJson,
      })
      map.addLayer({
        id: 'exhibit-pins',
        type: 'circle',
        source: 'exhibit-pins',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            14,
            HIT_CIRCLE_RADIUS_MIN,
            STARTING_ZOOM,
            HIT_CIRCLE_RADIUS_START,
            22,
            HIT_CIRCLE_RADIUS_MAX,
          ],
          'circle-translate': [
            'interpolate',
            ['linear'],
            ['zoom'],
            14,
            ['literal', [0, 0]],
            STARTING_ZOOM,
            ['literal', [0, 0]],
            22,
            ['literal', [0, 0]],
          ],
          'circle-color': ['case', ['==', ['get', 'discovered'], true], '#588157', '#dda15e'],
          'circle-opacity': 0,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0,
        },
      })

      const markerInputs = exhibitsRef.current.map((exhibit) => ({
        id: exhibit.id,
        lat: exhibit.gps_lat,
        lng: exhibit.gps_lng,
        status: exhibit.status,
        number: exhibit.displayNumber,
      }))

      try {
        const { createMarkerLayer } = await import('./marker-layer')
        map.addLayer(
          createMarkerLayer({
            map,
            getExhibits: () => markerInputs,
          })
        )
      } catch (err) {
        map.setPaintProperty('exhibit-pins', 'circle-opacity', 1)
        map.setPaintProperty('exhibit-pins', 'circle-stroke-opacity', 1)
        console.error('Failed to load 3D marker layer, falling back to circle markers', err)
      }

      const youDot = document.createElement('div')
      youDot.className = 'you-dot'
      const youMarker = new maplibregl.Marker({ element: youDot, anchor: 'center' })
      let markerAdded = false
      let hasFix = false

      const handlePosition = (lat: number, lng: number, accuracyM: number) => {
        const mapStore = useMapStore.getState()
        if (!markerAdded) {
          youMarker.setLngLat([lng, lat]).addTo(map)
          markerAdded = true
        } else {
          youMarker.setLngLat([lng, lat])
        }
        mapStore.setUserPosition({ lat, lng, accuracyM })
        mapStore.setGeoError(null)

        const visitedIds = useStore.getState().visitedExhibits
        const ids = nearestWithin(
          { lat, lng, accuracyM },
          exhibitsRef.current
            .filter((exhibit) => exhibit.status === 'live' && !visitedIds.includes(exhibit.id))
            .map((exhibit) => ({
              id: exhibit.id,
              lat: exhibit.gps_lat,
              lng: exhibit.gps_lng,
            }))
        )
        mapStore.setNearbyExhibitIds(ids)

        if (!hasFix) {
          hasFix = true
          mapStore.setFollowMode('following')
          map.flyTo({ center: [lng, lat] })
        } else if (mapStore.followMode === 'following') {
          map.panTo([lng, lat])
        }
      }

      const handleGeoError = (code: number) => {
        const mapStore = useMapStore.getState()
        mapStore.setGeoError(classifyGeoError(code))
        mapStore.setFollowMode('idle')
        mapStore.setNearbyExhibitIds([])
        if (markerAdded) {
          youMarker.remove()
          markerAdded = false
        }
        hasFix = false
      }

      const stopWatcher = () => {
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId)
          watchId = null
        }
        if (mockFrame !== null) {
          cancelAnimationFrame(mockFrame)
          mockFrame = null
        }
      }
      stopWatcherRef = stopWatcher

      const startWatcher = () => {
        stopWatcher()
        if (useDebugStore.getState().mockGpsEnabled) return
        if (!('geolocation' in navigator)) {
          handleGeoError(POSITION_UNAVAILABLE)
          return
        }
        watchId = navigator.geolocation.watchPosition(
          (pos) => handlePosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
          (err) => handleGeoError(err.code),
          { enableHighAccuracy: true }
        )
      }

      const startMockWalk = (to: LatLng) => {
        if (mockFrame !== null) cancelAnimationFrame(mockFrame)
        const current = useMapStore.getState().userPosition
        const c = map.getCenter()
        const from: LatLng = current ?? { lat: c.lat, lng: c.lng }
        const startedAt = performance.now()
        const tick = (now: number) => {
          const t = Math.min(1, (now - startedAt) / MOCK_WALK_MS)
          const p = lerpPosition(from, to, t)
          handlePosition(p.lat, p.lng, MOCK_ACCURACY_M)
          mockFrame = t < 1 ? requestAnimationFrame(tick) : null
        }
        mockFrame = requestAnimationFrame(tick)
      }

      startWatcher()
      unsubscribeMock = useDebugStore.subscribe((state, prev) => {
        if (state.mockGpsEnabled !== prev.mockGpsEnabled) startWatcher()
      })
      useMapStore.getState().setRecenterTrigger(() => {
        const pos = useMapStore.getState().userPosition
        if (!pos) return
        useMapStore.getState().setFollowMode('following')
        map.flyTo({ center: [pos.lng, pos.lat] })
      })
      useMapStore.getState().setRetryGpsTrigger(startWatcher)
      map.on('dragstart', () => useMapStore.getState().setFollowMode('idle'))

      map.on('click', 'exhibit-pins', (e) => {
        const feature = e.features?.[0]
        if (!feature) return
        const exhibit = exhibitsRef.current.find((ex) => ex.id === feature.properties?.id)
        if (exhibit) onPinTapRef.current(exhibit)
      })

      map.on('click', (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ['exhibit-pins'] })
        if (hits.length === 0) {
          onMapTapRef.current?.()
        }
        if (useDebugStore.getState().mockGpsEnabled) {
          startMockWalk({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        }
      })

      map.on('mouseenter', 'exhibit-pins', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'exhibit-pins', () => {
        map.getCanvas().style.cursor = ''
      })

      if (useDebugStore.getState().isActive) {
        const updateDebug = () => {
          const center = map.getCenter()
          setMapDebug({
            zoom: map.getZoom(),
            startingZoom: STARTING_ZOOM,
            outOfBounds: isOutOfOrthoBounds(center),
            lat: center.lat,
            lng: center.lng,
          })
        }
        updateDebug()
        map.on('move', updateDebug)
      }

      if (flyToTargetRef.current) {
        const pending = exhibitsRef.current.find((ex) => ex.id === flyToTargetRef.current)
        if (pending) map.flyTo({ center: [pending.gps_lng, pending.gps_lat], zoom: 19 })
      }

      // Initial peek chip calculation — moveend won't fire on first load
      setPeekChips(calcPeekChips(map, exhibitsRef.current, visitedExhibits))

      map.on('moveend', () => {
        const visited = useStore.getState().visitedExhibits
        setPeekChips(calcPeekChips(map, exhibitsRef.current, visited))
        const c = map.getCenter()
        useStore.getState().setMapViewport({ center: [c.lng, c.lat], zoom: map.getZoom() })
      })

      setMapReady(true)
    })

    map.on('error', onLoadError)

    return () => {
      cancelled = true
      unsubscribeMock?.()
      stopWatcherRef?.()
      map.off('error', onLoadError)
      map.remove()
      maplibregl.removeProtocol('pmtiles')
      useMapStore.getState().setRecenterTrigger(null)
      useMapStore.getState().setRetryGpsTrigger(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map initialises once; callbacks are stable refs
  }, [])

  useEffect(() => {
    if (!flyToTarget || !mapRef.current) return
    const exhibit = exhibitsRef.current.find((ex) => ex.id === flyToTarget)
    if (!exhibit) return
    mapRef.current.flyTo({ center: [exhibit.gps_lng, exhibit.gps_lat], zoom: 19 })
  }, [flyToTarget])

  // Amenity chips are DOM markers; React content is portalled into each marker element.
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || hideAmenities) return
    const chips = cachedAmenities.map((amenity) => {
      const el = document.createElement('div')
      el.setAttribute('role', 'button')
      el.tabIndex = 0
      el.style.cursor = 'pointer'
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onAmenityTapRef.current(amenity.id)
      })
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        onAmenityTapRef.current(amenity.id)
      })
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([amenity.gps_lng, amenity.gps_lat])
        .addTo(map)
      el.setAttribute('aria-label', amenity.name) // addTo sets a generic "Map marker" label
      return { amenity, el, marker }
    })
    setAmenityChips(chips)
    return () => {
      chips.forEach((c) => c.marker.remove())
      setAmenityChips([])
    }
  }, [mapReady, hideAmenities, cachedAmenities])

  useEffect(() => {
    if (!activeAmenityId || !mapRef.current) return
    const amenity = useStore.getState().cachedAmenities.find((a) => a.id === activeAmenityId)
    if (!amenity) return
    // GPS follow would panTo(user) over the flyTo
    useMapStore.getState().setFollowMode('idle')
    mapRef.current.flyTo({ center: [amenity.gps_lng, amenity.gps_lat] })
  }, [activeAmenityId])

  useEffect(() => {
    amenityChips.forEach(({ amenity, el }) =>
      el.setAttribute('aria-pressed', String(amenity.id === activeAmenityId))
    )
  }, [amenityChips, activeAmenityId])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {amenityChips.map(({ amenity, el }) =>
        createPortal(
          <AmenityChipEl amenity={amenity} selected={amenity.id === activeAmenityId} />,
          el,
          amenity.id
        )
      )}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {peekChips.map((chip) => (
          <PeekChipEl key={chip.id} chip={chip} />
        ))}
      </div>
    </div>
  )
}
