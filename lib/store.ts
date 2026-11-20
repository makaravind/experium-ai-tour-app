'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CachedAmenity, CachedExhibit, Language, TourSpot, User } from '@/lib/types'
import { CAMPAIGNS } from '@/lib/campaigns'
import { discoverVia, type Ctx } from '@/lib/discovery'

export const DEFAULT_CAMPAIGN_ID = 'default'

export type CampaignProgress = { codes: string[]; total: number }

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

  tourSpot: TourSpot | null
  setTourSpot: (s: TourSpot) => void
  clearTourSpot: () => void
  markTourSpotFlown: () => void

  // per campaign: exhibit codes already discovered + the count (the server total replaces it on queue drain)
  discoveredByCampaign: Record<string, CampaignProgress>
  // runs discoverVia per campaign; returns the default campaign's totals, or null if it didn't
  // newly discover this code (no rule matched or duplicate)
  discoverCode: (code: string, ctx: Ctx) => { prevTotal: number; newTotal: number } | null

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

  // writes the default campaign's total, keeping its codes
  setTotalDiscovered: (n: number) => void

  listenedCurrentExhibit: boolean
  setListenedCurrentExhibit: (b: boolean) => void

  refreshRequested: boolean
  setRefreshRequested: (v: boolean) => void

  moreMenuOpen: boolean
  setMoreMenuOpen: (v: boolean) => void

  profileModalOpen: boolean
  setProfileModalOpen: (v: boolean) => void

  insightsUnlocked: boolean
  setInsightsUnlocked: (v: boolean) => void

  // default-campaign total TrailCard last celebrated, so a new discovery celebrates once
  lastCelebratedTotal: number
  setLastCelebratedTotal: (n: number) => void
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

      tourSpot: null,
      setTourSpot: (tourSpot) => set({ tourSpot }),
      clearTourSpot: () => set({ tourSpot: null }),
      markTourSpotFlown: () =>
        set((s) => (s.tourSpot ? { tourSpot: { ...s.tourSpot, flown: true } } : s)),

      discoveredByCampaign: {},
      discoverCode: (code, ctx) => {
        const byCampaign = get().discoveredByCampaign
        const next = { ...byCampaign }
        let result: { prevTotal: number; newTotal: number } | null = null
        let changed = false
        for (const { id } of CAMPAIGNS) {
          if (!discoverVia(ctx)) continue
          const cur = byCampaign[id] ?? { codes: [], total: 0 }
          if (cur.codes.includes(code)) continue
          changed = true
          next[id] = { codes: [...cur.codes, code], total: cur.total + 1 }
          if (id === DEFAULT_CAMPAIGN_ID) result = { prevTotal: cur.total, newTotal: cur.total + 1 }
        }
        if (changed) set({ discoveredByCampaign: next })
        return result
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

      setTotalDiscovered: (total) =>
        set((s) => ({
          discoveredByCampaign: {
            ...s.discoveredByCampaign,
            [DEFAULT_CAMPAIGN_ID]: {
              codes: s.discoveredByCampaign[DEFAULT_CAMPAIGN_ID]?.codes ?? [],
              total,
            },
          },
        })),

      listenedCurrentExhibit: false,
      setListenedCurrentExhibit: (listenedCurrentExhibit) => set({ listenedCurrentExhibit }),

      refreshRequested: false,
      setRefreshRequested: (refreshRequested) => set({ refreshRequested }),

      moreMenuOpen: false,
      setMoreMenuOpen: (moreMenuOpen) => set({ moreMenuOpen }),

      profileModalOpen: false,
      setProfileModalOpen: (profileModalOpen) => set({ profileModalOpen }),

      insightsUnlocked: false,
      setInsightsUnlocked: (insightsUnlocked) => set({ insightsUnlocked }),

      lastCelebratedTotal: 0,
      setLastCelebratedTotal: (lastCelebratedTotal) => set({ lastCelebratedTotal }),
    }),
    {
      name: 'experium-store',
      version: 11,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<Store>
        // v9 keys discoveries by campaign: fold the old scalar shape into `default`
        if (version < 9) {
          const old = state as { discoveredCodes?: string[]; totalDiscovered?: number }
          state.discoveredByCampaign = {
            [DEFAULT_CAMPAIGN_ID]: {
              codes: old.discoveredCodes ?? [],
              total: old.totalDiscovered ?? 0,
            },
          }
        }
        // v10 replaces the persisted insightsKey string with an insightsUnlocked flag
        if (version < 10) {
          const old = state as { insightsKey?: string | null }
          state.insightsUnlocked = !!old.insightsKey
          delete old.insightsKey
        }
        // v11 adds lastCelebratedTotal: seed it to the current total so existing visitors don't celebrate on first load
        if (version < 11) {
          state.lastCelebratedTotal = state.discoveredByCampaign?.[DEFAULT_CAMPAIGN_ID]?.total ?? 0
        }
        // v9 caches are still valid
        if (version === 9) return state as Store
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
        // v2 cachedExhibits missing exhibitStatus/displayNumber/facts: clear to force re-fetch
        if (version < 3) return { ...state, cachedExhibits: [], cachedAmenities: [] } as Store
        // v3 cachedExhibits carry displayNumber, not displayId: clear to force re-fetch
        if (version < 4) return { ...state, cachedExhibits: [], cachedAmenities: [] } as Store
        // v4 cachedAmenities lack section: clear to force re-fetch
        if (version < 5) return { ...state, cachedExhibits: [], cachedAmenities: [] } as Store
        // v5 cachedExhibits lack tour_* fields: clear to force re-fetch
        if (version < 6) return { ...state, cachedExhibits: [], cachedAmenities: [] } as Store
        // v7 cachedExhibits lack photos: clear to force re-fetch (v6 also gets the v7 tourSpot default)
        return {
          ...state,
          ...(version < 7 && { tourSpot: null }),
          cachedExhibits: [],
          cachedAmenities: [],
        } as Store
      },
      partialize: (s) => ({
        language: s.language,
        visitedExhibits: s.visitedExhibits,
        visitorId: s.visitorId,
        userInfo: s.userInfo,
        mapViewport: s.mapViewport,
        cachedExhibits: s.cachedExhibits,
        cachedAmenities: s.cachedAmenities,
        tourSpot: s.tourSpot,
        discoveredByCampaign: s.discoveredByCampaign,
        scanQueue: s.scanQueue,
        precacheLanguage: s.precacheLanguage,
        completionByGroup: s.completionByGroup,
        assetFailures: s.assetFailures,
        acknowledgedCapped: s.acknowledgedCapped,
        insightsUnlocked: s.insightsUnlocked,
        lastCelebratedTotal: s.lastCelebratedTotal,
      }),
    }
  )
)

export const selectTotalDiscovered = (s: Store) =>
  s.discoveredByCampaign[DEFAULT_CAMPAIGN_ID]?.total ?? 0
