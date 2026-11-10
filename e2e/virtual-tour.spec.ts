import { test, expect, type Page } from '@playwright/test'
import {
  PIXEL_PNG_B64,
  markPrecacheComplete,
  mockPrecacheDataset,
  seedCachedExhibit,
  type SeedTour,
} from './gate-helpers'

const QR_CODE = 'baobab-forest'
const EXHIBIT_ID = 'e2e-baobab'
const BASE_URL = `http://localhost:${process.env.E2E_PORT ?? '3000'}`

const PIXEL = Buffer.from(PIXEL_PNG_B64, 'base64')

const pano = (ref: string, file: string) => `${BASE_URL}/e2e-pano/${ref}/${file}`
const node = (
  id: string,
  ref: string,
  label: string,
  isLobby = false,
  at: { lat: number; lng: number } | null = null
) => ({
  id,
  label,
  pano_ref: ref,
  tiles_url: pano(ref, 'manifest.json'),
  preview_url: pano(ref, 'preview.jpg'),
  lat: at?.lat ?? null,
  lng: at?.lng ?? null,
  is_lobby: isLobby,
})
const LOBBY = node('node-lobby', 'lobby', 'Park Entrance', true)
const NODE_1 = node('node-1', '1', 'Node 1')

// Mocked 3-node graph for the navigation specs: lobby <-> 1 <-> 2, all placed on the map.
const NAV_LOBBY = node('node-lobby', 'lobby', 'Park Entrance', true, { lat: 17.3812, lng: 78.1914 })
const NAV_1 = node('node-1', '1', 'Node 1', false, { lat: 17.3814, lng: 78.1916 })
const NAV_2 = node('node-2', '2', 'Node 2', false, { lat: 17.3816, lng: 78.1918 })
const NAV_NODES = [NAV_LOBBY, NAV_1, NAV_2]
const edge = (from: string, to: string, bearing: number) => ({
  from_node_id: from,
  to_node_id: to,
  bearing,
  pitch: -30,
})
const NAV_EDGES = [
  edge(NAV_LOBBY.id, NAV_1.id, 90),
  edge(NAV_1.id, NAV_LOBBY.id, 270),
  edge(NAV_1.id, NAV_2.id, 200),
  edge(NAV_2.id, NAV_1.id, 20),
]

const TOUR: SeedTour = {
  nodeId: NODE_1.id,
  heading: 120,
  pitch: -10,
  previewUrl: NODE_1.preview_url,
}

// The seeded exhibit's pin on node 1, off the arrows' bearings
const NAV_TOUR: SeedTour = { ...TOUR, heading: 120, pitch: 0 }

const manifest = (ref: string) => ({
  baseUrl: pano(ref, 'base.jpg'),
  levels: [
    { width: 1024, cols: 2, rows: 1 },
    { width: 2048, cols: 4, rows: 2 },
    { width: 4096, cols: 8, rows: 4 },
  ],
  tileUrl: pano(ref, 'l{level}/{col}_{row}.jpg'),
})

interface TourMocks {
  nodes?: object[]
  edges?: object[]
  /** manifest.json requests never answer (slow-load scenarios) */
  hangManifest?: boolean
  /** every tour_nodes request fails */
  failGraph?: boolean
}

/** Mocks tour_nodes/tour_edges, the manifests and every same-origin pano file (base, preview, tiles). */
async function mockTour(
  page: Page,
  { nodes = [LOBBY, NODE_1], edges = [], hangManifest, failGraph }: TourMocks = {}
) {
  const requested: string[] = []
  await page.route('**/rest/v1/tour_nodes*', (route) =>
    failGraph
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' })
      : route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(nodes),
        })
  )
  await page.route('**/rest/v1/tour_edges*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(edges) })
  )
  await page.route('**/e2e-pano/**', (route) => {
    const url = new URL(route.request().url())
    requested.push(url.pathname)
    const m = url.pathname.match(/^\/e2e-pano\/([^/]+)\/manifest\.json$/)
    if (m) {
      if (hangManifest) return // never answered
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(manifest(m[1])),
      })
    }
    return route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL })
  })
  return requested
}

