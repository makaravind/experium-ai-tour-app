import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import ExhibitPageClient from '@/components/ExhibitPageClient'
import type { ExhibitAudio, Fact } from '@/lib/types'

interface Exhibit {
  id: string
  code: string
  name: string
  type: string | null
  tier: string
  description: string | null
  facts: Fact[] | null
  exhibit_audio: ExhibitAudio[]
}

export default async function ExhibitPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const { data: qr, error } = await supabase
    .from('exhibit_qr_codes')
    .select('id, status, exhibit_id, exhibits(*, exhibit_audio(language, audio_url, status))')
    .eq('code', code)
    .single()

  if (error || !qr) notFound()

  if (qr.status !== 'active' || !qr.exhibit_id) {
    return (
      <main className="min-h-screen bg-stone-950 text-white flex items-center justify-center px-4">
        <p className="text-stone-400 text-sm">Content coming soon.</p>
      </main>
    )
  }

  const exhibit = qr.exhibits as unknown as Exhibit

  const audio = exhibit.exhibit_audio.filter((a) => a.status === 'published' && a.audio_url)

  return (
    <ExhibitPageClient
      exhibitId={exhibit.id}
      qrCode={code}
      exhibit={{
        name: exhibit.name,
        type: exhibit.type,
        tier: exhibit.tier,
        facts: exhibit.facts ?? [],
      }}
      audio={audio}
    />
  )
}
