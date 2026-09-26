import { describe, it, expect } from 'vitest'
import { haversineMetres, nearestWithin, pinPixelHeight } from '@/lib/nearby'

const PARK_LAT = 17.4

describe('haversineMetres', () => {
  it('returns ~0 m for identical points', () => {
    const p = { lat: 17.4, lng: 78.4 }
    expect(haversineMetres(p, p)).toBeCloseTo(0, 3)
  })

  it('matches a known distance between two coordinates', () => {
    // ~1 degree of latitude at the equator is ~111.19 km
    const a = { lat: 0, lng: 0 }
    const b = { lat: 1, lng: 0 }
    expect(haversineMetres(a, b)).toBeCloseTo(111195, -2)
  })
})

describe('nearestWithin', () => {
  const position = { lat: 0, lng: 0, accuracyM: 10 }

  it('includes an exhibit just inside the 50 m radius', () => {
    // ~49 m north
    const exhibits = [{ id: 'in', lat: 0.00044, lng: 0 }]
    expect(nearestWithin(position, exhibits)).toEqual(['in'])
  })

  it('excludes an exhibit just outside the 50 m radius', () => {
    // ~51 m north
    const exhibits = [{ id: 'out', lat: 0.00046, lng: 0 }]
    expect(nearestWithin(position, exhibits)).toEqual([])
  })

  it('caps results at 5 when more than 5 are in range, nearest-first', () => {
    const exhibits = [
      { id: 'e6', lat: 0.0004, lng: 0 },
      { id: 'e1', lat: 0.00005, lng: 0 },
      { id: 'e4', lat: 0.00025, lng: 0 },
      { id: 'e2', lat: 0.0001, lng: 0 },
      { id: 'e5', lat: 0.0003, lng: 0 },
      { id: 'e3', lat: 0.0002, lng: 0 },
    ]
    expect(nearestWithin(position, exhibits)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5'])
  })

  it('returns [] when accuracyM is greater than maxAccuracyM (60)', () => {
    const exhibits = [{ id: 'in', lat: 0.0001, lng: 0 }]
    expect(nearestWithin({ lat: 0, lng: 0, accuracyM: 61 }, exhibits)).toEqual([])
  })

  it('allows a fix with accuracyM exactly at maxAccuracyM (60)', () => {
    const exhibits = [{ id: 'in', lat: 0.0001, lng: 0 }]
    expect(nearestWithin({ lat: 0, lng: 0, accuracyM: 60 }, exhibits)).toEqual(['in'])
  })
})

describe('pinPixelHeight', () => {
  it('is ~42 px at zoom 18 at the park latitude', () => {
    expect(pinPixelHeight(18, PARK_LAT)).toBeCloseTo(42, 0)
  })

  it('clamps to 24 px at zoom 14', () => {
    expect(pinPixelHeight(14, PARK_LAT)).toBe(24)
  })

  it('clamps to 96 px at zoom 22', () => {
    expect(pinPixelHeight(22, PARK_LAT)).toBe(96)
  })
})
