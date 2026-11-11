'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import type { InsightsRange } from '@/lib/insights'

interface Summary {
  scans: number
  visitors: number
  minutes: number
  listen_rate: number
  top_exhibits: { display_id: string; name: string; plays: number }[]
  languages: { en: number; hi: number; te: number }
}

const RANGES: { value: InsightsRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7d' },
  { value: 'all', label: 'All' },
]

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'te', label: 'Telugu' },
] as const

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}
const getOnline = () => navigator.onLine
const getServerOnline = () => true

const num = new Intl.NumberFormat('en-IN')

function Tile({
  label,
  value,
  note,
  loading,
}: {
  label: string
  value: string
  note?: string
  loading: boolean
}) {
  return (
    <div
      className="bg-ex-paper rounded-2xl p-4 border border-ex-border"
      style={{ boxShadow: 'var(--ex-shadow-soft)' }}
    >
      <div className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-ex-muted">
        {label}
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-16 rounded-lg bg-ex-border animate-pulse" />
      ) : (
        <div
          className="mt-1 text-[28px] font-extrabold text-ex-ink leading-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {value}
        </div>
      )}
      {note && <div className="text-[12px] text-ex-muted mt-0.5 leading-snug">{note}</div>}
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="px-1 pb-2 text-[11px] font-extrabold tracking-[0.08em] uppercase text-ex-muted">
      {children}
    </div>
  )
}

export default function InsightsPage() {
  const router = useRouter()
  const insightsKey = useStore((s) => s.insightsKey)
  const setInsightsKey = useStore((s) => s.setInsightsKey)
  const online = useSyncExternalStore(subscribeOnline, getOnline, getServerOnline)
  const [range, setRange] = useState<InsightsRange>('today')
  const [reloads, setReloads] = useState(0)
  // Tagged with the request it answers, so a stale or pending request reads as loading.
  const [result, setResult] = useState<{ req: string; data: Summary | null } | null>(null)
  const req = `${range}:${reloads}`

  // Wait for the persisted store to hydrate, else a saved key reads as null and bounces to /map.
  useEffect(() => {
    const check = () => {
      if (!useStore.getState().insightsKey) router.replace('/map')
    }
    if (useStore.persist.hasHydrated()) {
      check()
      return
    }
    return useStore.persist.onFinishHydration(check)
  }, [insightsKey, router])

  useEffect(() => {
    if (!insightsKey || !online) return
    const controller = new AbortController()
    fetch(`/api/insights?range=${range}`, {
      headers: { 'x-insights-key': insightsKey },
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 401) {
          // Rotated or wrong key: clearing it triggers the redirect effect above.
          setInsightsKey(null)
          return
        }
        if (!res.ok) throw new Error(`insights ${res.status}`)
        setResult({ req, data: (await res.json()) as Summary })
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error(err)
          setResult({ req, data: null })
        }
      })
    return () => controller.abort()
  }, [insightsKey, online, range, reloads, req, setInsightsKey])

  if (!insightsKey) return null

  const current = result?.req === req ? result : null
  const data = current?.data ?? null
  const failed = !!current && !current.data
  const loading = online && !current
  const empty = data && data.top_exhibits.length === 0

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ex-bg overflow-y-auto"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <div className="flex items-center gap-3 px-4 h-14 shrink-0">
        <button
          onClick={() => router.push('/map')}
          aria-label="Back to map"
          className="text-ex-ink text-2xl font-extrabold leading-none"
        >
          ‹
        </button>
        <h1
          className="flex-1 text-ex-ink font-extrabold text-[17px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Insights
        </h1>
        <button
          onClick={() => setReloads((n) => n + 1)}
          disabled={!online}
          aria-label="Refresh insights"
          className="text-ex-forest text-[14px] font-extrabold disabled:opacity-40"
        >
          Refresh
        </button>
      </div>

      <div className="flex-1 px-5 pt-2 pb-10 flex flex-col gap-5">
        <div
          role="tablist"
          aria-label="Time range"
          className="flex p-1 rounded-full bg-ex-paper border border-ex-border"
        >
          {RANGES.map((r) => (
            <button
              key={r.value}
              role="tab"
              aria-selected={range === r.value}
              onClick={() => setRange(r.value)}
              className={`flex-1 py-2 rounded-full text-[14px] font-extrabold ${
                range === r.value ? 'bg-ex-forest text-white' : 'text-ex-muted'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {!online ? (
          <p className="text-[14px] text-ex-muted text-center py-10">
            Connect to the internet to view insights
          </p>
        ) : failed ? (
          <p className="text-[14px] text-ex-muted text-center py-10">
            Couldn&apos;t load insights. Tap Refresh to retry.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Scans" value={num.format(data?.scans ?? 0)} loading={loading} />
              <Tile label="Visitors" value={num.format(data?.visitors ?? 0)} loading={loading} />
              <Tile
                label="Minutes"
                value={num.format(Math.round(data?.minutes ?? 0))}
                note="at least"
                loading={loading}
              />
              <Tile
                label="Listen rate"
                value={`${Math.round((data?.listen_rate ?? 0) * 100)}%`}
                loading={loading}
              />
            </div>

            <section>
              <SectionTitle>Top exhibits</SectionTitle>
              <ul className="bg-ex-paper rounded-2xl border border-ex-border py-1">
                {loading ? (
                  [0, 1, 2].map((i) => (
                    <li key={i} className="px-4 py-3">
                      <div className="h-5 rounded-lg bg-ex-border animate-pulse" />
                    </li>
                  ))
                ) : empty ? (
                  <li className="px-4 py-3 text-[14px] text-ex-muted">No plays yet</li>
                ) : (
                  data?.top_exhibits.map((e) => (
                    <li key={e.display_id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="shrink-0 min-w-[36px] text-[13px] font-extrabold text-ex-forest">
                        {e.display_id}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-[15px] font-extrabold text-ex-ink">
                        {e.name}
                      </span>
                      <span className="shrink-0 text-[14px] text-ex-muted">
                        {num.format(e.plays)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section>
              <SectionTitle>Plays by language</SectionTitle>
              <ul className="bg-ex-paper rounded-2xl border border-ex-border py-1">
                {LANGUAGES.map((l) => (
                  <li key={l.code} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 text-[15px] font-extrabold text-ex-ink">{l.label}</span>
                    {loading ? (
                      <span className="h-5 w-10 rounded-lg bg-ex-border animate-pulse" />
                    ) : (
                      <span className="text-[14px] text-ex-muted">
                        {num.format(data?.languages[l.code] ?? 0)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