/** Returning visitor with a complete cache; `tour` links the seeded exhibit to a tour node. */
async function seedVisitor(page: Page, opts: { tour?: SeedTour; mocks?: TourMocks } = {}) {
  await mockPrecacheDataset(page, { tour: opts.tour })
  const requested = await mockTour(page, opts.mocks)
  await seedCachedExhibit(page, { onboarded: true, tour: opts.tour })
  await markPrecacheComplete(page)
  return requested
}

const tabBar = (page: Page) => page.getByRole('navigation', { name: 'Primary' })
const mapButton = (page: Page) => page.getByRole('button', { name: '← Map' })
const nodePill = (page: Page, label: string) => page.getByText(label, { exact: true })
const splashTitle = (page: Page, text: string | RegExp) => page.getByText(text)
const strip = (page: Page) => page.getByRole('link', { name: /Tap to listen/ })
// SheetSummary's thumbnail; the sheet handles are <button>s with the same label
const collapsedThumb = (page: Page) =>
  page.locator('div[role="button"][aria-label="Expand to full view"]')
const tourSlide = (page: Page) => page.getByRole('button', { name: /360° virtual tour/ })

/**
 * Clock frozen at a fixed instant: splash timers (0.8 s minimum, 15 s slow) only advance on
 * fastForward, so no test sleeps in real time.
 */
async function freezeClock(page: Page) {
  await page.clock.install({ time: new Date('2026-11-10T10:00:00') })
  await page.clock.pauseAt(new Date('2026-11-10T10:00:10'))
}

/** Offline whose flip back online is controlled by the test (navigator.onLine is read at load time). */
async function startOffline(page: Page) {
  await page.addInitScript(() => {
    ;(window as unknown as { __online: boolean }).__online = false
    Object.defineProperty(Navigator.prototype, 'onLine', {
      get: () => (window as unknown as { __online: boolean }).__online,
    })
  })
}

test.describe('Virtual tour viewer', () => {
  test('no params opens the lobby; Map pill goes to /map; no tab bar', async ({ page }) => {
    const requested = await seedVisitor(page)
    await page.goto('/tour')

    await expect(nodePill(page, 'Park Entrance')).toBeVisible({ timeout: 15000 })
    expect(requested).toContain('/e2e-pano/lobby/manifest.json')
    expect(requested).not.toContain('/e2e-pano/1/manifest.json')
    await expect(tabBar(page)).toBeHidden()
    // Not anchored to an exhibit: no strip
    await expect(strip(page)).toBeHidden()

    await mapButton(page).click()
    await expect(page).toHaveURL(/\/map$/)
  })

  test('?node=&heading= opens that node', async ({ page }) => {
    const requested = await seedVisitor(page)
    await page.goto(`/tour?node=${NODE_1.id}&heading=120`)

    await expect(nodePill(page, 'Node 1')).toBeVisible({ timeout: 15000 })
    await expect(nodePill(page, 'Park Entrance')).toBeHidden()
    expect(requested).toContain('/e2e-pano/1/manifest.json')
    expect(requested).not.toContain('/e2e-pano/lobby/manifest.json')
    await expect(page).toHaveURL(/heading=120/)
  })

  test('viewer mounts a canvas container once the splash clears', async ({ page }) => {
    await seedVisitor(page)
    await page.goto('/tour')
    await expect(nodePill(page, 'Park Entrance')).toBeVisible({ timeout: 15000 })
    // PSV renders its own container; not asserting WebGL output
    await expect(page.locator('.psv-container')).toHaveCount(1)
  })

  test('no lobby row: empty state, no crash', async ({ page }) => {
    await seedVisitor(page, { mocks: { nodes: [] } })
    const errors: Error[] = []
    page.on('pageerror', (e) => errors.push(e))
    await page.goto('/tour')

    await expect(page.getByText("Virtual tour isn't available yet")).toBeVisible({ timeout: 15000 })
    await expect(mapButton(page)).toBeHidden()
    expect(errors).toEqual([])

    await page.getByRole('button', { name: 'Back to map' }).click()
    await expect(page).toHaveURL(/\/map$/)
  })
})

