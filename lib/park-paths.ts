export type ParkPath = { name: string; coords: [number, number][] }
export type ParkPaths = Record<string, ParkPath>

export const JOIN_GAP_M = 3

export async function loadParkPaths(): Promise<ParkPaths> {
  try {
    const res = await fetch('/park-paths.json')
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

type Node = { x: number; y: number }
type Seg = { pi: number; a: number; b: number; ins: { t: number; id: number }[] }

export function findRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  paths: ParkPaths
): [number, number][] | null {
  const usable = Object.values(paths).filter((p) => p.coords.length >= 2)
  if (usable.length === 0) return null

  // equirectangular projection centred on `to`
  const ky = 111320
  const kx = ky * Math.cos((to.lat * Math.PI) / 180)
  const toXY = (lat: number, lng: number) => ({ x: (lng - to.lng) * kx, y: (lat - to.lat) * ky })
  const toLL = (n: Node): [number, number] => [n.y / ky + to.lat, n.x / kx + to.lng]

  const nodes: Node[] = []
  const adj: [number, number][][] = []
  const addNode = (x: number, y: number) => {
    nodes.push({ x, y })
    adj.push([])
    return nodes.length - 1
  }
  const link = (a: number, b: number) => {
    const w = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y)
    adj[a].push([b, w])
    adj[b].push([a, w])
  }

  const verts = usable.map((p) =>
    p.coords.map(([lat, lng]) => {
      const q = toXY(lat, lng)
      return addNode(q.x, q.y)
    })
  )

  const segs: Seg[] = usable.flatMap((_, pi) =>
    verts[pi].slice(0, -1).map((a, i) => ({ pi, a, b: verts[pi][i + 1], ins: [] as Seg['ins'] }))
  )

  const project = (n: Node, seg: Seg) => {
    const A = nodes[seg.a],
      B = nodes[seg.b]
    const dx = B.x - A.x,
      dy = B.y - A.y
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, ((n.x - A.x) * dx + (n.y - A.y) * dy) / len2)) : 0
    const x = A.x + t * dx,
      y = A.y + t * dy
    return { t, x, y, d: Math.hypot(n.x - x, n.y - y) }
  }

  const insertNode = (seg: Seg, pr: { t: number; x: number; y: number }) => {
    const id = addNode(pr.x, pr.y)
    seg.ins.push({ t: pr.t, id })
    return id
  }

  const snap = (lat: number, lng: number) => {
    const q = toXY(lat, lng)
    let best: { seg: Seg; pr: ReturnType<typeof project> } | null = null
    for (const seg of segs) {
      const pr = project(q, seg)
      if (!best || pr.d < best.pr.d) best = { seg, pr }
    }
    return best ? { id: insertNode(best.seg, best.pr), pi: best.seg.pi } : null
  }

  const fromSnap = snap(from.lat, from.lng)
  const toSnap = snap(to.lat, to.lng)
  if (!fromSnap || !toSnap) return null

  // junctions: waypoint of one path close to segment of another
  verts.forEach((vs, pi) =>
    vs.forEach((v) => {
      for (const seg of segs) {
        if (seg.pi === pi) continue
        const pr = project(nodes[v], seg)
        if (pr.d <= JOIN_GAP_M) link(v, insertNode(seg, pr))
      }
    })
  )

  // link nodes along each segment in order
  for (const seg of segs) {
    const chain = [seg.a, ...seg.ins.sort((m, n) => m.t - n.t).map((i) => i.id), seg.b]
    for (let i = 0; i < chain.length - 1; i++) link(chain[i], chain[i + 1])
  }

  // Dijkstra (graph has at most a few hundred nodes)
  const dist = nodes.map(() => Infinity)
  const prev = nodes.map(() => -1)
  const done = nodes.map(() => false)
  dist[fromSnap.id] = 0
  for (;;) {
    let u = -1
    for (let i = 0; i < nodes.length; i++) {
      if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i
    }
    if (u < 0 || dist[u] === Infinity || u === toSnap.id) break
    done[u] = true
    for (const [v, w] of adj[u]) {
      if (dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w
        prev[v] = u
      }
    }
  }

  if (dist[toSnap.id] === Infinity) return null

  const ids: number[] = []
  for (let n = toSnap.id; n !== -1; n = prev[n]) ids.push(n)
  return ids.reverse().map((n) => toLL(nodes[n]))
}
