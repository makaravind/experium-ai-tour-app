import { describe, expect, it } from 'vitest'
import type { CachedExhibit, TourSpot } from '@/lib/types'
import {
  isFreshTourSpot,
  isTourSpotEntry,
  manifestToPanorama,
  nodeLinks,
  nodeMarkers,
  parseHeading,
  resolveNode,
  tourHref,
  tourSpotHref,
  type TourEdge,
  type TourNode,
  yawToHeading,
} from '@/lib/tour'

const node = (id: string, is_lobby = false): TourNode => ({
  id,
  label: id,
  pano_ref: id,
  tiles_url: '',
  preview_url: '',
  lat: null,
  lng: null,
  is_lobby,
})

describe('parseHeading', () => {
  it('converts degrees to radians', () => {
    expect(parseHeading('180')).toBeCloseTo(Math.PI)
    expect(parseHeading('90')).toBeCloseTo(Math.PI / 2)
  })
  it('falls back to 0', () => {
    expect(parseHeading(null)).toBe(0)
    expect(parseHeading('abc')).toBe(0)
  })
})

describe('resolveNode', () => {
  const nodes = [node('a'), node('lobby', true)]
  it('uses the node param when it exists', () => expect(resolveNode(nodes, 'a')?.id).toBe('a'))
  it('falls back to the lobby', () => {
    expect(resolveNode(nodes, null)?.id).toBe('lobby')
    expect(resolveNode(nodes, 'missing')?.id).toBe('lobby')
  })
  it('returns null with no lobby', () => expect(resolveNode([node('a')], null)).toBeNull())
})

describe('manifestToPanorama', () => {
  it('fills tileUrl placeholders', () => {
    const p = manifestToPanorama({
      baseUrl: 'b.jpg',
      levels: [{ width: 1024, cols: 2, rows: 1 }],
      tileUrl: 'https://x/37A/l{level}/{col}_{row}.jpg',
    })
    expect(p.baseUrl).toBe('b.jpg')
    expect(p.levels).toHaveLength(1)
    expect(p.tileUrl(3, 1, 2)).toBe('https://x/37A/l2/3_1.jpg')
  })
})

describe('tourHref', () => {
  it('builds node, heading and exhibitId params', () => {
    expect(tourHref({ id: 'e1', tour_node_id: 'n1', tour_heading: 90 })).toBe(
      '/tour?node=n1&heading=90&exhibitId=e1'
    )
  })

  it('keeps a 0 heading', () => {
    expect(tourHref({ id: 'e1', tour_node_id: 'n1', tour_heading: 0 })).toBe(
      '/tour?node=n1&heading=0&exhibitId=e1'
    )
  })

  it('omits a null heading', () => {
    expect(tourHref({ id: 'e1', tour_node_id: 'n1', tour_heading: null })).toBe(
      '/tour?node=n1&exhibitId=e1'
    )
  })

  it('returns null without a tour node', () => {
    expect(tourHref({ id: 'e1', tour_node_id: null })).toBeNull()
    expect(tourHref({ id: 'e1' })).toBeNull()
  })
})

describe('nodeLinks', () => {
  const nodes = [{ ...node('a'), label: 'Lobby' }, { ...node('b'), label: 'Pond' }, node('c')]
  const edge = (from_node_id: string, to_node_id: string, bearing = 0, pitch = 0): TourEdge => ({
    from_node_id,
    to_node_id,
    bearing,
    pitch,
  })

  it('converts yaw/pitch degrees to radians and names the link after the target', () => {
    const [link] = nodeLinks('a', { nodes, edges: [edge('a', 'b', 90, -10)] })
    expect(link.nodeId).toBe('b')
    expect(link.name).toBe('Pond')
    expect(link.position.yaw).toBeCloseTo(Math.PI / 2)
    expect(link.position.pitch).toBeCloseTo((-10 * Math.PI) / 180)
  })
  it('only returns edges leaving the node', () => {
    const edges = [edge('a', 'b'), edge('b', 'a'), edge('a', 'c')]
    expect(nodeLinks('a', { nodes, edges }).map((l) => l.nodeId)).toEqual(['b', 'c'])
  })
  it('returns no links for a node without edges', () => {
    expect(nodeLinks('c', { nodes, edges: [edge('a', 'b')] })).toEqual([])
  })
  it('ignores edges to unknown nodes', () => {
    expect(nodeLinks('a', { nodes, edges: [edge('a', 'ghost')] })).toEqual([])
  })
})

