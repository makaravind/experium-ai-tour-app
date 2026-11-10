import { NextRequest, NextResponse } from 'next/server'
import { adminGuard } from '@/lib/admin/guard'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const denied = adminGuard()
  if (denied) return denied

  const changes: unknown = await req.json().catch(() => null)
  if (typeof changes !== 'object' || changes === null || Array.isArray(changes)) {
    return NextResponse.json({ error: 'Body must be a changeset object' }, { status: 400 })
  }

  const { data, error } = await getSupabaseAdmin().rpc('admin_apply_changes', { changes })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
