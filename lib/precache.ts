import { supabase } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import type { CachedExhibit, Fact, Language } from '@/lib/types'

export const MAX_ATTEMPTS = 3
export const CONCURRENCY = 6

export interface AssetGroup {
  cacheName: string
  urls: string[]
}

export interface GroupResult {
  cacheName: string
  complete: boolean
  /** urls still not in Cache Storage after the run (includes capped) */
  failed: string[]
  /** subset of failed that hit the retry cap */
  capped: string[]
}

export interface PrecacheResult {
  groups: GroupResult[]
  failures: Record<string, { count: number }>
  fetched: number
  total: number
  /** run aborted because the network dropped; no attempts were counted for it */
  offline: boolean
}

export interface PrecacheDeps {
  /** urls currently in Cache Storage for a cache name */
  listCached: (cacheName: string) => Promise<Iterable<string>>
  /** fetch one asset so the SW caches it; throws on failure */
  fetchAsset: (url: string) => Promise<void>
  isOnline: () => boolean
}

const norm = (u: string) => {
  try {
    return new URL(u, typeof location === 'undefined' ? undefined : location.href).href
  } catch {
    return u
  }
}

/** Bulk dataset query for the selected language. Mirrors the map layout's exhibits query. */
export async function fetchCachedExhibits(language: Language): Promise<CachedExhibit[]> {
  const { data, error } = await supabase
    .from('exhibits')
    .select(
      'id, name, type, tier, facts, exhibit_qr_codes(code, status), exhibit_audio(language, audio_url, status)'
    )
  if (error || !data) throw new Error(error?.message ?? 'exhibits query returned no data')

  return data.map((row) => {
    const qr = (row.exhibit_qr_codes as { code: string; status: string }[] | null)?.[0]
    const audio = (
      row.exhibit_audio as { language: string; audio_url: string | null; status: string }[] | null
    )?.find((a) => a.language === language && a.status === 'published' && a.audio_url)
    return {
      id: row.id,
      code: qr?.code ?? null,
      status: qr?.status === 'active' ? 'active' : 'coming_soon',
      name: row.name,
      type: row.type,
      tier: row.tier,
      facts: (row.facts as Fact[] | null) ?? [],
      audioUrl: audio?.audio_url ?? null,
    }
  })
}

/** One group today (audio). Add future asset types by returning more entries here. */
export function getAssetGroups(
  exhibits: CachedExhibit[] = useStore.getState().cachedExhibits
): AssetGroup[] {
  const audio = exhibits.flatMap((e) => (e.audioUrl ? [e.audioUrl] : []))
  return [{ cacheName: 'audio-cache', urls: [...new Set(audio)] }]
}

const realDeps: PrecacheDeps = {
  listCached: async (cacheName) => {
    const cache = await caches.open(cacheName)
    return (await cache.keys()).map((r) => r.url)
  },
  fetchAsset: async (url) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    await res.arrayBuffer() // finish the download before counting it
  },
  isOnline: () => navigator.onLine,
}

/** Cache Storage is authoritative: urls per group not currently cached. */
export async function findMissing(
  groups: AssetGroup[],
  deps: Pick<PrecacheDeps, 'listCached'> = realDeps
): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {}
  for (const g of groups) {
    const have = new Set([...(await deps.listCached(g.cacheName))].map(norm))
    out[g.cacheName] = g.urls.filter((u) => !have.has(norm(u)))
  }
  return out
}

/**
 * Pure core: fills the gaps in Cache Storage, retrying each asset up to
 * MAX_ATTEMPTS across runs (counts live in `failures`, caller persists them).
 */
export async function precacheGroups(
  groups: AssetGroup[],
  opts: {
    failures: Record<string, { count: number }>
    onProgress?: (fetched: number, total: number) => void
    concurrency?: number
    maxAttempts?: number
  } & Partial<PrecacheDeps>
): Promise<PrecacheResult> {
  const deps = { ...realDeps, ...opts }
  const max = opts.maxAttempts ?? MAX_ATTEMPTS
  const failures = { ...opts.failures }
  const missing = await findMissing(groups, deps)

  const total = groups.reduce((n, g) => n + g.urls.length, 0)
  const todoCount = Object.values(missing).reduce((n, m) => n + m.length, 0)
  let fetched = total - todoCount
  let offline = false
  opts.onProgress?.(fetched, total)
  if (todoCount > 0 && fetched > 0) {
    console.log(`[precache] gap-fill: ${todoCount}/${total} assets missing`)
  }

  let todo = Object.values(missing)
    .flat()
    .filter((u) => (failures[u]?.count ?? 0) < max)

  while (todo.length > 0 && !offline) {
    const retry: string[] = []
    const queue = [...todo]
    const worker = async () => {
      for (let url = queue.shift(); url && !offline; url = queue.shift()) {
        try {
          await deps.fetchAsset(url)
          delete failures[url]
          opts.onProgress?.(++fetched, total)
        } catch {
          if (!deps.isOnline()) {
            offline = true // connectivity, not a bad asset: don't burn an attempt
            return
          }
          const count = (failures[url]?.count ?? 0) + 1
          failures[url] = { count }
          if (count >= max) console.log(`[precache] retry cap hit: ${url}`)
          else retry.push(url)
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(opts.concurrency ?? CONCURRENCY, queue.length) }, worker)
    )
    todo = retry
  }

  // verify against Cache Storage rather than trusting our own counters
  const after = await findMissing(groups, deps)
  const results = groups.map((g): GroupResult => {
    const failed = after[g.cacheName]
    return {
      cacheName: g.cacheName,
      complete: failed.length === 0,
      failed,
      capped: failed.filter((u) => (failures[u]?.count ?? 0) >= max),
    }
  })
  return { groups: results, failures, fetched, total, offline }
}

/**
 * Full run for AppGate: query dataset, fill gaps, persist to the store.
 * Throws if the dataset query fails (caller treats as network failure).
 */
export async function runPrecache(
  language: Language,
  onProgress?: (fetched: number, total: number) => void
): Promise<PrecacheResult> {
  const store = useStore.getState()
  store.setCachedExhibits(await fetchCachedExhibits(language))
  const result = await precacheGroups(getAssetGroups(), {
    failures: useStore.getState().assetFailures,
    onProgress,
  })
  const s = useStore.getState()
  s.setAssetFailures(result.failures)
  for (const g of result.groups) s.setCompletionByGroup(g.cacheName, { language, complete: g.complete })
  return result
}

/**
 * Fresh-check for mount: Cache Storage vs the stored dataset. Never reads the
 * completion flag. Empty dataset (e.g. localStorage cleared) counts as missing
 * everything, so the caller must run `runPrecache` — which skips whatever is
 * already cached, so a cache-intact visitor only pays for the dataset query.
 */
export async function checkFresh(): Promise<{ hasDataset: boolean; missing: Record<string, string[]> }> {
  const exhibits = useStore.getState().cachedExhibits
  return { hasDataset: exhibits.length > 0, missing: await findMissing(getAssetGroups(exhibits)) }
}

/** Calls `resume` whenever the tab returns to the foreground. Returns unsubscribe. */
export function onForeground(resume: () => void): () => void {
  const handler = () => {
    if (document.visibilityState === 'visible') resume()
  }
  document.addEventListener('visibilitychange', handler)
  return () => document.removeEventListener('visibilitychange', handler)
}

export function logContinueAnyway(urls: string[]) {
  console.log(`[precache] continue anyway with ${urls.length} uncached asset(s)`, urls)
}
