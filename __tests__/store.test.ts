import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/lib/store'

beforeEach(() => {
  useStore.setState({
    language: 'en',
    visitedExhibits: [],
    onboardingStep: null,
    visitorId: null,
    totalDiscovered: 0,
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

describe('onboardingStep', () => {
  it('defaults to null (uninitialized)', () => {
    expect(useStore.getState().onboardingStep).toBe(null)
  })

  it('advances to exhibit', () => {
    useStore.getState().setOnboardingStep('exhibit')
    expect(useStore.getState().onboardingStep).toBe('exhibit')
  })
})

describe('totalDiscovered', () => {
  it('defaults to 0', () => {
    expect(useStore.getState().totalDiscovered).toBe(0)
  })

  it('updates', () => {
    useStore.getState().setTotalDiscovered(5)
    expect(useStore.getState().totalDiscovered).toBe(5)
  })
})
