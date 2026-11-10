'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

import AimPanel from '@/components/admin/tour/AimPanel'
import EdgesMap from '@/components/admin/tour/EdgesMap'
import EdgesPanel from '@/components/admin/tour/EdgesPanel'
import LinkMap from '@/components/admin/tour/LinkMap'
import LinkPanel from '@/components/admin/tour/LinkPanel'
import PlaceMap from '@/components/admin/tour/PlaceMap'
import PlacePanel from '@/components/admin/tour/PlacePanel'
import SavePanel from '@/components/admin/tour/SavePanel'
import { Button } from '@/components/ui/button'
import {
  aimMarkers,
  clickToAim,
  setEdgeAim,
  setExhibitAim,
  type AimTarget,
} from '@/lib/admin/tour-aim'
import { buildTourChangeset } from '@/lib/admin/tour-changeset'
import { pairKey, proposeEdges, toPair, type EdgePair } from '@/lib/admin/tour-edges'
import { LINK_RADIUS_M, proposeLinks, setExhibitNode } from '@/lib/admin/tour-links'
import { tourBlockers } from '@/lib/admin/tour-validation'
import type { TourAdminState, TourWorkingState } from '@/lib/admin/tour-types'
import {
  addEdgePairs,
  neighbourCount,
  removeEdgePair,
  setNodeLabel,
  setNodePosition,
  toTourWorking,
} from '@/lib/admin/tour-working'
import { loadParkPaths, type ParkPaths } from '@/lib/park-paths'

// PSV touches `window` on import, so the Aim viewer is client-only.
const AimViewer = dynamic(() => import('@/components/admin/tour/AimViewer'), { ssr: false })

