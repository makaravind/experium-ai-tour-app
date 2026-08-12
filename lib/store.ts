'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from '@/lib/types'

type OnboardingStep = 'loading' | 'info' | 'exhibit' | null

interface Store {
  // persisted
  language: Language
  setLanguage: (l: Language) => void

  visitedExhibits: string[]
  markVisited: (exhibitId: string) => void

  // session only
  onboardingStep: OnboardingStep
  setOnboardingStep: (s: OnboardingStep) => void

  visitorId: string | null
  setVisitorId: (id: string) => void

  totalDiscovered: number
  setTotalDiscovered: (n: number) => void
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

      onboardingStep: null,
      setOnboardingStep: (onboardingStep) => set({ onboardingStep }),

      visitorId: null,
      setVisitorId: (visitorId) => set({ visitorId }),

      totalDiscovered: 0,
      setTotalDiscovered: (totalDiscovered) => set({ totalDiscovered }),
    }),
    {
      name: 'experium-store',
      partialize: (s) => ({
        language: s.language,
        visitedExhibits: s.visitedExhibits,
        totalDiscovered: s.totalDiscovered,
      }),
    }
  )
)
