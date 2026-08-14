import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const { fingerprintHint } = await req.json().catch(() => ({}))

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({ fingerprint_hint: fingerprintHint ?? null })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })

  return NextResponse.json({ visitorId: data.id })
}
