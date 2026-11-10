import { describe, it, expect } from 'vitest'
import { deleteAmenity, replaceAmenity, replaceExhibit, replaceExhibitPhotos, toWorking, upsertAudio } from '@/lib/admin/working'
import type { AdminAmenity, AdminAudio, AdminExhibit, AdminPhoto, AdminState } from '@/lib/admin/types'

const exhibit = (id: string, name = id): AdminExhibit => ({
  id, code: 1, name, type: null, tier: 'silver', status: 'live', description: null, facts: [],
  gps_lat: null, gps_lng: null, section: null, number: null,
})
const amenity = (id: string, name = id): AdminAmenity => ({
  id, name, type: 'washroom', description: null, gps_lat: 0, gps_lng: 0, section: 'A',
})
const audio = (exhibit_id: string, language: AdminAudio['language'], script: string | null = null): AdminAudio => ({
  exhibit_id, language, script, audio_url: null, status: 'draft',
})
const photo = (id: string, exhibit_id: string, sort_order = 0): AdminPhoto => ({
  id, exhibit_id, url: `u/${id}`, caption: null, is_hero: sort_order === 0, sort_order,
})

describe('toWorking', () => {
  it('sets originalId = id on every section and keeps the rest', () => {
    const state: AdminState = {
      sections: [{ id: 'A', polygon: [[0, 0]] }],
      exhibits: [exhibit('e1')], audio: [audio('e1', 'en')], photos: [photo('p1', 'e1')], amenities: [amenity('a1')],
    }
    const w = toWorking(state)
    expect(w.sections).toEqual([{ id: 'A', polygon: [[0, 0]], originalId: 'A' }])
    expect(w.exhibits).toEqual(state.exhibits)
    expect(w.audio).toEqual(state.audio)
    expect(w.photos).toEqual(state.photos)
    expect(w.amenities).toEqual(state.amenities)
  })
})

describe('replaceExhibit', () => {
  it('replaces by id and leaves the others', () => {
    const next = replaceExhibit([exhibit('a'), exhibit('b')], exhibit('b', 'renamed'))
    expect(next.map((e) => e.name)).toEqual(['a', 'renamed'])
  })
})

describe('upsertAudio', () => {
  it('replaces the row with the same (exhibit_id, language)', () => {
    const list = [audio('e1', 'en', 'old'), audio('e1', 'hi')]
    const next = upsertAudio(list, audio('e1', 'en', 'new'))
    expect(next).toHaveLength(2)
    expect(next.find((a) => a.language === 'en')?.script).toBe('new')
  })

  it('appends when no row exists for that pair', () => {
    const next = upsertAudio([audio('e1', 'en'), audio('e2', 'hi')], audio('e2', 'en', 'x'))
    expect(next).toHaveLength(3)
  })
})

describe('replaceExhibitPhotos', () => {
  it('replaces only that exhibit’s photos (removals included)', () => {
    const all = [photo('a', 'e1', 0), photo('b', 'e1', 1), photo('x', 'e2', 0)]
    const next = replaceExhibitPhotos(all, 'e1', [photo('b', 'e1', 0)])
    expect(next.map((p) => p.id).sort()).toEqual(['b', 'x'])
  })

  it('can clear an exhibit’s photos', () => {
    expect(replaceExhibitPhotos([photo('a', 'e1')], 'e1', [])).toEqual([])
  })
})

describe('amenity helpers', () => {
  it('replaceAmenity replaces by id and leaves the others', () => {
    const next = replaceAmenity([amenity('a'), amenity('b')], amenity('b', 'renamed'))
    expect(next.map((a) => a.name)).toEqual(['a', 'renamed'])
  })

  it('deleteAmenity removes by id', () => {
    expect(deleteAmenity([amenity('a'), amenity('b')], 'a').map((a) => a.id)).toEqual(['b'])
  })
})
