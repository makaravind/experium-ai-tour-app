'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AUDIO_LANGUAGES, AUDIO_STATUSES, audioRow, uploadAudio } from '@/lib/admin/audio'
import type { AdminAudio, AdminExhibit } from '@/lib/admin/types'
import type { Language } from '@/lib/types'

interface Props {
  exhibit: AdminExhibit
  /** All exhibits' rows; filtered by exhibit.id here. */
  audio: AdminAudio[]
  onChange: (next: AdminAudio) => void
}

export default function AudioPanel({ exhibit, audio, onChange }: Props) {
  const [uploading, setUploading] = useState<Language | null>(null)
  const [errors, setErrors] = useState<Partial<Record<Language, string>>>({})
  const inputs = useRef<Partial<Record<Language, HTMLInputElement | null>>>({})
  // Edits made while an upload is in flight must not be overwritten when it lands.
  const latest = useRef(audio)
  latest.current = audio

  async function upload(language: Language, file: File) {
    if (exhibit.code === null) return
    setUploading(language)
    setErrors((e) => ({ ...e, [language]: undefined }))
    try {
      const url = await uploadAudio(exhibit.code, language, file)
      onChange({ ...audioRow(latest.current, exhibit.id, language), audio_url: url })
    } catch (e) {
      setErrors((prev) => ({ ...prev, [language]: e instanceof Error ? e.message : String(e) }))
    } finally {
      setUploading(null)
    }
  }

  return (
    <div className="space-y-4">
      {AUDIO_LANGUAGES.map((lang) => {
        const row = audioRow(audio, exhibit.id, lang)
        const busy = uploading === lang
        return (
          <section key={lang} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase">{lang}</h3>
              <select
                aria-label={`${lang} status`}
                value={row.status}
                onChange={(e) => onChange({ ...row, status: e.target.value })}
                className="h-7 rounded-md border border-border bg-background px-2 text-sm"
              >
                {AUDIO_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              aria-label={`${lang} script`}
              value={row.script ?? ''}
              onChange={(e) => onChange({ ...row, script: e.target.value })}
              rows={5}
              className="w-full rounded-md border border-border bg-background p-2 text-sm"
            />
            {row.audio_url && <audio controls src={row.audio_url} className="w-full" />}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={exhibit.code === null || busy}
                onClick={() => inputs.current[lang]?.click()}
              >
                {busy ? 'Uploading…' : row.audio_url ? 'Replace audio' : 'Upload audio'}
              </Button>
              <input
                ref={(el) => {
                  inputs.current[lang] = el
                }}
                type="file"
                accept=".wav,.mp3,audio/wav,audio/x-wav,audio/mpeg"
                aria-label={`${lang} audio file`}
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void upload(lang, file)
                }}
              />
              {exhibit.code === null && <span className="text-xs text-muted-foreground">Save the exhibit first</span>}
              {busy && <span className="text-xs text-muted-foreground">Converting and uploading…</span>}
            </div>
            {errors[lang] && <p className="text-xs text-destructive">{errors[lang]}</p>}
          </section>
        )
      })}
    </div>
  )
}
