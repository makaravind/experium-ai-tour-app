/**
 * Upserts tour_nodes rows (keyed by pano_ref) for panoramas already tiled + uploaded by
 * tools/tile-panorama.js. tiles_url / preview_url are derived from the same public-URL helper.
 *
 * Usage:
 *   node tools/seed-tour-nodes.js --lat <gate_lat> --lng <gate_lng> [--dry-run]
 *       seeds the default: node '1' as the lobby ('Park Entrance', is_lobby, at --lat/--lng)
 *   node tools/seed-tour-nodes.js --pano-ref <ref> [--label <label>] [--lobby] [--lat <n> --lng <n>] [--dry-run]
 *       seeds one node
 *   --dry-run prints the rows and writes nothing.
 *
 * Prereqs (real mode): NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
 * experium-ai-tour-app/.env.local. Re-running is idempotent: a new pano_ref is inserted whole; an
 * existing one only has its URLs (and lat/lng, when given) refreshed, so label / is_lobby / coordinates
 * edited later in /admin/tour are not clobbered.
 */

import { pathToFileURL } from 'url'
import { loadEnv, publicUrl } from './tile-panorama.js'

const USAGE =
  'Usage: node tools/seed-tour-nodes.js [--pano-ref <ref> [--label <label>] [--lobby]] [--lat <n> --lng <n>] [--dry-run]'

export function parseArgs(argv) {
  const out = { dryRun: false, lobby: false }
  const num = (flag, v) => {
    const n = Number(v)
    if (v === undefined || v === '' || !Number.isFinite(n)) throw new Error(`${flag} needs a number`)
    return n
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--lobby') out.lobby = true
    else if (a === '--pano-ref') out.panoRef = argv[++i]
    else if (a === '--label') out.label = argv[++i]
    else if (a === '--lat') out.lat = num(a, argv[++i])
    else if (a === '--lng') out.lng = num(a, argv[++i])
    else throw new Error(`Unknown argument "${a}"\n${USAGE}`)
  }
  if (out.panoRef !== undefined && !/^[A-Za-z0-9_-]+$/.test(out.panoRef)) {
    throw new Error(`Invalid pano_ref "${out.panoRef}" (letters, digits, - and _ only)`)
  }
  if ((out.lat === undefined) !== (out.lng === undefined)) throw new Error('--lat and --lng go together')
  return out
}

/**
 * Nodes to seed: the one named by --pano-ref, else the default (node '1' as the lobby).
 * @param {{ panoRef?: string, label?: string, lobby?: boolean, lat?: number, lng?: number }} args
 */
export function resolveNodes({ panoRef, label, lobby, lat, lng }) {
  if (panoRef) {
    return [{ panoRef, label: label ?? (lobby ? 'Park Entrance' : `Node ${panoRef}`), isLobby: lobby, lat, lng }]
  }
  return [{ panoRef: '1', label: 'Park Entrance', isLobby: true, lat, lng }]
}

/**
 * tour_nodes row; lat/lng omitted when unset so a re-seed never overwrites placed coordinates.
 * @param {string} supabaseUrl
 * @param {{ panoRef: string, label: string, isLobby: boolean, lat?: number, lng?: number }} node
 */
export function buildRow(supabaseUrl, { panoRef, label, isLobby, lat, lng }) {
  return {
    pano_ref: panoRef,
    label,
    tiles_url: publicUrl(supabaseUrl, panoRef, 'manifest.json'),
    preview_url: publicUrl(supabaseUrl, panoRef, 'preview.jpg'),
    is_lobby: isLobby,
    ...(lat !== undefined && { lat, lng }),
  }
}

/** Columns a re-seed may touch on an existing row: label / is_lobby are seed-time defaults only. */
export function buildUpdate(row) {
  const update = { ...row }
  delete update.label
  delete update.is_lobby
  return update
}

async function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
  const { dryRun } = args

  let env = {}
  try {
    env = loadEnv()
  } catch (e) {
    if (!dryRun) throw e
  }
  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'https://<project>.supabase.co'
  const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY']
  if (!dryRun && (!env['NEXT_PUBLIC_SUPABASE_URL'] || !serviceKey)) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const nodes = resolveNodes(args)
  const rows = nodes.map(n => buildRow(supabaseUrl, n))
  for (const row of rows) {
    if (row.is_lobby && row.lat === undefined) {
      if (!dryRun) {
        console.error(`Lobby "${row.pano_ref}" needs --lat and --lng (gate coordinates)`)
        process.exit(1)
      }
      console.warn(`! lobby "${row.pano_ref}" has no lat/lng — pass --lat/--lng before a real run`)
    }
  }

  console.log(JSON.stringify(rows, null, 2))
  if (dryRun) {
    console.log('Dry run — nothing written.')
    return
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: found, error: readError } = await supabase
    .from('tour_nodes')
    .select('pano_ref')
    .in('pano_ref', rows.map(r => r.pano_ref))
  if (readError) throw new Error(`Read failed: ${readError.message}`)
  const existing = new Set(found.map(r => r.pano_ref))
  for (const row of rows) {
    const { error } = existing.has(row.pano_ref)
      ? await supabase.from('tour_nodes').update(buildUpdate(row)).eq('pano_ref', row.pano_ref)
      : await supabase.from('tour_nodes').insert(row)
    if (error) throw new Error(`Seed failed for pano_ref "${row.pano_ref}": ${error.message}`)
  }
  console.log(`Seeded ${rows.length} tour_nodes (${existing.size} existing: label/is_lobby kept).`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => {
    console.error(e)
    process.exit(1)
  })
}
