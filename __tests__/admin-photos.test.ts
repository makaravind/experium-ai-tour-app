import { describe, it, expect } from 'vitest'
import { addPhoto, exhibitPhotos, removePhoto, reorder, setCaption, setHero } from '@/lib/admin/photos'
import type { AdminPhoto } from '@/lib/admin/types'

const photo = (id: string, sort_order: number, is_hero = false, exhibit_id = 'e1'): AdminPhoto => ({
  id, exhibit_id, url: `u/${id}`, caption: null, is_hero, sort_order,
})
const ids = (l: AdminPhoto[]) => l.map((p) => p.id)
const heroes = (l: AdminPhoto[]) => l.filter((p) => p.is_hero).map((p) => p.id)
const orders = (l: AdminPhoto[]) => l.map((p) => p.sort_order)

describe('exhibitPhotos', () => {
  it('filters by exhibit and sorts by sort_order', () => {
    const all = [photo('b', 1), photo('x', 0, true, 'e2'), photo('a', 0, true)]
    expect(ids(exhibitPhotos(all, 'e1'))).toEqual(['a', 'b'])
  })
})

describe('addPhoto', () => {
  it('makes the first photo the hero', () => {
    const next = addPhoto([], { id: 'a', exhibit_id: 'e1', url: 'u/a' })
    expect(heroes(next)).toEqual(['a'])
    expect(next[0]).toMatchObject({ sort_order: 0, caption: null })
  })

  it('appends later photos as non-hero with the next sort_order', () => {
    const next = addPhoto([photo('a', 0, true)], { id: 'b', exhibit_id: 'e1', url: 'u/b' })
    expect(ids(next)).toEqual(['a', 'b'])
    expect(heroes(next)).toEqual(['a'])
    expect(orders(next)).toEqual([0, 1])
  })
})

describe('setCaption', () => {
  it('updates one photo; empty string becomes null', () => {
    const l = [photo('a', 0, true), photo('b', 1)]
    expect(setCaption(l, 'b', 'hi')[1].caption).toBe('hi')
    expect(setCaption(setCaption(l, 'b', 'hi'), 'b', '')[1].caption).toBeNull()
    expect(setCaption(l, 'b', 'hi')[0].caption).toBeNull()
  })
})

describe('setHero', () => {
  it('moves the hero flag, keeping exactly one', () => {
    const next = setHero([photo('a', 0, true), photo('b', 1)], 'b')
    expect(heroes(next)).toEqual(['b'])
  })
})

describe('reorder', () => {
  const l = [photo('a', 0, true), photo('b', 1), photo('c', 2)]

  it('moves forward and backward, normalising sort_order', () => {
    expect(ids(reorder(l, 0, 2))).toEqual(['b', 'c', 'a'])
    expect(ids(reorder(l, 2, 0))).toEqual(['c', 'a', 'b'])
    expect(orders(reorder(l, 0, 2))).toEqual([0, 1, 2])
  })

  it('keeps the hero flag with its photo', () => {
    expect(heroes(reorder(l, 0, 2))).toEqual(['a'])
  })

  it('is a no-op for same or out-of-range indexes', () => {
    expect(ids(reorder(l, 1, 1))).toEqual(['a', 'b', 'c'])
    expect(ids(reorder(l, 5, 0))).toEqual(['a', 'b', 'c'])
  })
})

describe('removePhoto', () => {
  it('removes a non-hero and renumbers', () => {
    const next = removePhoto([photo('a', 0, true), photo('b', 1), photo('c', 2)], 'b')
    expect(ids(next)).toEqual(['a', 'c'])
    expect(orders(next)).toEqual([0, 1])
    expect(heroes(next)).toEqual(['a'])
  })

  it('promotes the first remaining photo when the hero is deleted', () => {
    const next = removePhoto([photo('a', 0), photo('b', 1, true), photo('c', 2)], 'b')
    expect(heroes(next)).toEqual(['a'])
  })

  it('returns an empty list when the last photo is deleted', () => {
    expect(removePhoto([photo('a', 0, true)], 'a')).toEqual([])
  })
})
