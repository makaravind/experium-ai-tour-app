import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchCachedAmenities, fetchCachedExhibits, runPrecache } from '@/lib/precache'
import { useStore } from '@/lib/store'
import { ConnectionTimeoutError, DATASET_TIMEOUT_MS } from '@/lib/timeouts'

const results: Record<string, { data: unknown; error: { message: string } | null }> = {}

let hang = false
const neq = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const q = {
        neq: (...args: unknown[]) => {
          neq(table, ...args)
          return q
        },
        abortSignal: (signal: AbortSignal) =>
          hang
            ? new Promise((resolve) =>
                signal.addEventListener('abort', () =>
                  resolve({ data: null, error: { message: 'AbortError' } })
                )
              )
            : Promise.resolve(results[table]),
      }
      return { select: () => q }
    },
  },
}))

const amenityRow = {
  id: 'a1',
  name: 'Main Washroom',
  type: 'washroom',
  description: 'Near Gate 2',
  photos: [],
  gps_lat: 17.937684,
  gps_lng: 78.461197,
  section: 'G',
}

const exhibitRow = {
  id: 'e1',
  code: 7,
  section: 'K',
  number: 11,
  name: 'Baobab Forest',
  type: null,
  tier: 'free',
  facts: [],
  status: 'live',
  gps_lat: 17.937484,
  gps_lng: 78.460897,
  tour_node_id: 'n1',
  tour_heading: 90,
  tour_pitch: -10,
  tour_nodes: { preview_url: 'https://cdn.test/panoramas/1/preview.jpg' },
  exhibit_audio: [],
}

beforeEach(() => {
  vi.useRealTimers()
  hang = false
  neq.mockClear()
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

  it('throws ConnectionTimeoutError after DATASET_TIMEOUT_MS', async () => {
    vi.useFakeTimers()
    hang = true
    const p = expect(fetchCachedAmenities()).rejects.toBeInstanceOf(ConnectionTimeoutError)
    await vi.advanceTimersByTimeAsync(DATASET_TIMEOUT_MS)
    await p
  })
})

describe('fetchCachedExhibits', () => {
  it('excludes disabled exhibits at the query', async () => {
    await fetchCachedExhibits()
    expect(neq).toHaveBeenCalledWith('exhibits', 'status', 'disabled')
  })

  it('maps exhibit_photos sorted by sort_order, dropping sort_order', async () => {
    results.exhibits = {
      data: [
        {
          ...exhibitRow,
          exhibit_photos: [
            { url: 'b.webp', caption: null, is_hero: false, sort_order: 2 },
            { url: 'a.webp', caption: 'Hero', is_hero: true, sort_order: 1 },
          ],
        },
      ],
      error: null,
    }
    const [e] = await fetchCachedExhibits()
    expect(e.photos).toEqual([
      { url: 'a.webp', caption: 'Hero', is_hero: true },
      { url: 'b.webp', caption: null, is_hero: false },
    ])
  })

  it('defaults photos to [] when the relation is missing', async () => {
    const [e] = await fetchCachedExhibits()
    expect(e.photos).toEqual([])
  })

  it('throws ConnectionTimeoutError after DATASET_TIMEOUT_MS', async () => {
    vi.useFakeTimers()
    hang = true
    const p = expect(fetchCachedExhibits()).rejects.toBeInstanceOf(ConnectionTimeoutError)
    await vi.advanceTimersByTimeAsync(DATASET_TIMEOUT_MS)
    await p
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
      code: '7',
      displayId: 'K11',
      exhibitStatus: 'live',
      status: 'active',
      tour_node_id: 'n1',
      tour_heading: 90,
      tour_pitch: -10,
      tour_preview_url: 'https://cdn.test/panoramas/1/preview.jpg',
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
