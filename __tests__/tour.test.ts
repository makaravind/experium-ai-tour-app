import { describe, expect, it } from 'vitest'
import { manifestToPanorama, parseHeading, resolveNode, type TourNode } from '@/lib/tour'

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
