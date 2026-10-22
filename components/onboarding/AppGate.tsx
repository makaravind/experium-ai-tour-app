'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import InfoModal from '@/components/onboarding/InfoModal'
import IntroScreen from '@/components/onboarding/IntroScreen'
import LoadingScreen from '@/components/onboarding/LoadingScreen'
import { getOrCreateVisitorId } from '@/lib/handshake-lock'
import { useDebugStore, type GatePhase } from '@/lib/debug-store'
import { ConnectionTimeoutError } from '@/lib/timeouts'
import { MAP_URL } from '@/lib/cache-names'
import {
  CONTENT_CACHE_NAMES,
  checkFresh,
  loadDataset,
  logContinueAnyway,
  MAX_ATTEMPTS,
  onForeground,
  runPrecache,
  type PrecacheResult,
} from '@/lib/precache'
import { useStore } from '@/lib/store'
import type { Language } from '@/lib/types'

const ONBOARDED_KEY = 'experium_onboarded'
const INTRO_DONE_KEY = 'experium_intro_done'
export const NO_PRECACHE_KEY = 'experium_debug_no_precache'
export const CONTINUE_ONLINE_KEY = 'experium_continue_online'
const SW_WAIT_MS = 20_000
const SW_CLAIM_GRACE_MS = 1000

// Fetches issued before the SW controls the page bypass its CacheFirst rules and never get cached.
// A shift-reload leaves an active SW that never claims the page, so ask it to claim after a grace period.
async function waitForServiceWorker(): Promise<'controlled' | 'unsupported' | 'timeout'> {
  if (process.env.NODE_ENV === 'development') return 'controlled'
  if (!('serviceWorker' in navigator)) return 'unsupported'
  const sw = navigator.serviceWorker
  const controlled = new Promise<'controlled'>((resolve) => {
    if (sw.controller) return resolve('controlled')
    sw.addEventListener('controllerchange', () => resolve('controlled'), { once: true })
    void sw.ready.then((registration) =>
      setTimeout(() => {
        if (!sw.controller) registration.active?.postMessage({ type: 'CLAIM' })
      }, SW_CLAIM_GRACE_MS)
    )
  })
  // don't strand the visitor if the SW never takes control (blocked, registration failed)
  const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), SW_WAIT_MS))
  return Promise.race([controlled, timeout])
}

const nextAfterClear = (): GatePhase => (localStorage.getItem(ONBOARDED_KEY) ? 'clear' : 'info')

