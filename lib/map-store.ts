import { create } from 'zustand'
import type { ExhibitAudio, PreviewExhibit } from './types'

interface ExhibitPageData {
  exhibit: PreviewExhibit
  audio: ExhibitAudio[]
  autoPlay: boolean
  onFirstPlay: () => void
  onQuartile: (sec: number, quartile: number) => void
}

interface UserPosition {
  lat: number
  lng: number
  accuracyM: number
}

interface MapStoreState {
  exhibitPageData: ExhibitPageData | null
  setExhibitPageData: (data: ExhibitPageData) => void
  clearExhibitPageData: () => void
  activeExhibitId: string | null
  setActiveExhibitId: (id: string | null) => void
  nearbyExhibitIds: string[]
  setNearbyExhibitIds: (ids: string[]) => void
  userPosition: UserPosition | null
  setUserPosition: (pos: UserPosition | null) => void
  followMode: 'idle' | 'following'
  setFollowMode: (mode: 'idle' | 'following') => void
  geoError: 'denied' | 'unavailable' | null
  setGeoError: (err: 'denied' | 'unavailable' | null) => void
  recenterTrigger: (() => void) | null
  setRecenterTrigger: (fn: (() => void) | null) => void
  retryGpsTrigger: (() => void) | null
  setRetryGpsTrigger: (fn: (() => void) | null) => void
  // A promise rather than the resolved value: audio can finish playing before the
  // scan request resolves, so handleAudioEnded awaits whatever is in flight instead
  // of checking an already-settled value (which would silently drop the discovery).
  pendingDiscoveryPromise: Promise<{
    exhibitId: string
    prevTotal: number
    newTotal: number
  } | null> | null
  setPendingDiscoveryPromise: (
    p: Promise<{ exhibitId: string; prevTotal: number; newTotal: number } | null>
  ) => void
  clearPendingDiscoveryPromise: () => void
}

export const useMapStore = create<MapStoreState>((set, get) => ({
  exhibitPageData: null,
  setExhibitPageData: (data) => set({ exhibitPageData: data }),
  clearExhibitPageData: () => set({ exhibitPageData: null }),
  activeExhibitId: null,
  setActiveExhibitId: (id) => set({ activeExhibitId: id }),
  nearbyExhibitIds: [],
  setNearbyExhibitIds: (ids) => {
    const current = get().nearbyExhibitIds
    if (current.length === ids.length && current.every((id, i) => id === ids[i])) {
      return
    }
    set({ nearbyExhibitIds: ids })
  },
  userPosition: null,
  setUserPosition: (pos) => set({ userPosition: pos }),
  followMode: 'idle',
  setFollowMode: (mode) => set({ followMode: mode }),
  geoError: null,
  setGeoError: (err) => set({ geoError: err }),
  recenterTrigger: null,
  setRecenterTrigger: (fn) => set({ recenterTrigger: fn }),
  retryGpsTrigger: null,
  setRetryGpsTrigger: (fn) => set({ retryGpsTrigger: fn }),
  pendingDiscoveryPromise: null,
  setPendingDiscoveryPromise: (p) => set({ pendingDiscoveryPromise: p }),
  clearPendingDiscoveryPromise: () => set({ pendingDiscoveryPromise: null }),
}))
