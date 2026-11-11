'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { EdgePair } from '@/lib/admin/tour-edges'
import type { TourNode } from '@/lib/tour'

interface EdgesPanelProps {
  nodes: TourNode[]
  selectedId: string | null
  proposed: EdgePair[]
  /** The edge picked on the map, and whether it is a proposal or an existing edge. */
  picked: { pair: EdgePair; kind: 'proposed' | 'existing' } | null
  connecting: boolean
  /** One-way edges lacking a reverse. */
  missingReverse: number
  neighbours: (id: string) => number
  onSelect: (id: string) => void
  onPropose: () => void
  onAccept: (pairs: EdgePair[]) => void
  onReject: (pairs: EdgePair[]) => void
  onRemove: (pair: EdgePair) => void
  onToggleConnect: () => void
  onAddMissingReverses: () => void
}

export default function EdgesPanel({
  nodes,
  selectedId,
  proposed,
  picked,
  connecting,
  missingReverse,
  neighbours,
  onSelect,
  onPropose,
  onAccept,
  onReject,
  onRemove,
  onToggleConnect,
  onAddMissingReverses,
}: EdgesPanelProps) {
  const label = (id: string) => nodes.find((n) => n.id === id)?.pano_ref ?? id
  const placed = nodes.filter((n) => n.lat !== null)
  const [added, setAdded] = useState<number | null>(null)

  return (
    <>
      <div className="space-y-2 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onPropose} disabled={placed.length < 2}>
            Propose edges
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={proposed.length === 0}
            onClick={() => onAccept(proposed)}
          >
            Accept all
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={proposed.length === 0}
            onClick={() => onReject(proposed)}
          >
            Reject all
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {proposed.length} proposed (dashed) · accepted edges are solid · click a line to pick it
        </p>
        {picked && (
          <div className="flex items-center gap-2 rounded border border-border px-2 py-1">
            <span className="flex-1 text-sm">
              {label(picked.pair.a)} – {label(picked.pair.b)}{' '}
              <span className="text-xs text-muted-foreground">({picked.kind})</span>
            </span>
            {picked.kind === 'proposed' ? (
              <>
                <Button size="sm" onClick={() => onAccept([picked.pair])}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => onReject([picked.pair])}>
                  Reject
                </Button>
              </>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => onRemove(picked.pair)}>
                Remove
              </Button>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={connecting ? 'default' : 'outline'}
            disabled={!selectedId}
            onClick={onToggleConnect}
          >
            {connecting ? 'Click target node…' : 'Add edge from selected'}
          </Button>
        </div>
        {missingReverse > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAdded(missingReverse)
                onAddMissingReverses()
              }}
            >
              Add missing reverse edges ({missingReverse})
            </Button>
          </div>
        )}
        {added !== null && (
          <p className="text-xs text-muted-foreground">
            Added {added} reverse edge{added === 1 ? '' : 's'} — aim them in Aim mode
          </p>
        )}
      </div>
      <ul className="flex-1 overflow-y-auto">
        {nodes.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              data-node={n.pano_ref}
              onClick={() => onSelect(n.id)}
              className={`flex w-full items-center gap-3 border-b border-border px-4 py-2 text-left hover:bg-muted ${
                n.id === selectedId ? 'bg-muted' : ''
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{n.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{n.pano_ref}</span>
              </span>
              {n.lat === null ? (
                <span className="text-xs text-muted-foreground">not placed</span>
              ) : (
                <span className="text-sm" aria-label="neighbours">
                  {neighbours(n.id)} ↔
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
