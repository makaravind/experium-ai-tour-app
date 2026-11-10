'use client'

import { useEffect, useMemo, useState } from 'react'

import AdminMap from '@/components/admin/AdminMap'
import AmenityPanel from '@/components/admin/AmenityPanel'
import AudioPanel from '@/components/admin/AudioPanel'
import DetailsPanel from '@/components/admin/DetailsPanel'
import PhotosPanel from '@/components/admin/PhotosPanel'
import { Button } from '@/components/ui/button'
import { buildChangeset } from '@/lib/admin/changeset'
import type { AdminState, WorkingState } from '@/lib/admin/types'
import { unplacedAmenityMessage, unplacedMessage } from '@/lib/admin/validation'
import {
  deleteAmenity, replaceAmenity, replaceExhibit, replaceExhibitPhotos, toWorking, upsertAudio,
} from '@/lib/admin/working'

const TABS = ['Details', 'Audio', 'Photos'] as const
type Tab = (typeof TABS)[number]

async function fetchState(): Promise<AdminState> {
  const res = await fetch('/api/admin/data')
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error ?? `Load failed (${res.status})`)
  return json
}

export default function AdminPage() {
  const [original, setOriginal] = useState<AdminState | null>(null)
  const [working, setWorking] = useState<WorkingState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedAmenityId, setSelectedAmenityId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('Details')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [panelError, setPanelError] = useState<string | null>(null)

  const apply = (state: AdminState) => {
    setOriginal(state)
    setWorking(toWorking(state))
  }

  useEffect(() => {
    fetchState().then(apply, (e) => setLoadError(e instanceof Error ? e.message : String(e)))
  }, [])

  const diff = useMemo(() => (original && working ? buildChangeset(original, working) : null), [original, working])

  // saved letters of sections deleted this session (in the original, no longer in working)
  const deletedSectionIds = useMemo(() => {
    if (!original || !working) return []
    const kept = new Set(working.sections.map((s) => s.originalId))
    return original.sections.map((s) => s.id).filter((id) => !kept.has(id))
  }, [original, working])

  // original rows of amenities deleted this session (in the original, no longer in working)
  const deletedAmenities = useMemo(() => {
    if (!original || !working) return []
    const kept = new Set(working.amenities.map((a) => a.id))
    return original.amenities.filter((a) => !kept.has(a.id))
  }, [original, working])

  const unplaced = useMemo(() => (working ? unplacedMessage(working.exhibits) : null), [working])
  const unplacedAmenity = useMemo(() => (working ? unplacedAmenityMessage(working.amenities) : null), [working])

  if (loadError) return <p className="p-6 text-sm text-destructive">{loadError}</p>
  if (!original || !working || !diff) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>

  const selected = working.exhibits.find((e) => e.id === selectedId) ?? null
  const selectedAmenity = working.amenities.find((a) => a.id === selectedAmenityId) ?? null

  async function save() {
    if (!working || !diff) return
    setSaving(true)
    setSaveError(null)
    setSaved(null)
    try {
      const res = await fetch('/api/admin/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diff.changeset),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setSaveError(json?.error ?? `Save failed (${res.status})`)
        return
      }
      const created: { id: string; code: number }[] = json?.exhibits_created ?? []
      const names = new Map(working.exhibits.map((e) => [e.id, e.name]))
      setSaved(
        created.length
          ? `Saved. New codes: ${created.map((c) => `${names.get(c.id) ?? c.id} → ${c.code}`).join(', ')}`
          : 'Saved.',
      )
      setSelectedId(null)
      setSelectedAmenityId(null)
      try {
        apply(await fetchState())
      } catch (e) {
        setSaveError(`Saved, but reload failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  function discard() {
    if (!original || !window.confirm('Discard all unsaved changes?')) return
    setWorking(toWorking(original))
    setSaveError(null)
    setSaved(null)
  }

  return (
    <div className="fixed inset-0">
      <AdminMap
        sections={working.sections}
        exhibits={working.exhibits}
        deletedSectionIds={deletedSectionIds}
        onSectionsChange={(sections) => setWorking((w) => w && { ...w, sections })}
        onExhibitsChange={(exhibits) => setWorking((w) => w && { ...w, exhibits })}
        amenities={working.amenities}
        onAmenitiesChange={(amenities) => setWorking((w) => w && { ...w, amenities })}
        deletedAmenities={deletedAmenities}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id)
          setPanelError(null)
        }}
        selectedAmenityId={selectedAmenityId}
        onSelectAmenity={(id) => {
          setSelectedAmenityId(id)
          setPanelError(null)
        }}
      />

      {selectedAmenity && (
        <aside className="absolute bottom-0 right-0 top-0 z-10 flex w-96 flex-col border-l border-border bg-background shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {`${selectedAmenity.type[0].toUpperCase()}${selectedAmenity.type.slice(1)} · ${selectedAmenity.section ?? 'unplaced'}`}
            </p>
            <h2 className="truncate text-base font-semibold">{selectedAmenity.name || 'Untitled amenity'}</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <AmenityPanel
              amenity={selectedAmenity}
              onChange={(next) => setWorking((w) => w && { ...w, amenities: replaceAmenity(w.amenities, next) })}
              onDelete={() => {
                setWorking((w) => w && { ...w, amenities: deleteAmenity(w.amenities, selectedAmenity.id) })
                setSelectedAmenityId(null)
              }}
              onValidityChange={setPanelError}
            />
          </div>
        </aside>
      )}

      {selected && (
        <aside className="absolute bottom-0 right-0 top-0 z-10 flex w-96 flex-col border-l border-border bg-background shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {selected.section && selected.number !== null ? `${selected.section}${selected.number}` : 'Unplaced'}
            </p>
            <h2 className="truncate text-base font-semibold">{selected.name || 'Untitled exhibit'}</h2>
            <div className="mt-2 flex gap-1">
              {TABS.map((t) => (
                <Button key={t} size="sm" variant={t === tab ? 'default' : 'ghost'} onClick={() => setTab(t)}>
                  {t}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'Details' && (
              <DetailsPanel
                exhibit={selected}
                exhibits={working.exhibits}
                onChange={(next) => setWorking((w) => w && { ...w, exhibits: replaceExhibit(w.exhibits, next) })}
                onValidityChange={setPanelError}
              />
            )}
            {tab === 'Audio' && (
              <AudioPanel
                exhibit={selected}
                audio={working.audio}
                onChange={(next) => setWorking((w) => w && { ...w, audio: upsertAudio(w.audio, next) })}
              />
            )}
            {tab === 'Photos' && (
              <PhotosPanel
                exhibit={selected}
                photos={working.photos}
                onChange={(next) =>
                  setWorking((w) => w && { ...w, photos: replaceExhibitPhotos(w.photos, selected.id, next) })
                }
              />
            )}
          </div>
        </aside>
      )}

      <div className="absolute bottom-4 left-1/2 z-20 flex max-w-xl -translate-x-1/2 flex-col gap-1 rounded-lg border border-border bg-background px-4 py-2 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-sm">{diff.isEmpty ? 'No unsaved changes' : diff.summary}</span>
          <Button size="sm" variant="outline" disabled={diff.isEmpty || saving} onClick={discard}>
            Discard
          </Button>
          <Button size="sm" disabled={diff.isEmpty || saving || unplaced !== null || unplacedAmenity !== null || panelError !== null} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
        {diff.changeset.sections.rename.length > 0 && (
          <p className="text-xs text-muted-foreground">Renaming a section letter changes what visitors see.</p>
        )}
        {panelError && <p className="text-xs text-destructive">Fix invalid fields before saving: {panelError}</p>}
        {unplaced && <p className="text-xs text-destructive">{unplaced}</p>}
        {unplacedAmenity && <p className="text-xs text-destructive">{unplacedAmenity}</p>}
        {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        {saved && !saveError && <p className="text-xs text-muted-foreground">{saved}</p>}
      </div>
    </div>
  )
}
