import { describe, it, expect } from 'vitest'
import { panoRefFromFile, selectMasters, parseArgs, DEFAULT_SKIP } from '@/tools/tile-all.js'

describe('panoRefFromFile', () => {
  it('uses the filename stem', () => {
    expect(panoRefFromFile('12.jpg')).toBe('12')
    expect(panoRefFromFile('37A.jpg')).toBe('37A')
    expect(panoRefFromFile('5.PNG')).toBe('5')
  })

  it('maps "Front Top View" to lobby', () => {
    expect(panoRefFromFile('Front Top View.png')).toBe('lobby')
  })
})

describe('selectMasters', () => {
  const files = ['Front Top View.png', '1.jpg', '2.png', '37A.jpg', '.DS_Store', 'notes.txt']

  it('skips lobby and 1 by default and ignores non-images', () => {
    expect(selectMasters(files).map((m) => m.panoRef)).toEqual(['2', '37A'])
  })

  it('honours a custom skip list', () => {
    expect(selectMasters(files, ['2']).map((m) => m.panoRef)).toEqual(['lobby', '1', '37A'])
  })

  it('rejects two masters with the same ref', () => {
    expect(() => selectMasters(['3.jpg', '3.png'])).toThrow(/Duplicate pano_ref "3"/)
  })
})

describe('parseArgs', () => {
  it('defaults', () => {
    expect(parseArgs(['a'])).toEqual({
      folders: ['a'],
      skip: DEFAULT_SKIP,
      dryRun: false,
      retries: 3,
    })
  })

  it('parses folders, --skip and --dry-run', () => {
    expect(parseArgs(['a', 'b c', '--skip', 'x, y', '--dry-run'])).toMatchObject({
      folders: ['a', 'b c'],
      skip: ['x', 'y'],
      dryRun: true,
    })
  })

  it('needs a folder and rejects unknown flags', () => {
    expect(() => parseArgs([])).toThrow(/Usage/)
    expect(() => parseArgs(['a', '--nope'])).toThrow(/Unknown argument/)
  })
})
