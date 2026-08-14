import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const body = await req.json()
  const { visitorId, qrCodeId, listened, listen_duration_sec, device_info } = body

  if (!visitorId || !qrCodeId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.rpc('upsert_scan', {
    p_user_id: visitorId,
    p_qr_code_id: qrCodeId,
    p_listened: listened ?? false,
    p_listen_duration_sec: listen_duration_sec ?? 0,
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
