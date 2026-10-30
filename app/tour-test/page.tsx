'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Viewer } from '@photo-sphere-viewer/core'
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin'
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin'

const PIN_HTML = `
  <div style="
    width:36px;height:44px;cursor:pointer;
    display:flex;flex-direction:column;align-items:center;gap:0;
  ">
    <div style="
      width:36px;height:36px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      background:#f97316;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
    ">
      <span style="transform:rotate(45deg);font-size:16px;">🌿</span>
    </div>
  </div>
`

const NODES = [
  {
    id: 'entrance',
    panorama: '/pano/entrance.jpg',
    name: 'Entrance',
    links: [{ nodeId: 'plaza', position: { yaw: 0, pitch: -0.2 } }],
    markers: [
      {
        id: 'exhibit-entrance',
        position: { yaw: 0.8, pitch: 0.1 },
        html: PIN_HTML,
        anchor: 'bottom center',
        data: { exhibitUrl: '/s/A7X3' },
      },
    ],
  },
  {
    id: 'plaza',
    panorama: '/pano/plaza.jpg',
    name: 'Main Plaza',
    links: [{ nodeId: 'entrance', position: { yaw: Math.PI, pitch: -0.2 } }],
    markers: [
      {
        id: 'exhibit-plaza',
        position: { yaw: -0.5, pitch: 0.05 },
        html: PIN_HTML,
        anchor: 'bottom center',
        data: { exhibitUrl: '/s/B2K9' },
      },
    ],
  },
]

export default function TourTestPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!containerRef.current) return

    const viewer = new Viewer({
      container: containerRef.current,
      plugins: [
        MarkersPlugin,
        [
          VirtualTourPlugin,
          {
            nodes: NODES,
            startNodeId: 'entrance',
          },
        ],
      ],
    })

    const markers = viewer.getPlugin(MarkersPlugin)
    markers.addEventListener('select-marker', ({ marker }) => {
      const url = marker.data?.exhibitUrl
      if (url) router.push(url)
    })

    viewerRef.current = viewer
    return () => viewer.destroy()
  }, [router])

  return (
    <div className="relative w-full h-screen">
      <div ref={containerRef} className="w-full h-full" />
      <button
        onClick={() => router.push('/')}
        className="absolute top-4 left-4 z-10 flex items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur-sm"
      >
        ← Back
      </button>
    </div>
  )
}
