import { describe, it, expect } from 'vitest'
import {
  levelGrid,
  buildLevels,
  tilePath,
  publicUrl,
  buildManifest,
  parseArgs,
} from '@/tools/tile-panorama.js'

describe('levelGrid', () => {
  it('uses 512px tiles on a 2:1 level', () => {
    expect(levelGrid(1024)).toEqual({ width: 1024, cols: 2, rows: 1 })
    expect(levelGrid(2048)).toEqual({ width: 2048, cols: 4, rows: 2 })
    expect(levelGrid(4096)).toEqual({ width: 4096, cols: 8, rows: 4 })
  })

  it('yields power-of-2 cols/rows for every level', () => {
    for (const { cols, rows } of buildLevels()) {
      expect(Math.log2(cols) % 1).toBe(0)
      expect(Math.log2(rows) % 1).toBe(0)
    }
  })
})

describe('tilePath', () => {
  it('formats l{level}/{col}_{row}.jpg', () => {
    expect(tilePath(2, 7, 3)).toBe('l2/7_3.jpg')
  })
})

describe('buildManifest', () => {
  const manifest = buildManifest('https://x.supabase.co', '37A')

  it('lists three levels low → high', () => {
    expect(manifest.levels).toEqual([
      { width: 1024, cols: 2, rows: 1 },
      { width: 2048, cols: 4, rows: 2 },
      { width: 4096, cols: 8, rows: 4 },
    ])
  })

  it('points baseUrl/tileUrl at the panoramas bucket under pano_ref', () => {
    expect(manifest.baseUrl).toBe(
      'https://x.supabase.co/storage/v1/object/public/panoramas/37A/base.jpg'
    )
    expect(manifest.tileUrl).toBe(
      'https://x.supabase.co/storage/v1/object/public/panoramas/37A/l{level}/{col}_{row}.jpg'
    )
  })

  it('tileUrl placeholders resolve to the paths the script writes', () => {
    const url = manifest.tileUrl.replace('{level}', '2').replace('{col}', '7').replace('{row}', '3')
    expect(url).toBe(publicUrl('https://x.supabase.co', '37A', tilePath(2, 7, 3)))
  })
})

describe('parseArgs', () => {
  it('parses master, pano_ref, label and --dry-run in any order', () => {
    expect(parseArgs(['--dry-run', 'a.png', 'lobby', '--label', 'Park Entrance'])).toEqual({
      master: 'a.png',
      panoRef: 'lobby',
      label: 'Park Entrance',
      dryRun: true,
    })
  })

  it('defaults label to "Node <pano_ref>" and dryRun to false', () => {
    expect(parseArgs(['a.jpg', '14'])).toMatchObject({ label: 'Node 14', dryRun: false })
  })

  it('rejects missing args and unsafe pano_ref', () => {
    expect(() => parseArgs(['a.jpg'])).toThrow(/Usage/)
    expect(() => parseArgs(['a.jpg', '../x'])).toThrow(/Invalid pano_ref/)
  })
})
