import { expect, type Page } from '@playwright/test'

const QR_CODE = 'baobab-forest'

// Never fetched: AppGate only compares Cache Storage keys against the dataset's audio URLs.
export const FAKE_AUDIO_URL = 'https://example.test/audio/baobab-forest-en.mp3'
// Not seeded in Cache Storage: precache only fills the precache language, HI is streamed from the sheet.
export const FAKE_HI_AUDIO_URL = 'https://example.test/audio/baobab-forest-hi.mp3'

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
          name: 'Baobab Forest',
          type: null,
          tier: 'free',
          facts: [],
          status: 'live',
          gps_lat: 17.937484,
          gps_lng: 78.460897,
          exhibit_qr_codes: [{ code: QR_CODE, status: 'active' }],
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

/**
 * Puts FAKE_AUDIO_URL in `audio-cache` at the start of every document load. A one-off put from a
 * throwaway page would be enough in chromium, but WebKit drops Cache Storage on navigation.
 * The put is not awaited; it settles long before AppGate's mount check (which awaits a store
 * rehydrate and a dataset query).
 */
export async function seedAudioCache(page: Page) {
  await page.addInitScript((url) => {
    void caches
      .open('audio-cache')
      .then((c) => c.put(url, new Response('fake-audio', { status: 200 })))
  }, FAKE_AUDIO_URL)
}

/** Puts /park.pmtiles in `map-tiles-cache` at every document load so the gate passes. */
export async function seedMapCache(page: Page, body = 'fake-pmtiles') {
  await page.addInitScript(
    (args: string[]) => {
      void caches
        .open('map-tiles-cache')
        .then((c) => c.put(args[0], new Response(args[1], { status: 200 })))
    },
    ['/park.pmtiles', body]
  )
}

/** Fresh visitor: AppGate starts the precache on mount; wait for it to hand off to the info modal. */
export async function passLoadingGate(page: Page) {
  await expect(page.getByText('Personalize your experience')).toBeVisible({ timeout: 10000 })
}
