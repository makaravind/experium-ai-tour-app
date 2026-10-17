/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { CacheFirst, NetworkFirst, Serwist } from 'serwist'
import { ExpirationPlugin } from 'serwist'
import { CacheableResponsePlugin } from 'serwist'
import { RangeRequestsPlugin } from 'serwist'
import { createPartialResponse } from 'serwist'

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
      handler: async ({ request, url }) => {
        const cache = await caches.open('map-tiles-cache')
        let full = await cache.match(url.pathname)
        if (!full) {
          full = await fetch(url.href)
          if (full.ok) await cache.put(url.pathname, full.clone())
        }
        return request.headers.has('range') ? createPartialResponse(request, full.clone()) : full
      },
    },
  ],
})

serwist.addEventListeners()
