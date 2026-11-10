'use client'

import { useEffect, useState } from 'react'
import type { AdminExhibit } from '@/lib/admin/types'
import { parseFacts, validateNumber } from '@/lib/admin/validation'

const TYPES = ['flora', 'structure', 'water_body', 'landmark']
const TIERS = ['gold', 'silver', 'bronze']
const STATUSES = ['live', 'coming_soon']

const inputCls = 'w-full rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-60'

interface Props {
  exhibit: AdminExhibit
  /** All exhibits in the working state (for the duplicate-number check). */
  exhibits: AdminExhibit[]
  onChange: (next: AdminExhibit) => void
  /** Message while number or facts input is invalid (so not applied to the working state), else null. */
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

const formatFacts = (facts: AdminExhibit['facts']) => JSON.stringify(facts, null, 2)

export default function DetailsPanel({ exhibit, exhibits, onChange, onValidityChange }: Props) {
  // Number and facts keep raw text while typing and only emit when valid; reset it when the
  // exhibit changes underneath us (selection change, discard).
  const [numberText, setNumberText] = useState(String(exhibit.number ?? ''))
  const [factsText, setFactsText] = useState(formatFacts(exhibit.facts))
  const [seen, setSeen] = useState({ id: exhibit.id, number: exhibit.number, facts: exhibit.facts })
  if (seen.id !== exhibit.id || seen.number !== exhibit.number || seen.facts !== exhibit.facts) {
    if (seen.id !== exhibit.id || seen.number !== exhibit.number) setNumberText(String(exhibit.number ?? ''))
    if (seen.id !== exhibit.id || seen.facts !== exhibit.facts) setFactsText(formatFacts(exhibit.facts))
    setSeen({ id: exhibit.id, number: exhibit.number, facts: exhibit.facts })
  }

  const numberResult = validateNumber(numberText, exhibit, exhibits)
  const factsResult = parseFacts(factsText)

  const placed = exhibit.section !== null
  const error = placed && !numberResult.ok ? numberResult.error : factsResult.ok ? null : factsResult.error
  useEffect(() => {
    onValidityChange?.(error)
  }, [error]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onValidityChange?.(null), []) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<AdminExhibit>) => onChange({ ...exhibit, ...patch })

  const onNumber = (text: string) => {
    setNumberText(text)
    const r = validateNumber(text, exhibit, exhibits)
    if (r.ok) {
      setSeen((s) => ({ ...s, number: r.value }))
      update({ number: r.value })
    }
  }

  const onFacts = (text: string) => {
    setFactsText(text)
    const r = parseFacts(text)
    if (r.ok) {
      setSeen((s) => ({ ...s, facts: r.value }))
      update({ facts: r.value })
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Code">
          <input className={inputCls} value={exhibit.code ?? 'assigned on save'} disabled readOnly />
        </Field>
        <Field label="Section">
          <input className={inputCls} value={exhibit.section ?? 'unplaced'} disabled readOnly />
        </Field>
        <Field label="Number" error={placed && !numberResult.ok ? numberResult.error : undefined}>
          <input
            className={inputCls}
            inputMode="numeric"
            value={numberText}
            disabled={!placed}
            aria-invalid={placed && !numberResult.ok}
            onChange={(e) => onNumber(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Name">
        <input className={inputCls} value={exhibit.name} onChange={(e) => update({ name: e.target.value })} />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Type">
          <select
            className={inputCls}
            value={exhibit.type ?? ''}
            onChange={(e) => update({ type: e.target.value || null })}
          >
            <option value="">—</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tier">
          <select className={inputCls} value={exhibit.tier} onChange={(e) => update({ tier: e.target.value })}>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputCls} value={exhibit.status} onChange={(e) => update({ status: e.target.value })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Description">
        <textarea
          className={inputCls}
          rows={4}
          value={exhibit.description ?? ''}
          onChange={(e) => update({ description: e.target.value || null })}
        />
      </Field>

      <Field label='Facts (JSON: [{"fact": "..."}])' error={factsResult.ok ? undefined : factsResult.error}>
        <textarea
          className={`${inputCls} font-mono`}
          rows={8}
          spellCheck={false}
          value={factsText}
          aria-invalid={!factsResult.ok}
          onChange={(e) => onFacts(e.target.value)}
        />
      </Field>
    </div>
  )
}
