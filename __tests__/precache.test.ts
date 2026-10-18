import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { render, waitFor } from '@testing-library/react'
import AppGate from '@/components/onboarding/AppGate'
import { useDebugStore } from '@/lib/debug-store'
import {
  getAssetGroups,
  precacheGroups,
  findMissing,
  checkFresh,
  runPrecache,
} from '@/lib/precache'
import { useStore } from '@/lib/store'
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
      if (bad.includes(url)) throw new Error('404')
      cached.add(url)
    },
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

  it('respects concurrency limit', async () => {
    const urls = Array.from({ length: 20 }, (_, i) => u(i))
    const cached = new Set<string>()
    let inFlight = 0
    let peak = 0
    await precacheGroups([{ cacheName: 'audio-cache', urls }], {
      failures: {},
      listCached: async () => cached,
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
