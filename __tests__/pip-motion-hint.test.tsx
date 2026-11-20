import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import PipMotionHint from '@/components/common/PipMotionHint'
import { useStore } from '@/lib/store'

const { trackMock } = vi.hoisted(() => ({ trackMock: vi.fn() }))
vi.mock('@vercel/analytics', () => ({ track: trackMock }))

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/126.0.0.0'
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) Firefox/126.0'

function setup({ reduced = true, ua = IPHONE }: { reduced?: boolean; ua?: string } = {}) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: reduced }))
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)
}

beforeEach(() => {
  trackMock.mockClear()
  useStore.setState({ pipMotionHintSeen: false })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('PipMotionHint', () => {
  it('shows once when Reduce Motion is on and the hint is unseen, and tracks it', () => {
    setup()
    render(<PipMotionHint />)
    expect(screen.getByText('Pip is resting')).toBeTruthy()
    expect(trackMock).toHaveBeenCalledTimes(1)
    expect(trackMock).toHaveBeenCalledWith('pip_motion_hint_shown', { platform: 'ios' })
  })

  it('renders nothing when Reduce Motion is off', () => {
    setup({ reduced: false })
    const { container } = render(<PipMotionHint />)
    expect(container.firstChild).toBeNull()
    expect(trackMock).not.toHaveBeenCalled()
  })

  it('renders nothing once the hint was seen', () => {
    setup()
    useStore.setState({ pipMotionHintSeen: true })
    const { container } = render(<PipMotionHint />)
    expect(container.firstChild).toBeNull()
    expect(trackMock).not.toHaveBeenCalled()
  })

  it('renders nothing (no throw) when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { container } = render(<PipMotionHint />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the iOS settings path on iOS', () => {
    setup({ ua: IPHONE })
    render(<PipMotionHint />)
    expect(screen.getByText(/Accessibility → Motion → Reduce Motion/)).toBeTruthy()
  })

  it('shows the Android settings path on Android', () => {
    setup({ ua: ANDROID })
    render(<PipMotionHint />)
    expect(screen.getByText(/Accessibility → Remove animations/)).toBeTruthy()
    expect(trackMock).toHaveBeenCalledWith('pip_motion_hint_shown', { platform: 'android' })
  })

  it('shows only the explanation on other platforms', () => {
    setup({ ua: DESKTOP })
    render(<PipMotionHint />)
    expect(screen.getByText(/Reduce Motion is on, so Pip holds still/)).toBeTruthy()
    expect(screen.queryByText(/Settings →/)).toBeNull()
  })

  it('"Got it" hides the hint, persists the flag and tracks the dismissal', () => {
    setup()
    const { container } = render(<PipMotionHint />)
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(useStore.getState().pipMotionHintSeen).toBe(true)
    expect(trackMock).toHaveBeenCalledWith('pip_motion_hint_dismissed', { platform: 'ios' })
    expect(container.firstChild).toBeNull()
  })
})
