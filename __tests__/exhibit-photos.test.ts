import { describe, it, expect } from 'vitest'
import { galleryPhotos, thumbUrl } from '@/lib/exhibit-photos'
import type { ExhibitPhoto } from '@/lib/types'

const photo = (n: number, is_hero = false): ExhibitPhoto => ({
  url: `https://cdn.test/p${n}.webp`,
  caption: `cap ${n}`,
  is_hero,
})
const TOUR = 'https://cdn.test/tour.webp'
const p = (n: number) => ({
  kind: 'photo',
  url: `https://cdn.test/p${n}.webp`,
  caption: `cap ${n}`,
})

describe('galleryPhotos', () => {
  it('hero → 360° → rest by sort order', () => {
    const photos = [photo(1), photo(2, true), photo(3)]
    expect(galleryPhotos({ tour_preview_url: TOUR, photos })).toEqual([
      p(2),
      { kind: 'tour', url: TOUR },
      p(1),
      p(3),
    ])
  })

  it('no hero: 360° first, then photos by sort order', () => {
    expect(galleryPhotos({ tour_preview_url: TOUR, photos: [photo(1), photo(2)] })).toEqual([
      { kind: 'tour', url: TOUR },
      p(1),
      p(2),
    ])
  })

  it('hero without tour: hero then rest', () => {
    expect(galleryPhotos({ tour_preview_url: null, photos: [photo(1), photo(2, true)] })).toEqual([
      p(2),
      p(1),
    ])
  })

  it('photos only, no hero: sort order', () => {
    expect(galleryPhotos({ photos: [photo(1), photo(2)] })).toEqual([p(1), p(2)])
  })

  it('tour only', () => {
    expect(galleryPhotos({ tour_preview_url: TOUR, photos: [] })).toEqual([
      { kind: 'tour', url: TOUR },
    ])
  })

  it('nothing → empty', () => {
    expect(galleryPhotos({ tour_preview_url: null, photos: [] })).toEqual([])
    expect(galleryPhotos({})).toEqual([])
  })
})

describe('thumbUrl', () => {
  it('hero beats 360° and other photos', () => {
    expect(thumbUrl({ tour_preview_url: TOUR, photos: [photo(1), photo(2, true)] })).toBe(
      photo(2).url
    )
  })

  it('no hero: 360° beats first photo', () => {
    expect(thumbUrl({ tour_preview_url: TOUR, photos: [photo(1)] })).toBe(TOUR)
  })

  it('no hero, no tour: first photo', () => {
    expect(thumbUrl({ tour_preview_url: null, photos: [photo(1), photo(2)] })).toBe(photo(1).url)
  })

  it('nothing → null', () => {
    expect(thumbUrl({ tour_preview_url: null, photos: [] })).toBeNull()
    expect(thumbUrl({})).toBeNull()
  })
})
