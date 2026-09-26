import { create } from 'zustand'
import type { ExhibitAudio, PreviewExhibit } from './types'

interface ExhibitPageData {
  exhibit: PreviewExhibit
  audio: ExhibitAudio[]
  autoPlay: boolean
  onFirstPlay: () => void
  onQuartile: (sec: number, quartile: number) => void
}

interface MapStoreState {
  exhibitPageData: ExhibitPageData | null
  setExhibitPageData: (data: ExhibitPageData) => void
  clearExhibitPageData: () => void
  activeExhibitId: string | null
  setActiveExhibitId: (id: string | null) => void
  nearbyExhibitIds: string[]
  setNearbyExhibitIds: (ids: string[]) => void
  geolocateTrigger: (() => void) | null
  setGeolocateTrigger: (fn: (() => void) | null) => void
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
  geolocateTrigger: null,
  setGeolocateTrigger: (fn) => set({ geolocateTrigger: fn }),
}))
