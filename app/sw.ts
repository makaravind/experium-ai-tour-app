/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { CacheFirst, NetworkFirst, Serwist } from 'serwist'
import { ExpirationPlugin } from 'serwist'
import { CacheableResponsePlugin } from 'serwist'
import { RangeRequestsPlugin } from 'serwist'
import { createPartialResponse } from 'serwist'
import { MAP_CACHE } from '@/lib/cache-names'

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

// Every page document, fetched at install so any route opens offline. Not precached: Serwist's
// precache route answers cache-first, so online visitors would get the previous deploy's pages.
const PAGES_CACHE = 'pages-cache'
const PAGES = ['/', '/map', '/scan', '/collection', '/s/_shell']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES_CACHE)
      .then((c) => c.addAll(PAGES.map((u) => new Request(u, { cache: 'reload' }))))
  )
})

// Shift-reload leaves the page uncontrolled; clientsClaim only runs on activate, so the page asks for control
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLAIM') {
    event.waitUntil(self.clients.claim())
  }
})

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: new CacheFirst({
        cacheName: 'google-fonts-cache',
        plugins: [
          new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
          new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
      }),
    },
    {
      matcher: ({ url }) => url.pathname.toLowerCase().endsWith('.mp3'),
      handler: new CacheFirst({
        cacheName: 'audio-cache',
        plugins: [
          new ExpirationPlugin({ maxEntries: 170, maxAgeSeconds: 60 * 60 * 24 * 30 }),
          new RangeRequestsPlugin(),
          new CacheableResponsePlugin({ statuses: [0, 200, 206] }),
        ],
      }),
    },
    {
      // Every /s/<code> shares one cached shell; the exhibit page reads its code from the URL
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new NetworkFirst({
        cacheName: PAGES_CACHE,
        networkTimeoutSeconds: 3,
        plugins: [
          {
            cacheKeyWillBeUsed: ({ request }) => {
              const { pathname } = new URL(request.url)
              return pathname.startsWith('/s/') ? '/s/_shell' : pathname
            },
          },
        ],
      }),
    },
    {
      // *.pmtiles assets are read via many different byte-range requests against one URL, so
      // they can't be precached normally (Workbox's precache route ignores Range headers and
      // always returns the full file, which the pmtiles reader rejects). Instead, cache the
      // whole file ourselves on first use and slice every read from that one cached copy.
      matcher: ({ url }) => url.pathname.toLowerCase().endsWith('.pmtiles'),
      handler: async ({ event, request, url }) => {
        const cache = await caches.open(MAP_CACHE)
        const isRange = request.headers.has('range')
        const cached = await cache.match(url.pathname)
        if (cached) return isRange ? createPartialResponse(request, cached.clone()) : cached
        const net = await fetch(url.href)
        if (!net.ok || !net.body) return net
        if (isRange) {
          // Store the full file first (net is fully consumed here), then slice from the cached copy.
          // Tee is not used: an unread tee branch causes backpressure that stalls the put indefinitely.
          await cache.put(url.pathname, net)
          return createPartialResponse(request, (await cache.match(url.pathname))!)
        }
        // Non-range (e.g. precache): tee so bytes flow to the page while storing in parallel.
        const [toCache, toPage] = net.body.tee()
        const stored = cache.put(url.pathname, new Response(toCache, { headers: net.headers }))
        event.waitUntil(stored)
        return new Response(toPage, { headers: net.headers })
      },
    },
  ],
})

serwist.addEventListeners()
