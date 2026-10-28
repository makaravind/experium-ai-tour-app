'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import ExhibitPageClient from '@/components/ExhibitPageClient'
import type { ExhibitAudio, Fact, Language } from '@/lib/types'

interface Exhibit {
  id: string
  name: string
  type: string | null
  tier: string
  status: 'live' | 'coming_soon'
  facts: Fact[] | null
  exhibit_audio: ExhibitAudio[]
}

type Live =
  | { state: 'loading' }
  | { state: 'offline' }
  | { state: 'missing' }
  | { state: 'coming_soon' }
  | { state: 'found'; exhibit: Exhibit }

function Message({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-stone-950 text-white flex items-center justify-center px-4">
      <p className="text-stone-400 text-sm text-center">{children}</p>
    </main>
  )
}

export default function ExhibitPage() {
  // The SW serves one cached shell for every /s/<code>, so useParams() can hold another code
  const code = decodeURIComponent(usePathname().split('/')[2])
  const sp = useSearchParams()
  const isQrScan = sp.get('scan') === '1'
  const scanSrc = sp.get('scansrc')
  const autoPlay = sp.get('autoplay') === '1'

  const cachedExhibits = useStore((s) => s.cachedExhibits)
  const cached = cachedExhibits.find((e) => e.code === code)

  // Persisted store is empty during SSR; wait for mount to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false)
  const [live, setLive] = useState<Live>({ state: 'loading' })

  useEffect(() => setMounted(true), []) // eslint-disable-line react-hooks/set-state-in-effect

  useEffect(() => {
    // Skip live fetch when cache has facts; fall through when facts are missing (stale cache)
    if (!mounted || (cached && (cached.facts.length > 0 || !navigator.onLine))) return
    if (!navigator.onLine) {
      setLive({ state: 'offline' }) // eslint-disable-line react-hooks/set-state-in-effect
      return
    }
    const numericCode = parseInt(code, 10)
    if (isNaN(numericCode)) {
      setLive({ state: 'missing' })
      return
    }
    let cancelled = false
    supabase
      .from('exhibits')
      .select('id, name, type, tier, status, facts, exhibit_audio(language, audio_url, status)')
      .eq('code', numericCode)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          // A network failure is a cache gap, not a missing exhibit.
          setLive({ state: navigator.onLine ? 'missing' : 'offline' })
        } else if (data.status !== 'live') {
          setLive({ state: 'coming_soon' })
        } else {
          setLive({ state: 'found', exhibit: data as unknown as Exhibit })
        }
      })
    return () => {
      cancelled = true
    }
  }, [mounted, cached, code])

  if (!mounted) return null

  // Use cached path only when it has facts, or we're offline (no live fetch possible)
  if (cached && (cached.facts.length > 0 || !navigator.onLine)) {
    if (cached.status !== 'active') return <Message>Content coming soon.</Message>
    const audio: ExhibitAudio[] = (Object.entries(cached.audio) as [Language, string][]).map(
      ([language, audio_url]) => ({ language, audio_url, status: 'published' })
    )
    return (
      <ExhibitPageClient
        exhibitId={cached.id}
        qrCode={code}
        isQrScan={isQrScan}
        scanSrc={scanSrc}
        autoPlay={autoPlay}
        exhibit={{ name: cached.name, type: cached.type, tier: cached.tier, facts: cached.facts }}
        audio={audio}
      />
    )
  }

  switch (live.state) {
    case 'loading':
      return null
    case 'offline':
      return (
        <Message>
          Can&apos;t verify this code right now. Connect to the internet and try again.
        </Message>
      )
    case 'missing':
      return <Message>Exhibit not found.</Message>
    case 'coming_soon':
      return <Message>Content coming soon.</Message>
    case 'found': {
      const { exhibit } = live
      return (
        <ExhibitPageClient
          exhibitId={exhibit.id}
          qrCode={code}
          isQrScan={isQrScan}
          scanSrc={scanSrc}
          autoPlay={autoPlay}
          exhibit={{
            name: exhibit.name,
            type: exhibit.type,
            tier: exhibit.tier,
            facts: exhibit.facts ?? [],
          }}
          audio={exhibit.exhibit_audio.filter((a) => a.status === 'published' && a.audio_url)}
        />
      )
    }
  }
}
