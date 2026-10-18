import { useStore, type QueuedScan } from '@/lib/store'
import { useDebugStore } from '@/lib/debug-store'

const FLUSH_TIMEOUT_MS = 10_000

let flushing = false

function report(lastResult: string) {
  useDebugStore.getState().setScanQueueDebug({ lastResult, at: Date.now() })
}

export function enqueueScan(code: string, fields: Record<string, unknown>): void {
  const entry: QueuedScan = {
    id: crypto.randomUUID(),
    code,
    scanned_at: new Date().toISOString(),
    fields,
  }
  useStore.getState().pushScan(entry)
  void flushScanQueue()
}

export async function flushScanQueue(): Promise<void> {
  if (flushing) return
  if (!useStore.getState().visitorId) return
  if (document.visibilityState !== 'visible') return
  if (navigator.onLine === false) return

  flushing = true
  let stoppedOnError = false
  try {
    for (;;) {
      const { scanQueue, visitorId, removeScan, setTotalDiscovered } = useStore.getState()
      const entry = scanQueue[0]
      if (!entry || !visitorId) return

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), FLUSH_TIMEOUT_MS)
      let res: Response
      try {
        res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...entry.fields,
            code: entry.code,
            visitorId,
            scanned_at: entry.scanned_at,
          }),
          signal: controller.signal,
        })
      } catch (err) {
        report(controller.signal.aborted ? 'timeout' : `network error: ${String(err)}`)
        stoppedOnError = true
        return
      } finally {
        clearTimeout(timer)
      }

      if (res.ok) {
        removeScan(entry.id)
        report(`ok ${res.status}`)
        if (useStore.getState().scanQueue.length === 0) {
          const data = await res.json().catch(() => null)
          if (typeof data?.total_discovered === 'number') {
            setTotalDiscovered(data.total_discovered)
          }
          return
        }
        continue
      }

      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        removeScan(entry.id)
        report(`dropped ${res.status}`)
        continue
      }

      report(`kept ${res.status}`)
      stoppedOnError = true
      return
    }
  } finally {
    flushing = false
    // Re-trigger only for entries that arrived while this flush was in flight,
    // not for the same stuck entry that caused a keep+stop.
    if (!stoppedOnError && useStore.getState().scanQueue.length > 0) void flushScanQueue()
  }
}
