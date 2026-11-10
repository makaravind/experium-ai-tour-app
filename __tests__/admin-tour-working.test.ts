import { describe, it, expect } from 'vitest'
import { buildTourChangeset } from '@/lib/admin/tour-changeset'
import type { TourAdminState } from '@/lib/admin/tour-types'
import {
  DEFAULT_EDGE_PITCH,
  addEdgePairs,
  hasEdgePair,
  neighbourCount,
  removeEdgePair,
  setNodeLabel,
  setNodePosition,
  toTourWorking,
} from '@/lib/admin/tour-working'
import type { TourNode } from '@/lib/tour'

const node = (id: string, over: Partial<TourNode> = {}): TourNode => ({
  id,
  label: `Node ${id}`,
  pano_ref: id,
  tiles_url: 't',
  preview_url: 'p',
  lat: null,
  lng: null,
  is_lobby: false,
  ...over,
})
const state: TourAdminState = {
  nodes: [node('a'), node('b', { lat: 17.38, lng: 78.19 })],
  edges: [],
  exhibits: [],
}

describe('tour working-state helpers', () => {
  it('setNodePosition sets only the target node and stages a node change', () => {
    const original = state
    const w = setNodePosition(toTourWorking(original), 'a', { lat: 17.381, lng: 78.191 })
    expect(w.nodes[0]).toMatchObject({ lat: 17.381, lng: 78.191 })
    expect(w.nodes[1]).toBe(original.nodes[1])
    expect(buildTourChangeset(original, w).changeset.nodes).toEqual([
      { id: 'a', lat: 17.381, lng: 78.191 },
    ])
  })

  it('setNodePosition(null) clears both coordinates', () => {
    const original = state
    const w = setNodePosition(toTourWorking(original), 'b', null)
    expect(w.nodes[1]).toMatchObject({ lat: null, lng: null })
    expect(buildTourChangeset(original, w).changeset.nodes).toEqual([
      { id: 'b', lat: null, lng: null },
    ])
  })

  it('setNodeLabel stages a label change; reverting it stages nothing', () => {
    const w = setNodeLabel(toTourWorking(state), 'a', 'Lobby')
    expect(buildTourChangeset(state, w).changeset.nodes).toEqual([{ id: 'a', label: 'Lobby' }])
    expect(buildTourChangeset(state, setNodeLabel(w, 'a', 'Node a')).isEmpty).toBe(true)
  })

  it('does not mutate the input', () => {
    const w = toTourWorking(state)
    setNodePosition(w, 'a', { lat: 1, lng: 2 })
    expect(w.nodes[0].lat).toBeNull()
  })
})

describe('tour edge-pair helpers', () => {
  const base = toTourWorking(state)

  it('addEdgePairs adds both directed rows, unaimed with the default pitch', () => {
    const w = addEdgePairs(base, [{ a: 'a', b: 'b' }])
    expect(w.edges).toEqual([
      { from_node_id: 'a', to_node_id: 'b', bearing: null, pitch: DEFAULT_EDGE_PITCH },
      { from_node_id: 'b', to_node_id: 'a', bearing: null, pitch: DEFAULT_EDGE_PITCH },
    ])
    expect(DEFAULT_EDGE_PITCH).toBe(-15)
  })

  it('addEdgePairs skips existing (either direction) and self pairs', () => {
    const w = addEdgePairs(base, [{ a: 'a', b: 'b' }])
    expect(
      addEdgePairs(w, [
        { a: 'b', b: 'a' },
        { a: 'a', b: 'a' },
      ]).edges
    ).toHaveLength(2)
  })

  it('unaimed pairs stage no changeset rows', () => {
    const w = addEdgePairs(base, [{ a: 'a', b: 'b' }])
    expect(buildTourChangeset(state, w).changeset.edges.upsert).toEqual([])
  })

  it('removeEdgePair drops both directions only for that pair', () => {
    const w = addEdgePairs(base, [
      { a: 'a', b: 'b' },
      { a: 'a', b: 'c' },
    ])
    const r = removeEdgePair(w, 'b', 'a')
    expect(r.edges.map((e) => `${e.from_node_id}>${e.to_node_id}`)).toEqual(['a>c', 'c>a'])
    expect(hasEdgePair(r, 'a', 'b')).toBe(false)
  })

  it('neighbourCount counts distinct neighbours in either direction', () => {
    const w = addEdgePairs(base, [
      { a: 'a', b: 'b' },
      { a: 'a', b: 'c' },
    ])
    expect(neighbourCount(w, 'a')).toBe(2)
    expect(neighbourCount(w, 'b')).toBe(1)
    expect(neighbourCount(w, 'z')).toBe(0)
  })
})
