import { describe, it, expect } from 'vitest'
import { discoverVia, MAX_ACCURACY_M, type Ctx } from '@/lib/discovery'
import { haversineMetres } from '@/lib/nearby'
import { CAMPAIGNS } from '@/lib/campaigns'

const EXHIBIT = { lat: 40, lng: -74 }
const M_PER_DEG_LAT = (Math.PI * 6371000) / 180

/** Position `metres` due north of the exhibit. */
const northOf = (metres: number, accuracyM = 10) => ({
  lat: EXHIBIT.lat + metres / M_PER_DEG_LAT,
  lng: EXHIBIT.lng,
  accuracyM,
})

const ctx = (over: Partial<Ctx> = {}): Ctx => ({
  scanSrc: null,
  quartile: null,
  position: null,
  exhibit: EXHIBIT,
  ...over,
})

describe('discoverVia', () => {
  it('returns null when nothing matches', () => {
    expect(discoverVia(ctx())).toBeNull()
  })

  describe('onsite_scan', () => {
    it('matches scanSrc onsite regardless of position or quartile', () => {
      expect(discoverVia(ctx({ scanSrc: 'onsite' }))).toBe('onsite_scan')
    })

    it('ignores other scan sources', () => {
      expect(discoverVia(ctx({ scanSrc: 'remote' }))).toBeNull()
    })

    it('wins over audio rules', () => {
      expect(
        discoverVia(ctx({ scanSrc: 'onsite', quartile: 100, position: northOf(10) }))
      ).toBe('onsite_scan')
    })
  })

  describe('audio_complete', () => {
    it.each([
      [49, null],
      [50, null],
      [99, null],
      [100, 'audio_complete'],
    ])('quartile %i without position -> %s', (quartile, expected) => {
      expect(discoverVia(ctx({ quartile }))).toBe(expected)
    })

    it('ignores a far position', () => {
      expect(discoverVia(ctx({ quartile: 100, position: northOf(5000) }))).toBe(
        'audio_complete'
      )
    })

    it('ignores exhibit without GPS', () => {
      expect(
        discoverVia(ctx({ quartile: 100, exhibit: { lat: null, lng: null } }))
      ).toBe('audio_complete')
    })

    it('wins over audio_half_near', () => {
      expect(discoverVia(ctx({ quartile: 100, position: northOf(10) }))).toBe(
        'audio_complete'
      )
    })
  })

  describe('audio_half_near', () => {
    it.each([
      [49, null],
      [50, 'audio_half_near'],
      [99, 'audio_half_near'],
    ])('quartile %i near -> %s', (quartile, expected) => {
      expect(discoverVia(ctx({ quartile, position: northOf(10) }))).toBe(expected)
    })

    it.each([
      [49, 'audio_half_near'],
      [50, 'audio_half_near'],
      [51, null],
    ])('distance %im -> %s', (metres, expected) => {
      const position = northOf(metres)
      expect(haversineMetres(position, EXHIBIT)).toBeCloseTo(metres, 3)
      expect(discoverVia(ctx({ quartile: 50, position }))).toBe(expected)
    })

    it.each([
      [MAX_ACCURACY_M, 'audio_half_near'],
      [MAX_ACCURACY_M + 1, null],
    ])('accuracy %im -> %s', (accuracyM, expected) => {
      expect(discoverVia(ctx({ quartile: 50, position: northOf(10, accuracyM) }))).toBe(
        expected
      )
    })

    it('MAX_ACCURACY_M is 40', () => {
      expect(MAX_ACCURACY_M).toBe(40)
    })

    it('null position does not match', () => {
      expect(discoverVia(ctx({ quartile: 50, position: null }))).toBeNull()
    })

    it('null exhibit GPS does not match', () => {
      const position = northOf(0)
      expect(
        discoverVia(ctx({ quartile: 50, position, exhibit: { lat: null, lng: null } }))
      ).toBeNull()
      expect(
        discoverVia(ctx({ quartile: 50, position, exhibit: { lat: 40, lng: null } }))
      ).toBeNull()
      expect(
        discoverVia(ctx({ quartile: 50, position, exhibit: { lat: null, lng: -74 } }))
      ).toBeNull()
    })

    it('forged far position does not discover', () => {
      expect(discoverVia(ctx({ quartile: 99, position: northOf(20000) }))).toBeNull()
    })
  })
})

describe('CAMPAIGNS', () => {
  it('has the default campaign with expected milestones', () => {
    expect(CAMPAIGNS).toEqual([
      { id: 'default', milestones: [1, 3, 5, 10, 15, 20, 30, 40, 50] },
    ])
  })
})
