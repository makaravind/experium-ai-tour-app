import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, selectTotalDiscovered } from '@/lib/store'

beforeEach(() => {
  useStore.setState({
    language: 'en',
    visitedExhibits: [],
    cachedExhibits: [],
    cachedAmenities: [],
    precacheLanguage: null,
    completionByGroup: {},
    assetFailures: {},
    acknowledgedCapped: [],
    visitorId: null,
    discoveredByCampaign: {},
    scanQueue: [],
  })
})

describe('language', () => {
  it('defaults to en', () => {
    expect(useStore.getState().language).toBe('en')
  })

  it('updates on setLanguage', () => {
    useStore.getState().setLanguage('hi')
    expect(useStore.getState().language).toBe('hi')
  })
})

describe('visitedExhibits', () => {
  it('marks an exhibit visited', () => {
    useStore.getState().markVisited('abc')
    expect(useStore.getState().visitedExhibits).toContain('abc')
  })

  it('does not duplicate', () => {
    useStore.getState().markVisited('abc')
    useStore.getState().markVisited('abc')
    expect(useStore.getState().visitedExhibits.filter((id) => id === 'abc')).toHaveLength(1)
  })
})

describe('precache slice', () => {
  it('defaults empty', () => {
    const s = useStore.getState()
    expect(s.cachedExhibits).toEqual([])
    expect(s.completionByGroup).toEqual({})
    expect(s.assetFailures).toEqual({})
  })

  it('sets completion per group without clobbering others', () => {
    useStore.getState().setCompletionByGroup('audio-cache', { language: 'en', complete: true })
    useStore.getState().setCompletionByGroup('image-cache', { complete: false })
    expect(useStore.getState().completionByGroup).toEqual({
      'audio-cache': { language: 'en', complete: true },
      'image-cache': { complete: false },
    })
  })

  it('stores asset failures', () => {
    useStore.getState().setAssetFailures({ 'https://x/a.mp3': { count: 3 } })
    expect(useStore.getState().assetFailures['https://x/a.mp3'].count).toBe(3)
  })
})

describe('totalDiscovered', () => {
  it('defaults to 0', () => {
    expect(selectTotalDiscovered(useStore.getState())).toBe(0)
  })

  it('updates', () => {
    useStore.getState().setTotalDiscovered(5)
    expect(selectTotalDiscovered(useStore.getState())).toBe(5)
  })
})

describe('precacheLanguage', () => {
  it('defaults to null', () => {
    expect(useStore.getState().precacheLanguage).toBeNull()
  })

  it('updates on setPrecacheLanguage', () => {
    useStore.getState().setPrecacheLanguage('hi')
    expect(useStore.getState().precacheLanguage).toBe('hi')
  })
})

describe('persist migration v0 -> v1', () => {
  const migrate = (state: object) => {
    const fn = useStore.persist.getOptions().migrate!
    return fn(state, 0) as unknown as Record<string, unknown>
  }

  it('drops cachedExhibits and seeds precacheLanguage from the audio-cache completion', () => {
    const out = migrate({
      language: 'en',
      cachedExhibits: [{ id: 'x' }],
      completionByGroup: { 'audio-cache': { language: 'hi', complete: true } },
      visitedExhibits: ['a'],
    })
    expect(out.cachedExhibits).toEqual([])
    expect(out.precacheLanguage).toBe('hi')
    expect(out.visitedExhibits).toEqual(['a'])
  })

  it('falls back to language when there is no completion record', () => {
    const out = migrate({ language: 'hi', cachedExhibits: [{ id: 'x' }] })
    expect(out.cachedExhibits).toEqual([])
    expect(out.precacheLanguage).toBe('hi')
  })
})

