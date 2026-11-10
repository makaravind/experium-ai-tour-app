import { NextResponse } from 'next/server'
import { adminGuard } from '@/lib/admin/guard'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { AdminAmenity, AdminAudio, AdminExhibit, AdminPhoto, AdminState, Section } from '@/lib/admin/types'

export const runtime = 'nodejs'

export async function GET() {
  const denied = adminGuard()
  if (denied) return denied

  const db = getSupabaseAdmin()
  const [sections, exhibits, audio, photos, amenities] = await Promise.all([
    db.from('sections').select('id, polygon').order('id'),
    db
      .from('exhibits')
      .select('id, code, name, type, tier, status, description, facts, gps_lat, gps_lng, section, number')
      .order('code'),
    db.from('exhibit_audio').select('exhibit_id, language, script, audio_url, status'),
    db.from('exhibit_photos').select('id, exhibit_id, url, caption, is_hero, sort_order').order('sort_order'),
    db.from('amenities').select('id, name, type, description, gps_lat, gps_lng, section').order('name'),
  ])

  const error = sections.error ?? exhibits.error ?? audio.error ?? photos.error ?? amenities.error
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const state: AdminState = {
    sections: sections.data as Section[],
    exhibits: (exhibits.data as (Omit<AdminExhibit, 'facts'> & { facts: AdminExhibit['facts'] | null })[]).map((e) => ({
      ...e,
      facts: e.facts ?? [],
    })),
    audio: audio.data as AdminAudio[],
    photos: photos.data as AdminPhoto[],
    amenities: amenities.data as AdminAmenity[],
  }
  return NextResponse.json(state)
}
