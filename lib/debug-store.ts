import { create } from 'zustand'

interface GpsCoords {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
}

interface ApiLogEntry {
  label: string
  response: unknown
  timestamp: number
}

interface DebugStore {
  isActive: boolean
  setActive: (v: boolean) => void
  gps: GpsCoords | null
  setGps: (coords: GpsCoords) => void
  apiLog: ApiLogEntry[]
  logApi: (label: string, response: unknown) => void
  clearApiLog: () => void
}

export const useDebugStore = create<DebugStore>((set) => ({
  isActive: false,
  setActive: (isActive) => set({ isActive }),
  gps: null,
  setGps: (gps) => set({ gps }),
  apiLog: [],
  logApi: (label, response) =>
    set((s) => ({
      apiLog: [...s.apiLog, { label, response, timestamp: Date.now() }],
    })),
  clearApiLog: () => set({ apiLog: [] }),
}))
