export const FOCUS_RADIUS_PX = 90 // map: from the screen center
export const FOCUS_RADIUS_DEG = 20 // tour: angular distance from the view center
export const FOCUS_SETTLE_MS = 250

// Nearest candidate within maxDistance (inclusive), or null. Ties go to the first.
export function pickFocus(
  candidates: { id: string; distance: number }[],
  maxDistance: number
): string | null {
  let best: { id: string; distance: number } | null = null
  for (const c of candidates) {
    if (c.distance <= maxDistance && (!best || c.distance < best.distance)) best = c
  }
  return best ? best.id : null
}
