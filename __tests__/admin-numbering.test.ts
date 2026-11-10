import { describe, it, expect } from 'vitest'
import { lowestFreeNumber } from '@/lib/admin/numbering'

const ex = (id: string, section: string | null, number: number | null) => ({ id, section, number })

describe('lowestFreeNumber', () => {
  it('returns 1 for an empty section', () => {
    expect(lowestFreeNumber('A', [], null)).toBe(1)
    expect(lowestFreeNumber('A', [ex('x', 'B', 1)], null)).toBe(1)
  })

  it('returns max+1 when numbers are dense', () => {
    expect(lowestFreeNumber('A', [ex('1', 'A', 1), ex('2', 'A', 2)], null)).toBe(3)
  })

  it('fills the lowest gap', () => {
    expect(lowestFreeNumber('A', [ex('1', 'A', 1), ex('3', 'A', 3), ex('4', 'A', 4)], null)).toBe(2)
    expect(lowestFreeNumber('A', [ex('2', 'A', 2), ex('3', 'A', 3)], null)).toBe(1)
  })

  it('only considers the target section', () => {
    expect(lowestFreeNumber('B', [ex('1', 'A', 1), ex('2', 'B', 1)], null)).toBe(2)
  })

  it('ignores the excluded exhibit (self)', () => {
    const list = [ex('1', 'A', 1), ex('2', 'A', 2), ex('3', 'A', 3)]
    expect(lowestFreeNumber('A', list, '2')).toBe(2)
    expect(lowestFreeNumber('A', list, '1')).toBe(1)
  })

  it('ignores unplaced exhibits (null section/number)', () => {
    expect(lowestFreeNumber('A', [ex('1', null, 1), ex('2', 'A', null)], null)).toBe(1)
  })
})
