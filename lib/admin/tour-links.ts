import { haversineMetres } from '@/lib/nearby'
import type { TourNode } from '@/lib/tour'
import type { AdminTourExhibit, TourWorkingState } from './tour-types'

/** Default search radius for exhibit → pano links (metres). Adjustable in the tool. */
export const LINK_RADIUS_M = 40

export interface LinkProposal {
  exhibitId: string
  nodeId: string
  distanceM: number
}

/**
 * Candidate exhibit → node links for the human to confirm: for each exhibit with GPS and no
 * node yet, the nearest placed node within `radiusM`. Exhibits with no pano nearby get none.
 */
export function proposeLinks(
  exhibits: AdminTourExhibit[],
  nodes: TourNode[],
  opts: { radiusM?: number } = {}
): LinkProposal[] {
  const { radiusM = LINK_RADIUS_M } = opts
  const placed = nodes.filter((n) => n.lat !== null && n.lng !== null)
  const out: LinkProposal[] = []
  for (const x of exhibits) {
    if (x.tour_node_id !== null || x.gps_lat === null || x.gps_lng === null) continue
    const here = { lat: x.gps_lat, lng: x.gps_lng }
    let best: LinkProposal | null = null
    for (const n of placed) {
      const d = haversineMetres(here, { lat: n.lat!, lng: n.lng! })
      if (d <= radiusM && (!best || d < best.distanceM))
        best = { exhibitId: x.id, nodeId: n.id, distanceM: d }
    }
    if (best) out.push(best)
  }
  return out
}

/**
 * Link an exhibit to a node (`null` clears). A different node (or a clear) also resets the
 * aim: the old yaw/pitch is meaningless in another pano. Re-linking the same node is a no-op.
 */
export function setExhibitNode(
  working: TourWorkingState,
  exhibitId: string,
  nodeId: string | null
): TourWorkingState {
  return {
    ...working,
    exhibits: working.exhibits.map((x) =>
      x.id === exhibitId && x.tour_node_id !== nodeId
        ? { ...x, tour_node_id: nodeId, tour_heading: null, tour_pitch: null }
        : x
    ),
  }
}
