'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface ParkMapboxProps {
  onLoadError: () => void
}

export default function ParkMapbox({ onLoadError }: ParkMapboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

    const map = new mapboxgl.Map({
      container: containerRef.current!,
      style: 'mapbox://styles/mapbox/satellite-v9',
    })
  }, [])

  return <div ref={containerRef} className="absolute inset-0" />
}
