'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CachedAmenity, CachedExhibit, Language, User } from '@/lib/types'

export type QueuedScan = {
  id: string
  code: string
  scanned_at: string
  fields: Record<string, unknown>
}

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

  cachedAmenities: CachedAmenity[]
  setCachedAmenities: (a: CachedAmenity[]) => void

  // QR codes already counted toward totalDiscovered
  discoveredCodes: string[]
  // null if already discovered, else appends + increments totalDiscovered
  discoverCode: (code: string) => { prevTotal: number; newTotal: number } | null

  // scans awaiting upload
  scanQueue: QueuedScan[]
  pushScan: (entry: QueuedScan) => void
  removeScan: (id: string) => void

  // language the offline dataset/audio is downloaded for
  precacheLanguage: Language | null
  setPrecacheLanguage: (l: Language | null) => void

  // keyed by Cache Storage cache name, e.g. 'audio-cache'
  completionByGroup: Record<string, { language?: Language; complete: boolean }>
  setCompletionByGroup: (cacheName: string, c: { language?: Language; complete: boolean }) => void

  // keyed by raw asset URL
  assetFailures: Record<string, { count: number }>
  setAssetFailures: (f: Record<string, { count: number }>) => void

  // capped URLs the visitor chose to "Continue anyway" past
  acknowledgedCapped: string[]
  setAcknowledgedCapped: (urls: string[]) => void

  // session only
  visitorId: string | null
  setVisitorId: (id: string) => void

  userInfo: User | null
  setUserInfo: (info: User) => void

  totalDiscovered: number
  setTotalDiscovered: (n: number) => void

  listenedCurrentExhibit: boolean
  setListenedCurrentExhibit: (b: boolean) => void

  refreshRequested: boolean
  setRefreshRequested: (v: boolean) => void

  moreMenuOpen: boolean
  setMoreMenuOpen: (v: boolean) => void

  profileModalOpen: boolean
  setProfileModalOpen: (v: boolean) => void
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
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

      cachedAmenities: [],
      setCachedAmenities: (cachedAmenities) => set({ cachedAmenities }),

      discoveredCodes: [],
      discoverCode: (code) => {
        const s = get()
        if (s.discoveredCodes.includes(code)) return null
        const prevTotal = s.totalDiscovered
        const newTotal = prevTotal + 1
        set({ discoveredCodes: [...s.discoveredCodes, code], totalDiscovered: newTotal })
        return { prevTotal, newTotal }
      },

      scanQueue: [],
      pushScan: (entry) => set((s) => ({ scanQueue: [...s.scanQueue, entry] })),
      removeScan: (id) => set((s) => ({ scanQueue: s.scanQueue.filter((e) => e.id !== id) })),

      precacheLanguage: null,
      setPrecacheLanguage: (precacheLanguage) => set({ precacheLanguage }),

      completionByGroup: {},
      setCompletionByGroup: (cacheName, c) =>
        set((s) => ({ completionByGroup: { ...s.completionByGroup, [cacheName]: c } })),

      assetFailures: {},
      setAssetFailures: (assetFailures) => set({ assetFailures }),

      acknowledgedCapped: [],
      setAcknowledgedCapped: (acknowledgedCapped) => set({ acknowledgedCapped }),

      visitorId: null,
      setVisitorId: (visitorId) => set({ visitorId }),

      userInfo: null,
      setUserInfo: (userInfo) => set({ userInfo }),

      totalDiscovered: 0,
      setTotalDiscovered: (totalDiscovered) => set({ totalDiscovered }),

      listenedCurrentExhibit: false,
      setListenedCurrentExhibit: (listenedCurrentExhibit) => set({ listenedCurrentExhibit }),

      refreshRequested: false,
      setRefreshRequested: (refreshRequested) => set({ refreshRequested }),

      moreMenuOpen: false,
      setMoreMenuOpen: (moreMenuOpen) => set({ moreMenuOpen }),

      profileModalOpen: false,
      setProfileModalOpen: (profileModalOpen) => set({ profileModalOpen }),
    }),
    {
      name: 'experium-store',
      version: 2,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<Store>
        if (version === 0) {
          return {
            ...state,
            cachedExhibits: [],
            cachedAmenities: [],
            precacheLanguage:
              state.completionByGroup?.['audio-cache']?.language ?? state.language ?? 'en',
          } as Store
        }
        // v1 cachedExhibits has no GPS: clear so AppGate re-runs runPrecache
        if (version < 2) return { ...state, cachedExhibits: [], cachedAmenities: [] } as Store
        return state as Store
      },
      partialize: (s) => ({
        language: s.language,
        visitedExhibits: s.visitedExhibits,
        totalDiscovered: s.totalDiscovered,
        visitorId: s.visitorId,
        userInfo: s.userInfo,
        mapViewport: s.mapViewport,
        cachedExhibits: s.cachedExhibits,
        cachedAmenities: s.cachedAmenities,
        discoveredCodes: s.discoveredCodes,
        scanQueue: s.scanQueue,
        precacheLanguage: s.precacheLanguage,
        completionByGroup: s.completionByGroup,
        assetFailures: s.assetFailures,
        acknowledgedCapped: s.acknowledgedCapped,
      }),
    }
  )
)
