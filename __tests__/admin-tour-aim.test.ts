import { describe, it, expect } from 'vitest'
import { buildTourChangeset } from '@/lib/admin/tour-changeset'
import { aimMarkers, clickToAim, setEdgeAim, setExhibitAim } from '@/lib/admin/tour-aim'
import type { TourAdminState } from '@/lib/admin/tour-types'
import { addEdgePairs, toTourWorking } from '@/lib/admin/tour-working'
import type { TourNode } from '@/lib/tour'

const rad = (deg: number) => (deg * Math.PI) / 180
const node = (id: string): TourNode => ({
  id,
  label: id,
  pano_ref: id,
  tiles_url: 't',
  preview_url: 'p',
  lat: null,
  lng: null,
  is_lobby: false,
})
const state: TourAdminState = {
  nodes: [node('a'), node('b')],
  edges: [],
  exhibits: [
    {
      id: 'x1',
      code: 1,
      name: 'Banyan',
      gps_lat: null,
      gps_lng: null,
      tour_node_id: 'a',
      tour_heading: null,
      tour_pitch: null,
    },
  ],
}

describe('clickToAim', () => {
  it('converts radians to whole degrees', () => {
    expect(clickToAim(rad(90), rad(-15))).toEqual({ yaw: 90, pitch: -15 })
  })
  it('rounds to integers', () => {
    expect(clickToAim(rad(89.6), rad(-14.4))).toEqual({ yaw: 90, pitch: -14 })
  })
  it('wraps yaw into 0-359 (360 -> 0, negatives wrap)', () => {
    expect(clickToAim(rad(360), 0).yaw).toBe(0)
    expect(clickToAim(rad(359.6), 0).yaw).toBe(0)
    expect(clickToAim(rad(-90), 0).yaw).toBe(270)
    expect(clickToAim(rad(-0.4), 0).yaw).toBe(0)
    expect(clickToAim(rad(450), 0).yaw).toBe(90)
  })
  it('clamps pitch to -90..90', () => {
    expect(clickToAim(0, rad(95)).pitch).toBe(90)
    expect(clickToAim(0, rad(-120)).pitch).toBe(-90)
  })
  it('never returns -0', () => {
    expect(Object.is(clickToAim(-0.001, -0.001).pitch, -0)).toBe(false)
  })
})

describe('setEdgeAim / setExhibitAim', () => {
  const w = addEdgePairs(toTourWorking(state), [{ a: 'a', b: 'b' }])

  it('aims only the A→B direction, leaving B→A unaimed', () => {
    const aimed = setEdgeAim(w, 'a', 'b', { bearing: 120, pitch: -10 })
    expect(aimed.edges.find((e) => e.from_node_id === 'a')).toMatchObject({
      bearing: 120,
      pitch: -10,
    })
    expect(aimed.edges.find((e) => e.from_node_id === 'b')).toMatchObject({ bearing: null })
    // only the aimed direction reaches the changeset
    expect(buildTourChangeset(state, aimed).changeset.edges.upsert).toEqual([
      { from_node_id: 'a', to_node_id: 'b', bearing: 120, pitch: -10 },
    ])
  })

  it('aims an exhibit and stages heading/pitch', () => {
    const aimed = setExhibitAim(w, 'x1', { heading: 200, pitch: 5 })
    expect(aimed.exhibits[0]).toMatchObject({ tour_heading: 200, tour_pitch: 5 })
    expect(buildTourChangeset(state, aimed).changeset.exhibits).toEqual([
      { id: 'x1', tour_heading: 200, tour_pitch: 5 },
    ])
  })

  it('does not mutate the input', () => {
    setEdgeAim(w, 'a', 'b', { bearing: 1, pitch: 2 })
    expect(w.edges.every((e) => e.bearing === null)).toBe(true)
  })
})

describe('aimMarkers', () => {
  it('lists aimed outgoing edges and aimed linked exhibits for the node only', () => {
    let w = addEdgePairs(toTourWorking(state), [{ a: 'a', b: 'b' }])
    expect(aimMarkers(w, 'a')).toEqual([])
    w = setEdgeAim(w, 'a', 'b', { bearing: 120, pitch: -10 })
    w = setExhibitAim(w, 'x1', { heading: 200, pitch: 5 })
    expect(aimMarkers(w, 'a')).toEqual([
      { id: 'edge:b', kind: 'edge', label: 'b', yaw: 120, pitch: -10 },
      { id: 'exhibit:x1', kind: 'exhibit', label: 'Banyan', yaw: 200, pitch: 5 },
    ])
    expect(aimMarkers(w, 'b')).toEqual([])
  })
})
