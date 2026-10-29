import { test, expect, type Page, type Route } from '@playwright/test'
import {
  FAKE_AUDIO_URL,
  FAKE_HI_AUDIO_URL,
  mockPrecacheDataset,
  seedAudioCache,
  seedMapCache,
  silentWav,
} from './gate-helpers'

const QR_CODE = 'baobab-forest'
const ONSITE_URL = `/s/${QR_CODE}?scansrc=onsite`

type QueuedScan = { id: string; code: string; scanned_at: string; fields: Record<string, unknown> }
type PersistedStore = {
  language: string
  totalDiscovered: number
  discoveredCodes: string[]
  scanQueue: QueuedScan[]
}

/**
 * Returning visitor with a complete EN cache and a visitor id, so the gate passes and no handshake
 * hits the DB. Seeds only when the store is absent: the init script re-runs on every document load
 * (and in every page of the context), and a re-seed would wipe what the app persisted.
 */
async function seedVisitor(
  page: Page,
  { totalDiscovered = 0, discoveredCodes = [] as string[] } = {}
) {
  await seedAudioCache(page)
  await seedMapCache(page)
  await page.addInitScript(
    ({ en, hi, code, totalDiscovered, discoveredCodes }) => {
      if (localStorage.getItem('experium-store')) return
      localStorage.setItem('experium_onboarded', '1')
      localStorage.setItem('experium_visitor_id', 'e2e-visitor')
      localStorage.setItem(
        'experium-store',
        JSON.stringify({
          state: {
            language: 'en',
            visitorId: 'e2e-visitor',
            visitedExhibits: [],
            totalDiscovered,
            discoveredCodes,
            precacheLanguage: 'en',
            completionByGroup: { 'audio-cache': { language: 'en', complete: true } },
            cachedExhibits: [
              {
                id: 'e2e-baobab',
                code,
                status: 'active',
                name: 'Baobab Forest',
                type: null,
                tier: 'free',
                facts: [],
                audio: { en, hi },
                gps_lat: 17.3816,
                gps_lng: 78.1916283,
                exhibitStatus: 'live',
              },
            ],
          },
          version: 2,
        })
      )
    },
    { en: FAKE_AUDIO_URL, hi: FAKE_HI_AUDIO_URL, code: QR_CODE, totalDiscovered, discoveredCodes }
  )
}

const readStore = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem('experium-store') ?? '{}').state as PersistedStore
  )
const queue = async (page: Page) => (await readStore(page)).scanQueue ?? []

const listen = (page: Page) => page.getByRole('button', { name: /listen/i })

/** Listen -> first-play scan is enqueued; then the sheet's <audio> "ends". */
async function listenAndFinish(page: Page) {
  await expect(listen(page)).toBeVisible({ timeout: 10000 })
  await listen(page).click()
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible()
  await page.evaluate(() => document.querySelector('audio')?.dispatchEvent(new Event('ended')))
}

const failScans = (page: Page) =>
  page.route('/api/scan', (route) => route.abort('connectionfailed'))

test.describe('Offline scan queue', () => {
  test.beforeEach(async ({ page }) => {
    await mockPrecacheDataset(page)
  })

  test('offline onsite scan: toast says saved offline', async ({ page }) => {
    await failScans(page)
    // 3 -> 4 crosses no milestone (1, 3, 5, ...), so the toast shows instead of the card reveal
    await seedVisitor(page, { totalDiscovered: 3 })
    await page.goto(ONSITE_URL)

    await listenAndFinish(page)

    await expect(page.getByText('+1 🌿 · 4/50 discovered · saved offline')).toBeVisible()
    const s = await readStore(page)
    expect(s.totalDiscovered).toBe(4)
    expect(s.discoveredCodes).toEqual([QR_CODE])
    // page land + first play, both persisted with a device time
    expect(s.scanQueue.map((e) => e.fields.listened)).toEqual([false, true])
    for (const e of s.scanQueue) expect(new Date(e.scanned_at).toISOString()).toBe(e.scanned_at)
  })

  test('offline onsite scan crossing milestone 3 lands on the collection reveal', async ({
    page,
  }) => {
    await failScans(page)
    await seedVisitor(page, { totalDiscovered: 2 })
    await page.goto(ONSITE_URL)

    await listenAndFinish(page)

    await expect(page).toHaveURL(/\/collection\?reveal=3/)
  })

  test('coming back online replays the queue in order with scanned_at, then the queue empties', async ({
    page,
  }) => {
    await failScans(page)
    await seedVisitor(page)
    await page.goto(ONSITE_URL)
    await expect(listen(page)).toBeVisible({ timeout: 10000 })
    await listen(page).click()
    await expect.poll(async () => (await queue(page)).length).toBe(2)
    const queued = await queue(page)

    const received: Record<string, unknown>[] = []
    await page.unroute('/api/scan')
    await page.route('/api/scan', async (route: Route) => {
      received.push(route.request().postDataJSON())
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_discovered: 7 }),
      })
    })
    await page.evaluate(() => window.dispatchEvent(new Event('online')))

    // the server total lands right after the last entry is removed
    await expect.poll(async () => (await readStore(page)).totalDiscovered).toBe(7)
    expect(await queue(page)).toEqual([])
    expect(received.map((b) => b.scanned_at)).toEqual(queued.map((e) => e.scanned_at))
    expect(received.map((b) => b.listened)).toEqual([false, true])
    for (const b of received) {
      expect(b.visitorId).toBe('e2e-visitor')
      expect(b.code).toBe(QR_CODE)
    }
  })

  test('rescanning an already discovered code shows no toast', async ({ page }) => {
    await page.route('/api/scan', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_discovered: 1 }),
      })
    )
    await seedVisitor(page, { totalDiscovered: 1, discoveredCodes: [QR_CODE] })
    await page.goto(ONSITE_URL)

    await listenAndFinish(page)

    // the toast shows 500ms after `ended`
    await page.waitForTimeout(1500)
    await expect(page.getByText(/discovered/)).toBeHidden()
    await expect(page).not.toHaveURL(/collection/)
    expect((await readStore(page)).totalDiscovered).toBe(1)
  })
})

test("a stale second tab cannot overwrite another tab's queued scan", async ({ context }) => {
  const stale = await context.newPage()
  const scanner = await context.newPage()
  for (const p of [stale, scanner]) {
    await mockPrecacheDataset(p)
    await failScans(p)
    await seedVisitor(p)
    await p.route(FAKE_HI_AUDIO_URL, (route) =>
      route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() })
    )
  }

  // `stale` hydrates first and never learns about what `scanner` queues except via `storage`
  await stale.goto(`/s/${QR_CODE}`)
  await expect(listen(stale)).toBeVisible({ timeout: 10000 })

  await scanner.goto(ONSITE_URL)
  await expect(listen(scanner)).toBeVisible({ timeout: 10000 })
  const onsiteQueued = async () =>
    (await queue(scanner)).filter((e) => e.fields.scan_src === 'onsite').length
  await expect.poll(onsiteQueued).toBe(1)

  // `stale` writes persisted state (language) -> whole-state write-back
  await stale
    .getByRole('group', { name: 'Audio language' })
    .first()
    .getByRole('button', { name: 'हि' })
    .click()
  await expect.poll(async () => (await readStore(stale)).language).toBe('hi')

  const s = await readStore(scanner)
  expect(s.language).toBe('hi')
  expect(s.scanQueue.filter((e) => e.fields.scan_src === 'onsite')).toHaveLength(1)
  expect(s.discoveredCodes).toEqual([QR_CODE])
})
