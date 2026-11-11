import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { adminGuard } from '@/lib/admin/guard'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

/** multipart: file (image), code (exhibit code) → max 1000 px WebP (quality 75) in bucket `images` at exhibits/{code}/{uuid}.webp */
export async function POST(req: NextRequest) {
  const denied = adminGuard()
  if (denied) return denied

  const form = await req.formData()
  const file = form.get('file')
  const code = String(form.get('code') ?? '')
  if (!(file instanceof File) || !/^\d+$/.test(code)) {
    return NextResponse.json({ error: 'Need file and numeric code' }, { status: 400 })
  }

  try {
    const webp = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer()

    const path = `exhibits/${code}/${randomUUID()}.webp`
    const bucket = getSupabaseAdmin().storage.from('images')
    const { error } = await bucket.upload(path, webp, { contentType: 'image/webp' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ url: bucket.getPublicUrl(path).data.publicUrl })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Image processing failed' }, { status: 500 })
  }
}
