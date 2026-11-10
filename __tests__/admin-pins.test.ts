import { describe, it, expect } from 'vitest'
import { moveAmenityPin, movePin, newAmenity, newExhibit } from '@/lib/admin/pins'
import type { AdminAmenity, AdminExhibit, WorkingSection } from '@/lib/admin/types'

const sq = (id: string, x: number): WorkingSection => ({
  id,
  originalId: id,
  polygon: [[x, 0], [x + 1, 0], [x + 1, 1], [x, 1]],
})
const A = sq('A', 0)
const B = sq('B', 2)
const sections = [A, B]

const ex = (id: string, section: string | null, number: number | null): AdminExhibit => ({
  id, code: 1, name: id, type: null, tier: 'silver', status: 'live', description: null, facts: [],
  gps_lat: 0.5, gps_lng: 0.5, section, number,
})

describe('movePin', () => {
  it('snaps back when dropped outside every section', () => {
    expect(movePin([ex('x', 'A', 1)], sections, 'x', 1.5, 0.5)).toBe('snap-back')
  })

  it('keeps the number when the section is unchanged', () => {
    const list = [ex('x', 'A', 3), ex('y', 'A', 1)]
    expect(movePin(list, sections, 'x', 0.2, 0.3)).toEqual({ gps_lng: 0.2, gps_lat: 0.3, section: 'A', number: 3 })
  })

  it('renumbers to the lowest free number in the new section', () => {
    const list = [ex('x', 'A', 1), ex('b1', 'B', 1), ex('b3', 'B', 3)]
    expect(movePin(list, sections, 'x', 2.5, 0.5)).toEqual({ gps_lng: 2.5, gps_lat: 0.5, section: 'B', number: 2 })
  })

  it('places an unplaced exhibit', () => {
    expect(movePin([ex('x', null, null)], sections, 'x', 0.5, 0.5)).toEqual({ gps_lng: 0.5, gps_lat: 0.5, section: 'A', number: 1 })
  })

  it('first section wins on overlap', () => {
    const overlap = [A, { ...B, polygon: A.polygon }]
    expect(movePin([ex('x', null, null)], overlap, 'x', 0.5, 0.5)).toMatchObject({ section: 'A' })
  })
})

describe('newExhibit', () => {
  const form = { name: 'Banyan', type: 'flora', tier: 'gold' }

  it('returns null outside every section', () => {
    expect(newExhibit([], sections, 'n1', 1.5, 0.5, form)).toBeNull()
  })

  it('builds a live exhibit with no code at the click point, numbered in the section', () => {
    expect(newExhibit([ex('a1', 'A', 1)], sections, 'n1', 0.5, 0.25, form)).toEqual({
      id: 'n1', code: null, name: 'Banyan', type: 'flora', tier: 'gold', status: 'live',
      description: null, facts: [], gps_lat: 0.25, gps_lng: 0.5, section: 'A', number: 2,
    })
  })
})

const am = (id: string, section: string | null): AdminAmenity => ({
  id, name: id, type: 'washroom', description: null, gps_lat: 0.5, gps_lng: 0.5, section,
})

describe('moveAmenityPin', () => {
  it('snaps back when dropped outside every section', () => {
    expect(moveAmenityPin([am('x', 'A')], sections, 'x', 1.5, 0.5)).toBe('snap-back')
  })

  it('snaps back for an unknown id', () => {
    expect(moveAmenityPin([], sections, 'x', 0.5, 0.5)).toBe('snap-back')
  })

  it('patches gps and section inside the same section', () => {
    expect(moveAmenityPin([am('x', 'A')], sections, 'x', 0.2, 0.3)).toEqual({ gps_lng: 0.2, gps_lat: 0.3, section: 'A' })
  })

  it('changes section when dropped into another', () => {
    expect(moveAmenityPin([am('x', 'A')], sections, 'x', 2.5, 0.5)).toEqual({ gps_lng: 2.5, gps_lat: 0.5, section: 'B' })
  })

  it('places an unplaced amenity; first section wins on overlap', () => {
    const overlap = [A, { ...B, polygon: A.polygon }]
    expect(moveAmenityPin([am('x', null)], overlap, 'x', 0.5, 0.5)).toMatchObject({ section: 'A' })
  })
})

describe('newAmenity', () => {
  const form = { name: 'Cafe', type: 'food' as const }

  it('returns null outside every section', () => {
    expect(newAmenity(sections, 'n1', 1.5, 0.5, form)).toBeNull()
  })

  it('builds an amenity at the click point in its section', () => {
    expect(newAmenity(sections, 'n1', 0.5, 0.25, form)).toEqual({
      id: 'n1', name: 'Cafe', type: 'food', description: null, gps_lat: 0.25, gps_lng: 0.5, section: 'A',
    })
  })
})
