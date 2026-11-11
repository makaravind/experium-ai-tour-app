'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'

export default function InsightsKeyDialog() {
  const open = useStore((s) => s.insightsKeyDialogOpen)
  return open ? <KeyForm /> : null
}

function KeyForm() {
  const setDialogOpen = useStore((s) => s.setInsightsKeyDialogOpen)
  const setInsightsKey = useStore((s) => s.setInsightsKey)
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = key.trim()
    if (!trimmed || busy) return
    if (!navigator.onLine) {
      setError('Connect to the internet to unlock')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/insights?range=today', {
        headers: { 'x-insights-key': trimmed },
      })
      if (res.ok) {
        setInsightsKey(trimmed)
        setDialogOpen(false)
        return
      }
      setError(res.status === 401 ? 'Invalid key' : 'Something went wrong. Try again')
    } catch {
      setError("Couldn't reach the server. Try again")
    }
    setBusy(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <form
        role="alertdialog"
        aria-labelledby="insights-key-title"
        onSubmit={onUnlock}
        className="bg-ex-paper rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl"
        style={{ boxShadow: 'var(--ex-shadow-modal)' }}
      >
        <h2
          id="insights-key-title"
          className="text-lg font-bold text-ex-ink"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.3px' }}
        >
          Enter insights key
        </h2>
        <input
          type="password"
          autoFocus
          autoComplete="off"
          aria-label="Insights key"
          aria-invalid={error ? true : undefined}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="mt-3 w-full h-12 px-4 rounded-xl border border-ex-border bg-ex-bg text-[16px] text-ex-ink outline-none"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-ex-muted">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!key.trim() || busy}
          className="btn-3d-green w-full h-14 mt-5 rounded-2xl font-extrabold text-base flex items-center justify-center bg-ex-forest text-white disabled:opacity-60"
        >
          {busy ? 'Checking…' : 'Unlock'}
        </button>
        <button
          type="button"
          onClick={() => setDialogOpen(false)}
          className="mt-3 w-full text-sm font-semibold text-ex-muted bg-transparent border-none cursor-pointer"
        >
          Cancel
        </button>
      </form>
    </div>
  )
}
