import { describe, it, expect } from 'vitest'
import { toMapExhibits } from '@/lib/map-exhibits'
import type { CachedExhibit } from '@/lib/types'

const cached = (over: Partial<CachedExhibit> = {}): CachedExhibit => ({
  id: 'e1',
  code: 'baobab',
  status: 'active',
  name: 'Baobab Forest',
  type: null,
  tier: 'free',
  facts: [],
  audio: { en: 'https://cdn.test/en.mp3', hi: 'https://cdn.test/hi.mp3' },
  gps_lat: 17.937484,
  gps_lng: 78.460897,
  exhibitStatus: 'live',
  ...over,
})

describe('toMapExhibits', () => {
  it('drops exhibits with null GPS', () => {
    const out = toMapExhibits([
      cached({ id: 'a' }),
      cached({ id: 'b', gps_lat: null }),
      cached({ id: 'c', gps_lng: null }),
    ])
    expect(out.map((e) => e.id)).toEqual(['a'])
  })

  it('keeps the qr_code only when the QR is active', () => {
    const [active, soon] = toMapExhibits([
      cached({ id: 'a' }),
      cached({ id: 'b', status: 'coming_soon' }),
    ])
    expect(active.qr_code).toBe('baobab')
    expect(soon.qr_code).toBeNull()
  })

  it('takes languages from the audio keys and status from exhibitStatus', () => {
    const [out] = toMapExhibits([cached({ exhibitStatus: 'coming_soon' })])
    expect(out.languages).toEqual(['en', 'hi'])
    expect(out.status).toBe('coming_soon')
    expect(out).toMatchObject({ gps_lat: 17.937484, gps_lng: 78.460897, tier: 'free' })
  })
})
