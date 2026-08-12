import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const body = await req.json()
  const { visitorId, qrCodeId, exhibitId, listenDurationSec } = body

  if (!visitorId || !qrCodeId || !exhibitId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // 1. Look up or create user by fingerprint_id
  const { data: user, error: uErr } = await supabaseAdmin
    .from('users')
    .upsert({ fingerprint_id: visitorId }, { onConflict: 'fingerprint_id' })
    .select('id')
    .single()

  if (uErr || !user) {
    console.error('User upsert failed', uErr)
    return NextResponse.json({ error: 'User upsert failed' }, { status: 500 })
  }

  // 2. Upsert scan row (dedup on user_id + qr_code_id)
  const { error: sErr } = await supabaseAdmin.from('scans').upsert(
    {
      qr_code_id: qrCodeId,
      user_id: user.id,
      listened: true,
      discovered: true,
      listen_duration_sec: listenDurationSec ?? 0,
      scanned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,qr_code_id' }
  )

  if (sErr) {
    console.error('Scan upsert failed', sErr)
    return NextResponse.json({ error: 'Scan upsert failed' }, { status: 500 })
  }

  // 3. Count total discovered for this user
  const { count } = await supabaseAdmin
    .from('scans')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('discovered', true)

  return NextResponse.json({ total_discovered: count ?? 0 })
}
