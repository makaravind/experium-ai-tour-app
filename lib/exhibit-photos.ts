import type { ExhibitPhoto } from '@/lib/types'

export type GallerySlide =
  { kind: 'photo'; url: string; caption: string | null } | { kind: 'tour'; url: string }

type PhotoSource = { tour_preview_url?: string | null; photos?: ExhibitPhoto[] }

const photoSlide = (p: ExhibitPhoto): GallerySlide => ({
  kind: 'photo',
  url: p.url,
  caption: p.caption,
})

/** Gallery order: hero photo → 360° → remaining photos. No hero: 360° first. Photos are already in sort order. */
export function galleryPhotos({ tour_preview_url, photos = [] }: PhotoSource): GallerySlide[] {
  const hero = photos.find((p) => p.is_hero)
  const rest = photos.filter((p) => p !== hero).map(photoSlide)
  const tour: GallerySlide[] = tour_preview_url ? [{ kind: 'tour', url: tour_preview_url }] : []
  return [...(hero ? [photoSlide(hero)] : []), ...tour, ...rest]
}

/** Thumbnail: hero photo → 360° preview → first photo → null (caller draws the gradient). */
export function thumbUrl({ tour_preview_url, photos = [] }: PhotoSource): string | null {
  return photos.find((p) => p.is_hero)?.url ?? tour_preview_url ?? photos[0]?.url ?? null
}
