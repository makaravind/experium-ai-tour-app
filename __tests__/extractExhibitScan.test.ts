import { describe, it, expect } from 'vitest'
import { extractExhibitScan } from '@/lib/scan-utils'

describe('extractExhibitScan', () => {
  it('forwards the onsite scansrc encoded on a physical plate URL', () => {
    expect(extractExhibitScan('https://app.example.com/s/baobab?scan=1&scansrc=onsite')).toEqual({
      code: 'baobab',
      scansrc: 'onsite',
    })
  })

  it('falls back to null scansrc when the URL has none', () => {
    expect(extractExhibitScan('https://app.example.com/s/baobab')).toEqual({
      code: 'baobab',
      scansrc: null,
    })
  })

  it('treats a bare code string as a code with no scansrc', () => {
    expect(extractExhibitScan('baobab')).toEqual({ code: 'baobab', scansrc: null })
  })

  it('returns null for text that is neither a matching URL nor a bare code', () => {
    expect(extractExhibitScan('https://example.com/not-an-exhibit')).toBe(null)
    expect(extractExhibitScan('not a url and too many spaces to be a code')).toBe(null)
  })
})
