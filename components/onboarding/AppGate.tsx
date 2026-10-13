'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import InfoModal from '@/components/onboarding/InfoModal'
import LoadingScreen from '@/components/onboarding/LoadingScreen'
import { getOrCreateVisitorId } from '@/lib/handshake-lock'
import { useDebugStore, type GatePhase } from '@/lib/debug-store'
import {
  checkFresh,
  logContinueAnyway,
  MAX_ATTEMPTS,
  onForeground,
  runPrecache,
  type PrecacheResult,
} from '@/lib/precache'
import { useStore } from '@/lib/store'
import type { Language } from '@/lib/types'

const ONBOARDED_KEY = 'experium_onboarded'
const SW_WAIT_MS = 4000

// Fetches issued before the SW controls the page bypass its CacheFirst rules and never get cached.
async function waitForServiceWorker() {
  if (process.env.NODE_ENV === 'development' || !('serviceWorker' in navigator)) return
  const sw = navigator.serviceWorker
  const controlling = sw.ready.then(() => {
    if (sw.controller) return
    return new Promise<void>((resolve) =>
      sw.addEventListener('controllerchange', () => resolve(), { once: true })
    )
  })
  // don't strand the visitor if the SW never takes control (unsupported, blocked)
  await Promise.race([controlling, new Promise((r) => setTimeout(r, SW_WAIT_MS))])
}

// Cached dataset was built for a different language than the one now selected.
const languageIsStale = () => {
  const { completionByGroup, language } = useStore.getState()
  return Object.values(completionByGroup).some((c) => c.language && c.language !== language)
}

const nextAfterClear = (): GatePhase => (localStorage.getItem(ONBOARDED_KEY) ? 'clear' : 'info')

function Screen({ title, body, children }: { title: string; body?: string; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6 bg-ex-bg"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 bg-ex-paper"
        style={{ boxShadow: 'var(--ex-shadow-modal)' }}
      >
        <h2
          className="text-lg font-bold text-ex-ink"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.3px' }}
        >
          {title}
        </h2>
        {body && <p className="mt-2 text-sm text-ex-muted">{body}</p>}
        {children}
      </div>
    </div>
  )
}

const buttonClass =
  'btn-3d-green w-full h-14 mt-5 rounded-2xl font-extrabold text-base flex items-center justify-center bg-ex-forest text-white'

