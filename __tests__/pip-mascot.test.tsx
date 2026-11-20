import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { createElement, type ComponentType } from 'react'
import { SLEEP_AFTER_MS } from '@/components/common/PipMascot'

const mascotProps = vi.fn()
let mascotShouldThrow = false

vi.mock('wobnimo/react', () => ({
  Mascot: (props: {
    state: string
    onReady?: () => void
    onPoke?: () => void
    interactive?: boolean
    maxPixelRatio?: number
  }) => {
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
  interactive?: boolean
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

describe('PipMascot interactive', () => {
  it('forwards interactive=false by default and maxPixelRatio 3', async () => {
    const PipMascot = await loadPip({ webgl2: true })
    const { findByTestId } = render(createElement(PipMascot, { state: 'idle', size: 48 }))
    await findByTestId('mascot')
    expect(mascotProps.mock.lastCall![0]).toMatchObject({ interactive: false, maxPixelRatio: 3 })
  })

  it('forwards interactive=true when set', async () => {
    const PipMascot = await loadPip({ webgl2: true })
    const { findByTestId } = render(
      createElement(PipMascot, { state: 'idle', size: 48, interactive: true })
    )
    await findByTestId('mascot')
    expect(mascotProps.mock.lastCall![0].interactive).toBe(true)
  })

  it.each([
    [false, false],
    [true, true],
  ])(
    'interactive=%j: canvas wrapper pointer-events-auto is %j, root stays none',
    async (interactive, auto) => {
      const PipMascot = await loadPip({ webgl2: true })
      const { container, findByTestId } = render(
        createElement(PipMascot, { state: 'idle', size: 48, interactive })
      )
      const mascot = await findByTestId('mascot')
      const root = container.firstElementChild as HTMLElement
      expect(root.classList.contains('pointer-events-none')).toBe(true)
      expect(mascot.parentElement!.classList.contains('pointer-events-auto')).toBe(auto)
    }
  )
})

describe('PipMascot sleep', () => {
  // RTL's findBy* hangs under fake timers, so wait for the canvas with vi.waitFor instead.
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const lastState = () => mascotProps.mock.lastCall![0].state as string
  const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

  async function renderLive(state: string) {
    const PipMascot = await loadPip({ webgl2: true })
    const utils = render(createElement(PipMascot, { state, size: 48 }))
    await vi.waitFor(() => expect(mascotProps).toHaveBeenCalled())
    // vi.waitFor advances the fake clock while polling; a poke re-arms the timer from t=0.
    act(() => mascotProps.mock.lastCall![0].onPoke())
    return { ...utils, PipMascot }
  }

  it('falls asleep after SLEEP_AFTER_MS of idle', async () => {
    await renderLive('idle')
    await advance(SLEEP_AFTER_MS - 1)
    expect(lastState()).toBe('idle')
    await advance(1)
    expect(lastState()).toBe('sleeping')
  })

  it('onPoke wakes it and restarts the timer', async () => {
    await renderLive('idle')
    await advance(SLEEP_AFTER_MS)
    expect(lastState()).toBe('sleeping')

    act(() => mascotProps.mock.lastCall![0].onPoke())
    expect(lastState()).toBe('idle')

    await advance(SLEEP_AFTER_MS - 1)
    expect(lastState()).toBe('idle')
    await advance(1)
    expect(lastState()).toBe('sleeping')
  })

  it('a poke before sleeping postpones it by a full interval', async () => {
    await renderLive('idle')
    await advance(SLEEP_AFTER_MS - 1000)
    act(() => mascotProps.mock.lastCall![0].onPoke())
    await advance(SLEEP_AFTER_MS - 1)
    expect(lastState()).toBe('idle')
    await advance(1)
    expect(lastState()).toBe('sleeping')
  })

  it('a requested-state change wakes it and restarts the timer', async () => {
    const { rerender, PipMascot } = await renderLive('idle')
    await advance(SLEEP_AFTER_MS)
    expect(lastState()).toBe('sleeping')

    rerender(createElement(PipMascot, { state: 'surprised', size: 48 }))
    expect(lastState()).toBe('surprised')
    rerender(createElement(PipMascot, { state: 'idle', size: 48 }))
    expect(lastState()).toBe('idle')

    await advance(SLEEP_AFTER_MS - 1)
    expect(lastState()).toBe('idle')
    await advance(1)
    expect(lastState()).toBe('sleeping')
  })

  it.each(['speaking', 'celebrating', 'thinking', 'sad', 'surprised'])(
    'never sleeps while %s',
    async (state) => {
      await renderLive(state)
      await advance(SLEEP_AFTER_MS * 3)
      expect(lastState()).toBe(state)
      expect(mascotProps.mock.calls.every(([p]) => p.state === state)).toBe(true)
    }
  )

  it.each([
    ['WebGL2 is unavailable', { webgl2: false }],
    ['under reduced motion', { webgl2: true, reducedMotion: true }],
  ])('sets no sleep timer and renders no canvas when %s', async (_name, opts) => {
    const PipMascot = await loadPip(opts)
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const { queryByTestId, container } = render(
      createElement(PipMascot, { state: 'idle', size: 48, interactive: true })
    )
    await advance(SLEEP_AFTER_MS * 2)
    expect(queryByTestId('mascot')).toBeNull()
    expect(mascotProps).not.toHaveBeenCalled()
    expect(container.querySelector('img')).not.toBeNull()
    expect(setTimeoutSpy.mock.calls.some(([, ms]) => ms === SLEEP_AFTER_MS)).toBe(false)
  })
})
