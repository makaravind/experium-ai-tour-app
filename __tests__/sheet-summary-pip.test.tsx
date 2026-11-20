import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import SheetSummary from '@/components/common/SheetSummary'
import SheetPerchPip, { PERCH_PIP_SIZE } from '@/components/common/SheetPerchPip'

vi.mock('@/components/common/PipMascot', () => ({
  default: (p: { state: string; size: number; className?: string; interactive?: boolean }) =>
    createElement('div', {
      'data-testid': 'pip',
      'data-state': p.state,
      'data-size': String(p.size),
      'data-interactive': String(!!p.interactive),
      className: p.className,
    }),
}))
vi.mock('@/components/exhibit/Gallery', () => ({ default: () => createElement('div') }))

afterEach(cleanup)

const summary = (props: { expanded: boolean; mascotState?: 'speaking'; hasItem?: boolean }) =>
  render(
    createElement(SheetSummary, {
      hasItem: true,
      ...props,
      thumb: createElement('div'),
      name: 'Rex',
      onCollapse: vi.fn(),
    })
  )

const pip = () => screen.getByTestId('pip')
const pipBox = () => pip().parentElement as HTMLElement

describe('SheetSummary expanded Pip', () => {
  it('is mounted but hidden (opacity-0 invisible) when collapsed', () => {
    summary({ expanded: false })
    expect(pipBox().classList.contains('opacity-0')).toBe(true)
    expect(pipBox().classList.contains('invisible')).toBe(true)
  })

  it('is not mounted when no item is selected (parked sheet)', () => {
    summary({ expanded: false, hasItem: false })
    expect(screen.queryByTestId('pip')).toBeNull()
  })

  it('is visible when expanded', () => {
    summary({ expanded: true })
    expect(pipBox().classList.contains('opacity-0')).toBe(false)
    expect(pipBox().classList.contains('invisible')).toBe(false)
  })

  it('stays the same instance across expand/collapse (no remount)', () => {
    const { rerender } = summary({ expanded: false })
    const before = pip()
    rerender(
      createElement(SheetSummary, {
        hasItem: true,
        expanded: true,
        thumb: createElement('div'),
        name: 'Rex',
        onCollapse: vi.fn(),
      })
    )
    expect(pip()).toBe(before)
  })

  it('is interactive, 110px, and receives mascotState (default idle)', () => {
    const { unmount } = summary({ expanded: true, mascotState: 'speaking' })
    expect(pip().getAttribute('data-state')).toBe('speaking')
    expect(pip().getAttribute('data-size')).toBe('110')
    expect(pip().getAttribute('data-interactive')).toBe('true')
    unmount()
    summary({ expanded: true })
    expect(pip().getAttribute('data-state')).toBe('idle')
  })

  it('renders exactly one Pip: none in the row, no pr-16 reserve on the name column', () => {
    const { container } = summary({ expanded: false })
    expect(screen.getAllByTestId('pip')).toHaveLength(1)
    expect(container.querySelector('.pr-16')).toBeNull()
    const nameCol = screen.getByText('Rex').parentElement!.parentElement as HTMLElement
    expect(nameCol.className).not.toMatch(/pr-16/)
    expect(nameCol.contains(pip())).toBe(false)
  })
})

describe('SheetPerchPip', () => {
  it('renders an interactive 108px Pip with the lift class and forwards state', () => {
    render(createElement(SheetPerchPip, { state: 'celebrating' }))
    expect(PERCH_PIP_SIZE).toBe(108)
    expect(pip().getAttribute('data-state')).toBe('celebrating')
    expect(pip().getAttribute('data-size')).toBe('108')
    expect(pip().getAttribute('data-interactive')).toBe('true')
    expect(pip().className).toContain('-translate-y-[70px]')
    expect(pip().className).toContain('touch-none')
  })
})
