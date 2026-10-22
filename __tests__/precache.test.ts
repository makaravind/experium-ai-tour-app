import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, waitFor } from '@testing-library/react'
import AppGate from '@/components/onboarding/AppGate'
import { useDebugStore } from '@/lib/debug-store'
import {
  AssetFetchError,
  CONCURRENCY,
  getAssetGroups,
  precacheGroups,
  findMissing,
  fetchAssetWithIdleTimeout,
  checkFresh,
  runPrecache,
} from '@/lib/precache'
import { useStore } from '@/lib/store'
import { AUDIO_IDLE_TIMEOUT_MS, ConnectionTimeoutError } from '@/lib/timeouts'
import type { CachedExhibit } from '@/lib/types'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/handshake-lock', () => ({ getOrCreateVisitorId: async () => 'visitor-1' }))
vi.mock('@/lib/precache', async (orig) => ({
  ...(await orig<typeof import('@/lib/precache')>()),
  checkFresh: vi.fn(),
  runPrecache: vi.fn(),
}))

const u = (n: number) => `https://cdn.test/a${n}.mp3`

function harness(urls: string[], preCached: string[] = [], bad: string[] = []) {
  const cached = new Set(preCached)
  const attempts: Record<string, number> = {}
  const deps = {
    listCached: async () => cached,
    fetchAsset: async (url: string) => {
      attempts[url] = (attempts[url] ?? 0) + 1
      if (bad.includes(url)) throw new AssetFetchError(404, url)
      cached.add(url)
    },
    isCached: async () => true,
    isOnline: () => true,
  }
  return { groups: [{ cacheName: 'audio-cache', urls }], deps, attempts }
}

describe('getAssetGroups', () => {
  const ex = [
    { audio: { en: u(1), hi: u(10) } },
    { audio: { hi: u(11) } },
    { audio: { en: u(1) } },
    { audio: { en: u(2), hi: u(12) } },
    { audio: {} },
  ] as CachedExhibit[]

  it('picks one language, deduped, skipping exhibits with no audio in it', () => {
    expect(getAssetGroups(ex, 'en')).toEqual([{ cacheName: 'audio-cache', urls: [u(1), u(2)] }])
    expect(getAssetGroups(ex, 'hi')).toEqual([
      { cacheName: 'audio-cache', urls: [u(10), u(11), u(12)] },
    ])
  })

  it('returns an empty audio group when no exhibit has the language', () => {
    expect(getAssetGroups(ex, 'te')).toEqual([{ cacheName: 'audio-cache', urls: [] }])
  })
})