describe('nodeMarkers', () => {
  const exhibit = (id: string, over: Partial<CachedExhibit> = {}) =>
    ({
      id,
      name: `Exhibit ${id}`,
      displayId: `K${id}`,
      tour_node_id: 'a',
      tour_heading: 90,
      tour_pitch: -10,
      ...over,
    }) as CachedExhibit

  it('keeps only exhibits linked to the node', () => {
    const pins = nodeMarkers('a', [exhibit('1'), exhibit('2', { tour_node_id: 'b' })], [])
    expect(pins.map((p) => p.exhibitId)).toEqual(['1'])
  })
  it('skips exhibits without an authored heading or pitch', () => {
    const pins = nodeMarkers(
      'a',
      [exhibit('1', { tour_heading: null }), exhibit('2', { tour_pitch: null }), exhibit('3')],
      []
    )
    expect(pins.map((p) => p.exhibitId)).toEqual(['3'])
  })
  it('converts degrees to radians, keeping 0', () => {
    const [pin] = nodeMarkers('a', [exhibit('1', { tour_heading: 180, tour_pitch: 0 })], [])
    expect(pin.position.yaw).toBeCloseTo(Math.PI)
    expect(pin.position.pitch).toBe(0)
  })
  it('flags visited exhibits', () => {
    const pins = nodeMarkers('a', [exhibit('1'), exhibit('2')], ['2'])
    expect(pins.map((p) => p.visited)).toEqual([false, true])
  })
})

describe('yawToHeading', () => {
  it('converts radians to degrees in [0, 360)', () => {
    expect(yawToHeading(0)).toBe(0)
    expect(yawToHeading(Math.PI / 2)).toBeCloseTo(90)
    expect(yawToHeading(-Math.PI / 2)).toBeCloseTo(270)
    expect(yawToHeading(2 * Math.PI + Math.PI)).toBeCloseTo(180)
  })
})

describe('isFreshTourSpot', () => {
  const spot: TourSpot = { nodeId: 'n', lat: 1, lng: 2, heading: 0, label: 'L', at: 100_000 }

  it('is true within 10 s of being written', () => {
    expect(isFreshTourSpot(spot, 100_000, null)).toBe(true)
    expect(isFreshTourSpot(spot, 110_000, null)).toBe(true)
  })

  it('is false when older than 10 s, or in the future', () => {
    expect(isFreshTourSpot(spot, 110_001, null)).toBe(false)
    expect(isFreshTourSpot(spot, 99_999, null)).toBe(false)
  })

  it('is false with no spot', () => {
    expect(isFreshTourSpot(null, 100_000, null)).toBe(false)
  })

  it('is false once the map already flew to this spot', () => {
    expect(isFreshTourSpot(spot, 101_000, 100_000)).toBe(false)
    expect(isFreshTourSpot(spot, 101_000, 50_000)).toBe(true)
  })
})

describe('tourSpotHref / isTourSpotEntry', () => {
  const spot: TourSpot = { nodeId: 'n 1', lat: 1, lng: 2, heading: 123.5, label: 'L', at: 1 }

  it('links to the node at the saved heading, no exhibit', () => {
    expect(tourSpotHref(spot)).toBe('/tour?node=n+1&heading=123.5')
  })

  it('recognises its own href as a spot entry', () => {
    const p = new URL(tourSpotHref(spot), 'http://x').searchParams
    expect(isTourSpotEntry(spot, p.get('node'), p.get('heading'), p.get('exhibitId'))).toBe(true)
  })

  it('is not a spot entry from other routes', () => {
    expect(isTourSpotEntry(spot, null, null, null)).toBe(false) // home button / virtual-tour QR
    expect(isTourSpotEntry(spot, 'n 1', '123.5', 'ex1')).toBe(false) // gallery slide
    expect(isTourSpotEntry(spot, 'n 1', null, null)).toBe(false)
    expect(isTourSpotEntry(spot, 'other', '123.5', null)).toBe(false)
    expect(isTourSpotEntry(null, 'n 1', '123.5', null)).toBe(false)
  })
})
