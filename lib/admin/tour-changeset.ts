import type { TourEdge } from '@/lib/tour'
import type {
  TourAdminState,
  TourChangeset,
  TourExhibitChange,
  TourNodeChange,
  TourWorkingState,
} from './tour-types'

const edgeKey = (e: { from_node_id: string; to_node_id: string }) =>
  `${e.from_node_id}>${e.to_node_id}`

/** Keys of `w` whose value differs from `o`, with `w`'s values. */
const changed = <T extends object, K extends keyof T>(o: T, w: T, keys: K[]) =>
  Object.fromEntries(keys.filter((k) => o[k] !== w[k]).map((k) => [k, w[k]])) as Partial<Pick<T, K>>

/** Diff original vs working tour state into the save payload plus a human summary ('' when nothing changed). */
export function buildTourChangeset(
  original: TourAdminState,
  working: TourWorkingState
): { changeset: TourChangeset; summary: string; isEmpty: boolean } {
  const cs: TourChangeset = { nodes: [], edges: { upsert: [], delete: [] }, exhibits: [] }
  let edgesAdded = 0
  let edgesChanged = 0

  const origNodes = new Map(original.nodes.map((n) => [n.id, n]))
  for (const n of working.nodes) {
    const o = origNodes.get(n.id)
    if (!o) continue // nodes are created by the seed script, not the tool
    const patch = changed(o, n, ['label', 'lat', 'lng'])
    if (Object.keys(patch).length) cs.nodes.push({ id: n.id, ...patch } satisfies TourNodeChange)
  }

  const origEdges = new Map(original.edges.map((e) => [edgeKey(e), e]))
  const workingKeys = new Set(working.edges.map(edgeKey))
  for (const e of working.edges) {
    if (e.bearing === null) continue // not aimed yet: can't be stored
    const o = origEdges.get(edgeKey(e))
    if (o && o.bearing === e.bearing && o.pitch === e.pitch) continue
    cs.edges.upsert.push(e as TourEdge)
    if (o) edgesChanged++
    else edgesAdded++
  }
  for (const o of original.edges) {
    if (!workingKeys.has(edgeKey(o)))
      cs.edges.delete.push({ from_node_id: o.from_node_id, to_node_id: o.to_node_id })
  }

  const origExhibits = new Map(original.exhibits.map((x) => [x.id, x]))
  for (const x of working.exhibits) {
    const o = origExhibits.get(x.id)
    if (!o) continue
    const patch = changed(o, x, ['tour_node_id', 'tour_heading', 'tour_pitch'])
    if (Object.keys(patch).length)
      cs.exhibits.push({ id: x.id, ...patch } satisfies TourExhibitChange)
  }

  const noun = (c: number, one: string, many: string) => `${c} ${c === 1 ? one : many}`
  const parts: [number, string][] = [
    [cs.nodes.length, noun(cs.nodes.length, 'node changed', 'nodes changed')],
    [edgesAdded, noun(edgesAdded, 'edge added', 'edges added')],
    [edgesChanged, noun(edgesChanged, 'edge re-aimed', 'edges re-aimed')],
    [cs.edges.delete.length, noun(cs.edges.delete.length, 'edge removed', 'edges removed')],
    [cs.exhibits.length, noun(cs.exhibits.length, 'exhibit link changed', 'exhibit links changed')],
  ]
  const summary = parts
    .filter(([c]) => c > 0)
    .map(([, s]) => s)
    .join(', ')

  return { changeset: cs, summary, isEmpty: summary === '' }
}
