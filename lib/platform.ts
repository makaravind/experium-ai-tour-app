export type Platform = 'ios' | 'android' | 'other'

/** iPadOS 13+ reports a Mac user agent, so a touch-capable Mac is an iPad. */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
  if (/android/i.test(userAgent)) return 'android'
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios'
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'ios'
  return 'other'
}
