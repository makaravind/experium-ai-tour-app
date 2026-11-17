import { describe, it, expect } from 'vitest'
import {
  amenityRows,
  exhibitChecklist,
  exhibitRows,
  filterAmenityRows,
  filterExhibitRows,
  parseParams,
  sortAmenityRows,
  sortExhibitRows,
  type TableParams,
} from '@/lib/admin/table'
import type { AdminAmenity, AdminAudio, AdminExhibit, AdminPhoto } from '@/lib/admin/types'

const exhibit = (id: string, over: Partial<AdminExhibit> = {}): AdminExhibit => ({
  id,
  code: 1,
  name: id,
  type: 'flora',
  tier: 'silver',
  status: 'live',
  description: null,
  facts: [],
  gps_lat: null,
  gps_lng: null,
  section: null,
  number: null,
  ...over,
})
const amenity = (id: string, over: Partial<AdminAmenity> = {}): AdminAmenity => ({
  id,
  name: id,
  type: 'washroom',
  description: null,
  gps_lat: 0,
  gps_lng: 0,
  section: 'A',
  ...over,
})
const audio = (
  exhibit_id: string,
  language: AdminAudio['language'],
  audio_url: string | null = 'u'
): AdminAudio => ({
  exhibit_id,
  language,
  script: null,
  audio_url,
  status: 'ready',
})
const photo = (id: string, exhibit_id: string): AdminPhoto => ({
  id,
  exhibit_id,
  url: 'u',
  caption: null,
  is_hero: false,
  sort_order: 0,
})
const params = (over: Partial<TableParams> = {}): TableParams => ({
  ...parseParams(new URLSearchParams()),
  ...over,
})

describe('parseParams', () => {
  it('defaults and reads the query', () => {
    expect(parseParams(new URLSearchParams())).toMatchObject({
      tab: 'exhibits',
      q: '',
      missing: '',
      dir: 'asc',
    })
    expect(
      parseParams(new URLSearchParams('tab=amenities&q=x&missing=audio&dir=desc&section=unplaced'))
    ).toMatchObject({
      tab: 'amenities',
      q: 'x',
      missing: 'audio',
      dir: 'desc',
      section: 'unplaced',
    })
  })
  it('drops an unknown missing key', () => {
    expect(parseParams(new URLSearchParams('missing=bogus')).missing).toBe('')
  })
})

describe('exhibitChecklist', () => {
  const full = exhibit('e', { name: 'N', description: 'D', facts: [{ fact: 'f' }] })
  it('is all false for an empty exhibit', () => {
    expect(
      Object.values(exhibitChecklist(exhibit('e', { name: '  ' }), [], [])).some(Boolean)
    ).toBe(false)
  })
  it('counts audio only when both EN and HI have a url', () => {
    expect(exhibitChecklist(full, [audio('e', 'en')], []).audio).toBe(false)
    expect(exhibitChecklist(full, [audio('e', 'en'), audio('e', 'hi', null)], []).audio).toBe(false)
    expect(exhibitChecklist(full, [audio('e', 'en'), audio('e', 'hi')], []).audio).toBe(true)
  })
  it('ignores blank facts and other exhibits media', () => {
    expect(
      exhibitChecklist(exhibit('e', { facts: [{ fact: ' ' }] }), [], [photo('p', 'x')])
    ).toMatchObject({
      facts: false,
      photos: false,
    })
    expect(exhibitChecklist(full, [], [photo('p', 'e')])).toMatchObject({
      name: true,
      description: true,
      facts: true,
      photos: true,
    })
  })
})

describe('exhibitRows', () => {
  const orig = {
    exhibits: [exhibit('a', { section: 'K', number: 1 }), exhibit('b')],
    audio: [],
    photos: [],
  }
  it('builds display id, score and unsaved flag', () => {
    const working = {
      ...orig,
      exhibits: [orig.exhibits[0], exhibit('b', { name: 'edited' }), exhibit('c')],
      photos: [photo('p', 'a')],
    }
    const rows = exhibitRows(working, orig)
    expect(rows.map((r) => [r.displayId, r.changed])).toEqual([
      ['K1', true],
      ['Unplaced', true],
      ['Unplaced', true],
    ])
    expect(rows[0]).toMatchObject({ done: 2, total: 5 }) // name + photo
    expect(exhibitRows(orig, orig).every((r) => !r.changed)).toBe(true)
  })
})

