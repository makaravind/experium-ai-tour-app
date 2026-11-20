import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMascotReaction } from '@/lib/use-mascot-reaction'

describe('useMascotReaction', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts null, sets a reaction, auto-clears after ms', () => {
    const { result } = renderHook(() => useMascotReaction())
    expect(result.current[0]).toBeNull()

    act(() => result.current[1]('celebrating', 2000))
    expect(result.current[0]).toBe('celebrating')

    act(() => vi.advanceTimersByTime(1999))
    expect(result.current[0]).toBe('celebrating')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current[0]).toBeNull()
  })

  it('newest reaction wins and cancels the older timer', () => {
    const { result } = renderHook(() => useMascotReaction())
    act(() => result.current[1]('thinking', 1000))
    act(() => vi.advanceTimersByTime(800))
    act(() => result.current[1]('celebrating', 1000))

    act(() => vi.advanceTimersByTime(300)) // old timer would have fired here
    expect(result.current[0]).toBe('celebrating')
    act(() => vi.advanceTimersByTime(700))
    expect(result.current[0]).toBeNull()
  })

  it('keeps a stable react identity', () => {
    const { result, rerender } = renderHook(() => useMascotReaction())
    const first = result.current[1]
    act(() => first('thinking', 100))
    rerender()
    expect(result.current[1]).toBe(first)
  })

  it('clears the timer on unmount (no pending timers, no late update)', () => {
    const { result, unmount } = renderHook(() => useMascotReaction())
    act(() => result.current[1]('thinking', 1000))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
