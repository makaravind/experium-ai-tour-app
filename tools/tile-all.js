/**
 * Batch wrapper around tools/tile-panorama.js: tiles (and uploads) every master in one or more folders.
 *
 *   pano_ref = filename stem ("Front Top View" → "lobby"); refs in --skip are left alone.
 *
 * Usage: node tools/tile-all.js <folder> [<folder> ...] [--skip lobby,1] [--dry-run] [--retries 3]
 *   --dry-run tiles to /tmp/tiles/<pano_ref> only; nothing is uploaded.
 *   Re-running is idempotent (tile-panorama upserts), so a failed ref is retried then reported.
 */

import { readdirSync } from 'fs'
import { join, extname, basename, dirname } from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TILE_PANORAMA = join(__dirname, 'tile-panorama.js')

export const DEFAULT_SKIP = ['lobby', '1']
const STEM_ALIASES = { 'Front Top View': 'lobby' }
const MASTER_EXT = new Set(['.png', '.jpg', '.jpeg'])

export const panoRefFromFile = file => {
  const stem = basename(file, extname(file))
  return STEM_ALIASES[stem] ?? stem
}

export const isMaster = file => MASTER_EXT.has(extname(file).toLowerCase())

/** [{ file, panoRef }] for masters not in `skip`; throws on two masters resolving to the same ref. */
export function selectMasters(files, skip = DEFAULT_SKIP) {
  const seen = new Map()
  const out = []
  for (const file of files.filter(isMaster)) {
    const panoRef = panoRefFromFile(file)
    if (seen.has(panoRef)) throw new Error(`Duplicate pano_ref "${panoRef}": ${seen.get(panoRef)} and ${file}`)
    seen.set(panoRef, file)
    if (!skip.includes(panoRef)) out.push({ file, panoRef })
  }
  return out
}

export function parseArgs(argv) {
  const out = { folders: [], skip: DEFAULT_SKIP, dryRun: false, retries: 3 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--skip') out.skip = (argv[++i] ?? '').split(',').map(s => s.trim()).filter(Boolean)
    else if (a === '--retries') out.retries = Number(argv[++i])
    else if (a.startsWith('--')) throw new Error(`Unknown argument "${a}"`)
    else out.folders.push(a)
  }
  if (!out.folders.length) throw new Error('Usage: node tools/tile-all.js <folder> [<folder> ...] [--skip a,b] [--dry-run] [--retries n]')
  if (!Number.isInteger(out.retries) || out.retries < 1) throw new Error('--retries needs a positive integer')
  return out
}

function run(master, panoRef, dryRun, retries) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = spawnSync('node', [TILE_PANORAMA, master, panoRef, ...(dryRun ? ['--dry-run'] : [])], { stdio: 'inherit' })
    if (res.status === 0) return true
    console.error(`! ${panoRef}: attempt ${attempt}/${retries} failed`)
  }
  return false
}

function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
  const { folders, skip, dryRun, retries } = args

  const masters = folders.flatMap(folder =>
    selectMasters(readdirSync(folder), skip).map(m => ({ ...m, path: join(folder, m.file) }))
  )
  console.log(`${masters.length} masters (skipping ${skip.join(',') || 'none'})${dryRun ? ' [dry run]' : ''}`)

  const failed = []
  for (const [i, { path, panoRef }] of masters.entries()) {
    console.log(`\n[${i + 1}/${masters.length}] ${panoRef} ← ${path}`)
    if (!run(path, panoRef, dryRun, retries)) failed.push(panoRef)
  }

  console.log(`\nDone: ${masters.length - failed.length}/${masters.length} ok`)
  if (failed.length) {
    console.error(`Failed: ${failed.join(', ')}`)
    process.exit(1)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