describe('precacheGroups', () => {
  it('completes when every asset succeeds and reports count progress', async () => {
    const h = harness([u(1), u(2), u(3)])
    const onProgress = vi.fn()
    const r = await precacheGroups(h.groups, { ...h.deps, failures: {}, onProgress })
    expect(r.groups[0]).toMatchObject({ complete: true, failed: [], capped: [] })
    expect(onProgress).toHaveBeenLastCalledWith(3, 3)
    expect(onProgress).toHaveBeenCalledWith(0, 3)
  })

  it('only fetches missing assets (gap-fill)', async () => {
    const h = harness([u(1), u(2), u(3)], [u(1), u(2)])
    const r = await precacheGroups(h.groups, { ...h.deps, failures: {} })
    expect(h.attempts).toEqual({ [u(3)]: 1 })
    expect(r.groups[0].complete).toBe(true)
  })

  it('caps a permanently bad asset at 3 attempts, leaves flag incomplete, lists it', async () => {
    const h = harness([u(1), u(2)], [], [u(2)])
    const r = await precacheGroups(h.groups, { ...h.deps, failures: {} })
    expect(h.attempts[u(2)]).toBe(3)
    expect(h.attempts[u(1)]).toBe(1)
    expect(r.groups[0]).toMatchObject({ complete: false, failed: [u(2)], capped: [u(2)] })
    expect(r.failures[u(2)]).toEqual({ count: 3 })
  })

  it('persisted counts carry across runs; capped assets are not retried', async () => {
    const h = harness([u(1)], [], [u(1)])
    const r = await precacheGroups(h.groups, { ...h.deps, failures: { [u(1)]: { count: 2 } } })
    expect(h.attempts[u(1)]).toBe(1)
    expect(r.groups[0].capped).toEqual([u(1)])

    const h2 = harness([u(1)], [], [u(1)])
    const r2 = await precacheGroups(h2.groups, { ...h2.deps, failures: r.failures })
    expect(h2.attempts[u(1)]).toBeUndefined()
    expect(r2.groups[0].capped).toEqual([u(1)])
  })

  it('clears failure count after eventual success', async () => {
    const h = harness([u(1)])
    const r = await precacheGroups(h.groups, { ...h.deps, failures: { [u(1)]: { count: 1 } } })
    expect(r.failures).toEqual({})
    expect(r.groups[0].complete).toBe(true)
  })

  it('does not count attempts when the network is down', async () => {
    const h = harness([u(1), u(2)], [], [u(1), u(2)])
    const r = await precacheGroups(h.groups, { ...h.deps, isOnline: () => false, failures: {} })
    expect(r.offline).toBe(true)
    expect(r.failures).toEqual({})
    expect(r.groups[0]).toMatchObject({ complete: false, capped: [] })
  })

  // 404 capping is covered by 'caps a permanently bad asset' above (harness throws AssetFetchError(404))
  it.each([
    ['5xx', (url: string) => new AssetFetchError(500, url)],
    ['a network error', () => new Error('network')],
  ])('does not count %s; stops the run as offline', async (_name, makeErr) => {
    const h = harness([u(1), u(2)])
    const r = await precacheGroups(h.groups, {
      ...h.deps,
      failures: {},
      concurrency: 1,
      fetchAsset: async (url) => {
        h.attempts[url] = (h.attempts[url] ?? 0) + 1
        throw makeErr(url)
      },
    })
    expect(r.offline).toBe(true)
    expect(r.failures).toEqual({})
    expect(h.attempts[u(1)]).toBe(1)
    expect(h.attempts[u(2)]).toBeUndefined()
    expect(r.groups[0]).toMatchObject({ complete: false, capped: [] })
  })

  it('counts 410 and caps it after 3 attempts', async () => {
    const h = harness([u(1)])
    let calls = 0
    const r = await precacheGroups(h.groups, {
      ...h.deps,
      failures: {},
      fetchAsset: async (url) => {
        calls++
        throw new AssetFetchError(410, url)
      },
    })
    expect(calls).toBe(3)
    expect(r.offline).toBeFalsy()
    expect(r.failures[u(1)]).toEqual({ count: 3 })
    expect(r.groups[0]).toMatchObject({ complete: false, capped: [u(1)] })
  })

  it('respects concurrency limit', async () => {
    const urls = Array.from({ length: 20 }, (_, i) => u(i))
    const cached = new Set<string>()
    let inFlight = 0
    let peak = 0
    await precacheGroups([{ cacheName: 'audio-cache', urls }], {
      failures: {},
      listCached: async () => cached,
      isCached: async () => true,
      isOnline: () => true,
      fetchAsset: async (url) => {
        peak = Math.max(peak, ++inFlight)
        await new Promise((r) => setTimeout(r, 1))
        inFlight--
        cached.add(url)
      },
    })
    expect(peak).toBe(6)
  })
})

describe('precacheGroups timeout', () => {
  it('stops on ConnectionTimeoutError: timedOut, failures unchanged, no further urls fetched', async () => {
    const urls = [u(1), u(2), u(3)]
    const h = harness(urls)
    const attempted: string[] = []
    const failures = { [u(9)]: { count: 1 } }
    const r = await precacheGroups(h.groups, {
      ...h.deps,
      failures,
      concurrency: 1,
      fetchAsset: async (url) => {
        attempted.push(url)
        throw new ConnectionTimeoutError()
      },
    })
    expect(r.timedOut).toBe(true)
    expect(r.failures).toEqual(failures)
    expect(attempted).toEqual([u(1)])
    expect(r.groups[0].complete).toBe(false)
  })
})

