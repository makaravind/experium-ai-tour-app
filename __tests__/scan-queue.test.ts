import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useStore, type QueuedScan } from '@/lib/store'
import { enqueueScan, flushScanQueue } from '@/lib/scan-queue'

const fetchMock = vi.fn()

const entry = (id: string, code = 'baobab'): QueuedScan => ({
  id,
  code,
  scanned_at: `2026-10-17T10:00:0${id}.000Z`,
  fields: { listened: false },
})

const respond = (status: number, body: unknown = { total_discovered: 7 }) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response

const queueIds = () => useStore.getState().scanQueue.map((e) => e.id)
const sentBodies = () => fetchMock.mock.calls.map((c) => JSON.parse(c[1].body))

const setVisibility = (v: DocumentVisibilityState) =>
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v })
const setOnline = (v: boolean) =>
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => v })

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(respond(200))
  vi.stubGlobal('fetch', fetchMock)
  setVisibility('visible')
  setOnline(true)
  useStore.setState({
    visitorId: 'v-1',
    totalDiscovered: 0,
    discoveredCodes: [],
    scanQueue: [entry('1'), entry('2'), entry('3')],
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('flushScanQueue — response classes', () => {
  it('2xx removes the entry and continues with the next', async () => {
    await flushScanQueue()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(queueIds()).toEqual([])
  })

  it.each([400, 401, 404, 422])('%i drops the entry and continues', async (status) => {
    fetchMock.mockResolvedValueOnce(respond(status))
    await flushScanQueue()
    expect(queueIds()).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it.each([408, 429, 500, 503])('%i keeps the entry and stops the flush', async (status) => {
    fetchMock.mockResolvedValueOnce(respond(status))
    await flushScanQueue()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(queueIds()).toEqual(['1', '2', '3'])
  })

  it('stops after a failure mid-queue; earlier 2xx stay removed', async () => {
    fetchMock.mockResolvedValueOnce(respond(200)).mockResolvedValueOnce(respond(500))
    await flushScanQueue()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(queueIds()).toEqual(['2', '3'])
  })

  it('network error keeps the entry and stops', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await flushScanQueue()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(queueIds()).toEqual(['1', '2', '3'])
  })

  it('10s timeout aborts the request, keeps the entry and stops', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal!.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          )
        })
    )
    const p = flushScanQueue()
    await vi.advanceTimersByTimeAsync(9_999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(queueIds()).toEqual(['1', '2', '3'])
    await vi.advanceTimersByTimeAsync(1)
    await p
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(queueIds()).toEqual(['1', '2', '3'])
  })

  it('a later flush after a failure resumes from the kept entry', async () => {
    fetchMock.mockResolvedValueOnce(respond(500))
    await flushScanQueue()
    fetchMock.mockClear()
    await flushScanQueue()
    expect(sentBodies().map((b) => b.scanned_at)).toEqual([
      '2026-10-17T10:00:01.000Z',
      '2026-10-17T10:00:02.000Z',
      '2026-10-17T10:00:03.000Z',
    ])
    expect(queueIds()).toEqual([])
  })
})

describe('flushScanQueue — request shape and order', () => {
  it('sends oldest first, one at a time', async () => {
    let inFlight = 0
    let maxInFlight = 0
    fetchMock.mockImplementation(async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await Promise.resolve()
      inFlight--
      return respond(200)
    })
    await flushScanQueue()
    expect(sentBodies().map((b) => b.scanned_at)).toEqual([
      '2026-10-17T10:00:01.000Z',
      '2026-10-17T10:00:02.000Z',
      '2026-10-17T10:00:03.000Z',
    ])
    expect(maxInFlight).toBe(1)
  })

  it('body carries visitorId, code, scanned_at and the entry fields', async () => {
    useStore.setState({
      scanQueue: [{ ...entry('1', 'lotus-pond'), fields: { listened: true, scan_src: 'onsite' } }],
    })
    await flushScanQueue()
    expect(fetchMock).toHaveBeenCalledWith('/api/scan', expect.objectContaining({ method: 'POST' }))
    expect(sentBodies()[0]).toEqual({
      listened: true,
      scan_src: 'onsite',
      code: 'lotus-pond',
      visitorId: 'v-1',
      scanned_at: '2026-10-17T10:00:01.000Z',
    })
  })
})