test.describe('Virtual tour splash', () => {
  test('stays up for at least 0.8 s even when the panorama is ready', async ({ page }) => {
    await seedVisitor(page)
    await freezeClock(page)
    const base = page.waitForResponse('**/e2e-pano/lobby/base.jpg')
    await page.goto('/tour')
    await base

    // Everything loaded, but the clock hasn't moved
    await expect(splashTitle(page, 'Starting at Park Entrance')).toBeVisible()

    await page.clock.fastForward(799)
    await expect(splashTitle(page, 'Starting at Park Entrance')).toBeVisible()
    await page.clock.fastForward(1)
    await expect(splashTitle(page, 'Starting at Park Entrance')).toBeHidden()
    await expect(nodePill(page, 'Park Entrance')).toBeVisible()
  })

  test('slow state after 15 s: Keep waiting restarts the timer', async ({ page }) => {
    await seedVisitor(page, { mocks: { hangManifest: true } })
    await freezeClock(page)
    await page.goto('/tour')

    await expect(splashTitle(page, 'Starting virtual tour')).toBeVisible()
    await page.clock.fastForward(14_999)
    await expect(splashTitle(page, 'Taking longer than expected')).toBeHidden()
    await page.clock.fastForward(1)
    await expect(splashTitle(page, 'Taking longer than expected')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Keep waiting' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()

    await page.getByRole('button', { name: 'Keep waiting' }).click()
    await expect(splashTitle(page, 'Taking longer than expected')).toBeHidden()
    await page.clock.fastForward(14_999)
    await expect(splashTitle(page, 'Taking longer than expected')).toBeHidden()
    await page.clock.fastForward(1)
    await expect(splashTitle(page, 'Taking longer than expected')).toBeVisible()
  })

  test('slow-state Cancel goes back to where the visitor tapped', async ({ page }) => {
    await seedVisitor(page, { mocks: { hangManifest: true } })
    await page.goto('/map')
    await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible()
    await freezeClock(page)
    // Client-side navigation, as an in-app entry point does
    await page.evaluate(() => (window as any).next.router.push('/tour'))
    await expect(splashTitle(page, 'Starting virtual tour')).toBeVisible()

    await page.clock.fastForward(15_000)
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(/\/map$/)
  })

  test('anchored splash names the exhibit; Cancel returns to it', async ({ page }) => {
    await seedVisitor(page, { tour: TOUR, mocks: { hangManifest: true } })
    await page.goto(`/tour?node=${NODE_1.id}&heading=120&exhibitId=${EXHIBIT_ID}`)

    await expect(splashTitle(page, 'Starting at Baobab Forest')).toBeVisible({ timeout: 15000 })
    // exhibit's node preview as the blurred backdrop
    await expect(page.locator(`img[src="${NODE_1.preview_url}"]`)).toBeAttached()

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(new RegExp(`/s/${QR_CODE}$`))
  })

  test('offline start fails immediately; Try again recovers, Back to map leaves', async ({
    page,
  }) => {
    const requested = await seedVisitor(page)
    await startOffline(page)
    await page.goto('/tour')

    await expect(page.getByText('Virtual tour needs internet')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back to map' })).toBeVisible()
    // Fails fast: nothing was fetched
    expect(requested).toEqual([])

    await page.evaluate(() => ((window as any).__online = true))
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(nodePill(page, 'Park Entrance')).toBeVisible({ timeout: 15000 })
  })

  test('offline start: Back to map', async ({ page }) => {
    await seedVisitor(page)
    await startOffline(page)
    await page.goto('/tour')

    await page.getByRole('button', { name: 'Back to map' }).click()
    await expect(page).toHaveURL(/\/map$/)
  })

  test('graph fetch failure shows the same needs-internet state', async ({ page }) => {
    await seedVisitor(page, { mocks: { failGraph: true } })
    await page.goto('/tour')
    await expect(page.getByText('Virtual tour needs internet')).toBeVisible({ timeout: 15000 })
  })

  test('connection dropping mid-tour toasts "Needs internet"', async ({ page }) => {
    await seedVisitor(page)
    await page.goto('/tour')
    await expect(nodePill(page, 'Park Entrance')).toBeVisible({ timeout: 15000 })

    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    await expect(page.getByText('Needs internet', { exact: true })).toBeVisible()
  })
})

test.describe('Virtual tour entry points', () => {
  test('gallery 360° slide: present for a linked exhibit, navigates with params, no modal', async ({
    page,
  }) => {
    await seedVisitor(page, { tour: TOUR })
    await page.goto(`/s/${QR_CODE}`)
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible({ timeout: 15000 })

    await expect(tourSlide(page)).toBeVisible()
    await expect(page.getByText('Tap to explore')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Go to 360° tour' })).toBeVisible()
    await expect(page.getByText('1 / 5')).toBeAttached()

    await tourSlide(page).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page).toHaveURL(/\/tour\?/)
    const url = new URL(page.url())
    expect(url.searchParams.get('node')).toBe(NODE_1.id)
    expect(url.searchParams.get('heading')).toBe('120')
    expect(url.searchParams.get('exhibitId')).toBe(EXHIBIT_ID)
    await expect(nodePill(page, 'Node 1')).toBeVisible({ timeout: 15000 })
  })

  test('gallery has no 360° slide for an exhibit without a tour node', async ({ page }) => {
    await seedVisitor(page)
    await page.goto(`/s/${QR_CODE}`)
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible({ timeout: 15000 })

    await expect(page.getByRole('group', { name: 'Exhibit photos' })).toBeVisible()
    await expect(tourSlide(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Go to 360° tour' })).toHaveCount(0)
  })

  test('collapsed sheet thumbnail shows the 360° badge only when linked', async ({ page }) => {
    await seedVisitor(page, { tour: TOUR })
    await page.goto(`/s/${QR_CODE}`)
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Close', exact: true }).click()
    const thumb = collapsedThumb(page)
    await expect(thumb.first()).toBeVisible()
    await expect(thumb.filter({ hasText: '360°' }).first()).toBeVisible()
  })

  test('collapsed sheet thumbnail has no badge for an unlinked exhibit', async ({ page }) => {
    await seedVisitor(page)
    await page.goto(`/s/${QR_CODE}`)
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Close', exact: true }).click()
    const thumb = collapsedThumb(page)
    await expect(thumb.first()).toBeVisible()
    await expect(thumb.filter({ hasText: '360°' })).toHaveCount(0)
  })

  test('?mode=virtual-tour redirects a linked exhibit to its node', async ({ page }) => {
    await seedVisitor(page, { tour: TOUR })
    await page.goto(`/s/${QR_CODE}?mode=virtual-tour`)

    await expect(page).toHaveURL(/\/tour\?/, { timeout: 15000 })
    const url = new URL(page.url())
    expect(url.searchParams.get('node')).toBe(NODE_1.id)
    expect(url.searchParams.get('heading')).toBe('120')
    expect(url.searchParams.get('exhibitId')).toBe(EXHIBIT_ID)
    await expect(nodePill(page, 'Node 1')).toBeVisible({ timeout: 15000 })
  })

  test('?mode=virtual-tour falls back to the exhibit page when unlinked', async ({ page }) => {
    await seedVisitor(page)
    await page.goto(`/s/${QR_CODE}?mode=virtual-tour`)

    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible({ timeout: 15000 })
    await expect(page).toHaveURL(new RegExp(`/s/${QR_CODE}\\?mode=virtual-tour$`))
  })
})

test.describe('Virtual tour exhibit strip', () => {
  test('only with exhibitId; tap opens the exhibit and back returns to /tour?…', async ({
    page,
  }) => {
    await seedVisitor(page, { tour: TOUR })
    await page.goto(`/tour?node=${NODE_1.id}&heading=120&exhibitId=${EXHIBIT_ID}`)

    await expect(nodePill(page, 'Node 1')).toBeVisible({ timeout: 15000 })
    await expect(strip(page)).toBeVisible()
    await expect(strip(page)).toContainText('Baobab Forest')

    await strip(page).click()
    await expect(page).toHaveURL(new RegExp(`/s/${QR_CODE}$`))
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible({ timeout: 15000 })

    await page.goBack()
    await expect(page).toHaveURL(
      new RegExp(`/tour\\?node=${NODE_1.id}&heading=120&exhibitId=${EXHIBIT_ID}$`)
    )
    await expect(nodePill(page, 'Node 1')).toBeVisible({ timeout: 15000 })
  })

  test('no strip without exhibitId, even for a linked node', async ({ page }) => {
    await seedVisitor(page, { tour: TOUR })
    await page.goto(`/tour?node=${NODE_1.id}`)

    await expect(nodePill(page, 'Node 1')).toBeVisible({ timeout: 15000 })
    await expect(strip(page)).toBeHidden()
  })
})

const navVisitor = (page: Page) =>
  seedVisitor(page, { tour: NAV_TOUR, mocks: { nodes: NAV_NODES, edges: NAV_EDGES } })

// PSV renders arrows as CSS3D elements, one per outgoing edge; exhibit pins are marker elements
const arrows = (page: Page) => page.locator('.psv-virtual-tour-link')
const pins = (page: Page) => page.locator('.psv-marker')
const sheetName = (page: Page) => page.getByText('Baobab Forest')
const navigateButton = (page: Page) => page.getByRole('button', { name: 'Navigate' })
const spotPin = (page: Page) => page.getByRole('button', { name: /^360° tour spot/ })
const savedSpot = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('experium-store')!).state.tourSpot)

test.describe('Virtual tour navigation', () => {
  test('arrow tap walks to the next node: pill updates, arrows follow edges, URL stays', async ({
    page,
  }) => {
    await navVisitor(page)
    await page.goto('/tour')
    await expect(nodePill(page, 'Park Entrance')).toBeVisible({ timeout: 15000 })
    await expect(arrows(page)).toHaveCount(1)
    const url = page.url()

    await arrows(page).first().click()
    await expect(nodePill(page, 'Node 1')).toBeVisible({ timeout: 15000 })
    await expect(nodePill(page, 'Park Entrance')).toBeHidden()
    // Node 1 has two outgoing edges (lobby, node 2)
    await expect(arrows(page)).toHaveCount(2)
    expect(page.url()).toBe(url)
  })

  test('exhibit pin opens the PreviewSheet; tapping the panorama closes it', async ({ page }) => {
    await navVisitor(page)
    await page.goto(`/tour?node=${NAV_1.id}&heading=120`)
    await expect(nodePill(page, 'Node 1')).toBeVisible({ timeout: 15000 })
    // The sheet is always mounted; it shows the exhibit's name only while open
    await expect(sheetName(page)).toHaveCount(0)

    await pins(page).filter({ hasText: 'K1' }).click()
    await expect(sheetName(page)).toBeVisible()
    await expect(navigateButton(page)).toBeVisible()

    // Top of the screen: panorama, clear of the sheet
    const size = page.viewportSize()!
    // PSV reads two taps within 300 ms as a double-click (it pans instead of emitting click)
    await page.waitForTimeout(400)
    await page.mouse.click(size.width / 2, size.height * 0.15)
    await expect(sheetName(page)).toHaveCount(0)
  })

  test('exhibit pin opens the PreviewSheet; swiping the sheet down closes it', async ({ page }) => {
    await navVisitor(page)
    await page.goto(`/tour?node=${NAV_1.id}&heading=120`)
    await expect(nodePill(page, 'Node 1')).toBeVisible({ timeout: 15000 })

    await pins(page).filter({ hasText: 'K1' }).click()
    await expect(sheetName(page)).toBeVisible()

    const handle = await page
      .getByRole('button', { name: 'Expand to full view' })
      .first()
      .boundingBox()
    const x = handle!.x + handle!.width / 2
    const y = handle!.y + handle!.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 30, { steps: 3 })
    await page.mouse.move(x, y + 150, { steps: 3 })
    await page.mouse.up()
    await expect(sheetName(page)).toHaveCount(0)
  })

  test('only the node a pin is linked to shows it', async ({ page }) => {
    await navVisitor(page)
    await page.goto('/tour')
    await expect(nodePill(page, 'Park Entrance')).toBeVisible({ timeout: 15000 })
    await expect(pins(page)).toHaveCount(0)
  })
})

test.describe('Virtual tour exit and 360° pin', () => {
  test('Map pill: exit splash, then /map with tourSpot saved', async ({ page }) => {
    await navVisitor(page)
    await freezeClock(page)
    const base = page.waitForResponse('**/e2e-pano/1/base.jpg')
    await page.goto(`/tour?node=${NAV_1.id}&heading=120`)
    await base
    await page.clock.fastForward(800)
    await expect(nodePill(page, 'Node 1')).toBeVisible()

    await mapButton(page).click()
    await expect(page.getByText('Landing at Node 1')).toBeVisible()
    await expect(page.getByText('Spot saved')).toBeVisible()
    await expect(page).toHaveURL(/\/tour/)
    const spot = await savedSpot(page)
    expect(spot).toMatchObject({
      nodeId: NAV_1.id,
      lat: NAV_1.lat,
      lng: NAV_1.lng,
      label: 'Node 1',
    })

    await page.clock.fastForward(600)
    await expect(page).toHaveURL(/\/map$/)
  })

  test('Navigate in the sheet: lands on /map with that exhibit open', async ({ page }) => {
    await navVisitor(page)
    await page.goto(`/tour?node=${NAV_1.id}&heading=120`)
    await expect(nodePill(page, 'Node 1')).toBeVisible({ timeout: 15000 })

    await pins(page).filter({ hasText: 'K1' }).click()
    await navigateButton(page).click()

    await expect(page).toHaveURL(/\/map$/, { timeout: 15000 })
    expect(await savedSpot(page)).toMatchObject({ nodeId: NAV_1.id })
    // The map's own sheet is open on the exhibit, ready for its Navigate
    await expect(page.getByText('Baobab Forest').first()).toBeVisible({ timeout: 15000 })
    await expect(navigateButton(page)).toBeVisible()
  })

  test('tourSpot survives a reload and keeps its pin', async ({ page, browserName }) => {
    test.skip(
      browserName === 'webkit',
      "WebKit drops Cache Storage on a second document load, so the gate shows 'low on storage' (see seedAudioCache)"
    )
    await navVisitor(page)
    await page.goto(`/tour?node=${NAV_1.id}&heading=120`)
    await expect(nodePill(page, 'Node 1')).toBeVisible({ timeout: 15000 })
    await mapButton(page).click()
    await expect(page).toHaveURL(/\/map$/, { timeout: 15000 })
    await expect(spotPin(page)).toBeVisible({ timeout: 15000 })

    await page.reload()
    expect(await savedSpot(page)).toMatchObject({ nodeId: NAV_1.id })
    await expect(spotPin(page)).toBeVisible({ timeout: 15000 })
  })

  test('the pin re-enters the tour at its node; ✕ dismisses it', async ({ page }) => {
    await navVisitor(page)
    await page.goto(`/tour?node=${NAV_1.id}&heading=120`)
    await expect(nodePill(page, 'Node 1')).toBeVisible({ timeout: 15000 })
    await mapButton(page).click()
    await expect(page).toHaveURL(/\/map$/, { timeout: 15000 })
    await expect(spotPin(page)).toBeVisible({ timeout: 15000 })

    // Tap the pin: back in the tour at the same node, spot kept
    await spotPin(page).click()
    await expect(page).toHaveURL(new RegExp(`/tour\\?node=${NAV_1.id}&heading=`), {
      timeout: 15000,
    })
    await expect(nodePill(page, 'Node 1')).toBeVisible({ timeout: 15000 })
    expect(await savedSpot(page)).toMatchObject({ nodeId: NAV_1.id })

    await mapButton(page).click()
    await expect(page).toHaveURL(/\/map$/, { timeout: 15000 })
    await page.getByRole('button', { name: 'Dismiss 360° pin' }).click()
    await expect(spotPin(page)).toBeHidden()
    expect(await savedSpot(page)).toBeNull()
  })

  test('entering the tour any other way replaces the old spot', async ({ page }) => {
    await navVisitor(page)
    await page.goto(`/tour?node=${NAV_1.id}&heading=120`)
    await expect(nodePill(page, 'Node 1')).toBeVisible({ timeout: 15000 })
    await mapButton(page).click()
    await expect(page).toHaveURL(/\/map$/, { timeout: 15000 })
    expect(await savedSpot(page)).not.toBeNull()

    // Client-side, as an in-app entry point does (WebKit's second document load can trip the storage gate)
    await page.evaluate(() => (window as any).next.router.push('/tour'))
    await expect(nodePill(page, 'Park Entrance')).toBeVisible({ timeout: 15000 })
    expect(await savedSpot(page)).toBeNull()
  })
})

test.describe('Home 360° Virtual Tour button', () => {
  test('visible online, links to /tour', async ({ page }) => {
    await navVisitor(page)
    await page.goto('/')
    const link = page.getByRole('link', { name: '360° Virtual Tour →' })
    await expect(link).toBeVisible({ timeout: 15000 })
    await expect(link).toHaveAttribute('href', '/tour')
  })

  test('hidden offline', async ({ page }) => {
    await navVisitor(page)
    await startOffline(page)
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Explore the Park →' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('link', { name: '360° Virtual Tour →' })).toBeHidden()
  })
})