describe('filterExhibitRows / sortExhibitRows', () => {
  const orig = {
    exhibits: [
      exhibit('a', {
        name: 'Banyan',
        code: 7,
        section: 'K',
        number: 2,
        status: 'live',
        tier: 'gold',
        type: 'flora',
      }),
      exhibit('b', {
        name: 'Fountain',
        code: 8,
        section: 'K',
        number: 1,
        status: 'coming_soon',
        tier: 'bronze',
        type: 'structure',
      }),
      exhibit('c', { name: 'Lotus', code: 9, section: null, status: 'disabled' }),
    ],
    audio: [audio('a', 'en'), audio('a', 'hi')],
    photos: [],
  }
  const rows = exhibitRows(orig, orig)
  const ids = (r: typeof rows) => r.map((x) => x.exhibit.id)

  it('searches name, display id and exact code', () => {
    expect(ids(filterExhibitRows(rows, params({ q: 'ban' })))).toEqual(['a'])
    expect(ids(filterExhibitRows(rows, params({ q: 'k1' })))).toEqual(['b'])
    expect(ids(filterExhibitRows(rows, params({ q: '9' })))).toEqual(['c'])
  })
  it('filters by section (incl. unplaced), status, type, tier', () => {
    expect(ids(filterExhibitRows(rows, params({ section: 'K' })))).toEqual(['a', 'b'])
    expect(ids(filterExhibitRows(rows, params({ section: 'unplaced' })))).toEqual(['c'])
    expect(ids(filterExhibitRows(rows, params({ status: 'coming_soon' })))).toEqual(['b'])
    expect(ids(filterExhibitRows(rows, params({ type: 'flora' })))).toEqual(['a', 'c'])
    expect(ids(filterExhibitRows(rows, params({ tier: 'gold' })))).toEqual(['a'])
  })
  it('missing = rows lacking that checklist item', () => {
    expect(ids(filterExhibitRows(rows, params({ missing: 'audio' })))).toEqual(['b', 'c'])
  })
  it('default sort: section then number, unplaced last; direction and keys', () => {
    expect(ids(sortExhibitRows(rows, params()))).toEqual(['b', 'a', 'c'])
    expect(ids(sortExhibitRows(rows, params({ sort: 'name', dir: 'desc' })))).toEqual([
      'c',
      'b',
      'a',
    ])
    expect(ids(sortExhibitRows(rows, params({ sort: 'bogus' })))).toEqual(['b', 'a', 'c'])
  })
})

describe('amenity rows', () => {
  const orig = {
    amenities: [
      amenity('w', { name: 'Washroom 1', description: 'd' }),
      amenity('g', { name: 'Gate', type: 'gate', section: null }),
    ],
  }
  it('scores name+description, flags edits', () => {
    const working = { amenities: [{ ...orig.amenities[0], name: 'W1' }, orig.amenities[1]] }
    const rows = amenityRows(working, orig)
    expect(rows.map((r) => [r.done, r.total, r.changed])).toEqual([
      [2, 2, true],
      [1, 2, false],
    ])
  })
  it('filters and sorts; exhibit-only missing keys are ignored', () => {
    const rows = amenityRows(orig, orig)
    const ids = (r: typeof rows) => r.map((x) => x.amenity.id)
    expect(ids(filterAmenityRows(rows, params({ q: 'wash' })))).toEqual(['w'])
    expect(ids(filterAmenityRows(rows, params({ section: 'unplaced' })))).toEqual(['g'])
    expect(ids(filterAmenityRows(rows, params({ type: 'gate' })))).toEqual(['g'])
    expect(ids(filterAmenityRows(rows, params({ missing: 'description' })))).toEqual(['g'])
    expect(ids(filterAmenityRows(rows, params({ missing: 'audio' })))).toEqual(['w', 'g'])
    expect(ids(sortAmenityRows(rows, params()))).toEqual(['w', 'g'])
    expect(ids(sortAmenityRows(rows, params({ sort: 'name' })))).toEqual(['g', 'w'])
  })
})
