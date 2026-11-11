import type { TourEdge, TourNode } from '@/lib/tour'

/** `exhibits` row as the tour tool needs it: tour link columns plus what Link mode shows/proposes from. */
export interface AdminTourExhibit {
  id: string
  code: number
  name: string
  gps_lat: number | null
  gps_lng: number | null
  tour_node_id: string | null
  tour_heading: number | null // yaw in the node's pano, degrees 0-359
  tour_pitch: number | null // degrees -90..90
}

/** Edge in the working state: an accepted-but-not-yet-aimed edge has `bearing: null` (never persisted). */
export type WorkingTourEdge = Omit<TourEdge, 'bearing'> & { bearing: number | null }

/** Loaded (original) state, as returned by GET /api/admin/tour/data. */
export interface TourAdminState {
  nodes: TourNode[]
  edges: TourEdge[]
  exhibits: AdminTourExhibit[]
}

/** Client working state: same shape, edges may be unaimed. */
export interface TourWorkingState extends Omit<TourAdminState, 'edges'> {
  edges: WorkingTourEdge[]
}

/** Existing node: `id` + changed keys (nodes are created by the seed script, never by the tool). */
export type TourNodeChange = { id: string } & Partial<Pick<TourNode, 'label' | 'lat' | 'lng'>>

/** Existing exhibit: `id` + changed link keys. Clearing a link sends `null`s. */
export type TourExhibitChange = { id: string } & Partial<
  Pick<AdminTourExhibit, 'tour_node_id' | 'tour_heading' | 'tour_pitch'>
>

/**
 * Payload for POST /api/admin/tour/save → admin_apply_tour(jsonb); mirrors the input
 * shape documented in supabase/migrations/20261110000600_admin_apply_tour.sql.
 * Edge upserts are full rows (new or changed); unaimed edges (`bearing: null`) are never sent.
 */
export interface TourChangeset {
  nodes: TourNodeChange[]
  edges: {
    upsert: TourEdge[]
    delete: { from_node_id: string; to_node_id: string }[]
  }
  exhibits: TourExhibitChange[]
}
