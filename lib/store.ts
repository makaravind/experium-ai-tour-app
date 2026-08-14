'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language, User } from '@/lib/types'

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

  userInfo: User | null
  setUserInfo: (info: User) => void

  totalDiscovered: number
  setTotalDiscovered: (n: number) => void

  listenedCurrentExhibit: boolean
  setListenedCurrentExhibit: (b: boolean) => void
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

      userInfo: null,
      setUserInfo: (userInfo) => set({ userInfo }),

      totalDiscovered: 0,
      setTotalDiscovered: (totalDiscovered) => set({ totalDiscovered }),

      listenedCurrentExhibit: false,
      setListenedCurrentExhibit: (listenedCurrentExhibit) => set({ listenedCurrentExhibit }),
    }),
    {
      name: 'experium-store',
      partialize: (s) => ({
        language: s.language,
        visitedExhibits: s.visitedExhibits,
        totalDiscovered: s.totalDiscovered,
        visitorId: s.visitorId,
        userInfo: s.userInfo,
      }),
    }
  )
)
