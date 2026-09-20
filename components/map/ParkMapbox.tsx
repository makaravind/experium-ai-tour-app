'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useDebugStore } from '@/lib/debug-store'

interface ParkMapboxProps {
  onLoadError: () => void
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

export default function ParkMapbox({ onLoadError }: ParkMapboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const setMapDebug = useDebugStore((s) => s.setMapDebug)

  useEffect(() => {
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

    const map = new mapboxgl.Map({
      container: containerRef.current!,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: STARTING_CENTER,
      zoom: STARTING_ZOOM,
      maxBounds: MAX_BOUNDS,
      minZoom: 14,
    })

    map.on('load', () => {
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

    return () => map.remove()
  }, [])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
