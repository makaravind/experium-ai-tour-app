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
      matcher: ({ request, url }) => request.mode === 'navigate' && url.pathname.startsWith('/s/'),
      handler: new NetworkFirst({
        cacheName: 'exhibit-shell-cache',
        plugins: [new ExpirationPlugin({ maxEntries: 1 })],
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
