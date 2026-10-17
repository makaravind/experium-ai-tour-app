'use client'

import { useEffect, useState } from 'react'
import { NO_PRECACHE_KEY } from '@/components/onboarding/AppGate'
import { useStore } from '@/lib/store'
import { useDebugStore } from '@/lib/debug-store'
import { MAX_ATTEMPTS, fetchCachedExhibits, findMissing, getAssetGroups } from '@/lib/precache'

const PRECACHE_CACHE_NAMES = ['audio-cache', 'map-tiles-cache']

export default function DebugPanel() {
  const [open, setOpen] = useState(false)
  const {
    isActive,
    setActive,
    gps,
    setGps,
    apiLog,
    clearApiLog,
    mapDebug,
    forcedMarkerState,
    setForcedMarkerState,
    mockGpsEnabled,
    setMockGpsEnabled,
  } = useDebugStore()
  const cacheDebug = useDebugStore((s) => s.cacheDebug)
  const { language, visitedExhibits, totalDiscovered } = useStore()
  const cachedExhibits = useStore((s) => s.cachedExhibits)
  const completionByGroup = useStore((s) => s.completionByGroup)
  const assetFailures = useStore((s) => s.assetFailures)
  const precacheLanguage = useStore((s) => s.precacheLanguage)
  const [cacheCounts, setCacheCounts] = useState<Record<string, number> | null>(null)
  const [missingUrls, setMissingUrls] = useState<string[]>([])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('debug') === '1') {
      sessionStorage.setItem('debug', '1')
    }
    if (sessionStorage.getItem('debug') === '1') {
      setActive(true)
    }
  }, [setActive])

  if (!isActive) return null

  const refreshGps = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }),
      () => {}
    )
  }

  const refreshCache = async () => {
    const groups = getAssetGroups()
    const counts: Record<string, number> = {}
    for (const g of groups)
      counts[g.cacheName] = (await (await caches.open(g.cacheName)).keys()).length
    setCacheCounts(counts)
    setMissingUrls(Object.values(await findMissing(groups)).flat())
  }

  const resetCache = async () => {
    await Promise.all(PRECACHE_CACHE_NAMES.map((n) => caches.delete(n)))
    useStore.setState({
      completionByGroup: {},
      assetFailures: {},
      cachedExhibits: [],
      precacheLanguage: null,
      visitorId: null,
      userInfo: null,
      visitedExhibits: [],
    })
    location.reload()
  }

  const noPrecache =
    typeof window !== 'undefined' && sessionStorage.getItem(NO_PRECACHE_KEY) === '1'

  const toggleNoPrecache = async () => {
    if (noPrecache) {
      sessionStorage.removeItem(NO_PRECACHE_KEY)
    } else {
      sessionStorage.setItem(NO_PRECACHE_KEY, '1')
      await Promise.all(PRECACHE_CACHE_NAMES.map((n) => caches.delete(n)))
      useStore.setState({
        completionByGroup: {},
        assetFailures: {},
        cachedExhibits: [],
        precacheLanguage: null,
      })
    }
    location.reload()
  }

  const audioLanguage = precacheLanguage ?? language

  const failRandomExhibit = async () => {
    let pool = cachedExhibits
    if (pool.length === 0) pool = await fetchCachedExhibits()
    const withAudio = pool.filter((e) => e.audio[audioLanguage])
    if (withAudio.length === 0) return
    const url = withAudio[Math.floor(Math.random() * withAudio.length)].audio[
      audioLanguage
    ] as string
    useStore.setState({ assetFailures: { ...assetFailures, [url]: { count: MAX_ATTEMPTS } } })
    location.reload()
  }

  const failedExhibitNames = cachedExhibits
    .filter((e) => {
      const url = e.audio[audioLanguage]
      return url && ((assetFailures[url]?.count ?? 0) >= MAX_ATTEMPTS || missingUrls.includes(url))
    })
    .map((e) => e.name)

  const copyAll = () => {
    const data = {
      store: { language, visitedExhibits, totalDiscovered },
      gps,
      apiLog,
    }
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-emerald-500 text-black text-xs font-mono font-bold px-2 py-1 rounded"
      >
        DBG
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="w-full max-w-md bg-stone-900 rounded-2xl p-4 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <span className="text-emerald-400 font-mono text-sm font-bold">Debug Panel</span>
              <button onClick={() => setOpen(false)} className="text-stone-400 text-sm">
                ✕
              </button>
            </div>

            <section>
              <p className="text-stone-500 text-xs mb-1">STORE</p>
              <pre className="text-xs text-stone-300 bg-stone-950 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify({ language, visitedExhibits, totalDiscovered }, null, 2)}
              </pre>
            </section>

            {mapDebug && (
              <section>
                <p className="text-stone-500 text-xs mb-1">MAP</p>
                <pre className="text-xs text-stone-300 bg-stone-950 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(
                    {
                      zoom: mapDebug.zoom.toFixed(2),
                      startingZoom: mapDebug.startingZoom?.toFixed(2) ?? null,
                      outOfBounds: mapDebug.outOfBounds,
                      lat: mapDebug.lat.toFixed(6),
                      lng: mapDebug.lng.toFixed(6),
                    },
                    null,
                    2
                  )}
                </pre>
              </section>
            )}

            <section>
              <p className="text-stone-500 text-xs mb-1">MARKER STATE</p>
              <div className="flex flex-wrap gap-1">
                {(['off', 'unvisited', 'visited', 'coming_soon', 'nearby', 'active'] as const).map(
                  (s) => {
                    const value = s === 'off' ? null : s
                    const isSelected = forcedMarkerState === value
                    return (
                      <button
                        key={s}
                        onClick={() => setForcedMarkerState(value)}
                        className={`text-xs px-2 py-1 rounded font-mono ${
                          isSelected
                            ? 'bg-emerald-500 text-black font-bold'
                            : 'bg-stone-800 text-stone-300'
                        }`}
                      >
                        {s}
                      </button>
                    )
                  }
                )}
              </div>
            </section>

            <section>
              <p className="text-stone-500 text-xs mb-1">MOCK GPS</p>
              <button
                onClick={() => setMockGpsEnabled(!mockGpsEnabled)}
                className={`text-xs px-2 py-1 rounded font-mono ${
                  mockGpsEnabled
                    ? 'bg-emerald-500 text-black font-bold'
                    : 'bg-stone-800 text-stone-300'
                }`}
              >
                Mock GPS: {mockGpsEnabled ? 'ON' : 'OFF'}
              </button>
            </section>

            <section>
              <div className="flex justify-between items-center mb-1">
                <p className="text-stone-500 text-xs">GPS</p>
                <button onClick={refreshGps} className="text-emerald-400 text-xs">
                  Refresh
                </button>
              </div>
              <pre className="text-xs text-stone-300 bg-stone-950 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(gps, null, 2)}
              </pre>
            </section>

            <section>
              <div className="flex justify-between items-center mb-1">
                <p className="text-stone-500 text-xs">CACHE</p>
                <button onClick={refreshCache} className="text-emerald-400 text-xs">
                  Refresh
                </button>
              </div>
              <pre className="text-xs text-stone-300 bg-stone-950 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(
                  {
                    phase: cacheDebug,
                    language,
                    noPrecache,
                    swControlling: navigator.serviceWorker?.controller != null,
                    completionByGroup,
                    cacheKeyCounts: cacheCounts,
                    failedAssets: Object.keys(assetFailures).length,
                    failedExhibits: failedExhibitNames,
                  },
                  null,
                  2
                )}
              </pre>
              <div className="flex gap-1 mt-1">
                <button
                  onClick={resetCache}
                  className="text-xs px-2 py-1 rounded font-mono bg-stone-800 text-stone-300"
                >
                  Reset
                </button>
                <button
                  onClick={failRandomExhibit}
                  className="text-xs px-2 py-1 rounded font-mono bg-stone-800 text-stone-300"
                >
                  Fail random exhibit
                </button>
                <button
                  onClick={toggleNoPrecache}
                  className={`text-xs px-2 py-1 rounded font-mono ${
                    noPrecache
                      ? 'bg-emerald-500 text-black font-bold'
                      : 'bg-stone-800 text-stone-300'
                  }`}
                >
                  No precache: {noPrecache ? 'ON' : 'OFF'}
                </button>
              </div>
            </section>

            <section>
              <div className="flex justify-between items-center mb-1">
                <p className="text-stone-500 text-xs">API LOG ({apiLog.length})</p>
                <button onClick={clearApiLog} className="text-stone-400 text-xs">
                  Clear
                </button>
              </div>
              <pre className="text-xs text-stone-300 bg-stone-950 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(apiLog, null, 2)}
              </pre>
            </section>

            <button
              onClick={copyAll}
              className="w-full bg-stone-800 text-stone-300 text-xs py-2 rounded-lg"
            >
              Copy All
            </button>
          </div>
        </div>
      )}
    </>
  )
}
