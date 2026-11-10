'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import PreviewLightbox from './PreviewLightbox'
import type { TourNode } from '@/lib/tour'

interface PlacePanelProps {
  nodes: TourNode[]
  selectedId: string | null
  onSelect: (id: string) => void
  onLabelChange: (id: string, label: string) => void
  onClearPosition: (id: string) => void
}

export default function PlacePanel({
  nodes,
  selectedId,
  onSelect,
  onLabelChange,
  onClearPosition,
}: PlacePanelProps) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const closePreview = useCallback(() => setPreviewId(null), [])
  const preview = nodes.find((n) => n.id === previewId) ?? null
  const selected = nodes.find((n) => n.id === selectedId) ?? null
  const placed = nodes.filter((n) => n.lat !== null).length

  return (
    <>
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {placed}/{nodes.length} placed · select a node, then click the map
        </p>
        {selected && (
          <div className="mt-2 flex items-center gap-2">
            <input
              aria-label="Node label"
              className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
              value={selected.label}
              onChange={(e) => onLabelChange(selected.id, e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={selected.lat === null}
              onClick={() => onClearPosition(selected.id)}
            >
              Clear position
            </Button>
          </div>
        )}
      </div>
      <ul className="flex-1 overflow-y-auto">
        {nodes.map((n) => (
          <li
            key={n.id}
            className={`flex items-center border-b border-border hover:bg-muted ${
              n.id === selectedId ? 'bg-muted' : ''
            }`}
          >
            <button
              type="button"
              aria-label={`View ${n.label} preview large`}
              onClick={() => setPreviewId(n.id)}
              className="shrink-0 py-2 pl-4"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- dev-only admin thumbnails */}
              <img
                src={n.preview_url}
                alt=""
                className="h-10 w-16 cursor-zoom-in rounded bg-muted object-cover"
              />
            </button>
            <button
              type="button"
              data-node={n.pano_ref}
              onClick={() => onSelect(n.id)}
              className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3 pr-4 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{n.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{n.pano_ref}</span>
              </span>
              <span
                className={n.lat !== null ? 'text-green-600' : 'text-destructive'}
                aria-label={n.lat !== null ? 'placed' : 'not placed'}
              >
                {n.lat !== null ? '✓' : '✗'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {preview && (
        <PreviewLightbox
          src={preview.preview_url}
          label={preview.label}
          panoRef={preview.pano_ref}
          onClose={closePreview}
        />
      )}
    </>
  )
}
