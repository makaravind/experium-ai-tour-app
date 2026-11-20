'use client'

import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Gallery, { type Palette } from '@/components/exhibit/Gallery'
import type { GallerySlide } from '@/lib/exhibit-photos'
import { CloseIcon } from '@/components/icons'
import PipMascot, { type PipState } from '@/components/common/PipMascot'

const EXPANDED_PIP_SIZE = 110

export default function SheetSummary({
  expanded,
  thumb,
  name,
  nameAddon,
  badge,
  displayId,
  onCollapse,
  onExpand,
  slides,
  count,
  palette,
  tourPreviewUrl,
  onTourEnter,
  mascotState,
}: {
  expanded: boolean
  thumb: ReactNode
  name?: string
  nameAddon?: ReactNode
  badge?: ReactNode
  displayId?: string | null
  onCollapse: () => void
  onExpand?: () => void
  slides?: GallerySlide[]
  count?: number
  palette?: Palette
  tourPreviewUrl?: string | null
  onTourEnter?: () => void
  mascotState?: PipState
}) {
  return (
    <div className={expanded ? 'flex flex-col gap-3' : 'flex flex-row gap-3 items-center pr-9'}>
      <div className={expanded ? 'relative w-full' : 'relative'}>
        <AnimatePresence mode="popLayout" initial={false}>
          {expanded ? (
            <motion.div
              key="gallery"
              className="-mx-4 relative"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Gallery
                slides={slides}
                name={name}
                count={count}
                palette={palette}
                tourPreviewUrl={tourPreviewUrl}
                onTourEnter={onTourEnter}
              />
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.12 }}
                onClick={onCollapse}
                className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-white/92 text-ex-ink"
                style={{ border: 'none', boxShadow: 'var(--ex-shadow-float)' }}
                aria-label="Close"
              >
                <CloseIcon size={16} strokeWidth={2.4} />
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="thumb"
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.15 }}
              onClick={onExpand}
              style={onExpand ? { cursor: 'pointer' } : undefined}
              role={onExpand ? 'button' : undefined}
              aria-label={onExpand ? 'Expand to full view' : undefined}
            >
              {thumb}
            </motion.div>
          )}
        </AnimatePresence>
        {/* Outside the gallery (it clips); both Pips stay mounted so a toggle never re-shows the poster. */}
        <div
          className={`absolute right-0 top-full z-10 -translate-y-[44px] transition-[opacity,visibility] ${expanded ? 'duration-150' : 'opacity-0 invisible duration-0'}`}
        >
          <PipMascot
            state={mascotState ?? 'idle'}
            size={EXPANDED_PIP_SIZE}
            className="relative"
            interactive
          />
        </div>
      </div>

      <div className={`flex-1 min-w-0 ${expanded ? 'pr-24' : ''}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-lg font-bold leading-tight text-ex-ink"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.3px' }}
          >
            {name}
          </span>
          {nameAddon}
        </div>
        {(badge || (expanded && displayId != null)) && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {badge && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-ex-bg border border-ex-border text-ex-ink">
                {badge}
              </span>
            )}
            {expanded && displayId != null && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-ex-bg border border-ex-border text-ex-muted">
                {displayId}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
