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

interface MapDebug {
  zoom: number
  startingZoom: number | null
  outOfBounds: boolean
  lat: number
  lng: number
}

interface DebugStore {
  isActive: boolean
  setActive: (v: boolean) => void
  gps: GpsCoords | null
  setGps: (coords: GpsCoords) => void
  apiLog: ApiLogEntry[]
  logApi: (label: string, response: unknown) => void
  clearApiLog: () => void
  mapDebug: MapDebug | null
  setMapDebug: (m: MapDebug) => void
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
  mapDebug: null,
  setMapDebug: (mapDebug) => set({ mapDebug }),
}))
