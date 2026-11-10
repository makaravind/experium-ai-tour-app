'use client'

import { useEffect, useRef } from 'react'
import { Viewer } from '@photo-sphere-viewer/core'
import { EquirectangularTilesAdapter } from '@photo-sphere-viewer/equirectangular-tiles-adapter'
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin'
import type { EquirectangularMultiTilesPanorama } from '@photo-sphere-viewer/equirectangular-tiles-adapter'

interface Props {
  nodeId: string
  name: string
  panorama: EquirectangularMultiTilesPanorama
  /** initial yaw in radians, applied on entry only */
  yaw: number
}

/** Loaded via next/dynamic (ssr: false) from app/tour/page.tsx. */
export default function TourViewer({ nodeId, name, panorama, yaw }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const viewer = new Viewer({
      container: containerRef.current,
      adapter: [EquirectangularTilesAdapter, { showErrorTile: false }],
      defaultYaw: yaw,
      navbar: false,
      plugins: [
        [
          VirtualTourPlugin,
          {
            // m9b adds links/markers and more nodes; preload stays off until then
            nodes: [{ id: nodeId, name, panorama }],
            startNodeId: nodeId,
            preload: false,
          },
        ],
      ],
    })
    return () => viewer.destroy()
  }, [nodeId, name, panorama, yaw])

  return <div ref={containerRef} className="h-full w-full" />
}
