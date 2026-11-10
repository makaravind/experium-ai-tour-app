import type { TourWorkingState } from './tour-types'

/**
 * Save blockers for the tour tool; [] means the graph is complete.
 * Each message names the offenders (node labels / exhibit names).
 */
export function tourBlockers(state: TourWorkingState): string[] {
  const label = new Map(state.nodes.map((n) => [n.id, n.label]))
  const name = (id: string) => label.get(id) ?? id
  const out: string[] = []
  const list = (items: string[]) => items.join(', ')

  const unplaced = state.nodes.filter((n) => n.lat === null || n.lng === null)
  if (unplaced.length)
    out.push(`${unplaced.length} node(s) without a position: ${list(unplaced.map((n) => n.label))}`)

  const unaimed = state.edges.filter((e) => e.bearing === null)
  if (unaimed.length) {
    out.push(
      `${unaimed.length} edge(s) without a yaw: ${list(unaimed.map((e) => `${name(e.from_node_id)} → ${name(e.to_node_id)}`))}`
    )
  }

  const have = new Set(state.edges.map((e) => `${e.from_node_id}>${e.to_node_id}`))
  const noReverse = state.edges.filter((e) => !have.has(`${e.to_node_id}>${e.from_node_id}`))
  if (noReverse.length) {
    out.push(
      `${noReverse.length} edge(s) missing the reverse: ${list(noReverse.map((e) => `${name(e.from_node_id)} → ${name(e.to_node_id)}`))}`
    )
  }

  const unaimedPins = state.exhibits.filter(
    (x) => x.tour_node_id !== null && (x.tour_heading === null || x.tour_pitch === null)
  )
  if (unaimedPins.length) {
    out.push(
      `${unaimedPins.length} exhibit(s) linked to a node without a yaw/pitch: ${list(unaimedPins.map((x) => x.name))}`
    )
  }

  const lobby = state.nodes.find((n) => n.is_lobby)
  if (!lobby) {
    out.push('No lobby node')
  } else {
    const next = new Map<string, string[]>()
    for (const e of state.edges)
      next.set(e.from_node_id, [...(next.get(e.from_node_id) ?? []), e.to_node_id])
    const seen = new Set([lobby.id])
    const queue = [lobby.id]
    for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
      for (const to of next.get(id) ?? []) {
        if (!seen.has(to)) {
          seen.add(to)
          queue.push(to)
        }
      }
    }
    const unreachable = state.nodes.filter((n) => !seen.has(n.id))
    if (unreachable.length) {
      out.push(
        `${unreachable.length} node(s) unreachable from the lobby: ${list(unreachable.map((n) => n.label))}`
      )
    }
  }

  return out
}