describe('fetchAssetWithIdleTimeout', () => {
  const abortError = (s: AbortSignal) => s.reason ?? new DOMException('aborted', 'AbortError')
  // a promise that never settles on its own but rejects when the signal aborts, like real fetch/reader
  const hangUntilAbort = <T>(signal: AbortSignal) =>
    new Promise<T>((_, reject) =>
      signal.addEventListener('abort', () => reject(abortError(signal)))
    )
  const chunk = new Uint8Array([1, 2, 3])

  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('rejects with ConnectionTimeoutError when fetch never resolves', async () => {
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => hangUntilAbort(init.signal!))
    const p = expect(fetchAssetWithIdleTimeout(u(1))).rejects.toBeInstanceOf(ConnectionTimeoutError)
    await vi.advanceTimersByTimeAsync(AUDIO_IDLE_TIMEOUT_MS)
    await p
  })

  it('resolves when chunks keep arriving, even past the idle window in total', async () => {
    vi.stubGlobal('fetch', async () => {
      let n = 0
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              new Promise((resolve) =>
                setTimeout(
                  () => resolve(++n <= 6 ? { done: false, value: chunk } : { done: true }),
                  10_000
                )
              ),
          }),
        },
      }
    })
    const p = fetchAssetWithIdleTimeout(u(1))
    await vi.advanceTimersByTimeAsync(70_000)
    expect((await p).byteLength).toBe(chunk.length * 6)
  })

  it('rejects with ConnectionTimeoutError when the body stalls after a chunk', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      let n = 0
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              ++n === 1
                ? Promise.resolve({ done: false, value: chunk })
                : hangUntilAbort(init.signal!),
          }),
        },
      }
    })
    const p = expect(fetchAssetWithIdleTimeout(u(1))).rejects.toBeInstanceOf(ConnectionTimeoutError)
    await vi.advanceTimersByTimeAsync(AUDIO_IDLE_TIMEOUT_MS)
    await p
  })

  it('rejects with AbortError, not a timeout, on outer abort', async () => {
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => hangUntilAbort(init.signal!))
    const outer = new AbortController()
    const p = fetchAssetWithIdleTimeout(u(1), outer.signal)
    const assertion = expect(p).rejects.toMatchObject({ name: 'AbortError' })
    outer.abort('language-switch')
    await assertion
    await expect(p).rejects.not.toBeInstanceOf(ConnectionTimeoutError)
  })
})

describe('precacheGroups isCached verification', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('stops with saveFailed when isCached always returns false', async () => {
    const h = harness(Array.from({ length: 20 }, (_, i) => u(i)))
    const fetchAsset = vi.fn().mockResolvedValue(undefined)
    const p = precacheGroups(h.groups, {
      ...h.deps,
      failures: {},
      listCached: async () => [],
      isCached: async () => false,
      fetchAsset,
    })
    await vi.runAllTimersAsync()
    const r = await p
    expect(r.saveFailed).toBe(true)
    // workers already past the fetch finish their poll before the stop flag is seen
    expect(fetchAsset.mock.calls.length).toBeLessThanOrEqual(3 + CONCURRENCY - 1)
    expect(r.failures).toEqual({})
    expect(r.offline).toBe(false)
  })

  it('resets the consecutive counter after a verified save', async () => {
    const h = harness([u(1), u(2), u(3), u(4), u(5)])
    const saved = new Set([u(3)])
    const onProgress = vi.fn()
    const p = precacheGroups(h.groups, {
      ...h.deps,
      failures: {},
      onProgress,
      concurrency: 1,
      listCached: async () => [],
      isCached: async (_cache, url) => saved.has(url),
    })
    await vi.runAllTimersAsync()
    const r = await p
    // not-saved x2, saved, not-saved x2: never 3 in a row
    expect(r.saveFailed).toBe(false)
    expect(onProgress).toHaveBeenLastCalledWith(1, 5)
    expect(h.attempts).toEqual({ [u(1)]: 1, [u(2)]: 1, [u(3)]: 1, [u(4)]: 1, [u(5)]: 1 })
  })

  it('counts asset as saved when isCached returns true on the 3rd poll', async () => {
    let polls = 0
    const isCached = vi.fn(async () => ++polls >= 3)
    const onProgress = vi.fn()
    const p = precacheGroups([{ cacheName: 'audio-cache', urls: [u(1)] }], {
      failures: {},
      onProgress,
      listCached: async () => [],
      isOnline: () => true,
      fetchAsset: vi.fn().mockResolvedValue(undefined),
      isCached,
    })
    await vi.advanceTimersByTimeAsync(600)
    const r = await p
    expect(r.saveFailed).toBe(false)
    expect(onProgress).toHaveBeenLastCalledWith(1, 1)
    expect(isCached).toHaveBeenCalledTimes(3)
  })

  it('verifies each url against its own cache', async () => {
    const isCached = vi.fn(async () => true)
    await precacheGroups(
      [
        { cacheName: 'audio-cache', urls: ['a.mp3'] },
        { cacheName: 'map-tiles-cache', urls: ['map.pmtiles'] },
      ],
      {
        failures: {},
        listCached: async () => [],
        isOnline: () => true,
        fetchAsset: vi.fn().mockResolvedValue(undefined),
        isCached,
      }
    )
    expect(isCached).toHaveBeenCalledWith('audio-cache', 'a.mp3')
    expect(isCached).toHaveBeenCalledWith('map-tiles-cache', 'map.pmtiles')
    expect(isCached).not.toHaveBeenCalledWith('audio-cache', 'map.pmtiles')
    expect(isCached).not.toHaveBeenCalledWith('map-tiles-cache', 'a.mp3')
  })
})

