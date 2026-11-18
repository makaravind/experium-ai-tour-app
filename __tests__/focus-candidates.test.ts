import { describe, it, expect, vi } from 'vitest'
import type { MapExhibit } from '@/lib/types'

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { calcFocusCandidates } = await import('@/components/map/ParkMap')

// Container is 400 × 600 CSS px → centre (200, 300). The canvas is deliberately 2× (device px)
// to prove the centre comes from the container, not the canvas.
function mockMap(projectFn: (lngLat: [number, number]) => { x: number; y: number }) {
  return {
    getContainer: () => ({ clientWidth: 400, clientHeight: 600 }),
    getCanvas: () => ({ width: 800, height: 1200 }),
    project: projectFn,
  } as unknown as import('maplibre-gl').Map
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
    status: 'live',
    displayId: 'A1',
    facts: [],
  }
}

describe('calcFocusCandidates', () => {
  it('returns an empty list for no exhibits', () => {
    expect(
      calcFocusCandidates(
        mockMap(() => ({ x: 0, y: 0 })),
        []
      )
    ).toEqual([])
  })

  it('measures distance from the container CSS-px centre, not the canvas centre', () => {
    const map = mockMap(() => ({ x: 200, y: 300 }))
    expect(calcFocusCandidates(map, [exhibit('e1', 1, 1)])).toEqual([{ id: 'e1', distance: 0 }])
  })

  it('uses euclidean pixel distance', () => {
    const map = mockMap(() => ({ x: 230, y: 340 }))
    expect(calcFocusCandidates(map, [exhibit('e1', 1, 1)])).toEqual([{ id: 'e1', distance: 50 }])
  })

  it('returns one candidate per exhibit, in order', () => {
    const points: Record<string, { x: number; y: number }> = {
      '1,1': { x: 200, y: 400 },
      '2,2': { x: 500, y: 300 },
    }
    const map = mockMap(([lng, lat]) => points[`${lng},${lat}`])
    const result = calcFocusCandidates(map, [exhibit('a', 1, 1), exhibit('b', 2, 2)])
    expect(result).toEqual([
      { id: 'a', distance: 100 },
      { id: 'b', distance: 300 },
    ])
  })

  it('includes off-screen exhibits (the radius filter is pickFocus’s job)', () => {
    const map = mockMap(() => ({ x: -1000, y: -1000 }))
    expect(calcFocusCandidates(map, [exhibit('e1', 1, 1)])).toHaveLength(1)
  })
})
