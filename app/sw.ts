import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { CacheFirst, NetworkFirst, Serwist } from 'serwist'
import { ExpirationPlugin } from 'serwist'
import { CacheableResponsePlugin } from 'serwist'
import { RangeRequestsPlugin } from 'serwist'

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
  ],
})

serwist.addEventListeners()
