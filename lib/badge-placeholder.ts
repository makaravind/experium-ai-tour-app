// Placeholder badge colors per milestone, until real artwork ships (#62).
export const MILESTONE_BADGE_COLORS: Record<number, string> = {
  1: '#a3b18a',
  3: '#8fae6e',
  5: '#588157',
  10: '#3f6b3a',
  15: '#c9a227',
  20: '#dda15e',
  30: '#b8834a',
  40: '#8a5a3b',
  50: '#d1495b',
}

export function getBadgeColor(m: number): string {
  return MILESTONE_BADGE_COLORS[m]
}

export const CARD_GRADIENT_STOPS: [number, string][] = [
  [0, '#6f8f56'],
  [0.55, '#4d6b46'],
  [1, '#b8834a'],
]
export const CARD_GRADIENT_CSS = `linear-gradient(150deg,${CARD_GRADIENT_STOPS.map(([pos, c]) => `${c} ${Math.round(pos * 100)}%`).join(',')})`
