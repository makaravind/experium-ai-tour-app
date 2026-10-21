import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@fingerprintjs/fingerprintjs', () => ({
  load: async () => ({ get: async () => ({ visitorId: 'fp' }) }),
}))

import { getOrCreateVisitorId } from '@/lib/handshake-lock'
import { ConnectionTimeoutError, HANDSHAKE_TIMEOUT_MS } from '@/lib/timeouts'

const fetchMock = vi.fn()

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ json: async () => ({ visitorId: 'new-id' }) })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('getOrCreateVisitorId', () => {
  it('returns cached id without fetching', async () => {
    localStorage.setItem('experium_visitor_id', 'cached')
    expect(await getOrCreateVisitorId()).toBe('cached')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('handshakes, stores id, releases lock', async () => {
    expect(await getOrCreateVisitorId()).toBe('new-id')
    expect(localStorage.getItem('experium_visitor_id')).toBe('new-id')
    expect(localStorage.getItem('experium_handshake_lock')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('concurrent callers (held lock) share one handshake', async () => {
    const ids = await Promise.all([getOrCreateVisitorId(), getOrCreateVisitorId()])
    expect(ids).toEqual(['new-id', 'new-id'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('waits for another tab holding a fresh lock', async () => {
    localStorage.setItem('experium_handshake_lock', JSON.stringify({ ts: Date.now() }))
    const p = getOrCreateVisitorId()
    await Promise.resolve()
    localStorage.setItem('experium_visitor_id', 'other-tab-id')
    window.dispatchEvent(new StorageEvent('storage', { key: 'experium_visitor_id' }))
    expect(await p).toBe('other-tab-id')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('takes over a stale lock', async () => {
    localStorage.setItem('experium_handshake_lock', JSON.stringify({ ts: Date.now() - 11_000 }))
    expect(await getOrCreateVisitorId()).toBe('new-id')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('releases lock and rejects when handshake fails', async () => {
    fetchMock.mockRejectedValue(new Error('net'))
    await expect(getOrCreateVisitorId()).rejects.toThrow('net')
    expect(localStorage.getItem('experium_handshake_lock')).toBeNull()
  })

  it('rejects with ConnectionTimeoutError and releases the lock when fetch never resolves', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    })
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) =>
          init.signal!.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          )
        )
    )
    const p = expect(getOrCreateVisitorId()).rejects.toBeInstanceOf(ConnectionTimeoutError)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await vi.advanceTimersByTimeAsync(HANDSHAKE_TIMEOUT_MS)
    await p
    expect(localStorage.getItem('experium_handshake_lock')).toBeNull()
  })

  describe('slow handshake / lock ownership', () => {
    const LOCK = 'experium_handshake_lock'
    let resolveFetch: (v: unknown) => void
    const realSleep = (ms: number) => new Promise((r) => setTimeout(r, ms)) // setTimeout isn't faked
    const deferFetch = () => fetchMock.mockReturnValue(new Promise((r) => (resolveFetch = r)))

    it('refreshes the lock so a handshake past LOCK_STALE_MS never lets a 2nd tab in', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
      deferFetch()
      const a = getOrCreateVisitorId()
      await realSleep(50) // let A reach fetch
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(25_000) // well past 10s stale threshold
      const b = getOrCreateVisitorId() // "second tab"
      await vi.advanceTimersByTimeAsync(1_000)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      resolveFetch({ json: async () => ({ visitorId: 'slow-id' }) })
      await realSleep(20)
      await vi.advanceTimersByTimeAsync(500) // B's poll sees the id
      expect(await Promise.all([a, b])).toEqual(['slow-id', 'slow-id'])
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(localStorage.getItem(LOCK)).toBeNull()
    })

    it("cleanup never clears a lock it doesn't own", async () => {
      deferFetch()
      const a = getOrCreateVisitorId()
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
      // another tab took over (e.g. A was frozen past stale) and holds its own lock
      const foreign = JSON.stringify({ ts: Date.now(), owner: 'tab-b' })
      localStorage.setItem(LOCK, foreign)

      resolveFetch({ json: async () => ({ visitorId: 'a-id' }) })
      await a
      expect(localStorage.getItem(LOCK)).toBe(foreign)
    })

    it('does not refresh a lock it no longer owns', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
      deferFetch()
      const a = getOrCreateVisitorId()
      await realSleep(50)
      const foreign = JSON.stringify({ ts: Date.now(), owner: 'tab-b' })
      localStorage.setItem(LOCK, foreign)

      await vi.advanceTimersByTimeAsync(10_000)
      expect(localStorage.getItem(LOCK)).toBe(foreign)

      resolveFetch({ json: async () => ({ visitorId: 'a-id' }) })
      await a
    })
  })
})
