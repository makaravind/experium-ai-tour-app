import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Row = { id: string; gps_lat: number | null; gps_lng: number | null }

const state = vi.hoisted(() => ({
  exhibit: null as Row | null,
  rpcErrors: {} as Record<string, unknown>,
  rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
}))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () =>
            table === 'exhibits'
              ? { data: state.exhibit, error: state.exhibit ? null : { message: 'none' } }
              : { data: { id: 'qr-1' }, error: null },
        }),
      }),
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args })
      if (state.rpcErrors[name]) return { data: null, error: state.rpcErrors[name] }
      return { data: name === 'total_discovered' ? 7 : null, error: null }
    },
  }),
}))

import { POST } from '@/app/api/scan/route'

const EXHIBIT = { id: 'ex-1', gps_lat: 12, gps_lng: 77 }
// 1e-4 deg lat ≈ 11.1 m
const NEAR = { lat: 12 + 0.0003, lng: 77, accuracyM: 20 } // ~33 m
const JUST_OUTSIDE = { lat: 12 + 0.00046, lng: 77, accuracyM: 20 } // ~51 m
const FAR = { lat: 12.1, lng: 77, accuracyM: 5 }

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest('http://localhost/api/scan', {
      method: 'POST',
      body: JSON.stringify({ visitorId: 'u-1', code: 'abc', ...body }),
    }),
  )
}

const calls = (name: string) => state.rpcCalls.filter((c) => c.name === name)

beforeEach(() => {
  state.exhibit = { ...EXHIBIT }
  state.rpcErrors = {}
  state.rpcCalls = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/scan', () => {
  it('onsite QR scan records onsite_scan', async () => {
    const res = await post({ is_qr_scan: true, scan_src: 'onsite', scanned_at: '2026-11-14T10:00:00Z' })
    expect(res.status).toBe(200)
    expect(calls('record_discovery')).toEqual([
      {
        name: 'record_discovery',
        args: {
          p_user_id: 'u-1',
          p_exhibit_id: 'ex-1',
          p_campaign_id: 'default',
          p_via: 'onsite_scan',
          p_at: '2026-11-14T10:00:00.000Z',
        },
      },
    ])
  })

  it('quartile 100 far away records audio_complete', async () => {
    await post({ listen_quartile: 100, ...FAR })
    expect(calls('record_discovery').map((c) => c.args.p_via)).toEqual(['audio_complete'])
  })

  it('quartile 50 near with good accuracy records audio_half_near', async () => {
    await post({ listen_quartile: 50, ...NEAR, accuracyM: 40 })
    expect(calls('record_discovery').map((c) => c.args.p_via)).toEqual(['audio_half_near'])
  })

  it.each([
    ['51 m away', { listen_quartile: 50, ...JUST_OUTSIDE }, EXHIBIT],
    ['accuracy 41', { listen_quartile: 50, ...NEAR, accuracyM: 41 }, EXHIBIT],
    ['no fix', { listen_quartile: 50 }, EXHIBIT],
    ['exhibit without GPS', { listen_quartile: 50, ...NEAR }, { id: 'ex-1', gps_lat: null, gps_lng: null }],
    ['forged far position', { listen_quartile: 50, ...FAR }, EXHIBIT],
    ['quartile 25 near', { listen_quartile: 25, ...NEAR }, EXHIBIT],
    ['non-QR play claiming onsite', { scan_src: 'onsite', listened: true }, EXHIBIT],
  ])('does not record a discovery: %s', async (_label, body, exhibit) => {
    state.exhibit = exhibit
    const res = await post(body)
    expect(res.status).toBe(200)
    expect(calls('record_discovery')).toHaveLength(0)
  })

  it('lat 0 / lng 0 is a valid position near an exhibit at 0,0', async () => {
    state.exhibit = { id: 'ex-1', gps_lat: 0, gps_lng: 0 }
    await post({ listen_quartile: 50, lat: 0, lng: 0, accuracyM: 20 })
    expect(calls('record_discovery').map((c) => c.args.p_via)).toEqual(['audio_half_near'])
  })

  it('missing accuracyM drops the position, no discovery at quartile 50', async () => {
    await post({ listen_quartile: 50, lat: NEAR.lat, lng: NEAR.lng })
    expect(calls('record_discovery')).toHaveLength(0)
  })

  it('string listen_quartile does not record a discovery', async () => {
    const res = await post({ listen_quartile: '100' })
    expect(res.status).toBe(200)
    expect(calls('record_discovery')).toHaveLength(0)
  })

  it('non-QR play does not call upsert_scan', async () => {
    await post({ listen_quartile: 100 })
    expect(calls('upsert_playback')).toHaveLength(1)
    expect(calls('upsert_scan')).toHaveLength(0)
  })

  it('returns total_discovered for the default campaign', async () => {
    const res = await post({ listen_quartile: 25 })
    expect(await res.json()).toEqual({ total_discovered: 7 })
    expect(calls('total_discovered')[0].args).toEqual({ p_user_id: 'u-1', p_campaign_id: 'default' })
  })

  it('returns 500 when record_discovery fails', async () => {
    state.rpcErrors.record_discovery = { message: 'boom' }
    const res = await post({ listen_quartile: 100 })
    expect(res.status).toBe(500)
  })

  it('returns 404 for an unknown exhibit', async () => {
    state.exhibit = null
    const res = await post({ listen_quartile: 100 })
    expect(res.status).toBe(404)
    expect(state.rpcCalls).toHaveLength(0)
  })

  it('returns 400 when fields are missing', async () => {
    const res = await post({ code: '' })
    expect(res.status).toBe(400)
  })
})
