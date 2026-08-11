import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import ExhibitPageClient from '@/components/ExhibitPageClient'

interface ExhibitAudio {
  language: string
  audio_url: string | null
  status: string
}

interface Exhibit {
  id: string
  code: string
  name: string
  type: string | null
  tier: string
  description: string | null
  facts: Record<string, string> | null
  exhibit_audio: ExhibitAudio[]
}

export default async function ExhibitPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const { data: qr, error } = await supabase
    .from('exhibit_qr_codes')
    .select('status, exhibit_id, exhibits(*, exhibit_audio(language, audio_url, status))')
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

  const audioByLang = Object.fromEntries(
    exhibit.exhibit_audio
      .filter((a) => a.status === 'published' && a.audio_url)
      .map((a) => [a.language, a.audio_url])
  )

  return (
    <ExhibitPageClient exhibitId={exhibit.id}>
      <main className="min-h-screen bg-stone-950 text-white flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          {/* Photo placeholder */}
          <div className="w-full aspect-video rounded-2xl bg-stone-800 flex items-center justify-center text-stone-500">
            <span className="text-sm">No photo yet</span>
          </div>

          {/* Exhibit info */}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{exhibit.name}</h1>
            {exhibit.facts?.scientific_name && (
              <p className="text-stone-400 italic text-sm">{exhibit.facts.scientific_name}</p>
            )}
            <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 capitalize">
              {exhibit.type?.replace('_', ' ')} · {exhibit.tier}
            </span>
          </div>

          {/* Audio player (skeleton) */}
          <div className="w-full rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-3">
            <p className="text-stone-400 text-sm">Language</p>
            <select className="w-full bg-stone-800 rounded-lg px-3 py-2 text-sm text-white">
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="te">Telugu</option>
            </select>

            <button className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 transition text-black font-semibold rounded-xl py-3 text-sm">
              ▶ Listen
            </button>

            {Object.keys(audioByLang).length === 0 && (
              <p className="text-stone-500 text-xs text-center">Audio not uploaded yet</p>
            )}
          </div>

          {/* Description */}
          {exhibit.description && (
            <p className="text-stone-300 text-sm leading-relaxed">{exhibit.description}</p>
          )}
        </div>
      </main>
    </ExhibitPageClient>
  )
}