// Reads the store directly (not a hook value) so run/finish keep stable identities; a changing
// callback would re-trigger the mount effect right after "Continue anyway".
const allAcknowledged = (urls: string[]) => {
  const acknowledged = new Set(useStore.getState().acknowledgedCapped)
  return urls.length > 0 && urls.every((u) => acknowledged.has(u))
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
  const [introDone, setIntroDone] = useState(() => {
    if (process.env.NODE_ENV === 'development') return true
    try { return !!sessionStorage.getItem(INTRO_DONE_KEY) } catch { return false }
  })
  const [showCopyFallback, setShowCopyFallback] = useState(false)
  const [copyConfirmed, setCopyConfirmed] = useState(false)
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
      if (result.saveFailed) {
        setPhase('storage-error')
        return
      }
      if (result.timedOut) {
        setPhase('weak-connection')
        return
      }
      if (result.offline) {
        setPhase('blocked-offline')
        return
      }
      const capped = result.groups.flatMap((g) => g.capped)
      if (capped.length > 0 && !allAcknowledged(capped)) {
        setPhase('asset-error')
        return
      }
      // acknowledged capped URLs stay in `failed` (never retried), so they must not count as incomplete
      const acknowledged = new Set(useStore.getState().acknowledgedCapped)
      const incomplete = result.groups.some((g) => g.failed.some((u) => !acknowledged.has(u)))
      if (incomplete) {
        setPhase('fetch-error')
        return
      }
      setPhase(nextAfterClear())
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
      // Continue-online: visitor chose to skip offline guarantee (e.g. in-app browser).
      // Session-scoped: reload in the same tab skips this screen; new session re-offers the offline path.
      if (sessionStorage.getItem(CONTINUE_ONLINE_KEY)) {
        if (!navigator.onLine) {
          setPhase(
            useStore.getState().cachedExhibits.length > 0 ? nextAfterClear() : 'blocked-offline'
          )
          return
        }
        try {
          await loadDataset()
        } catch {
          setPhase(navigator.onLine ? 'fetch-error' : 'blocked-offline')
          return
        }
        setPhase(nextAfterClear())
        return
      }

      // Start the SW wait early but only block on it if we actually need to download.
      const swResultPromise = waitForServiceWorker()
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

      // Only block on SW control if we're about to download (already-cached visitors skip the wait).
      const swResult = await swResultPromise
      if (swResult !== 'controlled') {
        setPhase('no-offline-support')
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
          (fetched, total, cacheName) => {
            setPct(total ? (fetched / total) * 100 : 0)
            setLabel(
              total
                ? cacheName === 'map-tiles-cache'
                  ? 'Downloading map…'
                  : `Downloading ${fetched} of ${total}`
                : undefined
            )
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
        p === 'weak-connection' ||
        p === 'storage-error'
      )
        void run()
    })
  }, [run])

  useEffect(() => {
    if (!refreshRequested || phaseRef.current !== 'clear') return
    useStore.getState().setRefreshRequested(false)
    void (async () => {
      await Promise.all(CONTENT_CACHE_NAMES.map((n) => caches.delete(n)))
      useStore.setState({
        cachedExhibits: [],
        cachedAmenities: [],
        assetFailures: {},
        acknowledgedCapped: [],
        completionByGroup: {},
      })
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

  const handleIntroEnd = useCallback(() => {
    try { sessionStorage.setItem(INTRO_DONE_KEY, '1') } catch { /* storage blocked */ }
    setIntroDone(true)
  }, [])

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
  } else if (phase === 'no-offline-support') {
    content = (
      <Screen
        title="This browser can't save the tour offline"
        body="Open this link in Chrome or Safari to use the tour without internet."
      >
        {showCopyFallback && (
          <p className="mt-3 text-sm text-ex-ink break-all select-all rounded-lg bg-ex-bg p-2">
            {location.href}
          </p>
        )}
        {copyConfirmed && <p className="mt-2 text-sm text-ex-forest font-bold">Link copied!</p>}
        <button
          type="button"
          className={buttonClass}
          style={{ border: 'none' }}
          onClick={() => {
            // clipboard is undefined in some webviews, so guard before .then
            const write = navigator.clipboard?.writeText(location.href) ?? Promise.reject()
            write.then(
              () => setCopyConfirmed(true),
              () => setShowCopyFallback(true)
            )
          }}
        >
          Copy link
        </button>
        <button
          type="button"
          className="w-full h-14 mt-3 rounded-2xl font-extrabold text-base flex items-center justify-center bg-transparent text-ex-forest border-2 border-ex-forest"
          onClick={() => {
            sessionStorage.setItem(CONTINUE_ONLINE_KEY, '1')
            void run()
          }}
        >
          Continue online
        </button>
      </Screen>
    )
  } else if (phase === 'storage-error') {
    content = (
      <Screen title="Your phone is low on storage" body="Free some space and try again.">
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
    const mapCapped = (assetFailures[MAP_URL]?.count ?? 0) >= MAX_ATTEMPTS
    const urls = [
      ...cappedExhibits.flatMap((e) => audioUrlOf(e) ?? []),
      ...(mapCapped ? [MAP_URL] : []),
    ]
    content = (
      <Screen
        title="Some audio couldn't be downloaded"
        body="These exhibits will need a connection to play:"
      >
        <ul className="mt-3 max-h-48 overflow-y-auto text-sm font-bold text-ex-ink">
          {cappedExhibits.map((e) => (
            <li key={e.id}>{e.name}</li>
          ))}
          {mapCapped && <li key="__map">Park map</li>}
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
            setAcknowledgedCapped([...urls])
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
