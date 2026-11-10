import { describe, it, expect } from 'vitest'
import { matchesQuery, filterExhibits, matchRange, sortAmenities } from '@/lib/search'
import type { CachedAmenity, MapExhibit } from '@/lib/types'

const ex = (
  id: string,
  name: string,
  displayId = 'Z99',
  tier = 'silver'
): MapExhibit => ({
  id,
  name,
  type: null,
  tier,
  gps_lat: 0,
  gps_lng: 0,
  qr_code: null,
  languages: ['en'],
  status: 'live',
  displayId,
  facts: [],
})

describe('matchesQuery', () => {
  const cases: [string, string, string, boolean][] = [
    ['prefix', 'Banyan Tree', 'ban', true],
    ['middle', 'Banyan Tree', 'yan t', true],
    ['suffix', 'Banyan Tree', 'tree', true],
    ['case-insensitive (upper query)', 'banyan tree', 'BANYAN', true],
    ['empty query', 'Banyan Tree', '', true],
    ['whitespace-only query', 'Banyan Tree', '   ', true],
    ['query is trimmed', 'Banyan Tree', '  tree  ', true],
    ['no match', 'Banyan Tree', 'lotus', false],
  ]

  it.each(cases)('%s', (_label, name, query, expected) => {
    expect(matchesQuery(name, query)).toBe(expected)
  })
})

describe('filterExhibits', () => {
  const list = [ex('1', 'Lotus Pond'), ex('2', 'banyan Tree'), ex('3', 'Amla Grove')]

  it('empty query returns all sorted A-Z by name', () => {
    expect(filterExhibits(list, '').map((e) => e.id)).toEqual(['3', '2', '1'])
  })

  it('narrows on query', () => {
    expect(filterExhibits(list, 'o').map((e) => e.id)).toEqual(['3', '1'])
  })

  it('returns [] on zero matches', () => {
    expect(filterExhibits(list, 'zzz')).toEqual([])
  })

  it('does not mutate the input array', () => {
    const input = [...list]
    filterExhibits(input, '')
    expect(input.map((e) => e.id)).toEqual(['1', '2', '3'])
  })

  it('sorts via localeCompare regardless of case', () => {
    const mixed = [ex('a', 'zebra'), ex('b', 'Apple'), ex('c', 'mango')]
    expect(filterExhibits(mixed, '').map((e) => e.name)).toEqual(['Apple', 'mango', 'zebra'])
  })

  it('matches by displayId prefix, case-insensitive', () => {
    const ids = [
      ex('1', 'Amla Grove', 'A3'),
      ex('2', 'Banyan Tree', 'A30'),
      ex('3', 'Lotus Pond', 'B3'),
    ]
    expect(filterExhibits(ids, 'a3').map((e) => e.id)).toEqual(['1', '2'])
    expect(filterExhibits(ids, 'A3').map((e) => e.id)).toEqual(['1', '2'])
    expect(filterExhibits(ids, ' b3 ').map((e) => e.id)).toEqual(['3'])
  })

  it('matches displayId by prefix only, not substring', () => {
    const ids = [ex('1', 'Amla Grove', 'K11'), ex('2', 'Banyan Tree', 'A1')]
    expect(filterExhibits(ids, '11')).toEqual([])
  })

  describe('mustVisit filter', () => {
    const mixed = [
      ex('1', 'Amla Grove', 'Z1', 'gold'),
      ex('2', 'Banyan Tree', 'Z2', 'silver'),
      ex('3', 'Lotus Pond', 'Z3', 'gold'),
    ]

    it('mustVisit=false returns all (default)', () => {
      expect(filterExhibits(mixed, '').map((e) => e.id)).toEqual(['1', '2', '3'])
    })

    it('mustVisit=true returns only gold tier', () => {
      expect(filterExhibits(mixed, '', true).map((e) => e.id)).toEqual(['1', '3'])
    })

    it('mustVisit compounds with text query', () => {
      expect(filterExhibits(mixed, 'a', true).map((e) => e.id)).toEqual(['1'])
    })
  })
})

describe('matchRange', () => {
  it('returns range for mid-string match', () => {
    expect(matchRange('Banyan Tree', 'yan')).toEqual({ start: 3, end: 6 })
  })

  it('range slices back to the matched text (case-insensitive)', () => {
    const name = 'Banyan Tree'
    const r = matchRange(name, 'TREE')!
    expect(name.slice(r.start, r.end)).toBe('Tree')
  })

  it('returns null for empty query', () => {
    expect(matchRange('Banyan Tree', '')).toBeNull()
  })

  it('returns null for whitespace-only query', () => {
    expect(matchRange('Banyan Tree', '   ')).toBeNull()
  })

  it('returns null when no match', () => {
    expect(matchRange('Banyan Tree', 'lotus')).toBeNull()
  })
})

describe('sortAmenities', () => {
  const am = (id: string, name: string, gps_lat: number): CachedAmenity => ({
    id,
    name,
    type: 'washroom',
    description: null,
    photos: [],
    gps_lat,
    gps_lng: 0,
  })
  const list = [
    am('far', 'Zeta Cafe', 0.003),
    am('near', 'Main Washroom', 0.001),
    am('mid', 'Gate 2', 0.002),
  ]
  const here = { lat: 0, lng: 0 }

  it('sorts by distance ascending with a fix', () => {
    const r = sortAmenities(list, '', here)
    expect(r.map((x) => x.amenity.id)).toEqual(['near', 'mid', 'far'])
    expect(r[0].distanceM).toBeCloseTo(111, -1)
  })

  it('sorts A-Z with null distance without a fix', () => {
    const r = sortAmenities(list, '', null)
    expect(r.map((x) => x.amenity.name)).toEqual(['Gate 2', 'Main Washroom', 'Zeta Cafe'])
    expect(r.every((x) => x.distanceM === null)).toBe(true)
  })

  it('filters by name case-insensitively', () => {
    expect(sortAmenities(list, 'WASH', here).map((x) => x.amenity.id)).toEqual(['near'])
  })

  it('returns [] on zero matches', () => {
    expect(sortAmenities(list, 'zzz', here)).toEqual([])
  })

  it('does not mutate the input array', () => {
    const input = [...list]
    sortAmenities(input, '', here)
    expect(input.map((a) => a.id)).toEqual(['far', 'near', 'mid'])
  })
})
