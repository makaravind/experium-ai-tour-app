import { describe, it, expect } from 'vitest'
import { pickFocus } from '@/lib/focus-pick'

describe('pickFocus', () => {
  it('returns the nearest candidate within the radius', () => {
    const c = [
      { id: 'a', distance: 60 },
      { id: 'b', distance: 20 },
      { id: 'c', distance: 40 },
    ]
    expect(pickFocus(c, 90)).toBe('b')
  })

  it('returns null when every candidate is outside the radius', () => {
    expect(pickFocus([{ id: 'a', distance: 91 }, { id: 'b', distance: 200 }], 90)).toBeNull()
  })

  it('returns null for no candidates', () => {
    expect(pickFocus([], 90)).toBeNull()
  })

  it('returns the first candidate on a tie', () => {
    const c = [
      { id: 'a', distance: 30 },
      { id: 'b', distance: 30 },
    ]
    expect(pickFocus(c, 90)).toBe('a')
  })

  it('includes a candidate exactly on the radius', () => {
    expect(pickFocus([{ id: 'a', distance: 90 }], 90)).toBe('a')
  })
})
