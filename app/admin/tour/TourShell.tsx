'use client'

import { useEffect, useState } from 'react'

import type { TourAdminState } from '@/lib/admin/tour-types'

async function fetchState(): Promise<TourAdminState> {
  const res = await fetch('/api/admin/tour/data')
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error ?? `Load failed (${res.status})`)
  return json
}

export default function TourShell() {
  const [state, setState] = useState<TourAdminState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    fetchState().then(setState, (e) => setLoadError(e instanceof Error ? e.message : String(e)))
  }, [])

  if (loadError) return <p className="p-6 text-sm text-destructive">{loadError}</p>
  if (!state) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold">Tour authoring</h1>
      <pre className="mt-3 text-sm">
        {JSON.stringify(
          { nodes: state.nodes.length, edges: state.edges.length, exhibits: state.exhibits.length },
          null,
          2
        )}
      </pre>
    </div>
  )
}
