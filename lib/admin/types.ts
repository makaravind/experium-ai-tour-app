import type { Fact, Language } from '@/lib/types'

/** [lng, lat] */
export type LngLat = [number, number]

/** `sections` row. `id` is the section letter (A, B, …). */
export interface Section {
  id: string
  polygon: LngLat[]
}

/** Section in the client's working state. `originalId` = id as loaded from the DB (null if drawn this session); differs from `id` after a letter rename. */
export interface WorkingSection extends Section {
  originalId: string | null
}

/** `exhibits` row as edited in the admin tool. New exhibits have a client-generated `id` and `code: null` (assigned in admin_apply_changes). */
export interface AdminExhibit {
  id: string
  code: number | null
  name: string
  type: string | null
  tier: string
  status: string // 'live' | 'coming_soon'
  description: string | null
  facts: Fact[]
  gps_lat: number | null
  gps_lng: number | null
  section: string | null // null = unplaced
  number: number | null
}

/** `exhibit_audio` row; identified by (exhibit_id, language). */
export interface AdminAudio {
  exhibit_id: string
  language: Language
  script: string | null
  audio_url: string | null
  status: string // 'draft' | 'ready' | 'published'
}

/** `exhibit_photos` row. New photos have a client-generated `id`. */
export interface AdminPhoto {
  id: string
  exhibit_id: string
  url: string
  caption: string | null
  is_hero: boolean
  sort_order: number
}

/** Loaded (original) state. */
export interface AdminState {
  sections: Section[]
  exhibits: AdminExhibit[]
  audio: AdminAudio[]
  photos: AdminPhoto[]
}

/** Client working state; same as AdminState but sections carry `originalId`. */
export interface WorkingState extends Omit<AdminState, 'sections'> {
  sections: WorkingSection[]
}

/**
 * Payload for POST /api/admin/save → admin_apply_changes(jsonb).
 * Apply order: sections.rename → sections.upsert → exhibits.upsert → audio.upsert
 * → photos.delete → photos.upsert → sections.delete.
 * Upserts carry full rows (not partial). Exhibits whose only change is a section
 * rename are omitted (ON UPDATE CASCADE handles them).
 */
export interface Changeset {
  sections: {
    rename: { from: string; to: string }[]
    upsert: Section[] // new or reshaped; `id` is the post-rename id
    delete: string[]
  }
  exhibits: {
    upsert: AdminExhibit[] // code === null → insert with code = max(code)+1
  }
  audio: {
    upsert: AdminAudio[] // conflict target (exhibit_id, language)
  }
  photos: {
    upsert: AdminPhoto[]
    delete: string[] // photo ids
  }
}
