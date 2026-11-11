/**
 * Cuts an equirectangular master into the tile pyramid the /tour viewer reads, and uploads it
 * to the public `panoramas` Storage bucket under <pano_ref>/.
 *
 *   manifest.json, preview.jpg (1024x512), base.jpg (512x256),
 *   l0/ (1024 wide, 2x1), l1/ (2048, 4x2), l2/ (4096, 8x4) — 512px tiles, JPEG q85
 *
 * Usage: node tools/tile-panorama.js <master> <pano_ref> [--label "Park Entrance"] [--dry-run]
 *   --dry-run writes to /tmp/tiles/<pano_ref> only; nothing is uploaded.
 *
 * Prereqs (real mode): NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
 * experium-ai-tour-app/.env.local. Run locally, never in CI. Re-running is idempotent (upsert).
 */

import { readFileSync, mkdirSync, writeFileSync, readdirSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP = join(__dirname, '..')

export const BUCKET = 'panoramas'
export const TILE_SIZE = 512
export const LEVEL_WIDTHS = [1024, 2048, 4096]
export const PREVIEW = { width: 1024, height: 512 }
export const BASE = { width: 512, height: 256 }
export const JPEG_QUALITY = 85
const CACHE_CONTROL = '31536000'

/** Grid for one equirectangular (2:1) level: 512px tiles, cols/rows are powers of 2. */
export function levelGrid(width) {
  return {
    width,
    cols: Math.ceil(width / TILE_SIZE),
    rows: Math.ceil(width / 2 / TILE_SIZE),
  }
}

export const buildLevels = (widths = LEVEL_WIDTHS) => widths.map(levelGrid)

export const tilePath = (level, col, row) => `l${level}/${col}_${row}.jpg`

export const publicUrl = (supabaseUrl, panoRef, path) =>
  `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${panoRef}/${path}`

/** Manifest the viewer depends on; tileUrl keeps {level}/{col}/{row} placeholders. */
export function buildManifest(supabaseUrl, panoRef) {
  return {
    baseUrl: publicUrl(supabaseUrl, panoRef, 'base.jpg'),
    levels: buildLevels(),
    tileUrl: publicUrl(supabaseUrl, panoRef, 'l{level}/{col}_{row}.jpg'),
  }
}

export function parseArgs(argv) {
  const positional = []
  let label
  let dryRun = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') dryRun = true
    else if (argv[i] === '--label') label = argv[++i]
    else positional.push(argv[i])
  }
  const [master, panoRef] = positional
  if (!master || !panoRef) throw new Error('Usage: node tools/tile-panorama.js <master> <pano_ref> [--label <label>] [--dry-run]')
  if (!/^[A-Za-z0-9_-]+$/.test(panoRef)) throw new Error(`Invalid pano_ref "${panoRef}" (letters, digits, - and _ only)`)
  return { master, panoRef, label: label ?? `Node ${panoRef}`, dryRun }
}

export function loadEnv() {
  return Object.fromEntries(
    readFileSync(join(APP, '.env.local'), 'utf8')
      .split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
  )
}

const jpeg = { quality: JPEG_QUALITY, mozjpeg: true }

async function writeTiles(sharp, master, outDir) {
  const { width, height } = await sharp(master, { limitInputPixels: false }).metadata()
  if (width !== height * 2) throw new Error(`Master must be 2:1 equirectangular, got ${width}x${height}`)
  const source = () => sharp(master, { limitInputPixels: false }).removeAlpha()

  await source().resize(PREVIEW.width, PREVIEW.height).jpeg(jpeg).toFile(join(outDir, 'preview.jpg'))
  await source().resize(BASE.width, BASE.height).jpeg(jpeg).toFile(join(outDir, 'base.jpg'))

  const levels = buildLevels()
  for (const [level, grid] of levels.entries()) {
    mkdirSync(join(outDir, `l${level}`), { recursive: true })
    const levelHeight = grid.width / 2
    const { data, info } = await source()
      .resize(grid.width, levelHeight)
      .raw()
      .toBuffer({ resolveWithObject: true })
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const left = col * TILE_SIZE
        const top = row * TILE_SIZE
        // not `raw: info`: a PNG master with alpha leaves premultiplied:true there, which blows out the colours
        await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
          .extract({ left, top, width: Math.min(TILE_SIZE, grid.width - left), height: Math.min(TILE_SIZE, levelHeight - top) })
          .jpeg(jpeg)
          .toFile(join(outDir, tilePath(level, col, row)))
      }
    }
  }
}

function listFiles(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? listFiles(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`]
  )
}

async function upload(supabase, panoRef, outDir) {
  const files = listFiles(outDir)
  for (const path of files) {
    const { error } = await supabase.storage.from(BUCKET).upload(`${panoRef}/${path}`, readFileSync(join(outDir, path)), {
      contentType: path.endsWith('.json') ? 'application/json' : 'image/jpeg',
      upsert: true,
      cacheControl: CACHE_CONTROL,
    })
    if (error) throw new Error(`Upload failed for ${panoRef}/${path}: ${error.message}`)
  }
  console.log(`Uploaded ${files.length} files to ${BUCKET}/${panoRef}/`)
}

async function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
  const { master, panoRef, label, dryRun } = args

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

  const outDir = join('/tmp', 'tiles', panoRef)
  mkdirSync(outDir, { recursive: true })

  const { default: sharp } = await import('sharp')
  console.log(`Tiling ${resolve(master)} → ${outDir} ...`)
  await writeTiles(sharp, master, outDir)
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(buildManifest(supabaseUrl, panoRef), null, 2))

  if (dryRun) {
    console.log('Dry run — nothing uploaded.')
  } else {
    const { createClient } = await import('@supabase/supabase-js')
    await upload(createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }), panoRef, outDir)
  }

  console.log(`\nlabel:       ${label}`)
  console.log(`tiles_url:   ${publicUrl(supabaseUrl, panoRef, 'manifest.json')}`)
  console.log(`preview_url: ${publicUrl(supabaseUrl, panoRef, 'preview.jpg')}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => {
    console.error(e)
    process.exit(1)
  })
}
