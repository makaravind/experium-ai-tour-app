'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import { useDebugStore } from '@/lib/debug-store'

export default function DebugPanel() {
  const [open, setOpen] = useState(false)
  const { isActive, setActive, gps, setGps, apiLog, clearApiLog } = useDebugStore()
  const { language, visitedExhibits, audioState } = useStore()

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

  const copyAll = () => {
    const data = { store: { language, visitedExhibits, audioState }, gps, apiLog }
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
                {JSON.stringify({ language, visitedExhibits, audioState }, null, 2)}
              </pre>
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
