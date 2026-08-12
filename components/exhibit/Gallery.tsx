'use client'

import { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { LeafOutlineIcon } from '@/components/icons'

/**
 * Photo gallery. `exhibit_photos` has no rows yet, so cards render as blank
 * placeholders — but the swipe, snapping and dots are fully functional.
 */
export default function Gallery({ count = 4 }: { count?: number }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

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

  return (
    <div className="w-full">
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
            <div
              className="w-full rounded-2xl overflow-hidden relative flex items-center justify-center"
              style={{
                aspectRatio: '16/9',
                background:
                  i === 0
                    ? 'linear-gradient(160deg, #6f9557, #456a3f)'
                    : 'linear-gradient(160deg, #e8e5df, #d8d4cb)',
              }}
              aria-label={`Photo ${i + 1} of ${count} — coming soon`}
            >
              {i > 0 && <LeafOutlineIcon size={30} color="#b9b4a8" strokeWidth={1.6} />}
            </div>
          </div>
        ))}
      </div>

      {/* Dots */}
      <div className="flex gap-1.5 justify-center mt-3.5 mb-1">
        {Array.from({ length: count }, (_, i) => (
          <motion.button
            key={i}
            onClick={() => goTo(i)}
            className="rounded-full"
            style={{ border: 'none', padding: 0, height: 6 }}
            animate={{
              width: i === active ? 16 : 6,
              background: i === active ? '#588157' : '#e8e5df',
            }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            aria-label={`Go to photo ${i + 1}`}
            aria-current={i === active}
          />
        ))}
      </div>
    </div>
  )
}