describe('persist migration v1 -> v2', () => {
  const migrate = (state: object) => {
    const fn = useStore.persist.getOptions().migrate!
    return fn(state, 1) as unknown as Record<string, unknown>
  }

  it('clears cachedExhibits (no GPS), defaults cachedAmenities to [], keeps the rest', () => {
    const out = migrate({
      language: 'hi',
      cachedExhibits: [{ id: 'x' }],
      precacheLanguage: 'hi',
      visitedExhibits: ['a'],
    })
    expect(out.cachedExhibits).toEqual([])
    expect(out.cachedAmenities).toEqual([])
    expect(out.precacheLanguage).toBe('hi')
    expect(out.visitedExhibits).toEqual(['a'])
  })

  it('clears datasets on v2->v3 migration', () => {
    const fn = useStore.persist.getOptions().migrate!
    const out = fn(
      { cachedExhibits: [{ id: 'x' }], cachedAmenities: [{ id: 'a' }] },
      2
    ) as unknown as Record<string, unknown>
    expect(out.cachedExhibits).toEqual([])
    expect(out.cachedAmenities).toEqual([])
  })

  it('clears datasets on v3->v4 migration (displayNumber -> displayId)', () => {
    const fn = useStore.persist.getOptions().migrate!
    const out = fn(
      { cachedExhibits: [{ id: 'x', displayNumber: 7 }], cachedAmenities: [{ id: 'a' }] },
      3
    ) as unknown as Record<string, unknown>
    expect(out.cachedExhibits).toEqual([])
    expect(out.cachedAmenities).toEqual([])
  })

  it('clears datasets on v4->v5 migration (amenity section)', () => {
    const fn = useStore.persist.getOptions().migrate!
    const out = fn(
      { cachedExhibits: [{ id: 'x' }], cachedAmenities: [{ id: 'a' }] },
      4
    ) as unknown as Record<string, unknown>
    expect(out.cachedExhibits).toEqual([])
    expect(out.cachedAmenities).toEqual([])
  })

  it('clears datasets on v5->v6 migration (tour fields)', () => {
    const fn = useStore.persist.getOptions().migrate!
    const out = fn(
      { cachedExhibits: [{ id: 'x' }], cachedAmenities: [{ id: 'a' }] },
      5
    ) as unknown as Record<string, unknown>
    expect(out.cachedExhibits).toEqual([])
    expect(out.cachedAmenities).toEqual([])
  })

  it('v6->v8 adds tourSpot null and clears the cached dataset', () => {
    const fn = useStore.persist.getOptions().migrate!
    const out = fn(
      { language: 'hi', cachedExhibits: [{ id: 'x' }], cachedAmenities: [{ id: 'a' }] },
      6
    ) as unknown as Record<string, unknown>
    expect(out.cachedExhibits).toEqual([])
    expect(out.cachedAmenities).toEqual([])
    expect(out.language).toBe('hi')
    expect(out.tourSpot).toBeNull()
  })

  it('clears datasets on v7->v8 migration (exhibit photos) and keeps tourSpot', () => {
    const fn = useStore.persist.getOptions().migrate!
    const spot = { nodeId: 'n', lat: 1, lng: 2, heading: 90, label: 'L', at: 5 }
    const out = fn(
      {
        language: 'hi',
        tourSpot: spot,
        cachedExhibits: [{ id: 'x' }],
        cachedAmenities: [{ id: 'a' }],
      },
      7
    ) as unknown as Record<string, unknown>
    expect(out.cachedExhibits).toEqual([])
    expect(out.cachedAmenities).toEqual([])
    expect(out.language).toBe('hi')
    expect(out.tourSpot).toEqual(spot)
  })

  it('persists tourSpot and clears it', () => {
    const spot = { nodeId: 'n', lat: 1, lng: 2, heading: 90, label: 'L', at: 5 }
    useStore.getState().setTourSpot(spot)
    const persisted = () =>
      useStore.persist.getOptions().partialize!(useStore.getState()) as Record<string, unknown>
    expect(persisted().tourSpot).toEqual(spot)
    useStore.getState().clearTourSpot()
    expect(persisted().tourSpot).toBeNull()
  })

  it('marks the tourSpot flown and persists the mark', () => {
    const spot = { nodeId: 'n', lat: 1, lng: 2, heading: 90, label: 'L', at: 5 }
    useStore.getState().setTourSpot(spot)
    useStore.getState().markTourSpotFlown()
    const persisted = useStore.persist.getOptions().partialize!(useStore.getState()) as {
      tourSpot: unknown
    }
    expect(persisted.tourSpot).toEqual({ ...spot, flown: true })
    useStore.getState().clearTourSpot()
    useStore.getState().markTourSpotFlown() // no spot: stays null
    expect(useStore.getState().tourSpot).toBeNull()
  })

  it('persists cachedAmenities', () => {
    useStore.setState({ cachedAmenities: [{ id: 'a' } as never] })
    const out = useStore.persist.getOptions().partialize!(useStore.getState()) as Record<
      string,
      unknown
    >
    expect(out.cachedAmenities).toEqual([{ id: 'a' }])
  })
})

describe('acknowledgedCapped', () => {
  it('defaults to []', () => {
    expect(useStore.getState().acknowledgedCapped).toEqual([])
  })

  it('updates on setAcknowledgedCapped', () => {
    useStore.getState().setAcknowledgedCapped(['a', 'b'])
    expect(useStore.getState().acknowledgedCapped).toEqual(['a', 'b'])
  })

  it('is persisted (partialize)', () => {
    useStore.setState({ acknowledgedCapped: ['a'] })
    const out = useStore.persist.getOptions().partialize!(useStore.getState()) as Record<
      string,
      unknown
    >
    expect(out.acknowledgedCapped).toEqual(['a'])
  })
})

