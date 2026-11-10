import { describe, it, expect } from 'vitest'
import { parseArgs, resolveNodes, buildRow, buildUpdate } from '@/tools/seed-tour-nodes.js'

const URL = 'https://x.supabase.co'

describe('parseArgs', () => {
  it('parses a single-node invocation', () => {
    expect(
      parseArgs([
        '--pano-ref',
        '37A',
        '--label',
        'Pond',
        '--lat',
        '17.38',
        '--lng',
        '78.19',
        '--dry-run',
      ])
    ).toEqual({
      panoRef: '37A',
      label: 'Pond',
      lat: 17.38,
      lng: 78.19,
      lobby: false,
      dryRun: true,
    })
  })

  it('rejects bad pano_ref, lone lat, non-numeric lat and unknown flags', () => {
    expect(() => parseArgs(['--pano-ref', 'a/b'])).toThrow(/Invalid pano_ref/)
    expect(() => parseArgs(['--lat', '1'])).toThrow(/together/)
    expect(() => parseArgs(['--lat', 'x', '--lng', '1'])).toThrow(/needs a number/)
    expect(() => parseArgs(['--nope'])).toThrow(/Unknown argument/)
  })
})

describe('resolveNodes', () => {
  it('defaults to lobby + node 1, coordinates on the lobby only', () => {
    expect(resolveNodes({ lobby: false, lat: 1, lng: 2 })).toEqual([
      { panoRef: 'lobby', label: 'Park Entrance', isLobby: true, lat: 1, lng: 2 },
      { panoRef: '1', label: 'Node 1', isLobby: false },
    ])
  })

  it('labels a single node "Node <ref>" unless given', () => {
    expect(resolveNodes({ panoRef: '14', lobby: false })[0].label).toBe('Node 14')
    expect(resolveNodes({ panoRef: '14', label: 'Fountain', lobby: false })[0].label).toBe(
      'Fountain'
    )
  })
})

describe('buildRow', () => {
  it('derives tiles_url / preview_url from the public-URL helper', () => {
    const row = buildRow(URL, { panoRef: '1', label: 'Node 1', isLobby: false })
    expect(row).toEqual({
      pano_ref: '1',
      label: 'Node 1',
      tiles_url: `${URL}/storage/v1/object/public/panoramas/1/manifest.json`,
      preview_url: `${URL}/storage/v1/object/public/panoramas/1/preview.jpg`,
      is_lobby: false,
    })
  })

  it('omits lat/lng unless set', () => {
    expect('lat' in buildRow(URL, { panoRef: '1', label: 'n', isLobby: false })).toBe(false)
    expect(
      buildRow(URL, { panoRef: 'lobby', label: 'p', isLobby: true, lat: 1, lng: 2 })
    ).toMatchObject({ lat: 1, lng: 2 })
  })
})

describe('buildUpdate', () => {
  it('drops label / is_lobby so a re-seed keeps admin edits, keeps URLs and lat/lng', () => {
    const row = buildRow(URL, { panoRef: 'lobby', label: 'p', isLobby: true, lat: 1, lng: 2 })
    expect(buildUpdate(row)).toEqual({
      pano_ref: 'lobby',
      tiles_url: row.tiles_url,
      preview_url: row.preview_url,
      lat: 1,
      lng: 2,
    })
  })
})
