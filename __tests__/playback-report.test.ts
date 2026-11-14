import { describe, it, expect, vi, beforeEach } from 'vitest'

const { enqueueScan, track } = vi.hoisted(() => ({ enqueueScan: vi.fn(), track: vi.fn() }))
vi.mock('@/lib/scan-queue', () => ({ enqueueScan }))
vi.mock('@vercel/analytics', () => ({ track }))

import { positionFields, reportPlayback } from '@/lib/playback-report'
import { useStore } from '@/lib/store'
import { useMapStore } from '@/lib/map-store'
import type { CachedExhibit } from '@/lib/types'

const EXHIBIT = { id: 'ex-1', qrCode: 'baobab' }
const GPS = { lat: 17.3816, lng: 78.1916283 }
// ~11m north of the exhibit / ~222m north of it
const NEAR = { lat: GPS.lat + 0.0001, lng: GPS.lng, accuracyM: 18 }
const FAR = { lat: GPS.lat + 0.002, lng: GPS.lng, accuracyM: 18 }

const cached = (over: Partial<CachedExhibit> = {}) =>
  ({ id: EXHIBIT.id, gps_lat: GPS.lat, gps_lng: GPS.lng, ...over }) as CachedExhibit

const lastFields = () => enqueueScan.mock.calls.at(-1)![1]
const defaultCampaign = () => useStore.getState().discoveredByCampaign.default

beforeEach(() => {
  enqueueScan.mockReset()
  track.mockReset()
  useStore.setState({
    language: 'en',
    visitedExhibits: [],
    discoveredByCampaign: { default: { codes: [], total: 3 } },
    cachedExhibits: [cached()],
  })
  useMapStore.setState({ userPosition: null, pendingDiscovery: null })
})

describe('positionFields', () => {
  it.each([25, 49])('sends nothing at quartile %i', (q) => {
    expect(positionFields(q, NEAR)).toEqual({})
  })

  it.each([50, 75, 100])('sends lat/lng/accuracyM at quartile %i', (q) => {
    expect(positionFields(q, NEAR)).toEqual(NEAR)
  })

  it('sends nothing without a fix', () => {
    expect(positionFields(50, null)).toEqual({})
  })
})

describe('reportPlayback — first play', () => {
  it('enqueues a listened scan with scan_src, marks visited, never carries position', () => {
    useMapStore.setState({ userPosition: NEAR })
    reportPlayback(EXHIBIT, 'app')
    expect(enqueueScan).toHaveBeenCalledWith('baobab', {
      listened: true,
      scan_src: 'app',
      language: 'en',
    })
    expect(track).toHaveBeenCalledWith('playback_start', { exhibit: 'baobab' })
    expect(useStore.getState().visitedExhibits).toEqual(['ex-1'])
    expect(useStore.getState().listenedCurrentExhibit).toBe(true)
  })

  it('omits scan_src for a map play', () => {
    reportPlayback(EXHIBIT, null)
    expect(lastFields()).toEqual({ listened: true, language: 'en' })
  })
})

describe('reportPlayback — quartile', () => {
  it('25%: no position, no discovery', () => {
    useMapStore.setState({ userPosition: NEAR })
    reportPlayback(EXHIBIT, null, { sec: 15, quartile: 25 })
    expect(lastFields()).toEqual({
      listened: true,
      listen_duration_sec: 15,
      listen_quartile: 25,
      language: 'en',
    })
    expect(track).toHaveBeenCalledWith('playback_progress', { exhibit: 'baobab', quartile: 25 })
    expect(defaultCampaign().codes).toEqual([])
  })

  it('50% near: attaches position, discovers, sets pendingDiscovery', () => {
    useMapStore.setState({ userPosition: NEAR })
    reportPlayback(EXHIBIT, null, { sec: 30, quartile: 50 })
    expect(lastFields()).toMatchObject({ listen_quartile: 50, ...NEAR })
    expect(defaultCampaign()).toEqual({ codes: ['baobab'], total: 4 })
    expect(useMapStore.getState().pendingDiscovery).toEqual({
      exhibitId: 'ex-1',
      prevTotal: 3,
      newTotal: 4,
    })
  })

  it('50% far: attaches position but does not discover', () => {
    useMapStore.setState({ userPosition: FAR })
    reportPlayback(EXHIBIT, null, { sec: 30, quartile: 50 })
    expect(lastFields()).toMatchObject({ listen_quartile: 50, ...FAR })
    expect(defaultCampaign().codes).toEqual([])
    expect(useMapStore.getState().pendingDiscovery).toBeNull()
  })

  it('50% without a fix: no position fields, no discovery', () => {
    reportPlayback(EXHIBIT, null, { sec: 30, quartile: 50 })
    expect(lastFields()).not.toHaveProperty('lat')
    expect(defaultCampaign().codes).toEqual([])
  })

  it('50% near with poor accuracy: not discovered', () => {
    useMapStore.setState({ userPosition: { ...NEAR, accuracyM: 41 } })
    reportPlayback(EXHIBIT, null, { sec: 30, quartile: 50 })
    expect(defaultCampaign().codes).toEqual([])
  })

  it('50% near on an exhibit with no GPS (or not cached): not discovered', () => {
    useMapStore.setState({ userPosition: NEAR })
    useStore.setState({ cachedExhibits: [cached({ gps_lat: null, gps_lng: null })] })
    reportPlayback(EXHIBIT, null, { sec: 30, quartile: 50 })
    useStore.setState({ cachedExhibits: [] })
    reportPlayback(EXHIBIT, null, { sec: 30, quartile: 50 })
    expect(defaultCampaign().codes).toEqual([])
  })

  it('100% far: discovers (audio_complete) and sets pendingDiscovery', () => {
    useMapStore.setState({ userPosition: FAR })
    reportPlayback(EXHIBIT, null, { sec: 60, quartile: 100 })
    expect(defaultCampaign()).toEqual({ codes: ['baobab'], total: 4 })
    expect(useMapStore.getState().pendingDiscovery).toMatchObject({ newTotal: 4 })
  })

  it('already discovered code: still reports, but skips evaluation', () => {
    useStore.setState({ discoveredByCampaign: { default: { codes: ['baobab'], total: 3 } } })
    useMapStore.setState({ userPosition: NEAR })
    const discoverCode = vi.spyOn(useStore.getState(), 'discoverCode')
    reportPlayback(EXHIBIT, null, { sec: 60, quartile: 100 })
    expect(enqueueScan).toHaveBeenCalledTimes(1)
    expect(discoverCode).not.toHaveBeenCalled()
    expect(defaultCampaign().total).toBe(3)
    expect(useMapStore.getState().pendingDiscovery).toBeNull()
  })

  it('50% near then 100%: one discovery', () => {
    useMapStore.setState({ userPosition: NEAR })
    reportPlayback(EXHIBIT, null, { sec: 30, quartile: 50 })
    reportPlayback(EXHIBIT, null, { sec: 60, quartile: 100 })
    expect(defaultCampaign()).toEqual({ codes: ['baobab'], total: 4 })
  })
})
