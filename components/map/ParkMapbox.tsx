'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useDebugStore } from '@/lib/debug-store'
import { useStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import type { MapExhibit } from '@/lib/types'

interface ParkMapboxProps {
  onLoadError: () => void
  onPinTap: (exhibit: MapExhibit) => void
  flyToTarget?: string | null
}

const ORTHO_ID = 'aravindmetku.nedour'
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

function isOutOfOrthoBounds(center: mapboxgl.LngLat): boolean {
  return (
    center.lng < ORTHO_BOUNDS[0] ||
    center.lat < ORTHO_BOUNDS[1] ||
    center.lng > ORTHO_BOUNDS[2] ||
    center.lat > ORTHO_BOUNDS[3]
  )
}

export default function ParkMapbox({ onLoadError, onPinTap, flyToTarget }: ParkMapboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const exhibitsRef = useRef<MapExhibit[]>([])
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const setMapDebug = useDebugStore((s) => s.setMapDebug)

  useEffect(() => {
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
    let cancelled = false

    const map = new mapboxgl.Map({
      container: containerRef.current!,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: STARTING_CENTER,
      zoom: STARTING_ZOOM,
      maxBounds: MAX_BOUNDS,
      minZoom: 14,
    })

    mapRef.current = map

    map.on('load', async () => {
      if (cancelled) return
      map.addSource('ortho', {
        type: 'raster',
        url: `mapbox://${ORTHO_ID}`,
        tileSize: 256,
      })
      map.addLayer({
        id: 'ortho-layer',
        type: 'raster',
        source: 'ortho',
        paint: {
          'raster-opacity': 1,
          'raster-resampling': 'linear',
        },
      })

      const { data } = await supabase
        .from('exhibits')
        .select('id, name, type, tier, gps_lng, gps_lat, exhibit_qr_codes(code)')
        .eq('exhibit_qr_codes.status', 'active')
        .not('gps_lat', 'is', null)
        .not('gps_lng', 'is', null)

      exhibitsRef.current = (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        tier: row.tier,
        gps_lat: row.gps_lat,
        gps_lng: row.gps_lng,
        qr_code: (row.exhibit_qr_codes as { code: string }[] | null)?.[0]?.code ?? null,
      }))

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
          'circle-radius': 8,
          'circle-color': ['case', ['==', ['get', 'discovered'], true], '#588157', '#dda15e'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      map.on('click', 'exhibit-pins', (e) => {
        const feature = e.features?.[0]
        if (!feature) return
        const exhibit = exhibitsRef.current.find((ex) => ex.id === feature.properties?.id)
        if (exhibit) onPinTap(exhibit)
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
    })

    map.on('error', onLoadError)

    return () => {
      cancelled = true
      map.off('error', onLoadError)
      map.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map initialises once; callbacks are stable refs
  }, [])

  useEffect(() => {
    if (!flyToTarget || !mapRef.current) return
    const exhibit = exhibitsRef.current.find((ex) => ex.id === flyToTarget)
    if (!exhibit) return
    mapRef.current.flyTo({ center: [exhibit.gps_lng, exhibit.gps_lat], zoom: 19 })
  }, [flyToTarget])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
