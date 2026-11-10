import type { EquirectangularMultiTilesPanorama } from '@photo-sphere-viewer/equirectangular-tiles-adapter'
import type { CachedExhibit, TourSpot } from '@/lib/types'

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

/** Radians -> degrees in [0, 360). */
export const yawToHeading = (yaw: number) => ((((yaw * 180) / Math.PI) % 360) + 360) % 360

/** A tourSpot written this recently was just left, so the map should fly to it. */
export const TOUR_SPOT_FRESH_MS = 10_000

/** True when `spot` was written within TOUR_SPOT_FRESH_MS of `now` and the map hasn't already flown to it. */
export function isFreshTourSpot(
  spot: TourSpot | null,
  now: number,
  flownAt: number | null
): boolean {
  return !!spot && spot.at !== flownAt && now - spot.at >= 0 && now - spot.at <= TOUR_SPOT_FRESH_MS
}

/** `heading` search param (degrees) -> radians; missing or non-numeric -> 0. */
export function parseHeading(param: string | null): number {
  const deg = param === null ? NaN : Number(param)
  return Number.isFinite(deg) ? degToRad(deg) : 0
}

/** `node` param if it matches, else the lobby; null when neither exists. */
export function resolveNode(nodes: TourNode[], nodeId: string | null): TourNode | null {
  return (nodes.find((n) => n.id === nodeId) ?? nodes.find((n) => n.is_lobby)) || null
}

/** `/tour` link for an exhibit linked to a node; null when it has none. Heading omitted if null. */
export function tourHref(e: {
  id: string
  tour_node_id?: string | null
  tour_heading?: number | null
}): string | null {
  if (!e.tour_node_id) return null
  const params = new URLSearchParams({ node: e.tour_node_id })
  if (e.tour_heading != null) params.set('heading', String(e.tour_heading))
  params.set('exhibitId', e.id)
  return `/tour?${params}`
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

/** Arrow on a node: where it sits (radians, in the node's own pano) and where it leads. */
export interface TourLink {
  nodeId: string
  /** target node's label */
  name: string
  position: { yaw: number; pitch: number }
}

/** Outgoing edges of `nodeId` as plugin links. Edges to nodes not in the graph are dropped. */
export function nodeLinks(nodeId: string, { nodes, edges }: TourGraph): TourLink[] {
  const labels = new Map(nodes.map((n) => [n.id, n.label]))
  return edges
    .filter((e) => e.from_node_id === nodeId && labels.has(e.to_node_id))
    .map((e) => ({
      nodeId: e.to_node_id,
      name: labels.get(e.to_node_id)!,
      position: { yaw: degToRad(e.bearing), pitch: degToRad(e.pitch) },
    }))
}

/** Exhibit pin on a node: where it sits (radians, in the node's own pano) and how it looks. */
export interface TourPin {
  exhibitId: string
  displayId: string
  name: string
  position: { yaw: number; pitch: number }
  visited: boolean
}

/** Pins for the exhibits linked to `nodeId`; exhibits without an authored heading/pitch are skipped. */
export function nodeMarkers(
  nodeId: string,
  exhibits: CachedExhibit[],
  visitedIds: string[]
): TourPin[] {
  return exhibits.flatMap((e) =>
    e.tour_node_id === nodeId && e.tour_heading != null && e.tour_pitch != null
      ? [
          {
            exhibitId: e.id,
            displayId: e.displayId,
            name: e.name,
            position: { yaw: degToRad(e.tour_heading), pitch: degToRad(e.tour_pitch) },
            visited: visitedIds.includes(e.id),
          },
        ]
      : []
  )
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
