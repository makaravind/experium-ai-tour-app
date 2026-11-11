'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'

interface SavePanelProps {
  summary: string
  isEmpty: boolean
  blockers: string[]
  saving: boolean
  error: string | null
  saved: boolean
  onSave: () => Promise<void>
}

export default function SavePanel({
  summary,
  isEmpty,
  blockers,
  saving,
  error,
  saved,
  onSave,
}: SavePanelProps) {
  const [override, setOverride] = useState(false)
  const blocked = blockers.length > 0 && !override

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
      <section>
        <h2 className="text-xs font-semibold uppercase text-muted-foreground">Changes</h2>
        <p className="text-sm">{isEmpty ? 'No unsaved changes' : summary}</p>
      </section>
      <section>
        <h2 className="text-xs font-semibold uppercase text-muted-foreground">
          Blockers ({blockers.length})
        </h2>
        {blockers.length === 0 ? (
          <p className="text-sm text-muted-foreground">None — the graph is complete.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-4 text-sm text-destructive">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
      </section>
      {blockers.length > 0 && (
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={override}
            onChange={(e) => setOverride(e.target.checked)}
          />
          <span>
            Save work-in-progress anyway. Unaimed edges are not written; the graph stays incomplete.
          </span>
        </label>
      )}
      <Button
        disabled={isEmpty || saving || blocked}
        onClick={() => void onSave().then(() => setOverride(false))}
      >
        {saving ? 'Saving…' : override && blockers.length > 0 ? 'Save anyway' : 'Save'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {saved && !error && <p className="text-xs text-muted-foreground">Saved.</p>}
    </div>
  )
}
