import { describe, expect, it } from 'vitest'
import { detectPlatform } from '@/lib/platform'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

describe('detectPlatform', () => {
  it('detects iOS and Android from the user agent', () => {
    expect(detectPlatform(IPHONE)).toBe('ios')
    expect(detectPlatform(ANDROID)).toBe('android')
  })

  it('treats a touch-capable Mac user agent as iPadOS, a plain Mac as other', () => {
    expect(detectPlatform(MAC, 5)).toBe('ios')
    expect(detectPlatform(MAC, 0)).toBe('other')
  })

  it('falls back to other', () => {
    expect(detectPlatform('Mozilla/5.0 (X11; Linux x86_64) Firefox/126.0')).toBe('other')
  })
})
