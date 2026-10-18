export type Language = 'en' | 'hi' | 'te'

export type ExhibitStatus = 'live' | 'coming_soon'

export interface User {
  name: string
  phone: string
  email: string
}

/** `exhibits.facts` is a jsonb array shaped `[{ fact: "..." }]` */
export interface Fact {
  fact: string
}

/** One exhibit row in the upfront-precached dataset (gh-64), with audio for every published language. */
export interface CachedExhibit {
  id: string
  code: string | null // exhibit_qr_codes.code; null if no active QR yet
  status: 'active' | 'coming_soon'
  name: string
  type: string | null
  tier: string
  facts: Fact[]
  audio: Partial<Record<Language, string>> // published audio_url per language
  gps_lat: number | null
  gps_lng: number | null
  exhibitStatus: ExhibitStatus // exhibits.status; `status` above means QR active
}

export type AmenityType = 'washroom' | 'ticketing' | 'food' | 'gate'

/** One amenity row in the persisted dataset. `photos` is carried but the UI ignores the URLs (v1). */
export interface CachedAmenity {
  id: string
  name: string
  type: AmenityType
  description: string | null
  photos: string[]
  gps_lat: number
  gps_lng: number
}

export interface ExhibitData {
  name: string
  type: string | null
  tier: string
  facts: Fact[]
}

/** A row of the `exhibit_audio` relation, as selected on the visitor page. */
export interface ExhibitAudio {
  language: string
  audio_url: string | null
  status: string
}

/** Minimal exhibit shape for map pins and the Preview bottom sheet. */
export interface MapExhibit {
  id: string
  name: string
  type: string | null
  tier: string
  gps_lat: number
  gps_lng: number
  qr_code: string | null
  languages: string[]
  status: ExhibitStatus
}

/** Exhibit shape used by PreviewSheet — no GPS needed. */
export interface PreviewExhibit {
  id: string
  name: string
  type: string | null
  tier: string
  qr_code: string | null
  facts?: Fact[] | null
  languages?: string[]
}
