import { describe, it, expect } from 'vitest'
import { getCurrentSegment } from '@/lib/trail'

describe('getCurrentSegment', () => {
  it('is not complete and has no achieved milestones at 0', () => {
    const s = getCurrentSegment(0)
    expect(s.achieved).toEqual([])
    expect(s.next).toBe(1)
    expect(s.isComplete).toBe(false)
  })

  it('achieves the 1 milestone at exactly 1', () => {
    const s = getCurrentSegment(1)
    expect(s.achieved).toEqual([1])
    expect(s.next).toBe(3)
  })

  it('sits between milestones at 2', () => {
    const s = getCurrentSegment(2)
    expect(s.achieved).toEqual([1])
    expect(s.next).toBe(3)
  })

  it('achieves 1, 3, 5 at 9, targets 10 next', () => {
    const s = getCurrentSegment(9)
    expect(s.achieved).toEqual([1, 3, 5])
    expect(s.next).toBe(10)
  })

  it('achieves 1, 3, 5, 10 at exactly 10', () => {
    const s = getCurrentSegment(10)
    expect(s.achieved).toEqual([1, 3, 5, 10])
    expect(s.next).toBe(15)
  })

  it('is not complete at 49', () => {
    const s = getCurrentSegment(49)
    expect(s.next).toBe(50)
    expect(s.isComplete).toBe(false)
  })

  it('is complete at exactly 50, with no next milestone', () => {
    const s = getCurrentSegment(50)
    expect(s.next).toBe(null)
    expect(s.isComplete).toBe(true)
  })

  it('stays complete beyond 50', () => {
    const s = getCurrentSegment(51)
    expect(s.next).toBe(null)
    expect(s.isComplete).toBe(true)
  })
})
