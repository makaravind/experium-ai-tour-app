import type { TourAdminState, TourWorkingState } from './tour-types'

/** Fresh working copy of a loaded state (edges are already assignable: `bearing: null` is only a working-state widening). */
export function toTourWorking(state: TourAdminState): TourWorkingState {
  return { ...state }
}

/** Set (or clear, with `null`) a node's map position. */
export function setNodePosition(
  working: TourWorkingState,
  id: string,
  pos: { lat: number; lng: number } | null
): TourWorkingState {
  return {
    ...working,
    nodes: working.nodes.map((n) =>
      n.id === id ? { ...n, lat: pos?.lat ?? null, lng: pos?.lng ?? null } : n
    ),
  }
}

export function setNodeLabel(
  working: TourWorkingState,
  id: string,
  label: string
): TourWorkingState {
  return { ...working, nodes: working.nodes.map((n) => (n.id === id ? { ...n, label } : n)) }
}
