import { describe, it, expect, vi } from 'vitest'
import { getAssetGroups, precacheGroups, findMissing } from '@/lib/precache'
import type { CachedExhibit } from '@/lib/types'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

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
  it('returns one audio group, deduped, skipping null urls', () => {
    const ex = [
      { audioUrl: u(1) },
      { audioUrl: null },
      { audioUrl: u(1) },
      { audioUrl: u(2) },
    ] as CachedExhibit[]
    expect(getAssetGroups(ex)).toEqual([{ cacheName: 'audio-cache', urls: [u(1), u(2)] }])
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

describe('findMissing', () => {
  it('compares normalized urls', async () => {
    const m = await findMissing([{ cacheName: 'c', urls: ['https://x.test/a.mp3', 'https://x.test/b.mp3'] }], {
      listCached: async () => ['https://x.test/a.mp3'],
    })
    expect(m).toEqual({ c: ['https://x.test/b.mp3'] })
  })
})