describe('flushScanQueue — no-op guards', () => {
  it('does nothing without a visitorId', async () => {
    useStore.setState({ visitorId: null })
    await flushScanQueue()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(queueIds()).toEqual(['1', '2', '3'])
  })

  it('does nothing while the tab is hidden', async () => {
    setVisibility('hidden')
    await flushScanQueue()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(queueIds()).toEqual(['1', '2', '3'])
  })

  it('does nothing while offline', async () => {
    setOnline(false)
    await flushScanQueue()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(queueIds()).toEqual(['1', '2', '3'])
  })

  it('a second flush while one is in flight is a no-op', async () => {
    useStore.setState({ scanQueue: [entry('1')] })
    let resolveFetch!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolveFetch = r)))
    const first = flushScanQueue()
    await flushScanQueue()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolveFetch(respond(200))
    await first
    expect(queueIds()).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('flushScanQueue — totalDiscovered correction', () => {
  it('is set from the server once the queue is empty after a 2xx', async () => {
    useStore.setState({ scanQueue: [entry('1')], totalDiscovered: 3 })
    fetchMock.mockResolvedValueOnce(respond(200, { total_discovered: 5 }))
    await flushScanQueue()
    expect(useStore.getState().totalDiscovered).toBe(5)
  })

  it('is left alone while entries remain, applied only by the last response', async () => {
    useStore.setState({ totalDiscovered: 3 })
    const seenAtSend: number[] = []
    let n = 0
    fetchMock.mockImplementation(async () => {
      seenAtSend.push(useStore.getState().totalDiscovered)
      return respond(200, { total_discovered: 10 + n++ })
    })
    await flushScanQueue()
    expect(seenAtSend).toEqual([3, 3, 3])
    expect(useStore.getState().totalDiscovered).toBe(12)
  })

  it('is not corrected when the flush stops with entries remaining', async () => {
    useStore.setState({ totalDiscovered: 3 })
    fetchMock
      .mockResolvedValueOnce(respond(200, { total_discovered: 10 }))
      .mockResolvedValueOnce(respond(500))
    await flushScanQueue()
    expect(queueIds()).toEqual(['2', '3'])
    expect(useStore.getState().totalDiscovered).toBe(3)
  })

  it('is not corrected after a dropped 4xx', async () => {
    useStore.setState({ scanQueue: [entry('1')], totalDiscovered: 3 })
    fetchMock.mockResolvedValueOnce(respond(400, { total_discovered: 99 }))
    await flushScanQueue()
    expect(useStore.getState().totalDiscovered).toBe(3)
  })
})

describe('enqueueScan', () => {
  it('persists an entry with id and ISO scanned_at, then flushes it', async () => {
    useStore.setState({ scanQueue: [] })
    fetchMock.mockResolvedValueOnce(respond(500)) // keep it queued so we can inspect it
    enqueueScan('lotus-pond', { listened: false })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [queued] = useStore.getState().scanQueue
    expect(queued.code).toBe('lotus-pond')
    expect(queued.fields).toEqual({ listened: false })
    expect(queued.id).toBeTruthy()
    expect(new Date(queued.scanned_at).toISOString()).toBe(queued.scanned_at)
    expect(sentBodies()[0].scanned_at).toBe(queued.scanned_at)
  })

  it('stays queued, with no request, when offline', () => {
    useStore.setState({ scanQueue: [] })
    setOnline(false)
    enqueueScan('lotus-pond', {})
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useStore.getState().scanQueue).toHaveLength(1)
  })
})
