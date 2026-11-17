import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sinceFor, type InsightsRange } from '@/lib/insights'

const RANGES: readonly string[] = ['today', '7d', 'all']

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get('range')
  if (!range || !RANGES.includes(range)) {
    return NextResponse.json({ error: 'Invalid range' }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin.rpc('insights_summary', {
    p_since: sinceFor(range as InsightsRange),
  })

  if (error) {
    console.error('insights_summary failed', error)
    return NextResponse.json({ error: 'Insights failed' }, { status: 500 })
  }

  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
