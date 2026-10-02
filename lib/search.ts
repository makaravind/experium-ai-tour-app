import type { MapExhibit } from './types'

export function matchesQuery(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.trim().toLowerCase())
}

export function filterExhibits(exhibits: MapExhibit[], query: string): MapExhibit[] {
  return exhibits
    .filter((e) => matchesQuery(e.name, query))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function matchRange(
  name: string,
  query: string,
): { start: number; end: number } | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const start = name.toLowerCase().indexOf(q)
  if (start === -1) return null
  return { start, end: start + q.length }
}
