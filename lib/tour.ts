import type { EquirectangularMultiTilesPanorama } from '@photo-sphere-viewer/equirectangular-tiles-adapter'

export interface TourNode {
  id: string
  label: string
  pano_ref: string
  tiles_url: string
  preview_url: string
  lat: number | null
  lng: number | null
  is_lobby: boolean
}

export interface TourEdge {
  from_node_id: string
  to_node_id: string
  bearing: number
  pitch: number
}

export interface TourGraph {
  nodes: TourNode[]
  edges: TourEdge[]
}

/** Shape of panoramas/<pano_ref>/manifest.json written by tools/tile-panorama.js. */
export interface TileManifest {
  baseUrl: string
  levels: { width: number; cols: number; rows: number }[]
  tileUrl: string // contains {level} {col} {row} placeholders
}

export const degToRad = (deg: number) => (deg * Math.PI) / 180

/** `heading` search param (degrees) -> radians; missing or non-numeric -> 0. */
export function parseHeading(param: string | null): number {
  const deg = param === null ? NaN : Number(param)
  return Number.isFinite(deg) ? degToRad(deg) : 0
}

/** `node` param if it matches, else the lobby; null when neither exists. */
export function resolveNode(nodes: TourNode[], nodeId: string | null): TourNode | null {
  return (nodes.find((n) => n.id === nodeId) ?? nodes.find((n) => n.is_lobby)) || null
}

export function manifestToPanorama(manifest: TileManifest): EquirectangularMultiTilesPanorama {
  return {
    baseUrl: manifest.baseUrl,
    levels: manifest.levels,
    tileUrl: (col, row, level) =>
      manifest.tileUrl
        .replace('{level}', String(level))
        .replace('{col}', String(col))
        .replace('{row}', String(row)),
  }
}

export type SplashView = 'hidden' | 'loading' | 'slow' | 'offline'

/** Which splash state to show. Offline fails immediately; ready hides only after the minimum display time. */
export function splashView(s: {
  loaded: boolean
  minElapsed: boolean
  offline: boolean
  slow: boolean
}): SplashView {
  if (s.offline) return 'offline'
  if (s.loaded && s.minElapsed) return 'hidden'
  return s.slow ? 'slow' : 'loading'
}
