'use client'

import { useEffect, useMemo, useState } from 'react'

import PlaceMap from '@/components/admin/tour/PlaceMap'
import PlacePanel from '@/components/admin/tour/PlacePanel'
import { Button } from '@/components/ui/button'
import { buildTourChangeset } from '@/lib/admin/tour-changeset'
import type { TourAdminState, TourWorkingState } from '@/lib/admin/tour-types'
import { setNodeLabel, setNodePosition, toTourWorking } from '@/lib/admin/tour-working'

// Workflow order. Steps 3-5 flip `ready` and render their panel in the mode switch below.
const MODES = [
  { id: 'Place', ready: true },
  { id: 'Edges', ready: false },
  { id: 'Aim', ready: false },
  { id: 'Link', ready: false },
  { id: 'Save', ready: false }, // Step 5: validate UI; the staged-edits bar below saves meanwhile
] as const
type Mode = (typeof MODES)[number]['id']

async function fetchState(): Promise<TourAdminState> {
  const res = await fetch('/api/admin/tour/data')
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error ?? `Load failed (${res.status})`)
  return json
}

export default function TourShell() {
  const [original, setOriginal] = useState<TourAdminState | null>(null)
  const [working, setWorking] = useState<TourWorkingState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('Place')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const apply = (state: TourAdminState) => {
    setOriginal(state)
    setWorking(toTourWorking(state))
  }

  useEffect(() => {
    fetchState().then(apply, (e) => setLoadError(e instanceof Error ? e.message : String(e)))
  }, [])

  const diff = useMemo(
    () => (original && working ? buildTourChangeset(original, working) : null),
    [original, working]
  )

  if (loadError) return <p className="p-6 text-sm text-destructive">{loadError}</p>
  if (!original || !working || !diff)
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>

  const update = (fn: (w: TourWorkingState) => TourWorkingState) => {
    setSaved(false)
    setWorking((w) => w && fn(w))
  }

  async function save() {
    if (!diff) return
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/admin/tour/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diff.changeset),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setSaveError(json?.error ?? `Save failed (${res.status})`)
        return
      }
      try {
        apply(await fetchState())
        setSaved(true)
      } catch (e) {
        setSaveError(`Saved, but reload failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0">
      {mode === 'Place' && (
        <PlaceMap
          nodes={working.nodes}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onPlace={(lat, lng) =>
            selectedId && update((w) => setNodePosition(w, selectedId, { lat, lng }))
          }
        />
      )}

      <aside className="absolute bottom-0 left-0 top-0 z-10 flex w-96 flex-col border-r border-border bg-background shadow-lg">
        <div className="border-b border-border px-4 py-3">
          <h1 className="text-base font-semibold">Tour authoring</h1>
          <div className="mt-2 flex gap-1">
            {MODES.map((m) => (
              <Button
                key={m.id}
                size="sm"
                variant={m.id === mode ? 'default' : 'ghost'}
                disabled={!m.ready}
                title={m.ready ? undefined : 'Coming soon'}
                onClick={() => setMode(m.id)}
              >
                {m.id}
              </Button>
            ))}
          </div>
        </div>
        {mode === 'Place' && (
          <PlacePanel
            nodes={working.nodes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onLabelChange={(id, label) => update((w) => setNodeLabel(w, id, label))}
            onClearPosition={(id) => update((w) => setNodePosition(w, id, null))}
          />
        )}
      </aside>

      <div className="absolute bottom-4 left-1/2 z-20 flex max-w-xl -translate-x-1/2 flex-col gap-1 rounded-lg border border-border bg-background px-4 py-2 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-sm">{diff.isEmpty ? 'No unsaved changes' : diff.summary}</span>
          <Button size="sm" disabled={diff.isEmpty || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
        {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        {saved && !saveError && <p className="text-xs text-muted-foreground">Saved.</p>}
      </div>
    </div>
  )
}
