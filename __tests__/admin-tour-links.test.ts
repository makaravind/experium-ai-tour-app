import { describe, it, expect } from 'vitest'
import { proposeLinks, setExhibitNode } from '@/lib/admin/tour-links'
import type { AdminTourExhibit, TourWorkingState } from '@/lib/admin/tour-types'
import type { TourNode } from '@/lib/tour'

// 0.0001° lat ≈ 11.1 m
const node = (id: string, lat: number | null, lng: number | null): TourNode => ({
  id,
  label: id.toUpperCase(),
  pano_ref: id,
  tiles_url: 't',
  preview_url: 'p',
  lat,
  lng,
  is_lobby: false,
})
const exhibit = (id: string, over: Partial<AdminTourExhibit> = {}): AdminTourExhibit => ({
  id,
  code: 1,
  name: id,
  gps_lat: 17.38,
  gps_lng: 78.19,
  tour_node_id: null,
  tour_heading: null,
  tour_pitch: null,
  ...over,
})

describe('proposeLinks', () => {
  const near = node('near', 17.3801, 78.19) // ~11 m
  const nearer = node('nearer', 17.38005, 78.19) // ~5.5 m
  const far = node('far', 17.381, 78.19) // ~111 m

  it('proposes the nearest placed node within the radius', () => {
    const [p] = proposeLinks([exhibit('x')], [near, nearer, far])
    expect(p).toMatchObject({ exhibitId: 'x', nodeId: 'nearer' })
    expect(p.distanceM).toBeGreaterThan(5)
    expect(p.distanceM).toBeLessThan(6)
  })

  it('proposes nothing when no node is in range (exhibit stays unlinked)', () => {
    expect(proposeLinks([exhibit('x')], [far])).toEqual([])
  })

  it('honours the radius option', () => {
    expect(proposeLinks([exhibit('x')], [far], { radiusM: 150 })).toHaveLength(1)
    expect(proposeLinks([exhibit('x')], [near], { radiusM: 5 })).toEqual([])
  })

  it('ignores unplaced nodes', () => {
    expect(proposeLinks([exhibit('x')], [node('u', null, null)])).toEqual([])
  })

  it('skips exhibits without GPS or already linked', () => {
    const xs = [
      exhibit('nogps', { gps_lat: null, gps_lng: null }),
      exhibit('linked', { tour_node_id: 'far' }),
      exhibit('ok'),
    ]
    expect(proposeLinks(xs, [near]).map((p) => p.exhibitId)).toEqual(['ok'])
  })
})

describe('setExhibitNode', () => {
  const state = (): TourWorkingState => ({
    nodes: [],
    edges: [],
    exhibits: [
      exhibit('x', { tour_node_id: 'a', tour_heading: 40, tour_pitch: -5 }),
      exhibit('y', { tour_node_id: 'a', tour_heading: 10, tour_pitch: 0 }),
    ],
  })

  it('links an unlinked exhibit', () => {
    const w = setExhibitNode({ ...state(), exhibits: [exhibit('x')] }, 'x', 'b')
    expect(w.exhibits[0]).toMatchObject({ tour_node_id: 'b', tour_heading: null, tour_pitch: null })
  })

  it('resets the aim when the node changes, leaving other exhibits alone', () => {
    const w = setExhibitNode(state(), 'x', 'b')
    expect(w.exhibits[0]).toMatchObject({ tour_node_id: 'b', tour_heading: null, tour_pitch: null })
    expect(w.exhibits[1]).toMatchObject({ tour_node_id: 'a', tour_heading: 10, tour_pitch: 0 })
  })

  it('resets the aim when clearing', () => {
    const w = setExhibitNode(state(), 'x', null)
    expect(w.exhibits[0]).toMatchObject({
      tour_node_id: null,
      tour_heading: null,
      tour_pitch: null,
    })
  })

  it('keeps the aim when re-linking the same node', () => {
    const s = state()
    expect(setExhibitNode(s, 'x', 'a').exhibits[0]).toEqual(s.exhibits[0])
  })
})
