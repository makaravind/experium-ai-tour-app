import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useStore } from '@/lib/store'
import { getCurrentSegment, TRAIL_MILESTONES } from '@/lib/trail'
import CollectionPage from '@/app/collection/page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

// Strip motion-only props so they don't leak onto DOM nodes
vi.mock('framer-motion', () => {
  const strip = (tag: 'button' | 'div') =>
    function MotionStub({ children, initial, animate, transition, onAnimationComplete, ...props }: Record<string, unknown>) {
      void initial; void animate; void transition; void onAnimationComplete
      return createElement(tag, props, children as React.ReactNode)
    }
  return { motion: { button: strip('button'), div: strip('div') } }
})

function setTotal(totalDiscovered: number) {
  useStore.setState({ totalDiscovered })
}

function badge(m: number) {
  return screen.getByRole('button', { name: `Milestone ${m} badge` }) as HTMLButtonElement
}

describe('Collection badge grid', () => {
  beforeEach(() => {
    useStore.setState({
      language: 'en',
      visitedExhibits: [],
      cachedExhibits: [],
      cachedAmenities: [],
      precacheLanguage: null,
      completionByGroup: {},
      assetFailures: {},
      acknowledgedCapped: [],
      visitorId: null,
      totalDiscovered: 0,
      discoveredCodes: [],
      scanQueue: [],
    })
  })

  afterEach(cleanup)

  it('renders all 9 badges', () => {
    render(createElement(CollectionPage))
    expect(TRAIL_MILESTONES).toHaveLength(9)
    for (const m of TRAIL_MILESTONES) expect(badge(m)).toBeInTheDocument()
  })

  it('disables every badge when nothing is earned', () => {
    render(createElement(CollectionPage))
    for (const m of TRAIL_MILESTONES) expect(badge(m)).toBeDisabled()
  })

  it('enables only earned badges (3 earned, 6 locked)', () => {
    setTotal(5)
    const { achieved } = getCurrentSegment(5)
    expect(achieved).toHaveLength(3)
    render(createElement(CollectionPage))
    for (const m of TRAIL_MILESTONES) {
      if (achieved.includes(m)) expect(badge(m)).toBeEnabled()
      else expect(badge(m)).toBeDisabled()
    }
  })

  it('enables all badges when every milestone is earned', () => {
    setTotal(50)
    render(createElement(CollectionPage))
    for (const m of TRAIL_MILESTONES) expect(badge(m)).toBeEnabled()
  })

  it('styles locked badges grayscale + 0.35 opacity, earned badges untouched', () => {
    setTotal(1)
    render(createElement(CollectionPage))
    expect(badge(1).style.filter).toBe('')
    expect(badge(1).style.opacity).toBe('1')
    expect(badge(3).style.filter).toBe('grayscale(1)')
    expect(badge(3).style.opacity).toBe('0.35')
  })
})
