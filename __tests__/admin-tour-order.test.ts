import { describe, expect, it } from 'vitest'
import { compareNodes, sortNodes } from '@/lib/admin/tour-order'

const refs = (refList: string[]) =>
  sortNodes(refList.map((pano_ref) => ({ pano_ref }))).map((n) => n.pano_ref)

describe('sortNodes', () => {
  it('orders numerically, not lexicographically', () => {
    expect(refs(['10', '2', '1', '11', '9'])).toEqual(['1', '2', '9', '10', '11'])
  })

  it('puts a lettered variant after its number and before the next', () => {
    expect(refs(['38', '37A', '37', '40', '39'])).toEqual(['37', '37A', '38', '39', '40'])
  })

  it('puts non-numeric refs first', () => {
    expect(refs(['2', 'lobby', '1', 'bonus'])).toEqual(['bonus', 'lobby', '1', '2'])
  })

  it('is stable and does not mutate the input', () => {
    const input = [
      { pano_ref: '2', id: 'a' },
      { pano_ref: '2', id: 'b' },
      { pano_ref: '1', id: 'c' },
    ]
    expect(sortNodes(input).map((n) => n.id)).toEqual(['c', 'a', 'b'])
    expect(input.map((n) => n.id)).toEqual(['a', 'b', 'c'])
    expect(compareNodes({ pano_ref: '7' }, { pano_ref: '7' })).toBe(0)
  })
})
