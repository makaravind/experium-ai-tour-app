import { describe, expect, it } from 'vitest'
import {
  manifestToPanorama,
  nodeLinks,
  parseHeading,
  resolveNode,
  tourHref,
  type TourEdge,
  type TourNode,
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
