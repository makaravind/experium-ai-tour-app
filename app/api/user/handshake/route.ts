import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const { visitorId } = await req.json()

  if (!visitorId) return NextResponse.json({ error: 'Missing visitorId' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('users')
    .upsert({ fingerprint_id: visitorId }, { onConflict: 'fingerprint_id' })

  if (error) return NextResponse.json({ error: 'Upsert failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
