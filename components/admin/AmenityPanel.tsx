'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { AdminAmenity } from '@/lib/admin/types'
import type { AmenityType } from '@/lib/types'

const TYPES: AmenityType[] = ['washroom', 'ticketing', 'food', 'gate', 'leisure']

const inputCls = 'w-full rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-60'

interface Props {
  amenity: AdminAmenity
  onChange: (next: AdminAmenity) => void
  /** Stages the delete; Save commits it. */
  onDelete: () => void
  /** Message while the name is blank (so not applied to the working state), else null. */
  onValidityChange?: (error: string | null) => void
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {error && <span className="block text-xs text-destructive">{error}</span>}
    </label>
  )
}

export default function AmenityPanel({ amenity, onChange, onDelete, onValidityChange }: Props) {
  // A blank name is never emitted, so the input shows what the user typed; the working name stays the last valid one.
  const [nameText, setNameText] = useState(amenity.name)
  const [seen, setSeen] = useState({ id: amenity.id, name: amenity.name })
  if (seen.id !== amenity.id || seen.name !== amenity.name) {
    setNameText(amenity.name)
    setSeen({ id: amenity.id, name: amenity.name })
  }

  const error = nameText.trim() === '' ? 'Amenity name is required' : null
  useEffect(() => {
    onValidityChange?.(error)
  }, [error]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onValidityChange?.(null), []) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<AdminAmenity>) => onChange({ ...amenity, ...patch })

  const onName = (text: string) => {
    setNameText(text)
    if (text.trim() !== '') {
      setSeen((s) => ({ ...s, name: text }))
      update({ name: text })
    }
  }

  return (
    <div className="space-y-3 p-3">
      <Field label="Name" error={error ?? undefined}>
        <input className={inputCls} value={nameText} aria-invalid={error !== null} onChange={(e) => onName(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select className={inputCls} value={amenity.type} onChange={(e) => update({ type: e.target.value as AmenityType })}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Section (drag the pin to change)">
          <input className={inputCls} value={amenity.section ?? 'unplaced'} disabled readOnly />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          className={inputCls}
          rows={4}
          value={amenity.description ?? ''}
          onChange={(e) => update({ description: e.target.value || null })}
        />
      </Field>

      <Button variant="destructive" size="sm" onClick={onDelete}>
        Delete amenity
      </Button>
    </div>
  )
}
