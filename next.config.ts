import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { NextConfig } from 'next'
import withSerwist from '@serwist/next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ]
  },
}

// *.pmtiles is read via many byte-range requests against one URL, which the generated
// precache route can't honor (it always returns the full file with status 200). It's
// handled by a dedicated runtimeCaching rule in app/sw.ts instead, so it's excluded here
// from the public-folder scan that `@serwist/next` would otherwise auto-precache it with.
const PRECACHE_EXCLUDE = [/\.pmtiles$/, /^sw\.js(\.map)?$/, /^workbox-.*\.js(\.map)?$/]

function listPublicFiles(dir: string, base = ''): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...listPublicFiles(path.join(dir, entry.name), rel))
    else if (!PRECACHE_EXCLUDE.some((re) => re.test(entry.name))) out.push(rel)
  }
  return out
}

const publicDir = path.join(process.cwd(), 'public')
const additionalPrecacheEntries = listPublicFiles(publicDir).map((f) => ({
  url: `/${f}`,
  revision: crypto
    .createHash('md5')
    .update(fs.readFileSync(path.join(publicDir, f)))
    .digest('hex'),
}))

export default withSerwist({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  additionalPrecacheEntries,
})(nextConfig)
