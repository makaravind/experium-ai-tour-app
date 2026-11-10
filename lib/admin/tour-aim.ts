import type { TourWorkingState } from './tour-types'

/** Aim stored in SMALLINT columns: whole degrees, yaw 0-359, pitch -90..90. */
export interface Aim {
  yaw: number
  pitch: number
}

/** PSV click position (radians) -> DB-ready integer degrees. */
export function clickToAim(yawRad: number, pitchRad: number): Aim {
  const toDeg = (r: number) => Math.round((r * 180) / Math.PI) + 0 // + 0: -0 -> 0
  const yaw = ((toDeg(yawRad) % 360) + 360) % 360 // 360 -> 0, negatives wrap
  const pitch = Math.min(90, Math.max(-90, toDeg(pitchRad)))
  return { yaw, pitch }
}

/** Aim one directed edge; the reverse direction is never touched. */
export function setEdgeAim(
  working: TourWorkingState,
  from: string,
  to: string,
  aim: { bearing: number; pitch: number }
): TourWorkingState {
  return {
    ...working,
    edges: working.edges.map((e) =>
      e.from_node_id === from && e.to_node_id === to
        ? { ...e, bearing: aim.bearing, pitch: aim.pitch }
        : e
    ),
  }
}

/** Aim an exhibit pin in its linked node's pano. */
export function setExhibitAim(
  working: TourWorkingState,
  exhibitId: string,
  aim: { heading: number; pitch: number }
): TourWorkingState {
  return {
    ...working,
    exhibits: working.exhibits.map((x) =>
      x.id === exhibitId ? { ...x, tour_heading: aim.heading, tour_pitch: aim.pitch } : x
    ),
  }
}

/** What the author is about to aim: a directed edge out of the selected node, or an exhibit pin. */
export type AimTarget = { kind: 'edge'; to: string } | { kind: 'exhibit'; id: string }

/** An already-aimed arrow/pin to draw in the selected node's pano (degrees). */
export interface AimMarker {
  id: string
  kind: 'edge' | 'exhibit'
  label: string
  yaw: number
  pitch: number
}

/** Aimed outgoing edges and aimed exhibits linked to `nodeId`; unaimed ones are skipped. */
export function aimMarkers(working: TourWorkingState, nodeId: string): AimMarker[] {
  const markers: AimMarker[] = []
  for (const e of working.edges) {
    if (e.from_node_id !== nodeId || e.bearing === null) continue
    const to = working.nodes.find((n) => n.id === e.to_node_id)
    markers.push({
      id: `edge:${e.to_node_id}`,
      kind: 'edge',
      label: to?.label ?? e.to_node_id,
      yaw: e.bearing,
      pitch: e.pitch,
    })
  }
  for (const x of working.exhibits) {
    if (x.tour_node_id !== nodeId || x.tour_heading === null) continue
    markers.push({
      id: `exhibit:${x.id}`,
      kind: 'exhibit',
      label: x.name,
      yaw: x.tour_heading,
      pitch: x.tour_pitch ?? 0,
    })
  }
  return markers
}
