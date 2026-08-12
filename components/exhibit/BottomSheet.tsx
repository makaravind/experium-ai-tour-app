'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import Gallery from '@/components/exhibit/Gallery'
import LanguageSelector from '@/components/common/LanguageSelector'
import { CloseIcon, LeafOutlineIcon, PauseIcon, PlayIcon, StarIcon } from '@/components/icons'
import { useStore } from '@/lib/store'
import { formatTime, getAvailableLangs, parseFacts } from '@/lib/utils'
import type { ExhibitAudio, ExhibitData } from '@/lib/types'

const SPRING = { type: 'spring', stiffness: 320, damping: 34 } as const

/** Clearance so the collapsed sheet never hides content behind the tab bar. */
const TAB_BAR_CLEARANCE = 108

const RING_R = 43
const RING_C = 2 * Math.PI * RING_R // ≈ 270

/** Beat after the sheet lands fullscreen before the button becomes the ring. */
const MORPH_DELAY = 280

/** Shared id that morphs the Listen button into the progress ring and back. */
const CONTROL_ID = 'audio-control'

/**
 * The sheet *is* the audio player. Peek height shows the exhibit summary;
 * expanding fills the screen, and pressing Listen swaps the button for the ring.
 */
export default function BottomSheet({
  exhibit,
  audio,
  onEnded,
}: {
  exhibit: ExhibitData
  audio: ExhibitAudio[]
  onEnded: (listenDurationSec: number) => void
}) {
  const language = useStore((s) => s.language)
  const [expanded, setExpanded] = useState(false)
  /** True once Listen is pressed — this is what shows the ring over the button. */
  const [started, setStarted] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [peekH, setPeekH] = useState<number | undefined>(undefined)
  const audioRef = useRef<HTMLAudioElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const expandedRef = useRef(false)
  const morphTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragControls = useDragControls()

  const currentSrc = audio.find((a) => a.language === language)?.audio_url ?? null

  useEffect(() => {
    expandedRef.current = expanded
  }, [expanded])

  useEffect(() => () => clearTimeout(morphTimer.current ?? undefined), [])

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

  // Re-point the element whenever the language changes. Playback only carries
  // over if it was already running — switching while idle must never autoplay.
  useEffect(() => {
    const el = audioRef.current
    if (!el || !currentSrc) return
    const wasPlaying = !el.paused
    el.src = currentSrc
    el.currentTime = 0
    setElapsed(0)
    if (wasPlaying) el.play()
  }, [currentSrc])

  /** Listen → fullscreen and play from the top; the ring lands a beat later. */
  const listen = () => {
    const el = audioRef.current
    if (!el) return
    const alreadyOpen = expanded
    setExpanded(true)
    setIsPlaying(true)
    el.currentTime = 0
    setElapsed(0)
    // Must stay inside the click's gesture context or iOS blocks playback.
    el.play()
    // Let the sheet finish opening before the button becomes the ring. Already
    // open means there's no height animation to wait on, so morph at once.
    if (alreadyOpen) setStarted(true)
    else morphTimer.current = setTimeout(() => setStarted(true), MORPH_DELAY)
  }

  /** Back to peek. Pauses rather than stops; the next Listen restarts from 0. */
  const collapse = () => {
    if (morphTimer.current) clearTimeout(morphTimer.current)
    audioRef.current?.pause()
    setStarted(false)
    setExpanded(false)
  }

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (isPlaying) {
      el.pause()
      setIsPlaying(false)
    } else {
      el.play()
      setIsPlaying(true)
    }
  }

  const availableLangs = getAvailableLangs(audio)
  const facts = parseFacts(exhibit.facts)
  const durationLabel = duration > 0 ? ` · ${formatTime(duration)}` : ''
  const typeLabel = exhibit.type?.replace(/_/g, ' ')
  const progress = duration > 0 ? elapsed / duration : 0

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
        else if (info.offset.y > 40 || info.velocity.y > 400) collapse()
      }}
    >
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onTimeUpdate={() => setElapsed(audioRef.current?.currentTime ?? 0)}
        onEnded={() => {
          collapse()
          onEnded(Math.round(elapsed))
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div ref={contentRef}>
        {/* Grab handle — drag or tap to toggle full view */}
        <button
          onPointerDown={(e) => dragControls.start(e)}
          onClick={() => (expanded ? collapse() : setExpanded(true))}
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
                <div className="relative">
                  <Gallery />
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.12 }}
                    onClick={collapse}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(255,255,255,.92)',
                      border: 'none',
                      boxShadow: '0 2px 8px rgba(43,43,43,.18)',
                    }}
                    aria-label="Close"
                  >
                    <CloseIcon size={16} color="#2b2b2b" strokeWidth={2.4} />
                  </motion.button>
                </div>
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

          {/* Listen button ⇄ progress ring — one element, shared layoutId */}
          {started ? (
            <div className="flex flex-col items-center">
              <motion.div
                layoutId={CONTROL_ID}
                transition={SPRING}
                className="relative"
                style={{ width: 96, height: 96 }}
              >
                <svg
                  width="96"
                  height="96"
                  viewBox="0 0 96 96"
                  style={{ transform: 'rotate(-90deg)' }}
                  aria-hidden="true"
                >
                  <circle cx="48" cy="48" r={RING_R} fill="none" stroke="#e8e5df" strokeWidth="5" />
                  <circle
                    cx="48"
                    cy="48"
                    r={RING_R}
                    fill="none"
                    stroke="#588157"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={RING_C}
                    strokeDashoffset={RING_C * (1 - progress)}
                    style={{ transition: 'stroke-dashoffset 0.3s linear' }}
                  />
                </svg>
                <motion.button
                  onClick={togglePlay}
                  whileTap={{ scale: 0.93 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="btn-3d-green absolute rounded-full flex items-center justify-center"
                  style={{
                    width: 64,
                    height: 64,
                    top: '50%',
                    left: '50%',
                    x: '-50%',
                    y: '-50%',
                    background: '#588157',
                    border: 'none',
                  }}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <PauseIcon size={26} color="#fff" />
                  ) : (
                    <PlayIcon size={26} color="#fff" />
                  )}
                </motion.button>
              </motion.div>

              <p className="mt-4 font-bold text-sm tabular-nums" style={{ color: '#8a8a8a' }}>
                <strong style={{ color: '#2b2b2b' }}>{formatTime(elapsed)}</strong>
                {duration > 0 && ` / ${formatTime(duration)}`}
              </p>
            </div>
          ) : (
            <motion.button
              layoutId={CONTROL_ID}
              onClick={listen}
              disabled={!currentSrc}
              whileTap={{ scale: 0.98 }}
              transition={SPRING}
              className="btn-3d-green w-full h-14 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2"
              style={{ background: '#588157', color: '#fff', border: 'none' }}
            >
              <PlayIcon size={20} color="#fff" />
              Listen{durationLabel}
            </motion.button>
          )}

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
