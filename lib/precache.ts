import { supabase } from '@/lib/supabase'
import { MAP_CACHE, MAP_URL } from '@/lib/cache-names'
import { useStore } from '@/lib/store'
import { AUDIO_IDLE_TIMEOUT_MS, ConnectionTimeoutError, DATASET_TIMEOUT_MS } from '@/lib/timeouts'
import type {
  AmenityType,
  CachedAmenity,
  CachedExhibit,
  ExhibitStatus,
  Fact,
  Language,
} from '@/lib/types'

export class AssetFetchError extends Error {
  constructor(
    public status: number,
    url: string
  ) {
    super(`${status} ${url}`)
  }
}

/** Only a definitive 404/410 means the asset itself is bad and counts toward the retry cap. */
const isPermanent = (err: unknown): err is AssetFetchError =>
  err instanceof AssetFetchError && (err.status === 404 || err.status === 410)

export const AUDIO_CACHE_NAME = 'audio-cache'
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
  /** run stopped for connectivity (network dropped, 5xx, non-404 error); no attempts were counted */
  offline: boolean
  /** run aborted because a request stalled (idle timeout); no attempts counted */
  timedOut: boolean
  /** run aborted because assets were downloading but not being saved (storage full / SW not caching) */
  saveFailed: boolean
}

export interface PrecacheDeps {
  /** urls currently in Cache Storage for a cache name */
  listCached: (cacheName: string) => Promise<Iterable<string>>
  /** fetch one asset so the SW caches it; throws on failure */
  fetchAsset: (url: string, signal?: AbortSignal) => Promise<void>
  /** true if the url is currently in the named cache */
  isCached: (cacheName: string, url: string) => Promise<boolean>
  isOnline: () => boolean
}

const norm = (u: string) => {
  try {
    return new URL(u, typeof location === 'undefined' ? undefined : location.href).href
  } catch {
    return u
  }
}

/** Bulk dataset query, every published audio language. Mirrors the map layout's exhibits query. */
export async function fetchCachedExhibits(): Promise<CachedExhibit[]> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), DATASET_TIMEOUT_MS)
  try {
    const { data, error } = await supabase
      .from('exhibits')
      .select(
        'id, code, name, type, tier, facts, status, gps_lat, gps_lng, exhibit_qr_codes(code, status), exhibit_audio(language, audio_url, status)'
      )
      .abortSignal(ctrl.signal)
    // postgrest-js returns { error } on abort instead of throwing
    if (ctrl.signal.aborted) throw new ConnectionTimeoutError()
    if (error || !data) throw new Error(error?.message ?? 'exhibits query returned no data')

    return data.map((row) => {
      const qr = (row.exhibit_qr_codes as { code: string; status: string }[] | null)?.[0]
      const audio: CachedExhibit['audio'] = {}
      for (const a of (row.exhibit_audio as
        { language: string; audio_url: string | null; status: string }[] | null) ?? []) {
        if (a.status === 'published' && a.audio_url) audio[a.language as Language] = a.audio_url
      }
      return {
        id: row.id,
        code: qr?.code ?? null,
        displayNumber: (row.code as number | null) ?? null,
        status: qr?.status === 'active' ? 'active' : 'coming_soon',
        name: row.name,
        type: row.type,
        tier: row.tier,
        facts: (row.facts as Fact[] | null) ?? [],
        audio,
        gps_lat: row.gps_lat,
        gps_lng: row.gps_lng,
        exhibitStatus: (row.status as ExhibitStatus | null) ?? 'live',
      }
    })
  } finally {
    clearTimeout(timer)
  }
}

/** Bulk amenities query (public-read RLS), same path as exhibits. */
export async function fetchCachedAmenities(): Promise<CachedAmenity[]> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), DATASET_TIMEOUT_MS)
  try {
    const { data, error } = await supabase
      .from('amenities')
      .select('id, name, type, description, photos, gps_lat, gps_lng')
      .abortSignal(ctrl.signal)
    if (ctrl.signal.aborted) throw new ConnectionTimeoutError()
    if (error || !data) throw new Error(error?.message ?? 'amenities query returned no data')

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as AmenityType,
      description: row.description,
      photos: row.photos,
      gps_lat: row.gps_lat,
      gps_lng: row.gps_lng,
    }))
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Two groups: audio (one language) then map tiles. Add future asset types by appending entries here.
 * Defaults to the precache language, falling back to the playback language.
 */
