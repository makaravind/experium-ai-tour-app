import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/lib/store'

beforeEach(() => {
  useStore.setState({
    language: 'en',
    visitedExhibits: [],
    cachedExhibits: [],
    completionByGroup: {},
    assetFailures: {},
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

describe('precache slice', () => {
  it('defaults empty', () => {
    const s = useStore.getState()
    expect(s.cachedExhibits).toEqual([])
    expect(s.completionByGroup).toEqual({})
    expect(s.assetFailures).toEqual({})
  })

  it('sets completion per group without clobbering others', () => {
    useStore.getState().setCompletionByGroup('audio-cache', { language: 'en', complete: true })
    useStore.getState().setCompletionByGroup('image-cache', { complete: false })
    expect(useStore.getState().completionByGroup).toEqual({
      'audio-cache': { language: 'en', complete: true },
      'image-cache': { complete: false },
    })
  })

  it('stores asset failures', () => {
    useStore.getState().setAssetFailures({ 'https://x/a.mp3': { count: 3 } })
    expect(useStore.getState().assetFailures['https://x/a.mp3'].count).toBe(3)
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
