'use client'

import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Gallery, { type Palette } from '@/components/exhibit/Gallery'
import { CloseIcon } from '@/components/icons'

export default function SheetSummary({
  expanded,
  thumb,
  name,
  nameAddon,
  badge,
  onCollapse,
  count,
  palette,
}: {
  expanded: boolean
  thumb: ReactNode
  name?: string
  nameAddon?: ReactNode
  badge?: ReactNode
  onCollapse: () => void
  count?: number
  palette?: Palette
}) {
  return (
    <div className={expanded ? 'flex flex-col gap-3' : 'flex flex-row gap-3 items-center pr-9'}>
      <div className={expanded ? 'w-full' : ''}>
        <AnimatePresence mode="popLayout" initial={false}>
          {expanded ? (
            <motion.div
              key="gallery"
              className="-mx-4 relative"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Gallery count={count} palette={palette} />
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
            >
              {thumb}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-lg font-bold leading-tight text-ex-ink"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.3px' }}
          >
            {name}
          </span>
          {nameAddon}
        </div>
        {badge && (
          <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-ex-bg border border-ex-border text-ex-ink">
            {badge}
          </span>
        )}
      </div>
    </div>
  )
}
