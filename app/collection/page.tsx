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
          <div
            className="flex-1 min-h-0 overflow-y-auto grid grid-cols-3 content-start gap-3 px-4 pt-2 pb-6"
            style={{ perspective: 600 }}
          >
            {TRAIL_MILESTONES.map((m) => (
              <motion.button
                key={m}
                type="button"
                aria-label={`Milestone ${m} badge`}
                disabled={!achieved.includes(m)}
                onClick={achieved.includes(m) ? () => handleSelect(m) : undefined}
                className="aspect-square w-full rounded-2xl flex items-center justify-center cursor-pointer disabled:cursor-default"
                style={{
                  background: CARD_GRADIENT_CSS,
                  filter: achieved.includes(m) ? undefined : 'grayscale(1)',
                  opacity: achieved.includes(m) ? 1 : 0.35,
                  boxShadow: achieved.includes(m) ? '0 4px 12px rgba(43,43,43,0.18)' : 'none',
                  transformStyle: 'preserve-3d',
                }}
                animate={
                  lifting?.m === m && lifting.phase === 'raise'
                    ? { y: -24, scale: 1.1, rotateY: 0 }
                    : lifting?.m === m && lifting.phase === 'flip'
                      ? { y: -24, scale: 1.1, rotateY: 90 }
                      : { y: 0, scale: 1, rotateY: 0 }
                }
                transition={
                  lifting?.m === m && lifting.phase === 'raise'
                    ? { duration: 0.2, ease: 'easeOut' }
                    : lifting?.m === m && lifting.phase === 'flip'
                      ? { duration: 0.2, ease: 'easeIn' }
                      : { duration: 0 }
                }
                onAnimationComplete={() => {
                  if (lifting?.m === m) {
                    if (lifting.phase === 'raise') setLifting({ m, phase: 'flip' })
                    if (lifting.phase === 'flip') {
                      setSelected(m)
                      setLifting(null)
                    }
                  }
                }}
              >
                <span
                  className="grid place-items-center rounded-full border-2 border-white/60 font-extrabold text-white"
                  style={{
                    background: getBadgeColor(m),
                    width: '55%',
                    height: '55%',
                    fontSize: 'clamp(14px, 4.5vw, 20px)',
                  }}
                >
                  {m}
                </span>
              </motion.button>
            ))}
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
