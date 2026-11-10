import { describe, it, expect } from 'vitest'
import {
  assignUnplaced, centroid, nextFreeLetter, renameAmenitiesSection, renameExhibitsSection, renameSection, strandedExhibits,
  validateLetter,
} from '@/lib/admin/sections'
import type { AdminAmenity, AdminExhibit, LngLat, WorkingSection } from '@/lib/admin/types'

const sq: LngLat[] = [[0, 0], [10, 0], [10, 10], [0, 10]]
const sec = (id: string, originalId: string | null = id): WorkingSection => ({ id, originalId, polygon: sq })
const pin = (id: string, section: string | null, lng: number | null, lat: number | null) =>
  ({ id, section, gps_lng: lng, gps_lat: lat })

describe('nextFreeLetter', () => {
  it('starts at A', () => expect(nextFreeLetter([])).toBe('A'))
  it('fills the first gap', () => expect(nextFreeLetter([sec('A'), sec('C')])).toBe('B'))
  it('rolls over to AA after Z', () => {
    const all = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => sec(c))
    expect(nextFreeLetter(all)).toBe('AA')
    expect(nextFreeLetter([...all, sec('AA')])).toBe('AB')
  })
})

describe('validateLetter', () => {
  const sections = [sec('A'), sec('B')]
  it('upper-cases and trims', () => expect(validateLetter(' c ', sections, null)).toEqual({ id: 'C', error: null }))
  it('rejects non-letters', () => {
    expect(validateLetter('', sections, null).error).toBeTruthy()
    expect(validateLetter('A1', sections, null).error).toBeTruthy()
  })
  it('blocks a duplicate of another section', () => expect(validateLetter('b', sections, 'A').error).toMatch(/already exists/))
  it('allows keeping its own letter', () => expect(validateLetter('A', sections, 'A').error).toBeNull())
  it('blocks a letter another section still holds in the DB (no swaps)', () => {
    const renamed = [sec('C', 'A'), sec('B')]
    expect(validateLetter('A', renamed, 'B').error).toMatch(/Save first/)
    expect(validateLetter('A', renamed, 'C').error).toBeNull() // its own original letter
  })
  it('blocks a letter of a section deleted this session (renames run before deletes)', () => {
    // B was deleted, so it is gone from the working sections but still saved in the DB
    expect(validateLetter('B', [sec('A')], 'A', ['B']).error).toMatch(/Save first/)
    expect(validateLetter('C', [sec('A')], 'A', ['B']).error).toBeNull()
  })
})

describe('strandedExhibits', () => {
  it('returns only this section\'s exhibits that fall outside the polygon', () => {
    const exhibits = [pin('in', 'A', 5, 5), pin('out', 'A', 20, 5), pin('other', 'B', 20, 5)]
    expect(strandedExhibits(exhibits, 'A', sq).map((e) => e.id)).toEqual(['out'])
  })
  it('ignores exhibits without coordinates', () => {
    expect(strandedExhibits([pin('x', 'A', null, null)], 'A', sq)).toEqual([])
  })
  it('is empty when the new polygon still covers everything', () => {
    expect(strandedExhibits([pin('in', 'A', 5, 5)], 'A', [[0, 0], [6, 0], [6, 6], [0, 6]])).toEqual([])
  })
})

describe('rename helpers', () => {
  it('renameSection keeps originalId', () => {
    expect(renameSection([sec('A'), sec('B')], 'A', 'C')).toEqual([sec('C', 'A'), sec('B')])
  })
  it('renameExhibitsSection re-points only matching exhibits', () => {
    const e = (id: string, section: string | null) => ({ id, section }) as AdminExhibit
    expect(renameExhibitsSection([e('1', 'A'), e('2', 'B'), e('3', null)], 'A', 'C').map((x) => x.section)).toEqual(['C', 'B', null])
  })
})

describe('strandedExhibits with amenities', () => {
  it('works for amenity rows (same shape check)', () => {
    const a = (id: string, section: string | null, lng: number, lat: number) => ({ id, section, gps_lng: lng, gps_lat: lat }) as AdminAmenity
    expect(strandedExhibits([a('in', 'A', 5, 5), a('out', 'A', 20, 5), a('other', 'B', 20, 5)], 'A', sq).map((x) => x.id)).toEqual(['out'])
  })
})

describe('renameAmenitiesSection', () => {
  const a = (id: string, section: string | null) => ({ id, section }) as AdminAmenity
  it('re-points only matching amenities', () => {
    expect(renameAmenitiesSection([a('1', 'A'), a('2', 'B'), a('3', null)], 'A', 'C').map((x) => x.section)).toEqual(['C', 'B', null])
  })
  it('keeps untouched rows by reference', () => {
    const rows = [a('1', 'A'), a('2', 'B')]
    expect(renameAmenitiesSection(rows, 'A', 'C')[1]).toBe(rows[1])
  })
})

describe('centroid', () => {
  it('averages the vertices', () => expect(centroid(sq)).toEqual([5, 5]))
})

describe('assignUnplaced', () => {
  const ex = (id: string, code: number | null, section: string | null, number: number | null, lng: number, lat: number) =>
    ({ id, code, section, number, gps_lng: lng, gps_lat: lat }) as AdminExhibit
  const A = sec('A', null)

  it('places unplaced exhibits inside, numbering in code order and filling gaps', () => {
    const exhibits = [
      ex('c9', 9, null, null, 5, 5),
      ex('c2', 2, null, null, 6, 6),
      ex('held', 1, 'A', 1, 1, 1),
      ex('far', 3, null, null, 50, 50),
    ]
    const out = assignUnplaced(exhibits, 'A', [A])
    expect(out.map((e) => [e.id, e.section, e.number])).toEqual([
      ['c9', 'A', 3], ['c2', 'A', 2], ['held', 'A', 1], ['far', null, null],
    ])
  })
  it('skips pins that an earlier overlapping section wins', () => {
    const first = sec('B', null)
    const out = assignUnplaced([ex('x', 1, null, null, 5, 5)], 'A', [first, A])
    expect(out[0].section).toBeNull()
  })
  it('returns the same array when nothing matches', () => {
    const exhibits = [ex('x', 1, 'B', 1, 5, 5)]
    expect(assignUnplaced(exhibits, 'A', [A])).toBe(exhibits)
  })
})
