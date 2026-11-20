import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { createElement, StrictMode } from 'react'
import { DEFAULT_CAMPAIGN_ID, useStore } from '@/lib/store'
import TrailCard from '@/components/exhibit/TrailCard'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const pipStates: string[] = []
vi.mock('@/components/common/PipMascot', () => ({
  default: ({
    state,
    size,
    className,
    interactive,
  }: {
    state: string
    size: { width: number; height: number }
    className?: string
    interactive?: boolean
  }) => {
    pipStates.push(state)
    return createElement('div', {
      'data-testid': 'pip',
      'data-state': state,
      'data-size': `${size.width}x${size.height}`,
      'data-interactive': String(!!interactive),
      className,
    })
  },
}))

function seed(total: number, lastCelebratedTotal: number) {
  useStore.setState({ lastCelebratedTotal })
  useStore.setState((s) => ({
    discoveredByCampaign: {
      ...s.discoveredByCampaign,
      [DEFAULT_CAMPAIGN_ID]: { codes: [], total },
    },
  }))
}

beforeEach(() => {
  vi.useFakeTimers()
  pipStates.length = 0
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const state = (c: HTMLElement) => c.querySelector('[data-testid="pip"]')!.getAttribute('data-state')

describe('TrailCard Pip celebrate', () => {
  it('celebrates when total exceeds stored value, then idles after 3s and stores total', () => {
    seed(3, 1)
    const { container } = render(createElement(TrailCard))
    expect(state(container)).toBe('celebrating')
    expect(useStore.getState().lastCelebratedTotal).toBe(3)

    act(() => vi.advanceTimersByTime(2999))
    expect(state(container)).toBe('celebrating')
    act(() => vi.advanceTimersByTime(1))
    expect(state(container)).toBe('idle')
  })

  it('does not celebrate when remounted at the same total', () => {
    seed(3, 1)
    render(createElement(TrailCard)).unmount()
    pipStates.length = 0
    const { container } = render(createElement(TrailCard))
    expect(state(container)).toBe('idle')
    act(() => vi.advanceTimersByTime(5000))
    expect(pipStates).not.toContain('celebrating')
  })

  it('does not celebrate when total equals stored value', () => {
    seed(3, 3)
    const { container } = render(createElement(TrailCard))
    expect(state(container)).toBe('idle')
    expect(pipStates).not.toContain('celebrating')
  })

  it('still celebrates once, then idles, under StrictMode double-mount', () => {
    seed(3, 1)
    const { container } = render(createElement(StrictMode, null, createElement(TrailCard)))
    expect(state(container)).toBe('celebrating')
    expect(useStore.getState().lastCelebratedTotal).toBe(3)
    act(() => vi.advanceTimersByTime(3000))
    expect(state(container)).toBe('idle')
  })
})

describe('TrailCard Pip perch', () => {
  it('renders an interactive 104px Pip perched above the card, left of the info button', () => {
    seed(3, 3)
    const { container } = render(createElement(TrailCard))
    const pip = container.querySelector('[data-testid="pip"]')!
    expect(pip.getAttribute('data-size')).toBe('104x104')
    expect(pip.getAttribute('data-interactive')).toBe('true')
    expect(pip.classList.contains('absolute')).toBe(true)
    expect(pip.classList.contains('right-[44px]')).toBe(true)
    expect(pip.classList.contains('top-[-44px]')).toBe(true)
  })
})
