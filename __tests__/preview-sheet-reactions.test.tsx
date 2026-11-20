import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { useStore } from '@/lib/store'
import PreviewSheet from '@/components/exhibit/PreviewSheet'
import type { ExhibitAudio, PreviewExhibit } from '@/lib/types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@vercel/analytics', () => ({ track: vi.fn() }))
vi.mock('@/lib/precache', () => ({ AUDIO_CACHE_NAME: 'audio' }))
vi.mock('@/components/common/BottomSheet', () => ({
  default: ({ perch, children }: { perch?: ReactNode; children: (s: object) => ReactNode }) =>
    createElement(
      'div',
      null,
      perch,
      children({ expanded: false, collapse: vi.fn(), expand: vi.fn() })
    ),
}))
vi.mock('@/components/common/SheetSummary', () => ({ default: () => null }))
vi.mock('@/components/common/LanguageSelector', () => ({ default: () => null }))
vi.mock('@/components/common/SheetPerchPip', () => ({
  default: ({ state }: { state: string }) =>
    createElement('div', { 'data-testid': 'pip', 'data-state': state }),
}))

const exhibit = (id: string) => ({ id, name: id, facts: [] }) as unknown as PreviewExhibit
const audio = [{ language: 'en', audio_url: 'https://x/en.mp3' }] as unknown as ExhibitAudio[]

const pip = () => screen.getByTestId('pip').getAttribute('data-state')
const audioEl = () => document.querySelector('audio') as HTMLAudioElement

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('MediaError', { MEDIA_ERR_ABORTED: 1 })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  useStore.setState({ language: 'en', precacheLanguage: null })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('PreviewSheet Pip reactions', () => {
  it('is surprised on open, then idle after 1.2 s', () => {
    render(createElement(PreviewSheet, { exhibit: exhibit('e1'), audio }))
    expect(pip()).toBe('surprised')
    act(() => void vi.advanceTimersByTime(1200))
    expect(pip()).toBe('idle')
  })

  it('stays idle with no exhibit', () => {
    render(createElement(PreviewSheet, { exhibit: null, audio }))
    expect(pip()).toBe('idle')
  })

  it('celebrates after audio ends, then idle after 2 s', () => {
    render(createElement(PreviewSheet, { exhibit: exhibit('e1'), audio }))
    act(() => void vi.advanceTimersByTime(1200))
    fireEvent.ended(audioEl())
    expect(pip()).toBe('celebrating')
    act(() => void vi.advanceTimersByTime(2000))
    expect(pip()).toBe('idle')
  })

  it('is sad on an audio error, then idle after 3 s', () => {
    render(createElement(PreviewSheet, { exhibit: exhibit('e1'), audio }))
    act(() => void vi.advanceTimersByTime(1200))
    Object.defineProperty(audioEl(), 'error', { value: { code: 4 }, configurable: true })
    fireEvent.error(audioEl())
    expect(pip()).toBe('sad')
    act(() => void vi.advanceTimersByTime(3000))
    expect(pip()).toBe('idle')
  })

  it('speaking overrides a pending reaction', () => {
    render(createElement(PreviewSheet, { exhibit: exhibit('e1'), audio }))
    expect(pip()).toBe('surprised')
    fireEvent.play(audioEl())
    expect(pip()).toBe('speaking')
    fireEvent.pause(audioEl())
    expect(pip()).toBe('surprised')
  })

  it('is sad when the "Needs internet" banner appears', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    vi.stubGlobal('caches', {
      open: () => Promise.resolve({ match: () => Promise.resolve(undefined) }),
    })
    render(createElement(PreviewSheet, { exhibit: exhibit('e1'), audio }))
    act(() => void vi.advanceTimersByTime(1200))
    expect(pip()).toBe('idle')
    await act(async () => {})
    expect(screen.getByText('Needs internet to play')).toBeTruthy()
    expect(pip()).toBe('sad')
    act(() => void vi.advanceTimersByTime(3000))
    expect(pip()).toBe('idle')
  })
})
