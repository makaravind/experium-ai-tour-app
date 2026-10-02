'use client'

import { useEffect } from 'react'
import { CloseIcon, StarIcon } from '@/components/icons'

const CONFETTI_COLORS = ['#ffffff', '#dda15e', '#a3b18a', '#f8f7f4', '#b8834a']

export default function MilestoneCelebration({
  milestone,
  totalDiscovered,
  onClose,
}: {
  milestone: number
  totalDiscovered: number
  onClose: () => void
}) {
  useEffect(() => {
    let cancelled = false
    let confetti: { reset: () => void } | null = null
    import('canvas-confetti').then((mod) => {
      if (cancelled) return
      const fire = mod.default
      confetti = fire
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
    return () => {
      cancelled = true
      confetti?.reset()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center text-center px-8 overflow-hidden"
      style={{
        zIndex: 60,
        background: 'linear-gradient(165deg, #5d8a59 0%, #456b41 100%)',
      }}
      onClick={onClose}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Dismiss"
        className="absolute top-14 right-5 w-[34px] h-[34px] rounded-full grid place-items-center text-white"
        style={{ border: 'none', background: 'rgba(255,255,255,.16)' }}
      >
        <CloseIcon size={16} />
      </button>

      <div
        className="w-[132px] h-[132px] rounded-full grid place-items-center mb-6"
        style={{ border: '3px dashed rgba(255,255,255,.55)' }}
      >
        <div
          className="w-[98px] h-[98px] rounded-full grid place-items-center"
          style={{
            background: 'rgba(255,255,255,.14)',
            border: '2px solid rgba(255,255,255,.4)',
          }}
        >
          <StarIcon size={46} color="#fff" />
        </div>
      </div>

      <div
        className="font-extrabold text-[11px] uppercase"
        style={{ letterSpacing: '.18em', color: 'rgba(255,255,255,.7)' }}
      >
        Milestone reached
      </div>
      <div className="font-display font-extrabold text-[22px] text-white mt-2">
        Explorer — {totalDiscovered} Discovered!
      </div>

      {(milestone === 10 || milestone === 50) && (
        <button
          onClick={(e) => {
            e.stopPropagation()
          }}
          className="mt-8 h-[54px] px-7 rounded-2xl text-white font-extrabold text-base flex items-center gap-2"
          style={{
            border: 'none',
            background: 'var(--color-ex-orange)',
            boxShadow: '0 4px 0 var(--color-ex-orange-shadow)',
          }}
        >
          📸 Your Discovery Card is ready!
        </button>
      )}
    </div>
  )
}
