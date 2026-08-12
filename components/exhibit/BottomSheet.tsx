'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import Gallery from '@/components/exhibit/Gallery'
import LanguageSelector from '@/components/common/LanguageSelector'
import { LeafOutlineIcon, PlayIcon, StarIcon } from '@/components/icons'
import { useStore } from '@/lib/store'
import { formatTime, getAvailableLangs, parseFacts } from '@/lib/utils'
import type { ExhibitData } from '@/lib/types'

const SPRING = { type: 'spring', stiffness: 320, damping: 34 } as const

/** Clearance so the collapsed sheet never hides content behind the tab bar. */
const TAB_BAR_CLEARANCE = 108

export default function BottomSheet({
  exhibit,
  audioByLang,
  audioDuration,
  onListen,
}: {
  exhibit: ExhibitData
  audioByLang: Record<string, string | null>
  audioDuration: number
  onListen: () => void
}) {
  const language = useStore((s) => s.language)
  const [expanded, setExpanded] = useState(false)
  const [peekH, setPeekH] = useState<number | undefined>(undefined)
  const contentRef = useRef<HTMLDivElement>(null)
  const expandedRef = useRef(false)
  const dragControls = useDragControls()

  useEffect(() => {
    expandedRef.current = expanded
  }, [expanded])

  // Sample the collapsed height so we tween between px values (not auto ↔ 100%).
  // Skipped while expanded — the same node then holds the hero gallery.
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const measure = () => {
      if (expandedRef.current) return
      setPeekH(el.offsetHeight)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const availableLangs = getAvailableLangs(audioByLang)
  const facts = parseFacts(exhibit.facts)
  const durationLabel = audioDuration > 0 ? ` · ${formatTime(audioDuration)}` : ''
  const typeLabel = exhibit.type?.replace(/_/g, ' ')

  return (
    <motion.div
      className="absolute left-0 right-0 bottom-0 rounded-t-3xl overflow-y-auto"
      style={{
        background: '#fff',
        boxShadow: '0 -8px 32px rgba(43,43,43,.12)',
        zIndex: 30,
        fontFamily: 'var(--font-body)',
      }}
      animate={{ height: expanded ? '100%' : peekH }}
      transition={SPRING}
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.16}
      onDragEnd={(_, info) => {
        if (info.offset.y < -40 || info.velocity.y < -400) setExpanded(true)
        else if (info.offset.y > 40 || info.velocity.y > 400) setExpanded(false)
      }}
    >
      <div ref={contentRef}>
        {/* Grab handle — drag or tap to toggle full view */}
        <button
          onPointerDown={(e) => dragControls.start(e)}
          onClick={() => setExpanded((v) => !v)}
          className="w-full pt-2.5 pb-4 flex justify-center"
          style={{ background: 'none', border: 'none', touchAction: 'none', cursor: 'grab' }}
          aria-label={expanded ? 'Collapse details' : 'Expand to full view'}
          aria-expanded={expanded}
        >
          <span className="rounded-full" style={{ width: 36, height: 4, background: '#e8e5df' }} />
        </button>

        <div className="px-4">
          {/* Exhibit row — thumbnail morphs into a hero gallery when expanded */}
          <motion.div
            layout
            transition={SPRING}
            className={expanded ? 'flex flex-col gap-3' : 'flex flex-row gap-3 items-center pr-9'}
          >
            <motion.div layout transition={SPRING} className={expanded ? 'w-full' : ''}>
              {expanded ? (
                <Gallery />
              ) : (
                <div
                  className="w-14 h-14 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, #7fa06a, #4d6b46)',
                    overflow: 'hidden',
                  }}
                />
              )}
            </motion.div>

            <motion.div layout="position" transition={SPRING}>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-lg font-bold leading-tight"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: '#2b2b2b',
                    letterSpacing: '-0.3px',
                  }}
                >
                  {exhibit.name}
                </span>
                {exhibit.tier === 'a' && (
                  <span
                    className="inline-flex items-center gap-1 text-[10.5px] font-extrabold px-2 py-0.5 rounded-full"
                    style={{ color: '#b8834a', background: 'rgba(221,161,94,.22)' }}
                  >
                    <StarIcon size={11} color="#dda15e" />
                    Featured
                  </span>
                )}
              </div>
              {typeLabel && (
                <span
                  className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ background: '#f8f7f4', border: '1px solid #e8e5df', color: '#2b2b2b' }}
                >
                  <LeafOutlineIcon size={13} color="#588157" strokeWidth={2} />
                  {typeLabel}
                </span>
              )}
            </motion.div>
          </motion.div>

          {/* Language chips */}
          {availableLangs.length > 0 && (
            <LanguageSelector options={availableLangs} variant="chip" className="mt-4 mb-4" />
          )}

          {/* Listen button */}
          <motion.button
            onClick={onListen}
            disabled={!audioByLang[language]}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="btn-3d-green w-full h-14 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2"
            style={{ background: '#588157', color: '#fff', border: 'none' }}
          >
            <PlayIcon size={20} color="#fff" />
            Listen{durationLabel}
          </motion.button>

          {/* Full-view-only content */}
          <AnimatePresence initial={false}>
            {expanded && facts.length > 0 && (
              <motion.section
                key="about"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="mt-6"
              >
                <h3
                  className="text-xs font-extrabold uppercase tracking-wider"
                  style={{ color: '#8a8a8a', letterSpacing: '0.05em' }}
                >
                  About
                </h3>
                <ol
                  className="mt-2.5 rounded-2xl px-5 py-4 space-y-2.5 list-decimal list-outside text-sm font-semibold"
                  style={{
                    background: '#f8f7f4',
                    border: '1px solid #e8e5df',
                    color: '#2b2b2b',
                    paddingLeft: 34,
                  }}
                >
                  {facts.map((fact, i) => (
                    <li key={i} className="leading-relaxed" style={{ paddingLeft: 2 }}>
                      {fact}
                    </li>
                  ))}
                </ol>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        <div style={{ height: TAB_BAR_CLEARANCE }} />
      </div>
    </motion.div>
  )
}
