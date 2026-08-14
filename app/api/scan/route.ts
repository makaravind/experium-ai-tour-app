import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const body = await req.json()
  const {
    visitorId,
    code,
    listened,
    listen_duration_sec,
    listen_quartile,
    is_qr_scan,
    scan_src,
    device_info,
  } = body

  if (!visitorId || !code) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data: qr, error: qrErr } = await supabaseAdmin
    .from('exhibit_qr_codes')
    .select('id')
    .eq('code', code)
    .single()

  if (qrErr || !qr) {
    return NextResponse.json({ error: 'Unknown QR code' }, { status: 404 })
  }

  const { error } = await supabaseAdmin.rpc('upsert_scan', {
    p_user_id: visitorId,
    p_qr_code_id: qr.id,
    p_listened: listened ?? false,
    p_listen_duration_sec: listen_duration_sec ?? 0,
    p_listen_quartile: listen_quartile ?? null,
    p_is_qr_scan: is_qr_scan ?? false,
    p_scan_src: scan_src ?? null,
    p_device_info: device_info ?? {},
  })

  if (error) {
    console.error('upsert_scan failed', error)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }

  const { count } = await supabaseAdmin
    .from('scans')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', visitorId)
    .eq('discovered', true)

  return NextResponse.json({ total_discovered: count ?? 0 })
}
