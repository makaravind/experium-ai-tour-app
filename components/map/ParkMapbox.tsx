'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface ParkMapboxProps {
  onLoadError: () => void
}

const ORTHO_ID = 'aravindmetku.nedour'
const ORTHO_BOUNDS: [number, number, number, number] = [
  78.45778053580075, 17.934780490162368, 78.46515161551673, 17.940598787066882,
]

export default function ParkMapbox({ onLoadError }: ParkMapboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

    const map = new mapboxgl.Map({
      container: containerRef.current!,
      style: 'mapbox://styles/mapbox/satellite-v9',
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
      map.fitBounds(ORTHO_BOUNDS, { padding: 40, maxZoom: 19 })
    })

    map.on('error', onLoadError)

    return () => map.remove()
  }, [])

  return <div ref={containerRef} className="absolute inset-0" />
}
