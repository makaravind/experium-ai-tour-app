import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { NextRequest, NextResponse } from 'next/server'
import { adminGuard } from '@/lib/admin/guard'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const run = promisify(execFile)
const LANGUAGES = ['en', 'hi', 'te']

/** multipart: file (WAV/MP3), code (exhibit code), lang → 64 kbps mono MP3 in bucket `audio` at {code}/{lang}-{timestamp}.mp3 */
export async function POST(req: NextRequest) {
  const denied = adminGuard()
  if (denied) return denied

  const form = await req.formData()
  const file = form.get('file')
  const code = String(form.get('code') ?? '')
  const lang = String(form.get('lang') ?? '')
  if (!(file instanceof File) || !/^\d+$/.test(code) || !LANGUAGES.includes(lang)) {
    return NextResponse.json({ error: 'Need file, numeric code and lang (en|hi|te)' }, { status: 400 })
  }

  const dir = await mkdtemp(join(tmpdir(), 'admin-audio-'))
  try {
    const input = join(dir, 'in')
    const output = join(dir, 'out.mp3')
    await writeFile(input, Buffer.from(await file.arrayBuffer()))
    await run('ffmpeg', ['-y', '-i', input, '-codec:a', 'libmp3lame', '-b:a', '64k', '-ac', '1', output])

    const path = `${code}/${lang}-${Date.now()}.mp3`
    const bucket = getSupabaseAdmin().storage.from('audio')
    const { error } = await bucket.upload(path, await readFile(output), { contentType: 'audio/mpeg' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ url: bucket.getPublicUrl(path).data.publicUrl })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Audio conversion failed' }, { status: 500 })
  } finally {
    await rm(dir, { recursive: true })
  }
}
