import { haversineMetres } from '@/lib/nearby'
import { projectToSegment, type ParkPaths } from '@/lib/park-paths'
import type { TourNode } from '@/lib/tour'

/** Nodes further than this from every path skip path adjacency and use nearest neighbours. Tune on real positions. */
export const OFF_PATH_M = 40
/** Nearest neighbours proposed for an off-path node (spec: 2-3). */
export const FALLBACK_K = 3

/** Undirected node pair, `a < b` (by id) so each pair has one canonical form. */
export interface EdgePair {
  a: string
  b: string
}

export const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`)

export const toPair = (x: string, y: string): EdgePair => (x < y ? { a: x, b: y } : { a: y, b: x })

type Placed = TourNode & { lat: number; lng: number }

/**
 * Candidate edges for the human to confirm: nodes adjacent along the same path, plus
 * nearest-neighbour edges for nodes far from every path. Unplaced nodes are ignored;
 * pairs already in `existing` (either direction) are skipped.
 */
export function proposeEdges(
  nodes: TourNode[],
  paths: ParkPaths,
  opts: {
    existing?: { from_node_id: string; to_node_id: string }[]
    offPathM?: number
    k?: number
  } = {}
): EdgePair[] {
  const { existing = [], offPathM = OFF_PATH_M, k = FALLBACK_K } = opts
  const placed = nodes.filter((n): n is Placed => n.lat !== null && n.lng !== null)
  if (placed.length < 2) return []

  // equirectangular metre frame centred on the first placed node
  const o = placed[0]
  const ky = 111320
  const kx = ky * Math.cos((o.lat * Math.PI) / 180)
  const toXY = (lat: number, lng: number) => ({ x: (lng - o.lng) * kx, y: (lat - o.lat) * ky })

  const lines = Object.entries(paths)
    .filter(([, p]) => p.coords.length >= 2)
    .map(([key, p]) => {
      const pts = p.coords.map(([lat, lng]) => toXY(lat, lng))
      let acc = 0
      const starts = pts.map((pt, i) =>
        i === 0 ? 0 : (acc += Math.hypot(pt.x - pts[i - 1].x, pt.y - pts[i - 1].y))
      )
      return { key, pts, starts }
    })

  const out = new Map<string, EdgePair>()
  const skip = new Set(existing.map((e) => pairKey(e.from_node_id, e.to_node_id)))
  const add = (x: string, y: string) => {
    const key = pairKey(x, y)
    if (x !== y && !skip.has(key)) out.set(key, toPair(x, y))
  }

  // snap: nearest point over all paths → path key, distance along it, distance off it
  const byPath = new Map<string, { id: string; along: number }[]>()
  const offPath: Placed[] = []
  for (const n of placed) {
    const q = toXY(n.lat, n.lng)
    let best: { key: string; along: number; d: number } | null = null
    for (const { key, pts, starts } of lines) {
      for (let i = 0; i < pts.length - 1; i++) {
        const pr = projectToSegment(q, pts[i], pts[i + 1])
        if (!best || pr.d < best.d) {
          best = { key, along: starts[i] + pr.t * (starts[i + 1] - starts[i]), d: pr.d }
        }
      }
    }
    if (best && best.d <= offPathM) {
      byPath.set(best.key, [...(byPath.get(best.key) ?? []), { id: n.id, along: best.along }])
    } else {
      offPath.push(n)
    }
  }

  for (const onPath of byPath.values()) {
    onPath.sort((p, q) => p.along - q.along)
    for (let i = 0; i < onPath.length - 1; i++) add(onPath[i].id, onPath[i + 1].id)
  }

  for (const n of offPath) {
    placed
      .filter((m) => m.id !== n.id)
      .map((m) => ({ id: m.id, d: haversineMetres(n, m) }))
      .sort((p, q) => p.d - q.d)
      .slice(0, k)
      .forEach((m) => add(n.id, m.id))
  }

  return [...out.values()]
}
