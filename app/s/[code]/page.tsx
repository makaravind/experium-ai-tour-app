import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'

interface Exhibit {
  id: string
  name: string
  type: string
  category: string
  scientific_name: string | null
  description: string | null
  photo_url: string | null
  audio_en: string | null
  audio_hi: string | null
  audio_te: string | null
}

// Skeleton: code maps directly to exhibit UUID.
// TODO: resolve via qr_codes table once that's created.
export default async function ExhibitPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

  const { data: exhibit, error } = await supabase
    .from('exhibits')
    .select('*')
    .eq('id', code)
    .single<Exhibit>()

  if (error || !exhibit) notFound()

  return (
    <main className="min-h-screen bg-stone-950 text-white flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">

        {/* Photo placeholder */}
        <div className="w-full aspect-video rounded-2xl bg-stone-800 flex items-center justify-center text-stone-500">
          {exhibit.photo_url ? (
            <img
              src={exhibit.photo_url}
              alt={exhibit.name}
              className="w-full h-full object-cover rounded-2xl"
            />
          ) : (
            <span className="text-sm">No photo yet</span>
          )}
        </div>

        {/* Exhibit info */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{exhibit.name}</h1>
          {exhibit.scientific_name && (
            <p className="text-stone-400 italic text-sm">{exhibit.scientific_name}</p>
          )}
          <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 capitalize">
            {exhibit.type.replace('_', ' ')} · Tier {exhibit.category}
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

          {!exhibit.audio_en && (
            <p className="text-stone-500 text-xs text-center">Audio not uploaded yet</p>
          )}
        </div>

        {/* Description */}
        {exhibit.description && (
          <p className="text-stone-300 text-sm leading-relaxed">{exhibit.description}</p>
        )}

      </div>
    </main>
  )
}
