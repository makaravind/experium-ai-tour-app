'use client'

import { useEffect, useRef, useState } from 'react'
import { Viewer } from '@photo-sphere-viewer/core'
import { EquirectangularTilesAdapter } from '@photo-sphere-viewer/equirectangular-tiles-adapter'
import type { EquirectangularMultiTilesPanorama } from '@photo-sphere-viewer/equirectangular-tiles-adapter'
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin'

import type { AimMarker } from '@/lib/admin/tour-aim'
import { fetchManifest } from '@/lib/tour-data'
import { manifestToPanorama } from '@/lib/tour'

interface Props {
  tilesUrl: string
  markers: AimMarker[]
  /** Rotate the view here (degrees); `n` changes on every request so repeats re-fire. */
  focus: { yaw: number; pitch: number; n: number } | null
  /** An item is armed: crosshair cursor. */
  armed: boolean
  /** PSV click position, radians. */
  onAim: (yaw: number, pitch: number) => void
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

function toConfig(m: AimMarker) {
  const arrow = m.kind === 'edge'
  const bg = arrow ? '#2563eb' : '#d97706'
  return {
    id: m.id,
    position: { yaw: `${m.yaw}deg`, pitch: `${m.pitch}deg` },
    anchor: 'center center',
    html: `<div style="background:${bg};color:#fff;padding:2px 8px;border-radius:9999px;font:600 12px system-ui;white-space:nowrap;box-shadow:0 1px 4px #0008">${
      arrow ? '➤' : '📍'
    } ${esc(m.label)}</div>`,
  }
}

/** Dev-only: one PSV instance for the selected node; panorama swapped on node change. Loaded via next/dynamic (ssr: false). */
export default function AimViewer({ tilesUrl, markers, focus, armed, onAim }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const onAimRef = useRef(onAim)
  useEffect(() => {
    onAimRef.current = onAim
  })
  const [pano, setPano] = useState<EquirectangularMultiTilesPanorama | null>(null)
  const [failed, setFailed] = useState<{ url: string; message: string } | null>(null)
  const error = failed?.url === tilesUrl ? failed.message : null

  useEffect(() => {
    let cancelled = false
    fetchManifest(tilesUrl).then(
      (m) => !cancelled && setPano(manifestToPanorama(m)),
      (e) =>
        !cancelled &&
        setFailed({ url: tilesUrl, message: e instanceof Error ? e.message : String(e) })
    )
    return () => {
      cancelled = true
    }
  }, [tilesUrl])

  // declared before the create effect so strict-mode remounts destroy, then recreate
  useEffect(
    () => () => {
      viewerRef.current?.destroy()
      viewerRef.current = null
    },
    []
  )

  useEffect(() => {
    if (!pano || !containerRef.current) return
    if (viewerRef.current) {
      void viewerRef.current.setPanorama(pano, { showLoader: false })
      return
    }
    const viewer = new Viewer({
      container: containerRef.current,
      adapter: [EquirectangularTilesAdapter, { showErrorTile: false }],
      panorama: pano,
      navbar: ['zoom', 'fullscreen'],
      plugins: [MarkersPlugin],
    })
    viewer.addEventListener('click', ({ data }) => {
      // a click on a marker is not an aim
      if ((data.target as HTMLElement | undefined)?.closest?.('.psv-marker')) return
      onAimRef.current(data.yaw, data.pitch)
    })
    viewerRef.current = viewer
  }, [pano])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const plugin = viewer.getPlugin<MarkersPlugin>(MarkersPlugin)
    const apply = () => plugin.setMarkers(markers.map(toConfig))
    if (viewer.state.ready) apply()
    else viewer.addEventListener('ready', apply, { once: true })
  }, [markers, pano])

  useEffect(() => {
    if (focus)
      void viewerRef.current?.animate({
        yaw: `${focus.yaw}deg`,
        pitch: `${focus.pitch}deg`,
        speed: '30rpm',
      })
  }, [focus])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className={`h-full w-full ${armed ? 'cursor-crosshair' : ''}`} />
      {!pano && !error && (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 text-sm text-muted-foreground">
          Loading panorama…
        </p>
      )}
      {error && (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
