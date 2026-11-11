import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sinceFor, type InsightsRange } from '@/lib/insights'

const RANGES: readonly string[] = ['today', '7d', 'all']

function keyMatches(provided: string | null): boolean {
  const expected = process.env.INSIGHTS_KEY
  if (!expected || !provided) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on unequal lengths.
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  if (!keyMatches(req.headers.get('x-insights-key'))) {
    return new NextResponse(null, { status: 401 })
  }

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
