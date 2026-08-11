'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Language = 'en' | 'hi' | 'te'

interface AudioState {
  isPlaying: boolean
  currentExhibitId: string | null
  positionSec: number
}

interface Store {
  // persisted
  language: Language
  setLanguage: (l: Language) => void

  visitedExhibits: string[]
  markVisited: (exhibitId: string) => void

  // session only
  audioState: AudioState
  setAudioState: (s: Partial<AudioState>) => void
}

const defaultAudioState: AudioState = {
  isPlaying: false,
  currentExhibitId: null,
  positionSec: 0,
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => set({ language }),

      visitedExhibits: [],
      markVisited: (exhibitId) =>
        set((s) => ({
          visitedExhibits: s.visitedExhibits.includes(exhibitId)
            ? s.visitedExhibits
            : [...s.visitedExhibits, exhibitId],
        })),

      audioState: defaultAudioState,
      setAudioState: (partial) => set((s) => ({ audioState: { ...s.audioState, ...partial } })),
    }),
    {
      name: 'experium-store',
      // audioState is excluded — session only
      partialize: (s) => ({ language: s.language, visitedExhibits: s.visitedExhibits }),
    }
  )
)
