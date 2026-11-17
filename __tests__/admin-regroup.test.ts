import { describe, it, expect } from 'vitest'
import { insertVertex, planRegroup, removeVertex } from '@/lib/admin/regroup'
import type { AdminAmenity, AdminExhibit, LngLat, WorkingSection } from '@/lib/admin/types'

// A = x 0..10, B = x 10..20 (both y 0..10)
const box = (x0: number, x1: number): LngLat[] => [
  [x0, 0],
  [x1, 0],
  [x1, 10],
  [x0, 10],
]
const sec = (id: string, polygon: LngLat[]): WorkingSection => ({ id, originalId: id, polygon })
const ex = (
  id: string,
  code: number,
  section: string | null,
  number: number | null,
  lng: number
): AdminExhibit => ({
  id,
  code,
  name: `ex-${id}`,
  type: null,
  tier: 'gold',
  status: 'live',
  description: null,
  facts: [],
  gps_lat: 5,
  gps_lng: lng,
  section,
  number,
})
const am = (id: string, section: string | null, lng: number): AdminAmenity => ({
  id,
  name: `am-${id}`,
  type: 'washroom',
  description: null,
  gps_lat: 5,
  gps_lng: lng,
  section,
})

const sections = [sec('A', box(0, 10)), sec('B', box(10, 20))]

describe('planRegroup', () => {
  it('no moves when nothing crosses a boundary', () => {
    const exhibits = [ex('a1', 1, 'A', 1, 2), ex('b1', 2, 'B', 1, 15)]
    const plan = planRegroup('A', box(0, 9), sections, exhibits, [])
    expect(plan).toMatchObject({ ok: true, moves: [] })
    if (plan.ok) expect(plan.exhibits).toBe(exhibits)
  })

  it('edited section wins on overlap: exhibits in the new area move in, lowest free number', () => {
    const exhibits = [
      ex('a1', 1, 'A', 1, 2),
      ex('a2', 2, 'A', 3, 4),
      ex('b1', 3, 'B', 1, 12),
      ex('b2', 4, 'B', 2, 18),
    ]
    // A grows over x 10..14 (B is later in the list but A would win anyway)
    const plan = planRegroup('A', box(0, 14), sections, exhibits, [])
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.moves).toEqual([{ kind: 'exhibit', id: 'b1', name: 'ex-b1', from: 'B1', to: 'A2' }])
    expect(plan.exhibits.find((e) => e.id === 'b1')).toMatchObject({ section: 'A', number: 2 })
    expect(plan.exhibits.find((e) => e.id === 'b2')).toMatchObject({ section: 'B', number: 2 })
    expect(plan.exhibits.find((e) => e.id === 'b1')).toMatchObject({ gps_lng: 12, code: 3 })
  })

  it('exhibits leaving the edited section go to the section that now contains them', () => {
    const exhibits = [ex('a1', 1, 'A', 1, 2), ex('a2', 2, 'A', 2, 9.5), ex('b1', 3, 'B', 1, 15)]
    // shrink A to x 0..5 and grow B left to x 5..20: a2 (9.5) is now only in B
    const wide = [sec('A', box(0, 10)), sec('B', box(5, 20))]
    const plan = planRegroup('A', box(0, 5), wide, exhibits, [])
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.moves).toEqual([{ kind: 'exhibit', id: 'a2', name: 'ex-a2', from: 'A2', to: 'B2' }])
    expect(plan.exhibits.find((e) => e.id === 'a2')).toMatchObject({ section: 'B', number: 2 })
  })

  it('rejects when an exhibit would end up in no section', () => {
    const exhibits = [ex('a1', 1, 'A', 1, 2), ex('a2', 2, 'A', 2, 9)]
    const plan = planRegroup('A', box(0, 5), sections, exhibits, [])
    expect(plan).toEqual({ ok: false, stranded: ['ex-a2'] })
  })

  it('ignores exhibits that were already outside the edited section before the edit', () => {
    const exhibits = [ex('a1', 1, 'A', 1, 2), ex('a9', 9, 'A', 2, 50)] // a9 is far outside A already
    const plan = planRegroup('A', box(0, 9), sections, exhibits, [])
    expect(plan).toMatchObject({ ok: true, moves: [] })
  })

  it('numbers several movers in old display-ID order (code as tiebreak)', () => {
    const exhibits = [
      ex('b2', 9, 'B', 2, 13),
      ex('b1', 8, 'B', 1, 12),
      ex('c1', 7, 'C', 1, 14),
      ex('a1', 1, 'A', 1, 2),
    ]
    const all = [...sections, sec('C', box(10, 20))]
    const plan = planRegroup('A', box(0, 20), all, exhibits, [])
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.moves.map((m) => `${m.from}>${m.to}`)).toEqual(['B1>A2', 'B2>A3', 'C1>A4'])
  })

  it('a mover is numbered after the existing exhibits of its target', () => {
    const exhibits = [ex('a1', 1, 'A', 1, 9), ex('b1', 2, 'B', 1, 15)]
    const wide = [sec('A', box(0, 10)), sec('B', box(5, 20))]
    const plan = planRegroup('A', box(0, 5), wide, exhibits, [])
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.exhibits.find((e) => e.id === 'a1')).toMatchObject({ section: 'B', number: 2 })
  })

  it('moves amenities too (section only) and rejects stranded ones', () => {
    const amenities = [am('w1', 'B', 12), am('w2', 'A', 2)]
    const plan = planRegroup('A', box(0, 14), sections, [], amenities)
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.moves).toEqual([{ kind: 'amenity', id: 'w1', name: 'am-w1', from: 'B', to: 'A' }])
    expect(plan.amenities.find((a) => a.id === 'w1')?.section).toBe('A')
    expect(planRegroup('A', box(0, 1), sections, [], amenities)).toEqual({
      ok: false,
      stranded: ['am-w2'],
    })
  })

  it('places unplaced exhibits that fall inside the edited polygon', () => {
    const plan = planRegroup('A', box(0, 14), sections, [ex('u', 5, null, null, 12)], [])
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.moves).toEqual([{ kind: 'exhibit', id: 'u', name: 'ex-u', from: '—', to: 'A1' }])
  })

  it('leaves exhibits without gps alone', () => {
    const noGps = { ...ex('n', 1, 'A', 1, 0), gps_lat: null, gps_lng: null }
    expect(planRegroup('A', box(0, 5), sections, [noGps], [])).toMatchObject({
      ok: true,
      moves: [],
    })
  })
})

describe('insertVertex / removeVertex', () => {
  const tri: LngLat[] = [
    [0, 0],
    [4, 0],
    [0, 4],
  ]
  it('inserts after the given edge start index', () => {
    expect(insertVertex(tri, 0, [2, -1])).toEqual([
      [0, 0],
      [2, -1],
      [4, 0],
      [0, 4],
    ])
    expect(insertVertex(tri, 2, [-1, 2])).toEqual([
      [0, 0],
      [4, 0],
      [0, 4],
      [-1, 2],
    ])
  })
  it('removes a vertex but never below 3', () => {
    expect(removeVertex(box(0, 1), 1)).toEqual([
      [0, 0],
      [1, 10],
      [0, 10],
    ])
    expect(removeVertex(tri, 0)).toBeNull()
  })
})
