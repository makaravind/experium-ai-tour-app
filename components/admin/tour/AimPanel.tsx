'use client'

import { Button } from '@/components/ui/button'
import type { AimTarget } from '@/lib/admin/tour-aim'
import type { AdminTourExhibit, TourWorkingState } from '@/lib/admin/tour-types'

interface AimPanelProps {
  working: TourWorkingState
  selectedId: string | null
  armed: AimTarget | null
  onSelect: (id: string) => void
  onArm: (target: AimTarget | null) => void
  /** Rotate the pano to an already-aimed item (degrees). */
  onFocus: (yaw: number, pitch: number) => void
}

const rowClass = (on: boolean) =>
  `flex w-full items-center gap-2 border-b border-border px-4 py-2 text-left hover:bg-muted ${
    on ? 'bg-muted ring-1 ring-inset ring-primary' : ''
  }`

function AimStatus({ yaw, pitch }: { yaw: number | null; pitch: number | null }) {
  return yaw === null ? (
    <span className="text-xs text-destructive">✗ unaimed</span>
  ) : (
    <span className="text-xs text-muted-foreground">
      ✓ yaw {yaw}° · pitch {pitch ?? 0}°
    </span>
  )
}

export default function AimPanel({
  working,
  selectedId,
  armed,
  onSelect,
  onArm,
  onFocus,
}: AimPanelProps) {
  const edges = working.edges.filter((e) => e.from_node_id === selectedId)
  const exhibits = working.exhibits.filter((x) => selectedId && x.tour_node_id === selectedId)
  const nodeName = (id: string) => working.nodes.find((n) => n.id === id)?.label ?? id

  const isArmed = (t: AimTarget) => JSON.stringify(armed) === JSON.stringify(t)
  const toggle = (t: AimTarget, yaw: number | null, pitch: number | null) => {
    const same = isArmed(t)
    onArm(same ? null : t)
    if (!same && yaw !== null) onFocus(yaw, pitch ?? 0)
  }

  const exhibitRow = (x: AdminTourExhibit) => {
    const t: AimTarget = { kind: 'exhibit', id: x.id }
    return (
      <li key={x.id}>
        <button
          type="button"
          data-exhibit={x.id}
          className={rowClass(isArmed(t))}
          onClick={() => toggle(t, x.tour_heading, x.tour_pitch)}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">📍 {x.name}</span>
            <AimStatus yaw={x.tour_heading} pitch={x.tour_pitch} />
          </span>
        </button>
      </li>
    )
  }

  return (
    <>
      <div className="space-y-2 border-b border-border px-4 py-3">
        <select
          aria-label="Node"
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
          value={selectedId ?? ''}
          onChange={(e) => onSelect(e.target.value)}
        >
          {working.nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label} ({n.pano_ref})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {armed
            ? 'Now click the target in the panorama (click the item again to cancel).'
            : 'Click an item, then click its target in the panorama.'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <h2 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase text-muted-foreground">
          Outgoing edges ({edges.length})
        </h2>
        <ul>
          {edges.map((e) => {
            const t: AimTarget = { kind: 'edge', to: e.to_node_id }
            return (
              <li key={e.to_node_id} className="flex items-center">
                <button
                  type="button"
                  data-edge={e.to_node_id}
                  className={rowClass(isArmed(t))}
                  onClick={() => toggle(t, e.bearing, e.pitch)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      ➤ {nodeName(e.to_node_id)}
                    </span>
                    <AimStatus yaw={e.bearing} pitch={e.pitch} />
                  </span>
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Go to this node"
                  onClick={() => onSelect(e.to_node_id)}
                >
                  Go →
                </Button>
              </li>
            )
          })}
        </ul>
        <h2 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase text-muted-foreground">
          Exhibits here ({exhibits.length})
        </h2>
        <ul>{exhibits.map(exhibitRow)}</ul>
      </div>
    </>
  )
}
