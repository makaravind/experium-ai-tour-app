import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { createElement, type ComponentType } from 'react'

const mascotProps = vi.fn()
let mascotShouldThrow = false

vi.mock('wobnimo/react', () => ({
  Mascot: (props: { state: string; onReady?: () => void }) => {
    mascotProps(props)
    if (mascotShouldThrow) throw new Error('webgl context lost')
    return createElement('div', { 'data-testid': 'mascot', 'data-state': props.state })
  },
}))
vi.mock('wobnimo/characters/pip', () => ({ pip: {} }))

type PipProps = {
  state: string
  size: number | { width: number; height: number }
  className?: string
}

// PipMascot caches its WebGL/reduced-motion probe at module level, so re-import per case.
async function loadPip(opts: { webgl2: boolean; reducedMotion?: boolean }) {
  vi.resetModules()
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: opts.reducedMotion ?? false }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) =>
    type === 'webgl2' && opts.webgl2
      ? { getExtension: () => null }
      : null) as unknown as HTMLCanvasElement['getContext'])
  const mod = await import('@/components/common/PipMascot')
  return mod.default as ComponentType<PipProps>
}

beforeEach(() => {
  mascotProps.mockClear()
  mascotShouldThrow = false
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('PipMascot', () => {
  it('renders the poster and no canvas when WebGL2 is unavailable', async () => {
    const PipMascot = await loadPip({ webgl2: false })
    const { container, queryByTestId } = render(
      createElement(PipMascot, { state: 'idle', size: 48 })
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/pip.webp')
    expect(queryByTestId('mascot')).toBeNull()
    expect(mascotProps).not.toHaveBeenCalled()
  })

  it('renders the poster and no canvas under prefers-reduced-motion', async () => {
    const PipMascot = await loadPip({ webgl2: true, reducedMotion: true })
    const { container, queryByTestId } = render(
      createElement(PipMascot, { state: 'idle', size: 48 })
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/pip.webp')
    expect(queryByTestId('mascot')).toBeNull()
    expect(mascotProps).not.toHaveBeenCalled()
  })

  it('forwards state to wobnimo and follows rerenders', async () => {
    const PipMascot = await loadPip({ webgl2: true })
    const { findByTestId, rerender } = render(
      createElement(PipMascot, { state: 'speaking', size: 48 })
    )
    const mascot = await findByTestId('mascot')
    expect(mascot.getAttribute('data-state')).toBe('speaking')

    rerender(createElement(PipMascot, { state: 'celebrating', size: 48 }))
    await waitFor(() => expect(mascot.getAttribute('data-state')).toBe('celebrating'))
  })

  it('hides the poster once wobnimo reports ready', async () => {
    const PipMascot = await loadPip({ webgl2: true })
    const { container, findByTestId } = render(
      createElement(PipMascot, { state: 'idle', size: 48 })
    )
    await findByTestId('mascot')
    expect(container.querySelector('img')).not.toBeNull()
    act(() => mascotProps.mock.lastCall![0].onReady())
    expect(container.querySelector('img')).toBeNull()
  })

  it('keeps the poster when the canvas throws', async () => {
    mascotShouldThrow = true
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const PipMascot = await loadPip({ webgl2: true })
    const { container, queryByTestId } = render(
      createElement(PipMascot, { state: 'idle', size: 48 })
    )
    await waitFor(() => expect(mascotProps).toHaveBeenCalled())
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('/pip.webp')
    expect(img?.classList.contains('object-contain')).toBe(true)
    expect(queryByTestId('mascot')).toBeNull()
  })

  it('is aria-hidden and reserves its size', async () => {
    const PipMascot = await loadPip({ webgl2: false })
    const { container, rerender } = render(createElement(PipMascot, { state: 'idle', size: 48 }))
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.getAttribute('aria-hidden')).toBe('true')
    expect(wrapper.style.width).toBe('48px')
    expect(wrapper.style.height).toBe('48px')

    rerender(createElement(PipMascot, { state: 'idle', size: { width: 48, height: 56 } }))
    expect(wrapper.style.width).toBe('48px')
    expect(wrapper.style.height).toBe('56px')
  })
})
