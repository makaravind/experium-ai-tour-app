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
