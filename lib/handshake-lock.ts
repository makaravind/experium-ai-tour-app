const ID_KEY = 'experium_visitor_id'
const LOCK_KEY = 'experium_handshake_lock'
const LOCK_STALE_MS = 10_000
const POLL_MS = 250

function lockIsHeld(): boolean {
  try {
    const raw = localStorage.getItem(LOCK_KEY)
    if (!raw) return false
    const { ts } = JSON.parse(raw) as { ts: number }
    return Date.now() - ts < LOCK_STALE_MS
  } catch {
    return false // corrupt lock → treat as free
  }
}

async function handshake(): Promise<string> {
  const FingerprintJS = await import('@fingerprintjs/fingerprintjs')
  const fp = await FingerprintJS.load()
  const result = await fp.get()
  const res = await fetch('/api/user/handshake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fingerprintHint: result.visitorId }),
  })
  const { visitorId } = await res.json()
  if (!visitorId) throw new Error('handshake returned no visitorId')
  return visitorId
}

// Resolves when the id appears, or the lock is released/stale (id still null).
function waitForOtherTab(): Promise<string | null> {
  return new Promise((resolve) => {
    const finish = (id: string | null) => {
      window.removeEventListener('storage', check)
      clearInterval(timer)
      resolve(id)
    }
    const check = () => {
      const id = localStorage.getItem(ID_KEY)
      if (id) finish(id)
      else if (!lockIsHeld()) finish(null)
    }
    window.addEventListener('storage', check)
    const timer = setInterval(check, POLL_MS)
    check()
  })
}

export async function getOrCreateVisitorId(): Promise<string> {
  for (;;) {
    const cached = localStorage.getItem(ID_KEY)
    if (cached) return cached

    if (!lockIsHeld()) {
      localStorage.setItem(LOCK_KEY, JSON.stringify({ ts: Date.now() }))
      try {
        const id = await handshake()
        localStorage.setItem(ID_KEY, id)
        return id
      } finally {
        localStorage.removeItem(LOCK_KEY)
      }
    }

    const id = await waitForOtherTab()
    if (id) return id
    // lock released or went stale without an id → loop and take over
  }
}
