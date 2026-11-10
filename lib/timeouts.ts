export const DATASET_TIMEOUT_MS = 15_000
export const HANDSHAKE_TIMEOUT_MS = 10_000
export const AUDIO_IDLE_TIMEOUT_MS = 15_000
export const TOUR_SLOW_TIMEOUT_MS = 15_000
export const TOUR_SPLASH_MIN_MS = 800
export const TOUR_TOAST_MS = 3000

export class ConnectionTimeoutError extends Error {
  name = 'ConnectionTimeoutError'
}
