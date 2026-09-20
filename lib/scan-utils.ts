export function extractExhibitScan(text: string): { code: string; scansrc: string | null } | null {
  try {
    const url = new URL(text)
    const match = url.pathname.match(/^\/s\/([^/?#]+)/)
    if (match) return { code: match[1], scansrc: url.searchParams.get('scansrc') }
  } catch {
    if (/^[a-zA-Z0-9_-]{2,32}$/.test(text)) return { code: text, scansrc: null }
  }
  return null
}
