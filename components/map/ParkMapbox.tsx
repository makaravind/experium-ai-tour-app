'use client'

import { useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface ParkMapboxProps {
  onLoadError: () => void
}

export default function ParkMapbox({ onLoadError }: ParkMapboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  return <div ref={containerRef} className="absolute inset-0" />
}
