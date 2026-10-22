import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import IntroScreen from '@/components/onboarding/IntroScreen'

describe('IntroScreen stall recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // play() resolves immediately (clears the 500ms bailout) but no events fire
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('calls onEnd via stalled event — SW range-request stall', async () => {
    const onEnd = vi.fn()
    render(createElement(IntroScreen, { onEnd }))

    // Let play() microtask run (clears 500ms timer)
    await vi.advanceTimersByTimeAsync(0)

    const video = document.querySelector('video')!
    video.dispatchEvent(new Event('stalled'))

    expect(onEnd).toHaveBeenCalledOnce()
  })

  it('calls onEnd after 8s max if play() resolves but video never ends', async () => {
    const onEnd = vi.fn()
    render(createElement(IntroScreen, { onEnd }))

    // play() resolves → 500ms timer cleared; video never fires ended/error/stalled
    await vi.advanceTimersByTimeAsync(7_999)
    expect(onEnd).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(onEnd).toHaveBeenCalledOnce()
  })

  it('500ms bailout still fires if play() never resolves', async () => {
    vi.restoreAllMocks()
    // play() returns a forever-pending promise
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockReturnValue(new Promise(() => {}))

    const onEnd = vi.fn()
    render(createElement(IntroScreen, { onEnd }))

    await vi.advanceTimersByTimeAsync(499)
    expect(onEnd).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(onEnd).toHaveBeenCalledOnce()
  })
})