// Workflow order.
const MODES = [
  { id: 'Place', ready: true },
  { id: 'Edges', ready: true },
  { id: 'Aim', ready: true },
  { id: 'Link', ready: true },
  { id: 'Save', ready: true },
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
  const [paths, setPaths] = useState<ParkPaths>({})
  const [proposals, setProposals] = useState<EdgePair[]>([]) // UI-local, never persisted
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [armed, setArmed] = useState<AimTarget | null>(null)
  const [focus, setFocus] = useState<{ yaw: number; pitch: number; n: number } | null>(null)
  const [linkRadius, setLinkRadius] = useState(LINK_RADIUS_M)
  const [linkPending, setLinkPending] = useState<Record<string, string>>({}) // exhibit id → proposed node id, UI-local
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

  useEffect(() => {
    loadParkPaths().then(setPaths)
  }, [])

  // distinct undirected pairs of the working edges
  const existingPairs = useMemo(() => {
    const seen = new Map<string, EdgePair>()
    for (const e of working?.edges ?? [])
      seen.set(pairKey(e.from_node_id, e.to_node_id), toPair(e.from_node_id, e.to_node_id))
    return [...seen.values()]
  }, [working])
  const visibleProposals = useMemo(() => {
    const have = new Set(existingPairs.map((p) => pairKey(p.a, p.b)))
    return proposals.filter((p) => !have.has(pairKey(p.a, p.b)))
  }, [proposals, existingPairs])
  const picked = useMemo(() => {
    const inProposed = visibleProposals.find((p) => pairKey(p.a, p.b) === pickedKey)
    if (inProposed) return { pair: inProposed, kind: 'proposed' as const }
    const inExisting = existingPairs.find((p) => pairKey(p.a, p.b) === pickedKey)
    return inExisting ? { pair: inExisting, kind: 'existing' as const } : null
  }, [visibleProposals, existingPairs, pickedKey])

  const diff = useMemo(
    () => (original && working ? buildTourChangeset(original, working) : null),
    [original, working]
  )

  const blockers = useMemo(() => (working ? tourBlockers(working) : []), [working])

  if (loadError) return <p className="p-6 text-sm text-destructive">{loadError}</p>
  if (!original || !working || !diff)
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>

  const update = (fn: (w: TourWorkingState) => TourWorkingState) => {
    setSaved(false)
    setWorking((w) => w && fn(w))
  }

  const dropProposals = (pairs: EdgePair[]) => {
    const drop = new Set(pairs.map((p) => pairKey(p.a, p.b)))
    setProposals((ps) => ps.filter((p) => !drop.has(pairKey(p.a, p.b))))
  }
  const acceptEdges = (pairs: EdgePair[]) => {
    update((w) => addEdgePairs(w, pairs))
    dropProposals(pairs)
  }
  const onEdgesNodeClick = (id: string) => {
    if (connecting && selectedId && id !== selectedId) {
      update((w) => addEdgePairs(w, [toPair(selectedId, id)]))
      setConnecting(false)
    } else {
      setSelectedId(id)
    }
  }

  const selectNode = (id: string) => {
    setSelectedId(id)
    setArmed(null)
    setFocus(null)
  }
  const switchMode = (m: Mode) => {
    setMode(m)
    setArmed(null)
    // Aim needs a node: fall back to the lobby, then the first node
    if (m === 'Aim' && !selectedId)
      setSelectedId((working.nodes.find((n) => n.is_lobby) ?? working.nodes[0])?.id ?? null)
  }
  const aimNode = working.nodes.find((n) => n.id === selectedId)
  const onAim = (yawRad: number, pitchRad: number) => {
    if (!armed || !selectedId) return
    const { yaw, pitch } = clickToAim(yawRad, pitchRad)
    update((w) =>
      armed.kind === 'edge'
        ? setEdgeAim(w, selectedId, armed.to, { bearing: yaw, pitch })
        : setExhibitAim(w, armed.id, { heading: yaw, pitch })
    )
    setArmed(null)
  }

  const pickLink = (exhibitId: string, nodeId: string | null) =>
    setLinkPending((p) => {
      const rest = { ...p }
      delete rest[exhibitId]
      return nodeId ? { ...rest, [exhibitId]: nodeId } : rest
    })
  const acceptLinks = (ids: string[]) => {
    update((w) => ids.reduce((acc, id) => setExhibitNode(acc, id, linkPending[id]), w))
    setLinkPending((p) => Object.fromEntries(Object.entries(p).filter(([id]) => !ids.includes(id))))
  }
  const aimExhibit = (exhibitId: string, nodeId: string) => {
    const x = working.exhibits.find((e) => e.id === exhibitId)
    setSelectedId(nodeId)
    setMode('Aim')
    setArmed({ kind: 'exhibit', id: exhibitId })
    setFocus(
      x?.tour_heading != null
        ? { yaw: x.tour_heading, pitch: x.tour_pitch ?? 0, n: (focus?.n ?? 0) + 1 }
        : null
    )
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

      {mode === 'Edges' && (
        <EdgesMap
          nodes={working.nodes}
          paths={paths}
          existing={existingPairs}
          proposed={visibleProposals}
          pickedKey={pickedKey}
          selectedId={selectedId}
          onNodeClick={onEdgesNodeClick}
          onPickEdge={setPickedKey}
        />
      )}

      {mode === 'Aim' && aimNode && (
        <div className="absolute inset-0 pl-96">
          <AimViewer
            tilesUrl={aimNode.tiles_url}
            markers={aimMarkers(working, aimNode.id)}
            focus={focus}
            armed={armed !== null}
            onAim={onAim}
          />
        </div>
      )}

      {mode === 'Link' && (
        <LinkMap nodes={working.nodes} exhibits={working.exhibits} pending={linkPending} />
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
                onClick={() => switchMode(m.id)}
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
        {mode === 'Edges' && (
          <EdgesPanel
            nodes={working.nodes}
            selectedId={selectedId}
            proposed={visibleProposals}
            picked={picked}
            connecting={connecting}
            neighbours={(id) => neighbourCount(working, id)}
            onSelect={setSelectedId}
            onPropose={() =>
              setProposals(proposeEdges(working.nodes, paths, { existing: working.edges }))
            }
            onAccept={acceptEdges}
            onReject={dropProposals}
            onRemove={(p) => {
              update((w) => removeEdgePair(w, p.a, p.b))
              setPickedKey(null)
            }}
            onToggleConnect={() => setConnecting((c) => !c)}
          />
        )}
        {mode === 'Aim' && (
          <AimPanel
            working={working}
            selectedId={selectedId}
            armed={armed}
            onSelect={selectNode}
            onArm={setArmed}
            onFocus={(yaw, pitch) => setFocus((f) => ({ yaw, pitch, n: (f?.n ?? 0) + 1 }))}
          />
        )}
        {mode === 'Link' && (
          <LinkPanel
            working={working}
            radiusM={linkRadius}
            pending={linkPending}
            onRadius={setLinkRadius}
            onPropose={() =>
              setLinkPending(
                Object.fromEntries(
                  proposeLinks(working.exhibits, working.nodes, { radiusM: linkRadius }).map(
                    (p) => [p.exhibitId, p.nodeId]
                  )
                )
              )
            }
            onAcceptAll={() => acceptLinks(Object.keys(linkPending))}
            onPick={pickLink}
            onAccept={(id) => acceptLinks([id])}
            onClear={(id) => update((w) => setExhibitNode(w, id, null))}
            onAim={aimExhibit}
          />
        )}
        {mode === 'Save' && (
          <SavePanel
            summary={diff.summary}
            isEmpty={diff.isEmpty}
            blockers={blockers}
            saving={saving}
            error={saveError}
            saved={saved}
            onSave={save}
          />
        )}
      </aside>

      <button
        type="button"
        title="Open the Save tab"
        className="absolute bottom-4 left-1/2 z-20 max-w-xl -translate-x-1/2 rounded-lg border border-border bg-background px-4 py-2 text-sm shadow-lg hover:bg-muted"
        onClick={() => switchMode('Save')}
      >
        {diff.isEmpty ? 'No unsaved changes' : diff.summary}
        {blockers.length > 0 && (
          <span className="ml-2 text-xs text-destructive">· {blockers.length} blocker(s)</span>
        )}
      </button>
    </div>
  )
}
