'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { CompassIcon, PlayIcon } from '@/components/icons'
import type { MapExhibit } from '@/lib/types'

interface PreviewSheetProps {
  exhibit: MapExhibit | null
  onClose: () => void
  onListen: () => void
  onNavigate: () => void
}

export default function PreviewSheet({
  exhibit,
  onClose,
  onListen,
  onNavigate,
}: PreviewSheetProps) {
  return (
    <AnimatePresence>
      {exhibit && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            key="preview-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 bg-ex-paper rounded-t-3xl px-6 pt-3 pb-8 z-50"
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4" />

            <h2 className="text-xl font-extrabold text-ex-forest">{exhibit.name}</h2>
            {exhibit.type && (
              <span className="text-xs font-semibold uppercase tracking-wide bg-ex-sage/20 text-ex-forest rounded-full px-3 py-1">
                {exhibit.type}
              </span>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={onListen}
                className="btn-3d-green flex-1 h-14 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 bg-ex-forest text-white"
              >
                <PlayIcon />
                Listen
              </button>
              <button
                onClick={onNavigate}
                className="flex-1 h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 bg-ex-sage text-white"
              >
                <CompassIcon />
                Navigate
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