export function getAssetGroups(
  exhibits: CachedExhibit[] = useStore.getState().cachedExhibits,
  language: Language = useStore.getState().precacheLanguage ?? useStore.getState().language
): AssetGroup[] {
  const audio = exhibits.flatMap((e) => (e.audio[language] ? [e.audio[language]!] : []))
  return [
    { cacheName: AUDIO_CACHE_NAME, urls: [...new Set(audio)] },
    { cacheName: MAP_CACHE, urls: [MAP_URL] },
  ]
}

function concatChunks(chunks: Uint8Array[]): ArrayBuffer {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out.buffer
}

/** Download one asset; aborts with ConnectionTimeoutError if no bytes arrive for idleMs. */
export async function fetchAssetWithIdleTimeout(
  url: string,
  outerSignal?: AbortSignal,
  idleMs = AUDIO_IDLE_TIMEOUT_MS
): Promise<ArrayBuffer> {
  const inner = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined

  const resetTimer = () => {
    clearTimeout(timer)
    timer = setTimeout(() => inner.abort('timeout'), idleMs)
  }

  const onOuterAbort = () => inner.abort(outerSignal!.reason)
  outerSignal?.addEventListener('abort', onOuterAbort)

  try {
    resetTimer()
    const res = await fetch(url, { signal: inner.signal })
    if (!res.ok) throw new AssetFetchError(res.status, url)
    if (!res.body) return new ArrayBuffer(0)
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    for (;;) {
      resetTimer()
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    return concatChunks(chunks)
  } catch (err) {
    if (outerSignal?.aborted) throw new DOMException(outerSignal.reason ?? 'aborted', 'AbortError')
    if (inner.signal.aborted && inner.signal.reason === 'timeout')
      throw new ConnectionTimeoutError()
    throw err
  } finally {
    clearTimeout(timer)
    outerSignal?.removeEventListener('abort', onOuterAbort)
  }
}

const realDeps: PrecacheDeps = {
  listCached: async (cacheName) => {
    const cache = await caches.open(cacheName)
    return (await cache.keys()).map((r) => r.url)
  },
  fetchAsset: async (url, signal) => {
    await fetchAssetWithIdleTimeout(url, signal) // finish the download before counting it
  },
  isCached: async (cacheName, url) => {
    const cache = await caches.open(cacheName)
    const match = await cache.match(url)
    return match !== undefined
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

const ICACHED_POLL_MS = 250
const ICACHED_MAX_WAIT_MS = 2000

/** The SW writes the cache in waitUntil, which may finish after the body is read; poll briefly. */
async function pollIsCached(
  deps: Pick<PrecacheDeps, 'isCached'>,
  cacheName: string,
  url: string
): Promise<boolean> {
  const deadline = Date.now() + ICACHED_MAX_WAIT_MS
  do {
    if (await deps.isCached(cacheName, url)) return true
    await new Promise<void>((r) => setTimeout(r, ICACHED_POLL_MS))
  } while (Date.now() < deadline)
  return false
}

/** Consecutive downloaded-but-unsaved assets that abort the run. */
const MAX_CONSECUTIVE_NOT_SAVED = 3

/**
 * Pure core: fills the gaps in Cache Storage, retrying each asset up to
 * MAX_ATTEMPTS across runs (counts live in `failures`, caller persists them).
 */
export async function precacheGroups(
  groups: AssetGroup[],
  opts: {
    failures: Record<string, { count: number }>
    onProgress?: (fetched: number, total: number, cacheName: string) => void
    concurrency?: number
    maxAttempts?: number
    /** checked before each fetch; once true no new urls are taken and no retry rounds run */
    isCancelled?: () => boolean
    /** aborts in-flight fetches immediately; treated as cancelled, no failure counted */
    signal?: AbortSignal
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
  let timedOut = false
  let saveFailed = false
  let notSavedCount = 0
  opts.onProgress?.(fetched, total, groups[0]?.cacheName ?? '')
  if (todoCount > 0 && fetched > 0) {
    console.log(`[precache] gap-fill: ${todoCount}/${total} assets missing`)
  }

  const cancelled = () => (opts.signal?.aborted ?? false) || (opts.isCancelled?.() ?? false)

  // Shared controller: aborted when any worker times out, so all peers exit immediately.
  const groupCtrl = new AbortController()
  opts.signal?.addEventListener('abort', () => groupCtrl.abort(opts.signal!.reason))

  // Groups run one at a time in array order; fetched/total stay global so the bar is continuous.
  for (const g of groups) {
    if (offline || timedOut || saveFailed || cancelled()) break

    let todo = (missing[g.cacheName] ?? []).filter((url) => (failures[url]?.count ?? 0) < max)

    while (todo.length > 0 && !offline && !timedOut && !saveFailed && !cancelled()) {
      const retry: string[] = []
      const queue = [...todo]
      const worker = async () => {
        for (
          let url = queue.shift();
          url && !offline && !timedOut && !saveFailed && !cancelled();
          url = queue.shift()
        ) {
          try {
            await deps.fetchAsset(url, groupCtrl.signal)
            if (await pollIsCached(deps, g.cacheName, url)) {
              delete failures[url]
              fetched++
              opts.onProgress?.(fetched, total, g.cacheName)
            } else if (++notSavedCount >= MAX_CONSECUTIVE_NOT_SAVED) {
              saveFailed = true // downloads succeed but nothing sticks; not a failed attempt
              groupCtrl.abort('save-failed')
              return
            }
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return
            if (err instanceof ConnectionTimeoutError) {
              timedOut = true
              groupCtrl.abort('timeout') // wake up all other in-flight workers immediately
              return
            }
            if (!isPermanent(err) || !deps.isOnline()) {
              offline = true // connectivity or server trouble, not a bad asset: don't burn an attempt
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
  return { groups: results, failures, fetched, total, offline, timedOut, saveFailed }
}

/** Query the dataset and persist it to the store. Throws if either query fails. */
export async function loadDataset(): Promise<void> {
  const [exhibits, amenities] = await Promise.all([fetchCachedExhibits(), fetchCachedAmenities()])
  useStore.getState().setCachedExhibits(exhibits)
  useStore.getState().setCachedAmenities(amenities)
}

/**
 * Full run for AppGate: query dataset, fill gaps for `language`, persist to the store.
 * Throws if the dataset query fails (caller treats as network failure).
 */
export async function runPrecache(
  language: Language,
  onProgress?: (fetched: number, total: number) => void,
  isCancelled?: () => boolean,
  signal?: AbortSignal
): Promise<PrecacheResult> {
  await loadDataset()
  const result = await precacheGroups(
    getAssetGroups(useStore.getState().cachedExhibits, language),
    {
      failures: useStore.getState().assetFailures,
      onProgress,
      isCancelled,
      signal,
    }
  )
  const s = useStore.getState()
  s.setAssetFailures(result.failures)
  for (const g of result.groups)
    s.setCompletionByGroup(g.cacheName, { language, complete: g.complete })
  return result
}

/**
 * Fresh-check for mount: Cache Storage vs the stored dataset, for `language`. Never reads the
 * completion flag. Empty dataset (e.g. localStorage cleared) counts as missing
 * everything, so the caller must run `runPrecache` — which skips whatever is
 * already cached, so a cache-intact visitor only pays for the dataset query.
 */
export async function checkFresh(
  language: Language
): Promise<{ hasDataset: boolean; missing: Record<string, string[]> }> {
  const exhibits = useStore.getState().cachedExhibits
  return {
    hasDataset: exhibits.length > 0,
    missing: await findMissing(getAssetGroups(exhibits, language)),
  }
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
