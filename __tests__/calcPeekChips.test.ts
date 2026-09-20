import { describe, it, expect, vi } from 'vitest'
import type { MapExhibit } from '@/lib/types'

vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { calcPeekChips } = await import('@/components/map/ParkMapbox')

function mockMap({
  sw = { lng: 0, lat: 0 },
  ne = { lng: 1, lat: 1 },
  W = 1000,
  H = 800,
  projectFn = (lngLat: [number, number]) => ({ x: lngLat[0] * 1000, y: lngLat[1] * 800 }),
} = {}) {
  return {
    getBounds: () => ({
      getSouthWest: () => sw,
      getNorthEast: () => ne,
    }),
    getCanvas: () => ({ width: W, height: H }),
    project: projectFn,
  } as unknown as import('mapbox-gl').Map
}

function exhibit(id: string, lng: number, lat: number): MapExhibit {
  return {
    id,
    name: `Exhibit ${id}`,
    type: null,
    tier: 'free',
    gps_lng: lng,
    gps_lat: lat,
    qr_code: null,
    languages: [],
  }
}

describe('calcPeekChips', () => {
  it('returns no chip for an in-viewport exhibit', () => {
    const map = mockMap()
    const result = calcPeekChips(map, [exhibit('e1', 0.5, 0.5)], [])
    expect(result).toEqual([])
  })

  it('assigns edge "left" for an exhibit off-screen to the left', () => {
    const map = mockMap({
      projectFn: () => ({ x: -300, y: 400 }),
    })
    const result = calcPeekChips(map, [exhibit('e1', -0.3, 0.5)], [])
    expect(result).toHaveLength(1)
    expect(result[0].edge).toBe('left')
    expect(result[0].offset).toBe(400)
  })

  it('assigns edge "right" for an exhibit off-screen to the right', () => {
    const map = mockMap({
      projectFn: () => ({ x: 1200, y: 400 }),
    })
    const result = calcPeekChips(map, [exhibit('e1', 1.2, 0.5)], [])
    expect(result).toHaveLength(1)
    expect(result[0].edge).toBe('right')
    expect(result[0].offset).toBe(400)
  })

  it('assigns edge "top" for an exhibit off-screen above', () => {
    const map = mockMap({
      projectFn: () => ({ x: 500, y: -200 }),
    })
    const result = calcPeekChips(map, [exhibit('e1', 0.5, 1.2)], [])
    expect(result).toHaveLength(1)
    expect(result[0].edge).toBe('top')
    expect(result[0].offset).toBe(500)
  })

  it('assigns edge "bottom" for an exhibit off-screen below', () => {
    const map = mockMap({
      projectFn: () => ({ x: 500, y: 1100 }),
    })
    const result = calcPeekChips(map, [exhibit('e1', 0.5, -0.3)], [])
    expect(result).toHaveLength(1)
    expect(result[0].edge).toBe('bottom')
    expect(result[0].offset).toBe(500)
  })

  it('returns no chip for an exhibit outside the extended bounds', () => {
    const map = mockMap()
    const result = calcPeekChips(map, [exhibit('e1', -0.6, 0.5)], [])
    expect(result).toEqual([])
  })

  it('picks the dominant axis for a corner exhibit', () => {
    const map = mockMap({
      projectFn: () => ({ x: -100, y: -300 }),
    })
    const result = calcPeekChips(map, [exhibit('e1', -0.3, 1.2)], [])
    expect(result).toHaveLength(1)
    expect(result[0].edge).toBe('top')
  })

  it('sets visited to true when the exhibit id is in visitedIds', () => {
    const map = mockMap({
      projectFn: () => ({ x: -300, y: 400 }),
    })
    const result = calcPeekChips(map, [exhibit('e1', -0.3, 0.5)], ['e1'])
    expect(result[0].visited).toBe(true)
  })

  it('sets visited to false when the exhibit id is not in visitedIds', () => {
    const map = mockMap({
      projectFn: () => ({ x: -300, y: 400 }),
    })
    const result = calcPeekChips(map, [exhibit('e2', -0.3, 0.5)], [])
    expect(result[0].visited).toBe(false)
  })

  it('clamps offset to the minimum of 16 for left/right edges', () => {
    const map = mockMap({
      projectFn: () => ({ x: -300, y: 2 }),
    })
    const result = calcPeekChips(map, [exhibit('e1', -0.3, 0.5)], [])
    expect(result[0].offset).toBe(16)
  })

  it('clamps offset to H - 16 for left/right edges', () => {
    const map = mockMap({
      projectFn: () => ({ x: -300, y: 798 }),
    })
    const result = calcPeekChips(map, [exhibit('e1', -0.3, 0.5)], [])
    expect(result[0].offset).toBe(784)
  })
})
