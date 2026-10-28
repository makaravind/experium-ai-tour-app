import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/lib/store'

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
    totalDiscovered: 0,
    discoveredCodes: [],
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
    expect(useStore.getState().totalDiscovered).toBe(0)
  })

  it('updates', () => {
    useStore.getState().setTotalDiscovered(5)
    expect(useStore.getState().totalDiscovered).toBe(5)
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

  it('leaves v3 state untouched', () => {
    const fn = useStore.persist.getOptions().migrate!
    const out = fn(
      { cachedExhibits: [{ id: 'x' }], cachedAmenities: [{ id: 'a' }] },
      3
    ) as unknown as Record<string, unknown>
    expect(out.cachedExhibits).toEqual([{ id: 'x' }])
    expect(out.cachedAmenities).toEqual([{ id: 'a' }])
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

describe('discoverCode', () => {
  it('defaults discoveredCodes and scanQueue to []', () => {
    expect(useStore.getState().discoveredCodes).toEqual([])
    expect(useStore.getState().scanQueue).toEqual([])
  })

  it('increments once per code and returns prev/new totals', () => {
    useStore.setState({ totalDiscovered: 2 })
    expect(useStore.getState().discoverCode('a')).toEqual({ prevTotal: 2, newTotal: 3 })
    expect(useStore.getState().totalDiscovered).toBe(3)
    expect(useStore.getState().discoveredCodes).toEqual(['a'])
  })

  it('returns null and changes nothing on rescan', () => {
    useStore.getState().discoverCode('a')
    expect(useStore.getState().discoverCode('a')).toBeNull()
    expect(useStore.getState().totalDiscovered).toBe(1)
    expect(useStore.getState().discoveredCodes).toEqual(['a'])
  })
})

describe('scanQueue persistence', () => {
  const entry = { id: 'q1', code: 'a', scanned_at: '2026-10-17T10:00:00.000Z', fields: {} }

  it('partialize includes discoveredCodes and scanQueue', () => {
    useStore.setState({ discoveredCodes: ['a'], scanQueue: [entry] })
    const out = useStore.persist.getOptions().partialize!(useStore.getState()) as Record<
      string,
      unknown
    >
    expect(out.discoveredCodes).toEqual(['a'])
    expect(out.scanQueue).toEqual([entry])
  })

  it('old persisted state without the new fields hydrates with []', async () => {
    localStorage.setItem(
      'experium-store',
      JSON.stringify({ state: { language: 'hi', totalDiscovered: 4 }, version: 1 })
    )
    await useStore.persist.rehydrate()
    expect(useStore.getState().language).toBe('hi')
    expect(useStore.getState().totalDiscovered).toBe(4)
    expect(useStore.getState().discoveredCodes).toEqual([])
    expect(useStore.getState().scanQueue).toEqual([])
  })

  it("a storage event + rehydrate picks up another tab's queue", async () => {
    localStorage.setItem(
      'experium-store',
      JSON.stringify({
        state: { discoveredCodes: ['a'], scanQueue: [entry], totalDiscovered: 1 },
        version: 1,
      })
    )
    window.dispatchEvent(new StorageEvent('storage', { key: 'experium-store' }))
    // ScanQueueSync's storage handler is `rehydrate()`; the event itself carries no state
    await useStore.persist.rehydrate()
    expect(useStore.getState().scanQueue).toEqual([entry])
    expect(useStore.getState().discoveredCodes).toEqual(['a'])
    expect(useStore.getState().totalDiscovered).toBe(1)
  })
})
