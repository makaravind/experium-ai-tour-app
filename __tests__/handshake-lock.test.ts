import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@fingerprintjs/fingerprintjs', () => ({
  load: async () => ({ get: async () => ({ visitorId: 'fp' }) }),
}))

import { getOrCreateVisitorId } from '@/lib/handshake-lock'

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
})
