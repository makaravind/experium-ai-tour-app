import { expect, type Page } from '@playwright/test'

const QR_CODE = 'baobab-forest'

// Never fetched: AppGate only compares Cache Storage keys against the dataset's audio URLs.
export const FAKE_AUDIO_URL = 'https://example.test/audio/baobab-forest-en.mp3'

/**
 * AppGate's bulk dataset query (lib/precache.ts fetchCachedExhibits) is the only browser-side
 * /rest/v1/exhibits call that selects `audio_url`. Mock it with one exhibit whose audio is already
 * in Cache Storage, so precache finishes instantly and the exhibit page (which reads the cached
 * dataset) has audio to play. Real audio can't be used under `npm run dev`: the service worker is
 * disabled there, so fetched audio never reaches Cache Storage and the gate ends on
 * "Connect to the internet".
 */
export async function mockPrecacheDataset(page: Page) {
  await seedAudioCache(page)
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
          exhibit_qr_codes: [{ code: QR_CODE, status: 'active' }],
          exhibit_audio: [{ language: 'en', audio_url: FAKE_AUDIO_URL, status: 'published' }],
        },
      ]),
    })
  })
}

/** 60s of 8-bit silence (won't end on its own) so the <audio> element can really play (fires `play` -> first-play scan). */
function silentWav(): Buffer {
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

/** Puts FAKE_AUDIO_URL in `audio-cache` from a throwaway same-origin page, before the app loads. */
export async function seedAudioCache(page: Page) {
  await page.goto('/manifest.json')
  await page.evaluate(async (url) => {
    const cache = await caches.open('audio-cache')
    await cache.put(url, new Response('fake-audio', { status: 200 }))
  }, FAKE_AUDIO_URL)
}

/** Fresh visitor: AppGate waits for a language tap before precache starts, then shows the info modal. */
export async function passLanguageGate(page: Page) {
  await expect(page.getByText('Choose your language to begin')).toBeVisible()
  await page.getByRole('button', { name: 'English' }).click()
}
