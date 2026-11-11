import { describe, it, expect } from 'vitest'
import { splashView } from '@/lib/tour'

const base = { loaded: false, minElapsed: false, offline: false, slow: false }

describe('splashView', () => {
  it('loading while not ready', () => {
    expect(splashView(base)).toBe('loading')
  })

  it('stays visible when loaded before the minimum display time', () => {
    expect(splashView({ ...base, loaded: true })).toBe('loading')
  })

  it('stays visible after the minimum time until loaded', () => {
    expect(splashView({ ...base, minElapsed: true })).toBe('loading')
  })

  it('hides when loaded and minimum time elapsed', () => {
    expect(splashView({ ...base, loaded: true, minElapsed: true })).toBe('hidden')
  })

  it('shows slow after the slow timeout', () => {
    expect(splashView({ ...base, slow: true })).toBe('slow')
  })

  it('offline wins over everything', () => {
    expect(splashView({ loaded: true, minElapsed: true, offline: true, slow: true })).toBe(
      'offline'
    )
  })
})
