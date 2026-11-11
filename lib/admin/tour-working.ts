import { pairKey, type EdgePair } from './tour-edges'
import type { TourAdminState, TourWorkingState } from './tour-types'

/** DB default for `tour_edges.pitch` (supabase/migrations/20261110000500_virtual_tour.sql). */
export const DEFAULT_EDGE_PITCH = -15

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

/** True when either direction of the pair exists. */
export function hasEdgePair(working: TourWorkingState, a: string, b: string): boolean {
  const key = pairKey(a, b)
  return working.edges.some((e) => pairKey(e.from_node_id, e.to_node_id) === key)
}

/** Add both directed rows (unaimed: `bearing: null`) for each pair; pairs that exist in either direction and self pairs are skipped. */
export function addEdgePairs(working: TourWorkingState, pairs: EdgePair[]): TourWorkingState {
  const edges = [...working.edges]
  for (const { a, b } of pairs) {
    if (a === b || edges.some((e) => pairKey(e.from_node_id, e.to_node_id) === pairKey(a, b)))
      continue
    edges.push(
      { from_node_id: a, to_node_id: b, bearing: null, pitch: DEFAULT_EDGE_PITCH },
      { from_node_id: b, to_node_id: a, bearing: null, pitch: DEFAULT_EDGE_PITCH }
    )
  }
  return { ...working, edges }
}

/** Directed edges A→B with no B→A in the working set. */
export function missingReverseEdges(working: TourWorkingState): TourWorkingState['edges'] {
  const have = new Set(working.edges.map((e) => `${e.from_node_id}>${e.to_node_id}`))
  return working.edges.filter((e) => !have.has(`${e.to_node_id}>${e.from_node_id}`))
}

/** Add an unaimed B→A (`bearing: null`) for every A→B without one; existing edges are untouched. */
export function addMissingReverses(working: TourWorkingState): TourWorkingState {
  const missing = missingReverseEdges(working)
  if (missing.length === 0) return working
  return {
    ...working,
    edges: [
      ...working.edges,
      ...missing.map((e) => ({
        from_node_id: e.to_node_id,
        to_node_id: e.from_node_id,
        bearing: null,
        pitch: DEFAULT_EDGE_PITCH,
      })),
    ],
  }
}

/** Remove both directions of a pair. */
export function removeEdgePair(working: TourWorkingState, a: string, b: string): TourWorkingState {
  const key = pairKey(a, b)
  return {
    ...working,
    edges: working.edges.filter((e) => pairKey(e.from_node_id, e.to_node_id) !== key),
  }
}

/** Distinct nodes connected to `id` in either direction. */
export function neighbourCount(working: TourWorkingState, id: string): number {
  const others = new Set<string>()
  for (const e of working.edges) {
    if (e.from_node_id === id) others.add(e.to_node_id)
    else if (e.to_node_id === id) others.add(e.from_node_id)
  }
  return others.size
}
