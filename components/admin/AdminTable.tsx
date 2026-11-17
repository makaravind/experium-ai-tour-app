'use client'

import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  AMENITY_CHECKLIST,
  AMENITY_SORT_KEYS,
  EXHIBIT_CHECKLIST,
  EXHIBIT_SORT_KEYS,
  amenityRows,
  exhibitRows,
  filterAmenityRows,
  filterExhibitRows,
  sortAmenityRows,
  sortExhibitRows,
  type ChecklistKey,
  type TableParams,
} from '@/lib/admin/table'
import type { AdminState, WorkingState } from '@/lib/admin/types'

const selectCls = 'rounded-md border border-border bg-background px-2 py-1 text-sm'

const EXHIBIT_TYPES = ['flora', 'structure', 'water_body', 'landmark']
const AMENITY_TYPES = ['washroom', 'ticketing', 'food', 'gate', 'leisure']
const TIERS = ['gold', 'silver', 'bronze']
const STATUSES = ['live', 'coming_soon', 'disabled']
const CHECKLIST_LABEL: Record<ChecklistKey, string> = {
  name: 'Name',
  description: 'Description',
  facts: 'Facts',
  audio: 'Audio (EN+HI)',
  photos: 'Photos',
}

interface Props {
  original: AdminState
  working: WorkingState
  params: TableParams
  /** Patch the URL query: a string sets a key, '' / null removes it. */
  onParams: (patch: Record<string, string | null>) => void
  selectedId: string | null // exhibit or amenity id
  onSelect: (id: string) => void
  toolbarLeft?: React.ReactNode
}

