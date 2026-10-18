import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchCachedAmenities, runPrecache } from '@/lib/precache'
import { useStore } from '@/lib/store'

const results: Record<string, { data: unknown; error: { message: string } | null }> = {}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => ({ select: async () => results[table] }) },
}))

const amenityRow = {
  id: 'a1',
  name: 'Main Washroom',
  type: 'washroom',
  description: 'Near Gate 2',
  photos: [],
  gps_lat: 17.937684,
  gps_lng: 78.461197,
}

const exhibitRow = {
  id: 'e1',
  name: 'Baobab Forest',
  type: null,
  tier: 'free',
  facts: [],
  status: 'live',
  gps_lat: 17.937484,
  gps_lng: 78.460897,
  exhibit_qr_codes: [{ code: 'baobab', status: 'active' }],
  exhibit_audio: [],
}

beforeEach(() => {
  vi.stubGlobal('caches', { open: async () => ({ keys: async () => [] }) })
  useStore.setState({ cachedExhibits: [], cachedAmenities: [], assetFailures: {} })
  results.exhibits = { data: [exhibitRow], error: null }
  results.amenities = { data: [amenityRow], error: null }
})

describe('fetchCachedAmenities', () => {
  it('maps rows to CachedAmenity', async () => {
    expect(await fetchCachedAmenities()).toEqual([amenityRow])
  })

  it('throws on query error', async () => {
    results.amenities = { data: null, error: { message: 'boom' } }
    await expect(fetchCachedAmenities()).rejects.toThrow('boom')
  })
})

describe('runPrecache dataset', () => {
  it('writes cachedExhibits (with GPS + exhibitStatus) and cachedAmenities', async () => {
    await runPrecache('en')
    const s = useStore.getState()
    expect(s.cachedAmenities).toEqual([amenityRow])
    expect(s.cachedExhibits[0]).toMatchObject({
      id: 'e1',
      gps_lat: 17.937484,
      gps_lng: 78.460897,
      exhibitStatus: 'live',
      status: 'active',
    })
  })

  it('throws when the amenities query fails', async () => {
    results.amenities = { data: null, error: { message: 'no table' } }
    await expect(runPrecache('en')).rejects.toThrow('no table')
  })

  it('throws when the exhibits query fails', async () => {
    results.exhibits = { data: null, error: { message: 'down' } }
    await expect(runPrecache('en')).rejects.toThrow('down')
  })
})
