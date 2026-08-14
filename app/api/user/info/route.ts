import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const { visitorId, name, phone, email } = await req.json()

  if (!visitorId) return NextResponse.json({ error: 'Missing visitorId' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('users')
    .update({ name, phone, email })
    .eq('id', visitorId)

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
