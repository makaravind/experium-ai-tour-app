import { describe, it, expect } from 'vitest'
import { pointInPolygon, sectionAt } from '@/lib/admin/geometry'
import type { Section } from '@/lib/admin/types'

// unit square [0,10] x [0,10]
const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]]
// concave "L"
const ell: [number, number][] = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]]

describe('pointInPolygon', () => {
  it('true for a point inside', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true)
  })

  it('false for a point outside', () => {
    expect(pointInPolygon(15, 5, square)).toBe(false)
    expect(pointInPolygon(5, -1, square)).toBe(false)
  })

  it('handles concave polygons', () => {
    expect(pointInPolygon(2, 8, ell)).toBe(true)
    expect(pointInPolygon(8, 2, ell)).toBe(true)
    expect(pointInPolygon(8, 8, ell)).toBe(false) // in the notch
  })

  it('false for an empty or degenerate polygon', () => {
    expect(pointInPolygon(1, 1, [])).toBe(false)
    expect(pointInPolygon(1, 1, [[0, 0], [2, 2]])).toBe(false)
  })
})

describe('sectionAt', () => {
  const a: Section = { id: 'A', polygon: square }
  const b: Section = { id: 'B', polygon: [[20, 0], [30, 0], [30, 10], [20, 10]] }

  it('returns the section containing the point', () => {
    expect(sectionAt(25, 5, [a, b])?.id).toBe('B')
  })

  it('returns null when outside every section', () => {
    expect(sectionAt(15, 5, [a, b])).toBeNull()
    expect(sectionAt(5, 5, [])).toBeNull()
  })

  it('first section in the list wins on overlap', () => {
    const overlap: Section = { id: 'C', polygon: [[5, 5], [15, 5], [15, 15], [5, 15]] }
    expect(sectionAt(7, 7, [a, overlap])?.id).toBe('A')
    expect(sectionAt(7, 7, [overlap, a])?.id).toBe('C')
  })
})
