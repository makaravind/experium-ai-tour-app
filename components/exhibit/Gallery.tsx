'use client'

import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LeafOutlineIcon } from '@/components/icons'

const PLACEHOLDER = {
  hero: 'linear-gradient(160deg, #6f9557, #456a3f)',
  blank: 'linear-gradient(160deg, #e8e5df, #d8d4cb)',
  blankIcon: '#b9b4a8',
} as const

export default function Gallery({ count = 4 }: { count?: number }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [active, setActive] = useState(0)
  const [fullscreen, setFullscreen] = useState<{ index: number; rect: DOMRect } | null>(null)

  const onScroll = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    setActive(Math.max(0, Math.min(count - 1, i)))
  }, [count])

  const goTo = (i: number) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  const bgFor = (i: number) => (i === 0 ? PLACEHOLDER.hero : PLACEHOLDER.blank)

  return (
    <div className="w-full">
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex w-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          role="group"
          aria-label="Exhibit photos"
        >
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="w-full flex-shrink-0 snap-center">
              <button
                ref={(el) => {
                  slideRefs.current[i] = el
                }}
                className="w-full flex items-center justify-center cursor-zoom-in"
                style={{
                  aspectRatio: '1/1',
                  background: bgFor(i),
                  border: 'none',
                  padding: 0,
                }}
                onClick={() => {
                  const el = slideRefs.current[i]
                  if (el) setFullscreen({ index: i, rect: el.getBoundingClientRect() })
                }}
                aria-label={`Photo ${i + 1} of ${count} — tap to enlarge`}
              >
                {i > 0 && (
                  <LeafOutlineIcon size={30} color={PLACEHOLDER.blankIcon} strokeWidth={1.6} />
                )}
              </button>
            </div>
          ))}
        </div>
        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold bg-black/50 text-white">
          {active + 1} / {count}
        </span>
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {fullscreen !== null && (
              <FullscreenModal
                key="fullscreen"
                index={fullscreen.index}
                rect={fullscreen.rect}
                bg={bgFor(fullscreen.index)}
                onClose={() => setFullscreen(null)}
              />
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Thumbnail strip */}
      <div className="flex gap-2 mt-3 justify-center">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
              i === active ? 'border-ex-forest' : 'border-transparent'
            }`}
            style={{
              width: 60,
              height: 48,
              background: bgFor(i),
              padding: 0,
            }}
            aria-label={`Go to photo ${i + 1}`}
            aria-current={i === active}
          >
            {i > 0 && (
              <div className="w-full h-full flex items-center justify-center">
                <LeafOutlineIcon size={16} color={PLACEHOLDER.blankIcon} strokeWidth={1.6} />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Separate component so AnimatePresence captures a stable snapshot of `rect`
 * at mount time — the FLIP exit animation references those same values.
 */
function FullscreenModal({
  index,
  rect,
  bg,
  onClose,
}: {
  index: number
  rect: DOMRect
  bg: string
  onClose: () => void
}) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const size = Math.min(vw - 32, 480)
  const targetLeft = (vw - size) / 2
  const targetTop = (vh - size) / 2

  // FLIP: position image at final (fullscreen) coordinates, then apply an
  // initial transform that maps it to the thumbnail's position on screen.
  const scale = rect.width / size
  const dx = rect.left + rect.width / 2 - (targetLeft + size / 2)
  const dy = rect.top + rect.height / 2 - (targetTop + size / 2)

  const morphTransition = { type: 'spring', stiffness: 350, damping: 35 } as const

  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ backgroundColor: 'rgba(0,0,0,0)' }}
      animate={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
      exit={{ backgroundColor: 'rgba(0,0,0,0)' }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} enlarged`}
    >
      {/* Close button fades in after the morph settles */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, delay: 0.22 }}
        className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-9 h-9 flex items-center justify-center text-lg leading-none"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Close"
      >
        ✕
      </motion.button>

      {/* Morphing image — starts at thumbnail, springs to fullscreen */}
      <motion.div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: targetLeft,
          top: targetTop,
          width: size,
          height: size,
          background: bg,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
        initial={{ scale, x: dx, y: dy, borderRadius: 10 / scale }}
        animate={{ scale: 1, x: 0, y: 0, borderRadius: 12 }}
        exit={{ scale, x: dx, y: dy, borderRadius: 10 / scale }}
        transition={morphTransition}
      >
        {index > 0 && <LeafOutlineIcon size={60} color={PLACEHOLDER.blankIcon} strokeWidth={1.2} />}
      </motion.div>
    </motion.div>
  )
}
