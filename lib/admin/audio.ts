import type { Language } from '@/lib/types'
import type { AdminAudio } from './types'

export const AUDIO_LANGUAGES: Language[] = ['en', 'hi', 'te']
export const AUDIO_STATUSES = ['draft', 'ready', 'published']

/** Row for (exhibit, lang) from `audio`, or an empty draft if none exists yet. */
export function audioRow(audio: AdminAudio[], exhibitId: string, language: Language): AdminAudio {
  return (
    audio.find((a) => a.exhibit_id === exhibitId && a.language === language) ?? {
      exhibit_id: exhibitId,
      language,
      script: null,
      audio_url: null,
      status: 'draft',
    }
  )
}

/** POST the file to /api/admin/upload-audio; resolves to the stored MP3's public URL, throws the server's error verbatim. */
export async function uploadAudio(code: number, language: Language, file: File): Promise<string> {
  const body = new FormData()
  body.set('file', file)
  body.set('code', String(code))
  body.set('lang', language)
  const res = await fetch('/api/admin/upload-audio', { method: 'POST', body })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.url) throw new Error(json?.error ?? `Upload failed (${res.status})`)
  return json.url
}
