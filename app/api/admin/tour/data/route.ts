import { NextResponse } from 'next/server'
import { adminGuard } from '@/lib/admin/guard'
import type { TourAdminState } from '@/lib/admin/tour-types'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function GET() {
  const denied = adminGuard()
  if (denied) return denied

  const db = getSupabaseAdmin()
  const [nodes, edges, exhibits] = await Promise.all([
    db
      .from('tour_nodes')
      .select('id, label, pano_ref, tiles_url, preview_url, lat, lng, is_lobby')
      .order('pano_ref'),
    db.from('tour_edges').select('from_node_id, to_node_id, bearing, pitch'),
    db
      .from('exhibits')
      .select('id, code, name, gps_lat, gps_lng, tour_node_id, tour_heading, tour_pitch')
      .order('code'),
  ])

  const error = nodes.error ?? edges.error ?? exhibits.error
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const state: TourAdminState = {
    nodes: nodes.data as TourAdminState['nodes'],
    edges: edges.data as TourAdminState['edges'],
    exhibits: exhibits.data as TourAdminState['exhibits'],
  }
  return NextResponse.json(state)
}
