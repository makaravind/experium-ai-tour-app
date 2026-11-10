'use client'

import { Button } from '@/components/ui/button'
import type { TourWorkingState } from '@/lib/admin/tour-types'

interface LinkPanelProps {
  working: TourWorkingState
  radiusM: number
  /** Proposed (not yet accepted) links: exhibit id → node id. */
  pending: Record<string, string>
  onRadius: (m: number) => void
  onPropose: () => void
  onAcceptAll: () => void
  /** Change a row's proposed node (`null` drops it). */
  onPick: (exhibitId: string, nodeId: string | null) => void
  onAccept: (exhibitId: string) => void
  /** Unlink an exhibit (also drops its aim). */
  onClear: (exhibitId: string) => void
  onAim: (exhibitId: string, nodeId: string) => void
}

export default function LinkPanel({
  working,
  radiusM,
  pending,
  onRadius,
  onPropose,
  onAcceptAll,
  onPick,
  onAccept,
  onClear,
  onAim,
}: LinkPanelProps) {
  const nodeLabel = (id: string) => working.nodes.find((n) => n.id === id)?.label ?? id
  const pendingCount = Object.keys(pending).length

  return (
    <>
      <div className="space-y-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            Radius
            <input
              type="number"
              aria-label="Radius (m)"
              min={1}
              className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
              value={radiusM}
              onChange={(e) => onRadius(Number(e.target.value))}
            />
            m
          </label>
          <Button size="sm" onClick={onPropose}>
            Propose links
          </Button>
          <Button size="sm" variant="outline" disabled={pendingCount === 0} onClick={onAcceptAll}>
            Accept all ({pendingCount})
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Nearest placed node within the radius. Exhibits with no pano nearby stay unlinked.
        </p>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {working.exhibits.map((x) => {
          const proposed = pending[x.id] ?? ''
          return (
            <li
              key={x.id}
              data-exhibit={x.id}
              className="space-y-1 border-b border-border px-4 py-2"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="w-8 text-xs text-muted-foreground">#{x.code}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{x.name}</span>
                {x.gps_lat === null && (
                  <span className="text-xs text-muted-foreground">no GPS</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                {x.tour_node_id ? (
                  <>
                    <span>
                      → {nodeLabel(x.tour_node_id)}{' '}
                      {x.tour_heading !== null ? (
                        <span className="text-muted-foreground">✓ aimed</span>
                      ) : (
                        <span className="text-destructive">✗ unaimed</span>
                      )}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => onAim(x.id, x.tour_node_id!)}>
                      Aim →
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onClear(x.id)}>
                      Clear
                    </Button>
                  </>
                ) : (
                  <span className="text-muted-foreground">not linked</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Proposed node for ${x.name}`}
                  className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                  value={proposed}
                  onChange={(e) => onPick(x.id, e.target.value || null)}
                >
                  <option value="">— no proposal —</option>
                  {working.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label} ({n.pano_ref})
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!proposed}
                  onClick={() => onAccept(x.id)}
                >
                  Accept
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
