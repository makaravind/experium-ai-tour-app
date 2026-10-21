'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import InfoModal from '@/components/onboarding/InfoModal'
import IntroScreen from '@/components/onboarding/IntroScreen'
import LoadingScreen from '@/components/onboarding/LoadingScreen'
import { getOrCreateVisitorId } from '@/lib/handshake-lock'
import { useDebugStore, type GatePhase } from '@/lib/debug-store'
import { ConnectionTimeoutError } from '@/lib/timeouts'
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
export const NO_PRECACHE_KEY = 'experium_debug_no_precache'
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

const nextAfterClear = (): GatePhase => (localStorage.getItem(ONBOARDED_KEY) ? 'clear' : 'info')

// Reads the store directly (not a hook value) so run/finish keep stable identities; a changing
// callback would re-trigger the mount effect right after "Continue anyway".
const allAcknowledged = (urls: string[]) => {
  const acknowledged = useStore.getState().acknowledgedCapped
  return urls.length > 0 && urls.every((u) => acknowledged.includes(u))
}

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
  const [introDone, setIntroDone] = useState(process.env.NODE_ENV === 'development')
  const precacheLanguage = useStore((s) => s.precacheLanguage)
  const cachedExhibits = useStore((s) => s.cachedExhibits)
  const assetFailures = useStore((s) => s.assetFailures)
  const refreshRequested = useStore((s) => s.refreshRequested)
  const setAcknowledgedCapped = useStore((s) => s.setAcknowledgedCapped)
  const setAssetFailures = useStore((s) => s.setAssetFailures)
  const phaseRef = useRef<GatePhase>('checking')
  const runningRef = useRef(false)
  const restartRef = useRef(false)
  const runRef = useRef<() => Promise<void>>(async () => {})
  const abortRef = useRef<AbortController | null>(null)

  const setPhase = useCallback((p: GatePhase) => {
    phaseRef.current = p
    setPhaseState(p)
    useDebugStore.getState().setCacheDebug(p)
  }, [])

  const finish = useCallback(
    (result: PrecacheResult) => {
      if (result.timedOut) {
        setPhase('weak-connection')
        return
      }
      const capped = result.groups.flatMap((g) => g.capped)
      // acknowledged capped URLs stay in `failed` (never retried), so they must not block here
      const failed = result.groups.flatMap((g) => g.failed)
      if (capped.length > 0 && !allAcknowledged(capped)) setPhase('asset-error')
      else if (result.offline) setPhase('blocked-offline')
      else if (failed.length > 0 && !allAcknowledged(failed)) setPhase('asset-error')
      else setPhase(nextAfterClear())
    },
    [setPhase]
  )

  const run = useCallback(async () => {
    if (runningRef.current) {
      restartRef.current = true // e.g. picker re-targeted the precache mid-download
      return
    }
    runningRef.current = true
    try {
      // Debug escape hatch: skip the gate entirely, no bulk download, no offline guarantee.
      if (sessionStorage.getItem(NO_PRECACHE_KEY)) {
        setPhase('clear')
        return
      }
      await waitForServiceWorker()
      const online = navigator.onLine
      const store = useStore.getState()
      const idPromise = getOrCreateVisitorId().then((id) => store.setVisitorId(id))
      idPromise.catch(() => {}) // handled where it matters; avoids unhandled rejection on early-exit paths

      // A fresh visitor's first run seeds the precache language from their current selection.
      const target = store.precacheLanguage ?? store.language
      if (!store.precacheLanguage) store.setPrecacheLanguage(target)

      const { hasDataset, missing } = await checkFresh(target)
      const gaps = Object.values(missing).flat()

      // Cache Storage is authoritative both ways: full cache skips onboarding regardless of flags.
      if (hasDataset && gaps.length === 0) {
        setPhase('clear')
        return
      }

      // Only capped assets left: nothing to fetch. Acknowledged -> straight in, else the error list.
      if (hasDataset && gaps.every((u) => (store.assetFailures[u]?.count ?? 0) >= MAX_ATTEMPTS)) {
        setPhase(allAcknowledged(gaps) ? nextAfterClear() : 'asset-error')
        return
      }

      if (!online) {
        setPhase(hasDataset ? nextAfterClear() : 'blocked-offline')
        return
      }

      setPhase('loading')
      setPct(0)
      setLabel(undefined)
      const controller = new AbortController()
      abortRef.current = controller
      const [result] = await Promise.all([
        runPrecache(
          target,
          (fetched, total) => {
            setPct(total ? (fetched / total) * 100 : 0)
            setLabel(total ? `Downloading ${fetched} of ${total}` : undefined)
          },
          () => restartRef.current,
          controller.signal
        ),
        idPromise,
      ])
      // A picker re-target mid-run queued a restart: this result is for the stale language, so
      // surfacing it (clear/info/error) would flash wrong-language content. The finally block re-runs.
      if (!restartRef.current) finish(result)
    } catch (err) {
      abortRef.current?.abort() // kill orphaned precache if idPromise rejected first
      // handshake or dataset query failed: offline is a connectivity problem, online is a fetch failure
      if (!restartRef.current) {
        if (err instanceof ConnectionTimeoutError) setPhase('weak-connection')
        else setPhase(navigator.onLine ? 'fetch-error' : 'blocked-offline')
      }
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
      if (
        p === 'loading' ||
        p === 'blocked-offline' ||
        p === 'fetch-error' ||
        p === 'weak-connection'
      )
        void run()
    })
  }, [run])

  useEffect(() => {
    if (!refreshRequested || phaseRef.current !== 'clear') return
    useStore.getState().setRefreshRequested(false)
    void (async () => {
      if (useDebugStore.getState().isActive) await caches.delete('audio-cache')
      useStore.getState().setCachedExhibits([])
      useStore.getState().setCachedAmenities([])
      await run()
    })()
  }, [refreshRequested, run])

  const handleLanguageChange = useCallback(
    (code: Language) => {
      if (code === useStore.getState().precacheLanguage) return
      abortRef.current?.abort()
      setPct(0)
      useStore.getState().setPrecacheLanguage(code)
      void run()
    },
    [run]
  )

  const handleIntroEnd = useCallback(() => setIntroDone(true), [])

  const handleInfoDone = useCallback(() => {
    localStorage.setItem(ONBOARDED_KEY, '1')
    setPhase('clear')
  }, [setPhase])

  const audioUrlOf = (e: (typeof cachedExhibits)[number]) =>
    precacheLanguage ? e.audio[precacheLanguage] : undefined
  const cappedExhibits = cachedExhibits.filter((e) => {
    const url = audioUrlOf(e)
    return url && (assetFailures[url]?.count ?? 0) >= MAX_ATTEMPTS
  })

  let content: ReactNode
  if (phase === 'clear') {
    content = <>{children}</>
  } else if (phase === 'loading') {
    content = (
      <LoadingScreen
        pct={pct}
        phase={label}
        activeLanguage={precacheLanguage ?? undefined}
        onLanguageChange={handleLanguageChange}
      />
    )
  } else if (phase === 'info') {
    content = <InfoModal onDone={handleInfoDone} />
  } else if (phase === 'blocked-offline') {
    content = (
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
  } else if (phase === 'fetch-error') {
    content = (
      <Screen
        title="Something went wrong"
        body="Couldn't load the tour data. Check your connection and try again."
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
  } else if (phase === 'weak-connection') {
    content = (
      <Screen
        title="Weak connection"
        body="The download stalled. Move closer to the park entrance or connect to Wi-Fi, then try again."
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
  } else if (phase === 'asset-error') {
    const urls = cappedExhibits.flatMap((e) => audioUrlOf(e) ?? [])
    content = (
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
            const next = { ...assetFailures }
            for (const url of urls) delete next[url]
            setAssetFailures(next)
            setAcknowledgedCapped(
              useStore.getState().acknowledgedCapped.filter((u) => !urls.includes(u))
            )
            void run()
          }}
        >
          Try again
        </button>
        <button
          type="button"
          className="w-full h-14 mt-3 rounded-2xl font-extrabold text-base flex items-center justify-center bg-transparent text-ex-forest border-2 border-ex-forest"
          onClick={() => {
            logContinueAnyway(urls)
            setAcknowledgedCapped([...urls].sort())
            setPhase(nextAfterClear())
          }}
        >
          Continue anyway
        </button>
      </Screen>
    )
  } else {
    // 'checking': neutral cover so real content never flashes before the mount check resolves
    content = <div className="fixed inset-0 bg-ex-bg" />
  }

  return (
    <>
      {content}
      <AnimatePresence>
        {!introDone && (
          <motion.div
            key="intro"
            className="fixed inset-0 z-50"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <IntroScreen onEnd={handleIntroEnd} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
