'use client'

import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { AmenityTypeIcon, CloseIcon } from '@/components/icons'

interface AmenitiesPillProps {
  active?: boolean
  onClick: () => void
}

export default function AmenitiesPill({ active = false, onClick }: AmenitiesPillProps) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`h-8 px-3.5 rounded-full inline-flex items-center text-[12.5px] font-extrabold border-[1.5px] transition-[background-color,border-color,color,box-shadow] duration-150 ${
          active
            ? 'bg-ex-amenity border-ex-amenity text-white'
            : 'bg-ex-paper border-ex-border text-ex-muted'
        }`}
        style={{ boxShadow: active ? '0 0 0 rgba(0,0,0,0)' : 'var(--ex-shadow-soft)' }}
      >
        <AmenityTypeIcon type="washroom" size={13} strokeWidth={2.2} />
        <span className="ml-1.5">Amenities</span>
        <AnimatePresence initial={false}>
          {active && (
            <motion.span
              key="close"
              className="inline-flex overflow-hidden"
              initial={{ opacity: 0, scale: 0.4, width: 0, marginLeft: 0 }}
              animate={{ opacity: 0.85, scale: 1, width: 'auto', marginLeft: 6 }}
              exit={{ opacity: 0, scale: 0.4, width: 0, marginLeft: 0 }}
              transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            >
              <CloseIcon size={12} strokeWidth={2.6} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </MotionConfig>
  )
}
