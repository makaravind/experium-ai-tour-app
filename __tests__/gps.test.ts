import { describe, it, expect } from 'vitest'
import { classifyGeoError, lerpPosition } from '@/lib/gps'

describe('classifyGeoError', () => {
  it('maps PERMISSION_DENIED (1) to denied', () => {
    expect(classifyGeoError(1)).toBe('denied')
  })

  it('maps POSITION_UNAVAILABLE (2) to unavailable', () => {
    expect(classifyGeoError(2)).toBe('unavailable')
  })

  it('maps TIMEOUT (3) to unavailable', () => {
    expect(classifyGeoError(3)).toBe('unavailable')
  })

  it('maps unknown codes to unavailable', () => {
    expect(classifyGeoError(0)).toBe('unavailable')
    expect(classifyGeoError(99)).toBe('unavailable')
  })
})

describe('lerpPosition', () => {
  const from = { lat: 17.4, lng: 78.4 }
  const to = { lat: 17.5, lng: 78.6 }

  it('returns from at t=0', () => {
    expect(lerpPosition(from, to, 0)).toEqual(from)
  })

  it('returns to at t=1', () => {
    expect(lerpPosition(from, to, 1)).toEqual(to)
  })

  it('returns the midpoint at t=0.5', () => {
    const mid = lerpPosition(from, to, 0.5)
    expect(mid.lat).toBeCloseTo(17.45, 10)
    expect(mid.lng).toBeCloseTo(78.5, 10)
  })

  it('handles decreasing coordinates', () => {
    const p = lerpPosition(to, from, 0.25)
    expect(p.lat).toBeCloseTo(17.475, 10)
    expect(p.lng).toBeCloseTo(78.55, 10)
  })
})
