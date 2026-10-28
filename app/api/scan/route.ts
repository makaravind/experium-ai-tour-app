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
    scanned_at,
  } = body
  // Client sends language only inside device_info until step 7 adds a top-level field.
  const language = body.language ?? body.device_info?.language ?? null

  if (!visitorId || !code) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data: exhibit, error: exhibitErr } = await supabaseAdmin
    .from('exhibits')
    .select('id')
    .eq('code', code)
    .single()

  if (exhibitErr || !exhibit) {
    return NextResponse.json({ error: 'Unknown exhibit' }, { status: 404 })
  }

  const isQrScan = is_qr_scan === true
  let qrCodeId: string | null = null
  if (isQrScan) {
    const { data: qr, error: qrErr } = await supabaseAdmin
      .from('exhibit_qr_codes')
      .select('id')
      .eq('code', code)
      .single()

    if (qrErr || !qr) {
      return NextResponse.json({ error: 'Unknown QR code' }, { status: 404 })
    }
    qrCodeId = qr.id
  }

  const playedAt =
    typeof scanned_at === 'string' && Date.parse(scanned_at) > 0
      ? new Date(scanned_at).toISOString()
      : null

  const { error: playbackErr } = await supabaseAdmin.rpc('upsert_playback', {
    p_user_id: visitorId,
    p_exhibit_id: exhibit.id,
    p_language: language,
    p_listened: listened ?? false,
    p_listen_duration_sec: listen_duration_sec ?? 0,
    p_listen_quartile: listen_quartile ?? null,
    p_played_at: playedAt,
  })

  if (playbackErr) {
    console.error('upsert_playback failed', playbackErr)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }

  if (isQrScan) {
    const { error: scanErr } = await supabaseAdmin.rpc('upsert_scan', {
      p_user_id: visitorId,
      p_qr_code_id: qrCodeId,
      p_is_qr_scan: isQrScan,
      p_scan_src: scan_src ?? null,
      p_discovered: scan_src === 'onsite',
      p_scanned_at: playedAt,
    })

    if (scanErr) {
      console.error('upsert_scan failed', scanErr)
      return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
    }
  }

  const { data: totalDiscovered, error: countErr } = await supabaseAdmin.rpc('total_discovered', {
    p_user_id: visitorId,
  })

  if (countErr) {
    console.error('total_discovered failed', countErr)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }

  return NextResponse.json({ total_discovered: totalDiscovered ?? 0 })
}