const ONSITE = {
  scanSrc: 'onsite',
  quartile: null,
  position: null,
  exhibit: { lat: null, lng: null },
}
const NO_MATCH = { ...ONSITE, scanSrc: null }

describe('discoverCode', () => {
  it('defaults discoveredByCampaign to {} and scanQueue to []', () => {
    expect(useStore.getState().discoveredByCampaign).toEqual({})
    expect(useStore.getState().scanQueue).toEqual([])
  })

  it('selector reads the default campaign total', () => {
    useStore.setState({
      discoveredByCampaign: { default: { codes: ['a'], total: 7 }, other: { codes: [], total: 2 } },
    })
    expect(selectTotalDiscovered(useStore.getState())).toBe(7)
  })

  it('increments once per code and returns prev/new totals', () => {
    useStore.setState({ discoveredByCampaign: { default: { codes: [], total: 2 } } })
    expect(useStore.getState().discoverCode('a', ONSITE)).toEqual({ prevTotal: 2, newTotal: 3 })
    expect(useStore.getState().discoveredByCampaign.default).toEqual({ codes: ['a'], total: 3 })
  })

  it('returns null and changes nothing on rescan', () => {
    useStore.getState().discoverCode('a', ONSITE)
    expect(useStore.getState().discoverCode('a', ONSITE)).toBeNull()
    expect(useStore.getState().discoveredByCampaign.default).toEqual({ codes: ['a'], total: 1 })
  })

  it('returns null and changes nothing when no rule matches', () => {
    expect(useStore.getState().discoverCode('a', NO_MATCH)).toBeNull()
    expect(useStore.getState().discoveredByCampaign).toEqual({})
  })

  it('setTotalDiscovered keeps the default campaign codes', () => {
    useStore.getState().discoverCode('a', ONSITE)
    useStore.getState().setTotalDiscovered(9)
    expect(useStore.getState().discoveredByCampaign.default).toEqual({ codes: ['a'], total: 9 })
  })
})

describe('scanQueue persistence', () => {
  const entry = { id: 'q1', code: 'a', scanned_at: '2026-10-17T10:00:00.000Z', fields: {} }

  it('partialize includes discoveredByCampaign and scanQueue', () => {
    const byCampaign = { default: { codes: ['a'], total: 1 } }
    useStore.setState({ discoveredByCampaign: byCampaign, scanQueue: [entry] })
    const out = useStore.persist.getOptions().partialize!(useStore.getState()) as Record<
      string,
      unknown
    >
    expect(out.discoveredByCampaign).toEqual(byCampaign)
    expect(out.scanQueue).toEqual([entry])
  })

  it('old persisted state without the new fields hydrates with []', async () => {
    localStorage.setItem(
      'experium-store',
      JSON.stringify({ state: { language: 'hi', totalDiscovered: 4 }, version: 1 })
    )
    await useStore.persist.rehydrate()
    expect(useStore.getState().language).toBe('hi')
    expect(selectTotalDiscovered(useStore.getState())).toBe(4)
    expect(useStore.getState().discoveredByCampaign.default.codes).toEqual([])
    expect(useStore.getState().scanQueue).toEqual([])
  })

  it('migrates the pre-v9 discoveredCodes/totalDiscovered into the default campaign', async () => {
    localStorage.setItem(
      'experium-store',
      JSON.stringify({ state: { discoveredCodes: ['a', 'b'], totalDiscovered: 5 }, version: 8 })
    )
    await useStore.persist.rehydrate()
    expect(useStore.getState().discoveredByCampaign).toEqual({
      default: { codes: ['a', 'b'], total: 5 },
    })
  })

  it("a storage event + rehydrate picks up another tab's queue", async () => {
    localStorage.setItem(
      'experium-store',
      JSON.stringify({
        state: {
          discoveredByCampaign: { default: { codes: ['a'], total: 1 } },
          scanQueue: [entry],
        },
        version: 9,
      })
    )
    window.dispatchEvent(new StorageEvent('storage', { key: 'experium-store' }))
    // ScanQueueSync's storage handler is `rehydrate()`; the event itself carries no state
    await useStore.persist.rehydrate()
    expect(useStore.getState().scanQueue).toEqual([entry])
    expect(useStore.getState().discoveredByCampaign.default).toEqual({ codes: ['a'], total: 1 })
  })
})
