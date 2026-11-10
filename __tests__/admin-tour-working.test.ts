import { describe, it, expect } from 'vitest'
import { buildTourChangeset } from '@/lib/admin/tour-changeset'
import type { TourAdminState } from '@/lib/admin/tour-types'
import { setNodeLabel, setNodePosition, toTourWorking } from '@/lib/admin/tour-working'
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
