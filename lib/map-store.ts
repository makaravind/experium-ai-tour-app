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
}

export const useMapStore = create<MapStoreState>((set) => ({
  exhibitPageData: null,
  setExhibitPageData: (data) => set({ exhibitPageData: data }),
  clearExhibitPageData: () => set({ exhibitPageData: null }),
}))
