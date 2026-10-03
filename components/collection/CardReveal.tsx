'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CARD_GRADIENT_CSS, getBadgeColor } from '@/lib/badge-placeholder'

const CONFETTI_COLORS = ['#ffffff', '#dda15e', '#a3b18a', '#f8f7f4', '#b8834a']
const AUTO_FLIP_MS = 2000
const FLIP_MS = 650

export default function CardReveal({
  milestone,
  onContinue,
}: {
  milestone: number
  onContinue: () => void
}) {
  const [flipped, setFlipped] = useState(false)
  const [showContinue, setShowContinue] = useState(false)
  const confettiRef = useRef<{ reset: () => void } | null>(null)
  const cancelledRef = useRef(false)
  const flippedRef = useRef(false)

  const flip = useCallback(() => {
    if (flippedRef.current) return
    flippedRef.current = true
    setFlipped(true)
    import('canvas-confetti').then((mod) => {
      if (cancelledRef.current) return
      const fire = mod.default
      confettiRef.current = fire
      // zIndex above the overlay (60) so the burst isn't hidden behind it
      fire({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.4 },
        colors: CONFETTI_COLORS,
        zIndex: 70,
        disableForReducedMotion: true,
      })
    })
  }, [])

  useEffect(() => {
    cancelledRef.current = false
    const timer = setTimeout(flip, AUTO_FLIP_MS)
    return () => {
      cancelledRef.current = true
      clearTimeout(timer)
      confettiRef.current?.reset()
    }
  }, [flip])

  useEffect(() => {
    if (!flipped) return
    const timer = setTimeout(() => setShowContinue(true), FLIP_MS)
    return () => clearTimeout(timer)
  }, [flipped])

  const face: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    borderRadius: 20,
    overflow: 'hidden',
    background: CARD_GRADIENT_CSS,
    boxShadow: '0 16px 32px rgba(0,0,0,.32)',
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        zIndex: 60,
        background: 'linear-gradient(165deg, #588157 0%, #3f6b3a 100%)',
      }}
    >
      <style>{`
        @keyframes card-reveal-shine { 0% { left: -60% } 100% { left: 140% } }
        @media (prefers-reduced-motion: reduce) {
          .card-reveal-shine { animation: none !important; display: none }
          .card-reveal-inner { transition: none !important }
        }
      `}</style>

      <div className="flex-1 w-full flex items-center justify-center" style={{ perspective: 1400 }}>
        <button
          type="button"
          onClick={flip}
          aria-label="Reveal card"
          className="w-[230px] h-[230px] p-0"
          style={{ background: 'none', border: 'none', cursor: flipped ? 'default' : 'pointer' }}
        >
          <div
            className="card-reveal-inner relative w-full h-full"
            style={{
              transformStyle: 'preserve-3d',
              transition: `transform ${FLIP_MS}ms cubic-bezier(.4,.1,.2,1)`,
              transform: flipped ? 'rotateY(180deg)' : 'none',
            }}
          >
            <div
              className="flex flex-col items-center justify-center text-center text-white"
              style={face}
            >
              <div
                className="card-reveal-shine absolute"
                style={{
                  top: '-50%',
                  left: '-60%',
                  width: '55%',
                  height: '220%',
                  background:
                    'linear-gradient(100deg,transparent,rgba(255,255,255,.4),transparent)',
                  transform: 'rotate(18deg)',
                  animation: 'card-reveal-shine 2.4s ease-in-out infinite',
                }}
              />
              <div
                className="font-extrabold text-[11px] px-3 py-[5px] rounded-full mb-2.5"
                style={{ letterSpacing: '.1em', background: 'rgba(255,255,255,.22)' }}
              >
                NEW CARD
              </div>
              <div className="font-bold text-[13px]" style={{ color: 'rgba(255,255,255,.85)' }}>
                Tap to reveal
              </div>
            </div>

            <div
              className="flex flex-col items-center justify-center text-center text-white"
              style={{ ...face, transform: 'rotateY(180deg)' }}
            >
              <div
                className="w-[72px] h-[72px] rounded-full grid place-items-center font-display font-extrabold text-[24px]"
                style={{
                  background: getBadgeColor(milestone),
                  border: '3px solid rgba(255,255,255,.5)',
                }}
              >
                {milestone}
              </div>
              <div className="font-display font-extrabold text-[19px] mt-3.5">
                Milestone {milestone}
              </div>
              <div
                className="font-bold text-[12.5px] mt-0.5"
                style={{ color: 'rgba(255,255,255,.85)' }}
              >
                Experium Park Explorer
              </div>
            </div>
          </div>
        </button>
      </div>

      <div className="h-[114px] pb-[60px]">
        {showContinue && (
          <button
            type="button"
            onClick={onContinue}
            className="h-[54px] px-6 rounded-2xl text-white font-extrabold text-[14.5px]"
            style={{
              border: 'none',
              background: 'var(--color-ex-orange)',
              boxShadow: '0 4px 0 var(--color-ex-orange-shadow)',
            }}
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  )
}
