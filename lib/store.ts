'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CachedExhibit, Language, User } from '@/lib/types'

interface Store {
  // persisted
  language: Language
  setLanguage: (l: Language) => void

  visitedExhibits: string[]
  markVisited: (exhibitId: string) => void

  mapViewport: { center: [number, number]; zoom: number } | null
  setMapViewport: (v: { center: [number, number]; zoom: number }) => void

  cachedExhibits: CachedExhibit[]
  setCachedExhibits: (e: CachedExhibit[]) => void

  // keyed by Cache Storage cache name, e.g. 'audio-cache'
  completionByGroup: Record<string, { language?: Language; complete: boolean }>
  setCompletionByGroup: (cacheName: string, c: { language?: Language; complete: boolean }) => void

  // keyed by raw asset URL
  assetFailures: Record<string, { count: number }>
  setAssetFailures: (f: Record<string, { count: number }>) => void

  // session only
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

      mapViewport: null,
      setMapViewport: (mapViewport) => set({ mapViewport }),

      cachedExhibits: [],
      setCachedExhibits: (cachedExhibits) => set({ cachedExhibits }),

      completionByGroup: {},
      setCompletionByGroup: (cacheName, c) =>
        set((s) => ({ completionByGroup: { ...s.completionByGroup, [cacheName]: c } })),

      assetFailures: {},
      setAssetFailures: (assetFailures) => set({ assetFailures }),

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
        mapViewport: s.mapViewport,
        cachedExhibits: s.cachedExhibits,
        completionByGroup: s.completionByGroup,
        assetFailures: s.assetFailures,
      }),
    }
  )
)
