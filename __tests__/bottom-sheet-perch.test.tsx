import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import BottomSheet from '@/components/common/BottomSheet'

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderSheet(itemId: string | null, withPerch = true) {
  return render(
    <BottomSheet itemId={itemId} perch={withPerch ? <div data-testid="perch">pip</div> : undefined}>
      {({ expanded }) => <p data-testid="child">{expanded ? 'full' : 'peek'}</p>}
    </BottomSheet>
  )
}

const perchBox = () => screen.getByTestId('perch').parentElement as HTMLElement

describe('BottomSheet perch', () => {
  it('renders outside the scroll container but inside the draggable wrapper', () => {
    const { container } = renderSheet('x')
    const scroller = container.querySelector('.overflow-y-auto') as HTMLElement
    const perch = screen.getByTestId('perch')
    expect(scroller).not.toBeNull()
    expect(scroller.contains(perch)).toBe(false)
    // draggable wrapper = the fixed motion.div that also holds the scroller
    const wrapper = scroller.parentElement as HTMLElement
    expect(wrapper.classList.contains('fixed')).toBe(true)
    expect(wrapper.contains(perch)).toBe(true)
  })

  it('keeps the draggable wrapper unclipped; only the inner scroller scrolls', () => {
    const { container } = renderSheet('x')
    const scroller = container.querySelector('.overflow-y-auto') as HTMLElement
    const wrapper = scroller.parentElement as HTMLElement
    expect(wrapper.className).not.toMatch(/overflow/)
    expect(scroller.className).toContain('overflow-x-clip')
  })

  it('is visible when collapsed with an item and cannot take taps', () => {
    renderSheet('x')
    expect(perchBox().style.opacity).toBe('1')
    expect(perchBox().style.visibility).toBe('visible')
    expect(perchBox().classList.contains('pointer-events-none')).toBe(true)
  })

  it('hides (opacity 0 + visibility hidden) once expanded, and returns on collapse', () => {
    renderSheet('x')
    fireEvent.click(screen.getByLabelText('Expand to full view'))
    expect(perchBox().style.opacity).toBe('0')
    expect(perchBox().style.visibility).toBe('hidden')

    fireEvent.click(screen.getByLabelText('Collapse details'))
    expect(perchBox().style.opacity).toBe('1')
    expect(perchBox().style.visibility).toBe('visible')
  })

  it('is not mounted when itemId is null, and mounts once an item is selected', () => {
    const { rerender } = renderSheet(null)
    expect(screen.queryByTestId('perch')).toBeNull()
    rerender(
      <BottomSheet itemId="x" perch={<div data-testid="perch">pip</div>}>
        {() => null}
      </BottomSheet>
    )
    expect(screen.getByTestId('perch')).toBeTruthy()
  })

  it('hides the perch as soon as a close starts, and restores it for the next item', () => {
    const onClose = vi.fn()
    const { container, rerender } = render(
      <BottomSheet itemId="x" onClose={onClose} perch={<div data-testid="perch">pip</div>}>
        {() => null}
      </BottomSheet>
    )
    // tap-outside backdrop runs close()
    fireEvent.click(container.querySelector('.inset-0') as HTMLElement)
    expect(perchBox().style.opacity).toBe('0')
    expect(perchBox().style.visibility).toBe('hidden')

    rerender(
      <BottomSheet itemId="y" onClose={onClose} perch={<div data-testid="perch">pip</div>}>
        {() => null}
      </BottomSheet>
    )
    expect(perchBox().style.opacity).toBe('1')
    expect(perchBox().style.visibility).toBe('visible')
  })

  it('starts the sheet drag on pointer-down over the perch', () => {
    const { container } = renderSheet('x')
    const handle = screen.getByLabelText('Expand to full view')
    // Same wiring as the handle: the perch container carries a pointer-down handler.
    expect(handle.getAttribute('aria-expanded')).toBe('false')
    expect(() => fireEvent.pointerDown(perchBox(), { pointerId: 1 })).not.toThrow()
    expect(container.querySelector('.fixed.bottom-0')).not.toBeNull()
  })

  it('renders no perch container without a perch prop', () => {
    const { container } = renderSheet('x', false)
    expect(screen.queryByTestId('perch')).toBeNull()
    expect(container.querySelector('.z-10')).toBeNull()
  })

  it('children API is unchanged: receives expanded and lives inside the scroller', () => {
    const { container } = renderSheet('x')
    const scroller = container.querySelector('.overflow-y-auto') as HTMLElement
    expect(scroller.contains(screen.getByTestId('child'))).toBe(true)
    expect(screen.getByTestId('child').textContent).toBe('peek')
    act(() => {
      fireEvent.click(screen.getByLabelText('Expand to full view'))
    })
    expect(screen.getByTestId('child').textContent).toBe('full')
  })
})
