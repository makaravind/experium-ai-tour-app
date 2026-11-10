'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { addPhoto, exhibitPhotos, removePhoto, reorder, setCaption, setHero } from '@/lib/admin/photos'
import type { AdminExhibit, AdminPhoto } from '@/lib/admin/types'

interface Props {
  exhibit: AdminExhibit
  /** All exhibits' photo rows; this panel only shows/edits `exhibit.id`'s. */
  photos: AdminPhoto[]
  /** Full photo list for this exhibit after the edit (parent merges). */
  onChange: (next: AdminPhoto[]) => void
}

export default function PhotosPanel({ exhibit, photos, onChange }: Props) {
  const list = exhibitPhotos(photos, exhibit.id)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)

  // An upload resolves later; append to the list as it is then, not as it was at click time.
  const latest = useRef(list)
  useEffect(() => {
    latest.current = list
  })

  async function upload(file: File) {
    if (exhibit.code === null) return
    setUploading(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('code', String(exhibit.code))
      const res = await fetch('/api/admin/upload-photo', { method: 'POST', body })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Upload failed (${res.status})`)
      onChange(addPhoto(latest.current, { id: crypto.randomUUID(), exhibit_id: exhibit.id, url: json.url }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <label
          className={`inline-flex h-8 items-center rounded-lg border px-2.5 text-sm font-medium ${
            exhibit.code === null || uploading ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-muted'
          }`}
        >
          {uploading ? 'Uploading…' : 'Upload photo'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={exhibit.code === null || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void upload(file)
            }}
          />
        </label>
        {exhibit.code === null && <span className="text-xs text-muted-foreground">Save the exhibit first</span>}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>

      {list.length === 0 && <p className="text-sm text-muted-foreground">No photos</p>}

      <ul className="flex flex-col gap-2">
        {list.map((p, i) => (
          <li
            key={p.id}
            draggable
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragFrom !== null) onChange(reorder(list, dragFrom, i))
              setDragFrom(null)
            }}
            onDragEnd={() => setDragFrom(null)}
            className={`flex cursor-grab items-center gap-3 rounded-lg border p-2 ${dragFrom === i ? 'opacity-50' : ''}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption ?? ''} className="size-16 shrink-0 rounded object-cover" draggable={false} />
            <input
              type="text"
              value={p.caption ?? ''}
              placeholder="Caption"
              onChange={(e) => onChange(setCaption(list, p.id, e.target.value))}
              className="h-8 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm"
            />
            <label className="flex items-center gap-1 text-xs whitespace-nowrap">
              <input type="radio" name={`hero-${exhibit.id}`} checked={p.is_hero} onChange={() => onChange(setHero(list, p.id))} />
              Hero
            </label>
            <Button type="button" variant="destructive" size="sm" onClick={() => onChange(removePhoto(list, p.id))}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
