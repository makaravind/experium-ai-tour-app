'use client'

import { useCallback, useRef, useState } from 'react'
import { LeafOutlineIcon } from '@/components/icons'

/**
 * Placeholder art only — these disappear once `exhibit_photos` has rows, so they
 * stay local rather than entering the theme palette.
 */
const PLACEHOLDER = {
  hero: 'linear-gradient(160deg, #6f9557, #456a3f)',
  blank: 'linear-gradient(160deg, #e8e5df, #d8d4cb)',
  blankIcon: '#b9b4a8',
} as const

/**
 * Photo gallery. `exhibit_photos` has no rows yet, so cards render as blank
 * placeholders — but the swipe, snapping and thumbnails are fully functional.
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
              className="w-full relative flex items-center justify-center"
              style={{
                aspectRatio: '1/1',
                background: i === 0 ? PLACEHOLDER.hero : PLACEHOLDER.blank,
              }}
              aria-label={`Photo ${i + 1} of ${count} — coming soon`}
            >
              {i > 0 && (
                <LeafOutlineIcon size={30} color={PLACEHOLDER.blankIcon} strokeWidth={1.6} />
              )}
              <span
                className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}
              >
                {active + 1} / {count}
              </span>
            </div>
          </div>
        ))}
      </div>

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
              background: i === 0 ? PLACEHOLDER.hero : PLACEHOLDER.blank,
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
