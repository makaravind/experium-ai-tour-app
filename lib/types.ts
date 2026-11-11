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

/** Where the visitor left the virtual tour; persisted so the map can recentre on it and pin it. */
export interface TourSpot {
  nodeId: string
  lat: number
  lng: number
  /** view direction on exit, degrees (panos aren't north-aligned, so this is not a compass bearing) */
  heading: number
  label: string
  /** Date.now() when written */
  at: number
  /** the map already flew to this spot, so a reload doesn't fly again */
  flown?: boolean
}

/** One `exhibit_photos` row; array order is `sort_order`. */
export interface ExhibitPhoto {
  url: string
  caption: string | null
  is_hero: boolean
}

/** One exhibit row in the upfront-precached dataset (gh-64), with audio for every published language. */
export interface CachedExhibit {
  id: string
  code: string | null // exhibits.code as text (the /s/<code> URL segment); null if unassigned
  status: 'active' | 'coming_soon'
  name: string
  type: string | null
  tier: string
  facts: Fact[]
  audio: Partial<Record<Language, string>> // published audio_url per language
  gps_lat: number | null
  gps_lng: number | null
  exhibitStatus: ExhibitStatus // exhibits.status; `status` above is the same, as active/coming_soon
  displayId: string // `${section}${number}` e.g. 'K1'; park reference shown to visitors
  tour_node_id: string | null // linked 360° node; null if the exhibit has no tour view
  tour_heading: number | null // yaw in degrees when entering the node from this exhibit
  tour_pitch: number | null
  tour_preview_url: string | null // tour_nodes.preview_url, precached for the gallery slide
  photos: ExhibitPhoto[] // exhibit_photos by sort_order
}

export type AmenityType = 'washroom' | 'ticketing' | 'food' | 'gate' | 'leisure'

/** One amenity row in the persisted dataset. `photos` is carried but the UI ignores the URLs (v1). */
export interface CachedAmenity {
  id: string
  name: string
  type: AmenityType
  description: string | null
  photos: string[]
  gps_lat: number
  gps_lng: number
  section: string
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
  displayId: string
  facts: Fact[]
  tour_node_id?: string | null
  tour_heading?: number | null
  tour_pitch?: number | null
  tour_preview_url?: string | null
  photos?: ExhibitPhoto[]
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
  displayId: string | null // null when the exhibit page opens before the dataset is cached
  tour_node_id?: string | null
  tour_heading?: number | null
  tour_pitch?: number | null
  tour_preview_url?: string | null
  photos?: ExhibitPhoto[]
}