function Checklist({
  done,
  total,
  items,
  checklist,
}: {
  done: number
  total: number
  items: ChecklistKey[]
  checklist: Record<ChecklistKey, boolean>
}) {
  return (
    <span className="flex items-center gap-2">
      <span className={done === total ? 'text-foreground' : 'text-muted-foreground'}>
        {done}/{total}
      </span>
      <span className="flex gap-0.5">
        {items.map((k) => (
          <span
            key={k}
            title={`${CHECKLIST_LABEL[k]}: ${checklist[k] ? 'filled' : 'missing'}`}
            className={`inline-block size-2 rounded-full ${checklist[k] ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
          />
        ))}
      </span>
    </span>
  )
}

export default function AdminTable({
  original,
  working,
  params,
  onParams,
  selectedId,
  onSelect,
  toolbarLeft,
}: Props) {
  const isExhibits = params.tab === 'exhibits'

  // search box edits locally and reaches the URL after a short pause
  const [q, setQ] = useState(params.q)
  useEffect(() => setQ(params.q), [params.q])
  useEffect(() => {
    if (q === params.q) return
    const t = setTimeout(() => onParams({ q: q || null }), 250)
    return () => clearTimeout(t)
  }, [q, params.q, onParams])

  const exRows = useMemo(() => exhibitRows(working, original), [working, original])
  const amRows = useMemo(() => amenityRows(working, original), [working, original])
  const shownEx = useMemo(
    () => sortExhibitRows(filterExhibitRows(exRows, params), params),
    [exRows, params]
  )
  const shownAm = useMemo(
    () => sortAmenityRows(filterAmenityRows(amRows, params), params),
    [amRows, params]
  )

  const letters = working.sections.map((s) => s.id).sort()
  const missingKeys = isExhibits ? EXHIBIT_CHECKLIST : AMENITY_CHECKLIST
  const sortKeys: readonly string[] = isExhibits ? EXHIBIT_SORT_KEYS : AMENITY_SORT_KEYS
  const defaultSort = isExhibits ? 'id' : 'section'
  const activeSort = sortKeys.includes(params.sort) ? params.sort : defaultSort
  const filtered = !!(
    params.q ||
    params.section ||
    params.status ||
    params.type ||
    params.tier ||
    params.missing
  )

  const sortBy = (key: string) =>
    onParams(
      key === activeSort
        ? { sort: key, dir: params.dir === 'asc' ? 'desc' : 'asc' }
        : { sort: key, dir: null }
    )

  const th = (k: string | undefined, label: string) => (
    <th
      key={label || 'blank'}
      className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground"
    >
      {k ? (
        <button type="button" className="hover:text-foreground" onClick={() => sortBy(k)}>
          {label}
          {k === activeSort ? (params.dir === 'asc' ? ' ▲' : ' ▼') : ''}
        </button>
      ) : (
        label
      )}
    </th>
  )

  const rowCls = (id: string) =>
    `cursor-pointer border-b border-border hover:bg-muted/50 ${id === selectedId ? 'bg-muted' : ''}`
  const dot = (changed: boolean) =>
    changed ? (
      <span title="Unsaved change" className="inline-block size-2 rounded-full bg-amber-500" />
    ) : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        {toolbarLeft}
        <div className="flex gap-1">
          {(['exhibits', 'amenities'] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={t === params.tab ? 'default' : 'ghost'}
              // filters differ per tab (types, checklist), so switching starts clean
              onClick={() =>
                onParams({
                  tab: t === 'exhibits' ? null : t,
                  q: null,
                  section: null,
                  status: null,
                  type: null,
                  tier: null,
                  missing: null,
                  sort: null,
                  dir: null,
                })
              }
            >
              {t === 'exhibits' ? `Exhibits (${exRows.length})` : `Amenities (${amRows.length})`}
            </Button>
          ))}
        </div>
        <input
          className={`${selectCls} w-56`}
          placeholder={isExhibits ? 'Search name, ID, code' : 'Search name'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className={selectCls}
          value={params.section}
          onChange={(e) => onParams({ section: e.target.value || null })}
        >
          <option value="">Section: all</option>
          {letters.map((l) => (
            <option key={l} value={l}>{`Section ${l}`}</option>
          ))}
          <option value="unplaced">Unplaced</option>
        </select>
        {isExhibits && (
          <select
            className={selectCls}
            value={params.status}
            onChange={(e) => onParams({ status: e.target.value || null })}
          >
            <option value="">Status: all</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <select
          className={selectCls}
          value={params.type}
          onChange={(e) => onParams({ type: e.target.value || null })}
        >
          <option value="">Type: all</option>
          {(isExhibits ? EXHIBIT_TYPES : AMENITY_TYPES).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {isExhibits && (
          <select
            className={selectCls}
            value={params.tier}
            onChange={(e) => onParams({ tier: e.target.value || null })}
          >
            <option value="">Tier: all</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <select
          className={selectCls}
          value={params.missing}
          onChange={(e) => onParams({ missing: e.target.value || null })}
        >
          <option value="">Missing: any</option>
          {missingKeys.map((k) => (
            <option key={k} value={k}>{`Missing ${CHECKLIST_LABEL[k].toLowerCase()}`}</option>
          ))}
        </select>
        {filtered && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onParams({
                q: null,
                section: null,
                status: null,
                type: null,
                tier: null,
                missing: null,
              })
            }
          >
            Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {isExhibits
            ? `${shownEx.length} of ${exRows.length}`
            : `${shownAm.length} of ${amRows.length}`}
        </span>
      </div>

      {/* bottom padding keeps the last rows clear of the floating save bar */}
      <div className="flex-1 overflow-auto pb-28">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-background shadow-[0_1px_0_var(--border)]">
            {isExhibits ? (
              <tr>
                {th('id', 'ID')}
                {th('code', 'Code')}
                {th('name', 'Name')}
                {th('section', 'Section')}
                {th('type', 'Type')}
                {th('tier', 'Tier')}
                {th('status', 'Status')}
                {th('checklist', 'Checklist')}
                {th(undefined, 'TE')}
                {th(undefined, '')}
              </tr>
            ) : (
              <tr>
                {th('name', 'Name')}
                {th('type', 'Type')}
                {th('section', 'Section')}
                {th('checklist', 'Checklist')}
                {th(undefined, '')}
              </tr>
            )}
          </thead>
          <tbody>
            {isExhibits
              ? shownEx.map((r) => (
                  <tr
                    key={r.exhibit.id}
                    className={rowCls(r.exhibit.id)}
                    onClick={() => onSelect(r.exhibit.id)}
                  >
                    <td className="px-3 py-2">{r.displayId}</td>
                    <td className="px-3 py-2">{r.exhibit.code ?? 'New'}</td>
                    <td className="px-3 py-2">
                      {r.exhibit.name || <span className="text-muted-foreground">Untitled</span>}
                    </td>
                    <td className="px-3 py-2">{r.exhibit.section ?? '—'}</td>
                    <td className="px-3 py-2">{r.exhibit.type ?? '—'}</td>
                    <td className="px-3 py-2">{r.exhibit.tier}</td>
                    <td className="px-3 py-2">{r.exhibit.status}</td>
                    <td className="px-3 py-2">
                      <Checklist
                        done={r.done}
                        total={r.total}
                        items={EXHIBIT_CHECKLIST}
                        checklist={r.checklist}
                      />
                    </td>
                    <td className="px-3 py-2">{r.te ? '✓' : ''}</td>
                    <td className="px-3 py-2">{dot(r.changed)}</td>
                  </tr>
                ))
              : shownAm.map((r) => (
                  <tr
                    key={r.amenity.id}
                    className={rowCls(r.amenity.id)}
                    onClick={() => onSelect(r.amenity.id)}
                  >
                    <td className="px-3 py-2">
                      {r.amenity.name || <span className="text-muted-foreground">Untitled</span>}
                    </td>
                    <td className="px-3 py-2">{r.amenity.type}</td>
                    <td className="px-3 py-2">{r.amenity.section ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Checklist
                        done={r.done}
                        total={r.total}
                        items={AMENITY_CHECKLIST}
                        checklist={r.checklist}
                      />
                    </td>
                    <td className="px-3 py-2">{dot(r.changed)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
        {(isExhibits ? shownEx.length : shownAm.length) === 0 && (
          <p className="p-6 text-sm text-muted-foreground">No rows match.</p>
        )}
      </div>
    </div>
  )
}
