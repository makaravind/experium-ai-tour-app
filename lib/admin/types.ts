import type { AmenityType, Fact, Language } from '@/lib/types'

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

/** `amenities` row as edited in the admin tool. `photos` is never loaded or written. New amenities have a client-generated `id`. */
export interface AdminAmenity {
  id: string
  name: string
  type: AmenityType
  description: string | null
  gps_lat: number
  gps_lng: number
  section: string | null // null = unplaced
}

/** Loaded (original) state. */
export interface AdminState {
  sections: Section[]
  exhibits: AdminExhibit[]
  audio: AdminAudio[]
  photos: AdminPhoto[]
  amenities: AdminAmenity[]
}

/** Client working state; same as AdminState but sections carry `originalId`. */
export interface WorkingState extends Omit<AdminState, 'sections'> {
  sections: WorkingSection[]
}

/** Exhibit entry in the save payload: full row (minus `code`) for a new exhibit, `id` + changed keys for an existing one. */
export type ExhibitChange = { id: string } & Partial<Omit<AdminExhibit, 'id' | 'code'>>

/** Audio entry in the save payload: full row for a new (exhibit, language), changed keys otherwise. `url` is stored in exhibit_audio.audio_url. */
export interface AudioChange {
  exhibit_id: string
  language: Language
  script?: string | null
  status?: string
  url?: string | null
}

/** `id` + changed keys of an existing photo. */
export type PhotoUpdate = { id: string } & Partial<Pick<AdminPhoto, 'url' | 'caption' | 'is_hero' | 'sort_order'>>

/** Amenity entry in the save payload: full row for a new amenity, `id` + changed keys for an existing one. */
export type AmenityChange = { id: string } & Partial<Omit<AdminAmenity, 'id'>>

/**
 * Payload for POST /api/admin/save → admin_apply_changes(jsonb); mirrors the input
 * shape documented in supabase/migrations/20261110000100_sections.sql.
 * Exhibits whose only change is a section rename are omitted (ON UPDATE CASCADE).
 * `section` and `number` are always sent together when either changes.
 * An existing amenity sends `gps_lat`/`gps_lng`/`section` whenever its position or section changes.
 */
export interface Changeset {
  sections: {
    rename: { from: string; to: string }[]
    upsert: Section[] // new or reshaped; `id` is the post-rename id
    delete: string[]
  }
  exhibits: ExhibitChange[] // code is never sent; new rows get max(code)+1
  audio: AudioChange[]
  photos: {
    insert: AdminPhoto[]
    update: PhotoUpdate[]
    delete: string[] // photo ids
  }
  amenities: {
    upsert: AmenityChange[]
    delete: string[] // amenity ids
  }
}
