import { describe, it, expect } from 'vitest'
import { tourBlockers } from '@/lib/admin/tour-validation'
import type { AdminTourExhibit, TourWorkingState, WorkingTourEdge } from '@/lib/admin/tour-types'
import type { TourNode } from '@/lib/tour'

const node = (id: string, over: Partial<TourNode> = {}): TourNode => ({
  id,
  label: id.toUpperCase(),
  pano_ref: id,
  tiles_url: 't',
  preview_url: 'p',
  lat: 17,
  lng: 78,
  is_lobby: false,
  ...over,
})
const edge = (from: string, to: string, over: Partial<WorkingTourEdge> = {}): WorkingTourEdge => ({
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

/** Lobby L <-> A <-> B, all placed and aimed. */
const valid = (): TourWorkingState => ({
  nodes: [node('l', { is_lobby: true }), node('a'), node('b')],
  edges: [edge('l', 'a'), edge('a', 'l'), edge('a', 'b'), edge('b', 'a')],
  exhibits: [exhibit({ tour_node_id: 'a', tour_heading: 10, tour_pitch: 0 })],
})

describe('tourBlockers', () => {
  it('returns no blockers for a complete graph', () => {
    expect(tourBlockers(valid())).toEqual([])
  })

  it('flags a node without lat/lng', () => {
    const s = valid()
    s.nodes[2] = node('b', { lat: null, lng: null })
    expect(tourBlockers(s)).toEqual(['1 node(s) without a position: B'])
  })

  it('flags an edge without a yaw', () => {
    const s = valid()
    s.edges[2] = edge('a', 'b', { bearing: null })
    expect(tourBlockers(s)).toEqual(['1 edge(s) without a yaw: A → B'])
  })

  it('flags a directed edge whose reverse is missing', () => {
    const s = valid()
    s.edges.pop() // drop b>a
    expect(tourBlockers(s)).toEqual(['1 edge(s) missing the reverse: A → B'])
  })

  it('flags an exhibit with a node but no yaw or pitch', () => {
    const s = valid()
    s.exhibits = [exhibit({ tour_node_id: 'a', tour_heading: 10, tour_pitch: null })]
    expect(tourBlockers(s)).toEqual(['1 exhibit(s) linked to a node without a yaw/pitch: Baobab'])
  })

  it('ignores an exhibit with no node', () => {
    const s = valid()
    s.exhibits = [exhibit()]
    expect(tourBlockers(s)).toEqual([])
  })

  it('flags nodes unreachable from the lobby (directed)', () => {
    const s = valid()
    s.nodes.push(node('c'))
    s.edges.push(edge('c', 'a'), edge('a', 'c', { bearing: 5 }))
    expect(tourBlockers(s)).toEqual([])
    s.edges.pop() // a>c gone: c has an out-edge but no way in, and c>a lacks its reverse
    expect(tourBlockers(s)).toEqual([
      '1 edge(s) missing the reverse: C → A',
      '1 node(s) unreachable from the lobby: C',
    ])
  })

  it('flags a missing lobby', () => {
    const s = valid()
    s.nodes[0] = node('l')
    expect(tourBlockers(s)).toEqual(['No lobby node'])
  })
})
