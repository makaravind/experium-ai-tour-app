'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import ExhibitPageClient from '@/components/ExhibitPageClient'
import type { ExhibitAudio, Fact } from '@/lib/types'

interface Exhibit {
  id: string
  name: string
  type: string | null
  tier: string
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
  const { code } = useParams<{ code: string }>()
  const sp = useSearchParams()
  const isQrScan = sp.get('scan') === '1'
  const scanSrc = sp.get('scansrc')
  const autoPlay = sp.get('autoplay') === '1'

  const language = useStore((s) => s.language)
  const cachedExhibits = useStore((s) => s.cachedExhibits)
  const cached = cachedExhibits.find((e) => e.code === code)

  // Persisted store is empty during SSR; wait for mount to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false)
  const [live, setLive] = useState<Live>({ state: 'loading' })

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted || cached) return
    if (!navigator.onLine) {
      setLive({ state: 'offline' })
      return
    }
    let cancelled = false
    supabase
      .from('exhibit_qr_codes')
      .select('id, status, exhibit_id, exhibits(*, exhibit_audio(language, audio_url, status))')
      .eq('code', code)
      .single()
      .then(({ data: qr, error }) => {
        if (cancelled) return
        if (error || !qr) {
          // A network failure is a cache gap, not a broken marker.
          setLive({ state: navigator.onLine ? 'missing' : 'offline' })
        } else if (qr.status !== 'active' || !qr.exhibit_id) {
          setLive({ state: 'coming_soon' })
        } else {
          setLive({ state: 'found', exhibit: qr.exhibits as unknown as Exhibit })
        }
      })
    return () => {
      cancelled = true
    }
  }, [mounted, cached, code])

  if (!mounted) return null

  if (cached) {
    if (cached.status !== 'active') return <Message>Content coming soon.</Message>
    const audio: ExhibitAudio[] = cached.audioUrl
      ? [{ language, audio_url: cached.audioUrl, status: 'published' }]
      : []
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
      return <Message>Can&apos;t verify this code right now. Connect to the internet and try again.</Message>
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
          exhibit={{ name: exhibit.name, type: exhibit.type, tier: exhibit.tier, facts: exhibit.facts ?? [] }}
          audio={exhibit.exhibit_audio.filter((a) => a.status === 'published' && a.audio_url)}
        />
      )
    }
  }
}
