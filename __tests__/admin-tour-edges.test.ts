import { describe, it, expect } from 'vitest'
import { proposeEdges, pairKey } from '@/lib/admin/tour-edges'
import type { ParkPaths } from '@/lib/park-paths'
import type { TourNode } from '@/lib/tour'

const node = (id: string, lat: number | null, lng: number | null): TourNode => ({
  id,
  label: id,
  pano_ref: id,
  tiles_url: 't',
  preview_url: 'p',
  lat,
  lng,
  is_lobby: false,
})

// ~0.00001° lat ≈ 1.1 m. One east-west path along lat 17.38, lng 78.19 → 78.192 (~210 m).
const paths: ParkPaths = {
  p1: {
    name: 'P1',
    coords: [
      [17.38, 78.19],
      [17.38, 78.192],
    ],
  },
}
const keys = (pairs: { a: string; b: string }[]) => pairs.map((p) => pairKey(p.a, p.b)).sort()

describe('proposeEdges', () => {
  it('connects nodes adjacent along a path, in path order, not across a node in between', () => {
    const nodes = [
      node('c', 17.38001, 78.1915), // listed out of order on purpose
      node('a', 17.38001, 78.1905),
      node('b', 17.37999, 78.191),
    ]
    expect(keys(proposeEdges(nodes, paths))).toEqual([pairKey('a', 'b'), pairKey('b', 'c')])
  })

  it('falls back to k nearest neighbours for nodes far from every path', () => {
    const nodes = [
      node('a', 17.38, 78.1905),
      node('b', 17.38, 78.191),
      node('far', 17.3815, 78.1908), // ~165 m north of the path
      node('far2', 17.382, 78.1908),
    ]
    const got = keys(proposeEdges(nodes, paths, { k: 2 }))
    expect(got).toContain(pairKey('far', 'far2'))
    expect(got).toContain(pairKey('far', 'b')) // nearest on-path node to `far`
    expect(got).toContain(pairKey('a', 'b')) // path adjacency still applies
    expect(got).not.toContain(pairKey('far', 'a')) // k = 2 → far's 3rd nearest dropped
  })

  it('falls back to neighbours when there are no paths', () => {
    const nodes = [node('a', 17.38, 78.19), node('b', 17.38, 78.1901), node('c', 17.38, 78.1902)]
    expect(keys(proposeEdges(nodes, {}, { k: 1 }))).toEqual([pairKey('a', 'b'), pairKey('b', 'c')])
  })

  it('never proposes duplicates or self edges', () => {
    const nodes = [
      node('a', 17.3815, 78.19),
      node('b', 17.3815, 78.1901),
      node('c', 17.3815, 78.1902),
    ]
    const got = proposeEdges(nodes, {}, { k: 2 })
    expect(new Set(keys(got)).size).toBe(got.length)
    expect(got.every((p) => p.a !== p.b)).toBe(true)
    expect(got).toHaveLength(3) // a-b, a-c, b-c once each
  })

  it('skips pairs that already exist, in either direction', () => {
    const nodes = [node('a', 17.38, 78.1905), node('b', 17.38, 78.191), node('c', 17.38, 78.1915)]
    const got = proposeEdges(nodes, paths, { existing: [{ from_node_id: 'b', to_node_id: 'a' }] })
    expect(keys(got)).toEqual([pairKey('b', 'c')])
  })

  it('ignores unplaced nodes', () => {
    const nodes = [node('a', 17.38, 78.1905), node('x', null, null), node('c', 17.38, 78.1915)]
    expect(keys(proposeEdges(nodes, paths))).toEqual([pairKey('a', 'c')])
    expect(proposeEdges([node('a', 17.38, 78.19), node('x', null, null)], paths)).toEqual([])
  })
})
