import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/lib/store'

beforeEach(() => {
  useStore.setState({
    language: 'en',
    visitedExhibits: [],
    audioState: { isPlaying: false, currentExhibitId: null, positionSec: 0 },
  })
})

describe('language', () => {
  it('defaults to en', () => {
    expect(useStore.getState().language).toBe('en')
  })

  it('updates on setLanguage', () => {
    useStore.getState().setLanguage('hi')
    expect(useStore.getState().language).toBe('hi')
  })
})

describe('visitedExhibits', () => {
  it('marks an exhibit visited', () => {
    useStore.getState().markVisited('abc')
    expect(useStore.getState().visitedExhibits).toContain('abc')
  })

  it('does not duplicate', () => {
    useStore.getState().markVisited('abc')
    useStore.getState().markVisited('abc')
    expect(useStore.getState().visitedExhibits.filter((id) => id === 'abc')).toHaveLength(1)
  })
})

describe('audioState', () => {
  it('defaults to not playing', () => {
    expect(useStore.getState().audioState.isPlaying).toBe(false)
  })

  it('updates partially', () => {
    useStore.getState().setAudioState({ isPlaying: true, currentExhibitId: 'abc' })
    const { audioState } = useStore.getState()
    expect(audioState.isPlaying).toBe(true)
    expect(audioState.currentExhibitId).toBe('abc')
    expect(audioState.positionSec).toBe(0)
  })
})