describe('precacheGroups cancellation', () => {
  it('stops scheduling new fetches once isCancelled flips', async () => {
    const urls = Array.from({ length: 10 }, (_, i) => u(i))
    const h = harness(urls)
    let cancelled = false
    const r = await precacheGroups(h.groups, {
      ...h.deps,
      failures: {},
      concurrency: 1,
      isCancelled: () => cancelled,
      fetchAsset: async (url) => {
        await h.deps.fetchAsset(url)
        if (url === u(2)) cancelled = true
      },
    })
    expect(Object.keys(h.attempts)).toEqual([u(0), u(1), u(2)])
    expect(r.groups[0].complete).toBe(false)
  })

  it('fetches nothing when already cancelled', async () => {
    const h = harness([u(1), u(2)])
    await precacheGroups(h.groups, { ...h.deps, failures: {}, isCancelled: () => true })
    expect(h.attempts).toEqual({})
  })
})

describe('findMissing', () => {
  it('compares normalized urls', async () => {
    const m = await findMissing(
      [{ cacheName: 'c', urls: ['https://x.test/a.mp3', 'https://x.test/b.mp3'] }],
      {
        listCached: async () => ['https://x.test/a.mp3'],
      }
    )
    expect(m).toEqual({ c: ['https://x.test/b.mp3'] })
  })
})

describe('AppGate offline with gaps', () => {
  const gaps = { 'audio-cache': [u(1)] }
  const gate = () => createElement(AppGate, null, 'app')

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useDebugStore.setState({ cacheDebug: null })
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })
  })

  it('lets a visitor with a dataset through to onboarding (nextAfterClear), not blocked-offline', async () => {
    vi.mocked(checkFresh).mockResolvedValue({ hasDataset: true, missing: gaps })
    const { container } = render(gate())
    await waitFor(() => expect(useDebugStore.getState().cacheDebug).toBe('info'))
    expect(container).not.toHaveTextContent('Connect to the internet')
  })

  it('lets an onboarded visitor with a dataset straight into the app', async () => {
    localStorage.setItem('experium_onboarded', '1')
    vi.mocked(checkFresh).mockResolvedValue({ hasDataset: true, missing: gaps })
    const { container } = render(gate())
    await waitFor(() => expect(useDebugStore.getState().cacheDebug).toBe('clear'))
    expect(container).toHaveTextContent('app')
  })

  it('still blocks a visitor with no dataset', async () => {
    vi.mocked(checkFresh).mockResolvedValue({ hasDataset: false, missing: gaps })
    const { findByText } = render(gate())
    await findByText('Connect to the internet')
    expect(useDebugStore.getState().cacheDebug).toBe('blocked-offline')
  })
})

describe('AppGate Refresh content', () => {
  it('clears cachedExhibits and cachedAmenities, then re-runs the precache', async () => {
    localStorage.clear()
    localStorage.setItem('experium_onboarded', '1')
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
    vi.mocked(checkFresh)
      .mockResolvedValueOnce({ hasDataset: true, missing: {} })
      .mockResolvedValue({ hasDataset: false, missing: {} })
    vi.mocked(runPrecache).mockResolvedValue({
      groups: [],
      failures: {},
      fetched: 0,
      total: 0,
      offline: false,
      timedOut: false,
      saveFailed: false,
    })
    useStore.setState({
      cachedExhibits: [{ id: 'e1', audio: {} } as CachedExhibit],
      cachedAmenities: [{ id: 'a1' } as never],
    })
    render(createElement(AppGate, null, 'app'))
    await waitFor(() => expect(useDebugStore.getState().cacheDebug).toBe('clear'))

    useStore.getState().setRefreshRequested(true)
    await waitFor(() => expect(runPrecache).toHaveBeenCalled())
    expect(useStore.getState().cachedExhibits).toEqual([])
    expect(useStore.getState().cachedAmenities).toEqual([])
  })
})
