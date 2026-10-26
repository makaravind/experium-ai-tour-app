'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useStore } from '@/lib/store'
import { getCurrentSegment, TRAIL_MILESTONES } from '@/lib/trail'
import { CARD_GRADIENT_CSS, getBadgeColor } from '@/lib/badge-placeholder'
import CardReveal from '@/components/collection/CardReveal'
import DiscoveryCard from '@/components/collection/DiscoveryCard'

type LiftPhase = { m: number; phase: 'raise' | 'flip' }

function CollectionView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const totalDiscovered = useStore((s) => s.totalDiscovered)
  const [selected, setSelected] = useState<number | null>(null)
  const [lifting, setLifting] = useState<LiftPhase | null>(null)

  const { achieved } = getCurrentSegment(totalDiscovered)
  const reveal = Number(searchParams.get('reveal'))

  function handleSelect(m: number) {
    setLifting({ m, phase: 'raise' })
  }

  return (
    <div className="fixed inset-0" style={{ perspective: 1200 }}>
      {achieved.includes(reveal) ? (
        <CardReveal milestone={reveal} onContinue={() => router.replace('/collection')} />
      ) : selected !== null ? (
        <DiscoveryCard key={selected} milestone={selected} onBack={() => setSelected(null)} />
      ) : (
        <div className="fixed inset-0 z-50 flex flex-col bg-ex-bg">
          <div className="flex items-center gap-3 px-4 h-14">
            <button
              onClick={() => router.push('/')}
              aria-label="Back to home"
              className="text-ex-ink text-2xl font-extrabold"
            >
              ‹
            </button>
            <h1 className="text-ex-ink font-extrabold">{achieved.length}/9 cards collected</h1>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-3 content-start gap-3 px-4 pt-2 pb-6" style={{ perspective: 600 }}>
            {/* Step 3 will fill this with grid cells */}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CollectionPage() {
  return (
    <Suspense>
      <CollectionView />
    </Suspense>
  )
}
