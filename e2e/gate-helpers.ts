import { expect, type Page } from '@playwright/test'

const QR_CODE = 'baobab-forest'

// Same-origin paths so page.route intercepts on all browsers (including WebKit's <audio> element).
const BASE_URL = `http://localhost:${process.env.E2E_PORT ?? '3000'}`
export const FAKE_AUDIO_URL = `${BASE_URL}/audio/baobab-forest-en.mp3`
export const FAKE_HI_AUDIO_URL = `${BASE_URL}/audio/baobab-forest-hi.mp3`

/**
 * AppGate's bulk dataset query (lib/precache.ts fetchCachedExhibits) is the only browser-side
 * /rest/v1/exhibits call that selects `audio_url`. Mock it with one exhibit whose audio is already
 * in Cache Storage, so precache finishes instantly and the exhibit page (which reads the cached
 * dataset) has audio to play. Real audio can't be used under `npm run dev`: the service worker is
 * disabled there, so fetched audio never reaches Cache Storage and the gate ends on
 * "Connect to the internet".
 */
export async function mockPrecacheDataset(page: Page, { seedCache = true } = {}) {
  if (seedCache) await seedAudioCache(page)
  await seedMapCache(page)
  await mockAmenities(page)
  await page.route(FAKE_AUDIO_URL, (route) =>
    route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() })
  )
  await page.route('**/rest/v1/exhibits?*', async (route) => {
    if (!decodeURIComponent(route.request().url()).includes('audio_url')) return route.fallback()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'e2e-baobab',
          code: QR_CODE,
          name: 'Baobab Forest',
          type: null,
          tier: 'free',
          facts: [{ fact: 'The Baobab can store thousands of litres of water in its trunk.' }],
          status: 'live',
          gps_lat: 17.3816,
          gps_lng: 78.1916283,
          exhibit_audio: [
            { language: 'en', audio_url: FAKE_AUDIO_URL, status: 'published' },
            { language: 'hi', audio_url: FAKE_HI_AUDIO_URL, status: 'published' },
          ],
        },
      ]),
    })
  })
}

/** AppGate's bulk amenities query (lib/precache.ts fetchCachedAmenities); runPrecache fails if it errors. */
export async function mockAmenities(page: Page, rows: object[] = []) {
  await page.route('**/rest/v1/amenities?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
  )
}

/** 60s of 8-bit silence (won't end on its own) so the <audio> element can really play (fires `play` -> first-play scan). */
export function silentWav(): Buffer {
  const rate = 8000
  const n = rate * 60
  const h = Buffer.alloc(44)
  h.write('RIFF', 0)
  h.writeUInt32LE(36 + n, 4)
  h.write('WAVEfmt ', 8)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20)
  h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24)
  h.writeUInt32LE(rate, 28)
  h.writeUInt16LE(1, 32)
  h.writeUInt16LE(8, 34)
  h.write('data', 36)
  h.writeUInt32LE(n, 40)
  return Buffer.concat([h, Buffer.alloc(n, 128)])
}

// 1-second silent WAV as base64 — small enough to pass via addInitScript
const CACHE_WAV_B64 = (() => {
  const rate = 8000
  const n = rate
  const h = Buffer.alloc(44)
  h.write('RIFF', 0)
  h.writeUInt32LE(36 + n, 4)
  h.write('WAVEfmt ', 8)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20)
  h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24)
  h.writeUInt32LE(rate, 28)
  h.writeUInt16LE(1, 32)
  h.writeUInt16LE(8, 34)
  h.write('data', 36)
  h.writeUInt32LE(n, 40)
  return Buffer.concat([h, Buffer.alloc(n, 128)]).toString('base64')
})()

// Minimal valid PMTiles v3 file (128 bytes): 127-byte header + 1-byte root directory.
// The root directory is varint(0) = 0 entries, so all tile lookups return empty.
// Tile type = MVT so the protocol handler returns { data: new Uint8Array() } (not null),
// which MapLibre treats as a valid empty tile without firing a pre-load error.
const MINIMAL_PMTILES = (() => {
  const buf = Buffer.alloc(128, 0)
  buf.write('PMTiles', 0, 'ascii')
  buf[7] = 3 // version 3
  buf.writeBigUInt64LE(127n, 8) // root_dir_offset = 127 (immediately after header)
  buf.writeBigUInt64LE(1n, 16) // root_dir_length = 1 (one byte: varint 0)
  buf[97] = 1 // internal_compression = none
  buf[98] = 1 // tile_compression = none
  buf[99] = 1 // tile_type = mvt
  buf[101] = 14 // max_zoom
  buf.writeInt32LE(-1800000000, 102) // min_lon = -180
  buf.writeInt32LE(-900000000, 106) // min_lat = -90
  buf.writeInt32LE(1800000000, 110) // max_lon = 180
  buf.writeInt32LE(900000000, 114) // max_lat = 90
  // byte 127 = 0x00: varint(0) = 0 root dir entries (already 0 from alloc)
  return buf
})()

/**
 * Puts FAKE_AUDIO_URL in `audio-cache` at the start of every document load. A one-off put from a
 * throwaway page would be enough in chromium, but WebKit drops Cache Storage on navigation.
 * The put is not awaited; it settles long before AppGate's mount check (which awaits a store
 * rehydrate and a dataset query).
 */
export async function seedAudioCache(page: Page) {
  await page.addInitScript(
    ({ url, wav }: { url: string; wav: string }) => {
      const bytes = Uint8Array.from(atob(wav), (c) => c.charCodeAt(0))
      void caches
        .open('audio-cache')
        .then((c) =>
          c.put(url, new Response(bytes, { status: 200, headers: { 'Content-Type': 'audio/wav' } }))
        )
    },
    { url: FAKE_AUDIO_URL, wav: CACHE_WAV_B64 }
  )
}

/** Puts /park.pmtiles in `map-tiles-cache` at every document load so the gate passes. */
export async function seedMapCache(page: Page, body: Buffer | string = MINIMAL_PMTILES) {
  const buf = typeof body === 'string' ? Buffer.from(body) : body
  await page.addInitScript(
    ({ b64 }: { b64: string }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      void caches
        .open('map-tiles-cache')
        .then((c) => c.put('/park.pmtiles', new Response(bytes, { status: 200 })))
    },
    { b64: buf.toString('base64') }
  )
  await page.route('**/park.pmtiles', (route) =>
    route.fulfill({ status: 200, contentType: 'application/octet-stream', body: buf })
  )
}

/** Fresh visitor: AppGate starts the precache on mount; wait for it to hand off to the info modal. */
export async function passLoadingGate(page: Page) {
  await expect(page.getByText('Personalize your experience')).toBeVisible({ timeout: 10000 })
}
