import { describe, it, expect } from 'vitest'
import { buildTourChangeset } from '@/lib/admin/tour-changeset'
import type { AdminTourExhibit, TourAdminState, TourWorkingState } from '@/lib/admin/tour-types'
import type { TourEdge, TourNode } from '@/lib/tour'

const node = (id: string, over: Partial<TourNode> = {}): TourNode => ({
  id,
  label: `Node ${id}`,
  pano_ref: id,
  tiles_url: 't',
  preview_url: 'p',
  lat: 17,
  lng: 78,
  is_lobby: false,
  ...over,
})
const edge = (from: string, to: string, over: Partial<TourEdge> = {}): TourEdge => ({
  from_node_id: from,
  to_node_id: to,
  bearing: 90,
  pitch: -15,
  ...over,
})
const exhibit = (over: Partial<AdminTourExhibit> = {}): AdminTourExhibit => ({
  id: 'x1',
  code: 1,
  name: 'Baobab',
  gps_lat: 17,
  gps_lng: 78,
  tour_node_id: null,
  tour_heading: null,
  tour_pitch: null,
  ...over,
})

const original = (): TourAdminState => ({
  nodes: [node('a', { is_lobby: true }), node('b')],
  edges: [edge('a', 'b'), edge('b', 'a', { bearing: 270 })],
  exhibits: [exhibit()],
})
const working = (o: TourAdminState = original()): TourWorkingState => structuredClone(o)

const empty = { nodes: [], edges: { upsert: [], delete: [] }, exhibits: [] }

describe('buildTourChangeset', () => {
  it('is empty when nothing changed', () => {
    const r = buildTourChangeset(original(), working())
    expect(r.isEmpty).toBe(true)
    expect(r.summary).toBe('')
    expect(r.changeset).toEqual(empty)
  })

  it('sends only changed node keys', () => {
    const w = working()
    w.nodes[1] = { ...w.nodes[1], lat: 18, label: 'Gate' }
    const r = buildTourChangeset(original(), w)
    expect(r.changeset.nodes).toEqual([{ id: 'b', label: 'Gate', lat: 18 }])
    expect(r.summary).toBe('1 node changed')
  })

  it('sends a newly placed node (null -> coords)', () => {
    const o = original()
    o.nodes[1] = { ...o.nodes[1], lat: null, lng: null }
    const r = buildTourChangeset(o, working())
    expect(r.changeset.nodes).toEqual([{ id: 'b', lat: 17, lng: 78 }])
  })

  it('ignores nodes that are not in the original', () => {
    const w = working()
    w.nodes.push(node('z'))
    expect(buildTourChangeset(original(), w).isEmpty).toBe(true)
  })

  it('upserts new and re-aimed edges as full rows, deletes removed ones', () => {
    const o = original()
    o.nodes.push(node('c'))
    const w = working(o)
    w.edges[0] = { ...w.edges[0], bearing: 100 } // re-aimed a>b
    w.edges.splice(1, 1) // removed b>a
    w.edges.push(edge('a', 'c', { bearing: 10, pitch: -5 })) // new
    const r = buildTourChangeset(o, w)
    expect(r.changeset.edges.upsert).toEqual([
      edge('a', 'b', { bearing: 100 }),
      edge('a', 'c', { bearing: 10, pitch: -5 }),
    ])
    expect(r.changeset.edges.delete).toEqual([{ from_node_id: 'b', to_node_id: 'a' }])
    expect(r.summary).toBe('1 edge added, 1 edge re-aimed, 1 edge removed')
  })

  it('never sends an unaimed edge', () => {
    const w = working()
    w.edges.push({ from_node_id: 'a', to_node_id: 'c', bearing: null, pitch: -15 })
    const r = buildTourChangeset(original(), w)
    expect(r.changeset.edges.upsert).toEqual([])
    expect(r.isEmpty).toBe(true)
  })

  it('sends only changed exhibit link keys, and nulls to clear', () => {
    const o = original()
    o.exhibits[0] = exhibit({ tour_node_id: 'a', tour_heading: 10, tour_pitch: 5 })
    const w = working(o)
    w.exhibits[0] = { ...w.exhibits[0], tour_heading: 20 }
    expect(buildTourChangeset(o, w).changeset.exhibits).toEqual([{ id: 'x1', tour_heading: 20 }])

    w.exhibits[0] = { ...w.exhibits[0], tour_node_id: null, tour_heading: null, tour_pitch: null }
    const r = buildTourChangeset(o, w)
    expect(r.changeset.exhibits).toEqual([
      { id: 'x1', tour_node_id: null, tour_heading: null, tour_pitch: null },
    ])
    expect(r.summary).toBe('1 exhibit link changed')
  })
})