export default function AppGate({ children }: { children: ReactNode }) {
  const [phase, setPhaseState] = useState<GatePhase>('checking')
  const [pct, setPct] = useState(0)
  const [label, setLabel] = useState<string | undefined>()
  const language = useStore((s) => s.language)
  const cachedExhibits = useStore((s) => s.cachedExhibits)
  const assetFailures = useStore((s) => s.assetFailures)
  const phaseRef = useRef<GatePhase>('checking')
  const runningRef = useRef(false)
  const restartRef = useRef(false)
  const runRef = useRef<() => Promise<void>>(async () => {})

  const setPhase = useCallback((p: GatePhase) => {
    phaseRef.current = p
    setPhaseState(p)
    useDebugStore.getState().setCacheDebug(p)
  }, [])

  const finish = useCallback(
    (result: PrecacheResult) => {
      const capped = result.groups.some((g) => g.capped.length > 0)
      if (capped) setPhase('asset-error')
      else if (result.offline || result.groups.some((g) => !g.complete)) setPhase('blocked-offline')
      else setPhase(nextAfterClear())
    },
    [setPhase]
  )

  const run = useCallback(async () => {
    if (runningRef.current) {
      restartRef.current = true // e.g. language changed mid-download
      return
    }
    runningRef.current = true
    try {
      await waitForServiceWorker()
      const online = navigator.onLine
      const store = useStore.getState()
      const idPromise = getOrCreateVisitorId().then((id) => store.setVisitorId(id))
      idPromise.catch(() => {}) // handled where it matters; avoids unhandled rejection on early-exit paths

      const { hasDataset, missing } = await checkFresh()
      const gaps = Object.values(missing).flat()
      const staleLanguage = Object.values(store.completionByGroup).some(
        (c) => c.language && c.language !== store.language
      )
      const complete = hasDataset && gaps.length === 0

      // Cache Storage is authoritative both ways: full cache skips onboarding regardless of flags.
      // Offline + language switched: old-language cache still plays, so don't strand the visitor.
      if (complete && (!staleLanguage || !online)) {
        setPhase('clear')
        return
      }

      // Only capped assets left: nothing to fetch, go straight to the error list.
      if (
        hasDataset &&
        !staleLanguage &&
        gaps.every((u) => (store.assetFailures[u]?.count ?? 0) >= MAX_ATTEMPTS)
      ) {
        setPhase('asset-error')
        return
      }

      if (!online) {
        setPhase('blocked-offline')
        return
      }

      setPhase('loading')
      setPct(0)
      setLabel(undefined)
      const [result] = await Promise.all([
        runPrecache(useStore.getState().language, (fetched, total) => {
          setPct(total ? (fetched / total) * 100 : 0)
          setLabel(total ? `Downloading ${fetched} of ${total}` : undefined)
        }),
        idPromise,
      ])
      // A language change mid-run queued a restart: this result is for the stale language, so
      // surfacing it (clear/info/error) would flash wrong-language content. The finally block re-runs.
      if (!restartRef.current) finish(result)
    } catch {
      // handshake or dataset query failed: treat as network failure
      if (!restartRef.current) setPhase('blocked-offline')
    } finally {
      runningRef.current = false
      if (restartRef.current) {
        restartRef.current = false
        void runRef.current()
      }
    }
  }, [finish, setPhase])

  useEffect(() => {
    runRef.current = run
    // first setState happens after awaits (SW wait, cache check), not synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run()
    return onForeground(() => {
      const p = phaseRef.current
      // 'clear' + stale language = a switch made offline; retry now that we're back
      if (p === 'loading' || p === 'blocked-offline' || (p === 'clear' && languageIsStale()))
        void run()
    })
  }, [run])

  // Catches any language change after the gate (e.g. PreviewSheet's chip), whoever made it.
  useEffect(() => {
    if (phaseRef.current === 'clear' && languageIsStale()) void run()
  }, [language, run])

  const handleLanguageChange = useCallback(
    (_code: Language) => {
      void run()
    },
    [run]
  )

  const cappedExhibits = cachedExhibits.filter(
    (e) => e.audioUrl && (assetFailures[e.audioUrl]?.count ?? 0) >= MAX_ATTEMPTS
  )

  if (phase === 'clear') return <>{children}</>

  if (phase === 'loading') {
    return <LoadingScreen pct={pct} phase={label} onLanguageChange={handleLanguageChange} />
  }

  if (phase === 'info') {
    const done = () => {
      localStorage.setItem(ONBOARDED_KEY, '1')
      setPhase('clear')
    }
    return <InfoModal onDone={done} />
  }

  if (phase === 'blocked-offline') {
    return (
      <Screen
        title="Connect to the internet"
        body="We need a connection once to download the audio tour. After that it works offline."
      >
        <button
          type="button"
          className={buttonClass}
          style={{ border: 'none' }}
          onClick={() => void run()}
        >
          Try again
        </button>
      </Screen>
    )
  }

  if (phase === 'asset-error') {
    const urls = cappedExhibits.flatMap((e) => (e.audioUrl ? [e.audioUrl] : []))
    return (
      <Screen
        title="Some audio couldn't be downloaded"
        body="These exhibits will need a connection to play:"
      >
        <ul className="mt-3 max-h-48 overflow-y-auto text-sm font-bold text-ex-ink">
          {cappedExhibits.map((e) => (
            <li key={e.id}>{e.name}</li>
          ))}
        </ul>
        <button
          type="button"
          className={buttonClass}
          style={{ border: 'none' }}
          onClick={() => {
            logContinueAnyway(urls)
            setPhase(nextAfterClear())
          }}
        >
          Continue anyway
        </button>
      </Screen>
    )
  }

  // 'checking': neutral cover so real content never flashes before the mount check resolves
  return <div className="fixed inset-0 bg-ex-bg" />
}
