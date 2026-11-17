export type SearchDeepLink = 'must-visit' | 'amenities' | 'exhibits'

const VALUES: readonly string[] = ['must-visit', 'amenities', 'exhibits']

/** `?search=` value from a query string, or null when absent/unknown. */
export function parseSearchDeepLink(search: string): SearchDeepLink | null {
  const v = new URLSearchParams(search).get('search')
  return v && VALUES.includes(v) ? (v as SearchDeepLink) : null
}
