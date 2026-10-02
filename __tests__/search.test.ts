import { describe, it, expect } from 'vitest'
import { matchesQuery, filterExhibits, matchRange } from '@/lib/search'
import type { MapExhibit } from '@/lib/types'

const ex = (id: string, name: string): MapExhibit => ({
  id,
  name,
  type: null,
  tier: 'standard',
  gps_lat: 0,
  gps_lng: 0,
  qr_code: null,
  languages: ['en'],
  status: 'active' as MapExhibit['status'],
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
