'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useDragControls, useMotionValue } from 'framer-motion'
import Gallery from '@/components/exhibit/Gallery'
import LanguageSelector from '@/components/common/LanguageSelector'
import { CloseIcon, LeafOutlineIcon, PauseIcon, PlayIcon, StarIcon } from '@/components/icons'
import { useStore } from '@/lib/store'
import { formatTime, getAvailableLangs, parseFacts } from '@/lib/utils'
import type { ExhibitAudio, ExhibitData } from '@/lib/types'

const SPRING = { duration: 0.3, ease: [0.4, 0, 0.2, 1] } as const

/**
 * Critically damped, so the sheet lands without wobble. Release velocity gets
 * fed in on drag end — that's what makes a flick carry through instead of
 * restarting from a standstill.
 */
const SHEET_SPRING = { type: 'spring', stiffness: 400, damping: 40, restDelta: 0.5 } as const

/**
 * Fraction of the travel after which a drag swaps in the expanded layout. Low
 * on purpose: the row→column reflow then happens while the sheet is still
 * mostly off-screen, so the fullscreen content has already arrived by the time
 * the sheet lands rather than popping in when the finger lifts.
 */
const REVEAL_AT = 0.18

/** Clearance so the collapsed sheet never hides content behind the tab bar. */
const TAB_BAR_CLEARANCE = 108

const RING_R = 43
const RING_C = 2 * Math.PI * RING_R // ≈ 270

/**
 * Doubles as the beat after the sheet lands fullscreen and the length of the
 * button's pop, so the button has collapsed to nothing before the ring arrives.
 */
const MORPH_DELAY = 280

/**
 * The sheet *is* the audio player. Peek height shows the exhibit summary;
 * expanding fills the screen, and pressing Listen swaps the button for the ring.
 */
export default function BottomSheet({
  exhibit,
  audio,
  onFirstPlay,
  onQuartile,
}: {
  exhibit: ExhibitData
  audio: ExhibitAudio[]
  onFirstPlay: () => void
  onQuartile: (sec: number, quartile: number) => void
}) {
  const language = useStore((s) => s.language)
  const [expanded, setExpanded] = useState(false)
  /** True once Listen is pressed — this is what shows the ring over the button. */
  const [started, setStarted] = useState(false)
  /** Drives the button's grow-flash-vanish while it waits to be replaced. */
  const [popping, setPopping] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [peekH, setPeekH] = useState<number | undefined>(undefined)
  // innerHeight is the layout viewport — stable even as the address bar shows/hides.
  // visualViewport.height shrinks when the address bar is visible, which would
  // change this value across renders and cause a height flash on Chrome.
  const [fullH] = useState<number>(() => (typeof window !== 'undefined' ? window.innerHeight : 900))
  const yOffset = peekH !== undefined ? fullH - peekH : fullH
  /**
   * The sheet's translation, owned here rather than driven by an `animate` prop.
   * The drag gesture writes to this exact value, so a declarative target would
   * be fighting the finger for control of it mid-gesture.
   */
  const y = useMotionValue(fullH)
  const audioRef = useRef<HTMLAudioElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const factsRef = useRef<HTMLElement>(null)
  const morphTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedQuartiles = useRef<Set<number>>(new Set())
  const dragControls = useDragControls()

  const currentSrc = audio.find((a) => a.language === language)?.audio_url ?? null

  useEffect(() => () => clearTimeout(morphTimer.current ?? undefined), [])

  // Measure peek height once before first paint. Peek content is stable
  // (server-rendered exhibit data, constant chips and button), so no ResizeObserver needed.
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const h = el.offsetHeight
    setPeekH(h)
    // Park the sheet at its resting position before the first paint.
    y.set(fullH - h)
  }, [fullH, y])

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

  /** Open to fullscreen. `velocity` carries a drag release into the snap. */
  const expand = (velocity = 0) => {
    setExpanded(true)
    animate(y, 0, { ...SHEET_SPRING, velocity })
  }

  /** Listen → fullscreen and play from the top; the ring lands a beat later. */
  const listen = () => {
    const el = audioRef.current
    if (!el) return
    firedQuartiles.current = new Set()
    expand()
    setIsPlaying(true)
    setPopping(true)
    el.currentTime = 0
    setElapsed(0)
    // Must stay inside the click's gesture context or iOS blocks playback.
    el.play()
    onFirstPlay()
    // The pop runs for exactly this long, so the ring takes over the instant
    // the button hits zero — whether or not the sheet had to open first.
    morphTimer.current = setTimeout(() => setStarted(true), MORPH_DELAY)
  }

  /** Back to peek. Pauses rather than stops; the next Listen restarts from 0. */
  const collapse = (velocity = 0) => {
    if (morphTimer.current) clearTimeout(morphTimer.current)
    if (sheetRef.current) sheetRef.current.scrollTop = 0
    audioRef.current?.pause()
    setStarted(false)
    setPopping(false)
    setExpanded(false)
    animate(y, yOffset, { ...SHEET_SPRING, velocity })
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
      ref={sheetRef}
      className="absolute left-0 right-0 bottom-0 rounded-t-3xl overflow-y-auto overflow-x-clip bg-ex-paper"
      style={{
        boxShadow: 'var(--ex-shadow-sheet)',
        zIndex: 30,
        fontFamily: 'var(--font-body)',
        height: fullH,
        y,
      }}
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      // These are min/max for `y` itself, relative to the layout position: 0 is
      // fullscreen, yOffset is peek. Framer rebases object constraints into the
      // transform's own space, so anything else here drags the sheet outside its
      // legal travel and makes it jump on the first touch.
      dragConstraints={{ top: 0, bottom: yOffset }}
      // Hard ceiling at fullscreen — overshooting upward lifts the sheet off the
      // bottom edge and exposes the map beneath it. Downward can give a little.
      dragElastic={{ top: 0, bottom: 0.2 }}
      // Framer kicks off its own inertia on `y` before onDragEnd fires, which
      // would strand a sub-threshold release mid-screen. We snap explicitly below.
      dragMomentum={false}
      onDrag={() => {
        // Swap layouts as the finger moves rather than on release, so the
        // fullscreen content is already in place by the time the sheet lands.
        const revealed = y.get() < yOffset * (1 - REVEAL_AT)
        if (revealed !== expanded) setExpanded(revealed)
      }}
      onDragEnd={(_, info) => {
        // Always resolve to a snap point, handing the spring the release velocity
        // so the sheet keeps the momentum the finger gave it.
        const flick = info.velocity.y
        const pastHalfway = y.get() < yOffset / 2
        if (flick < -400 || (pastHalfway && flick <= 400)) expand(flick)
        else collapse(flick)
      }}
    >
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onTimeUpdate={() => {
          const el = audioRef.current
          if (!el) return
          setElapsed(el.currentTime)
          if (duration > 0) {
            const pct = (el.currentTime / duration) * 100
            for (const q of [25, 50, 75, 100]) {
              if (pct >= q && !firedQuartiles.current.has(q)) {
                firedQuartiles.current.add(q)
                onQuartile(Math.round(el.currentTime), q)
              }
            }
          }
        }}
        onEnded={() => collapse()}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div ref={contentRef}>
        {/* Grab handle — drag or tap to toggle full view */}
        <button
          onPointerDown={(e) => dragControls.start(e)}
          onClick={() => (expanded ? collapse() : expand())}
          className="w-full pt-2.5 pb-4 flex justify-center"
          style={{ background: 'none', border: 'none', touchAction: 'none', cursor: 'grab' }}
          aria-label={expanded ? 'Collapse details' : 'Expand to full view'}
          aria-expanded={expanded}
        >
          <span className="rounded-full bg-ex-border" style={{ width: 36, height: 4 }} />
        </button>

        <div className="px-4">
          {/* Exhibit row — thumbnail morphs into a hero gallery when expanded */}
          <div
            className={expanded ? 'flex flex-col gap-3' : 'flex flex-row gap-3 items-center pr-9'}
          >
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
                    <Gallery />
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: 0.12 }}
                      onClick={() => collapse()}
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
                    <div
                      className="w-14 h-14 rounded-xl"
                      style={{
                        background:
                          'linear-gradient(135deg, var(--color-ex-forest-light), var(--color-ex-forest-deep))',
                        overflow: 'hidden',
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* No layout animation here: it measures in viewport space, so while the
                sheet is translating every frame the delta absorbs the parent's
                motion and the title jitters sideways. */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-lg font-bold leading-tight text-ex-ink"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.3px' }}
                >
                  {exhibit.name}
                </span>
                {exhibit.tier === 'a' && (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold px-2 py-0.5 rounded-full text-ex-orange-shadow bg-ex-orange/22">
                    <StarIcon size={11} className="text-ex-orange" />
                    Featured
                  </span>
                )}
              </div>
              {typeLabel && (
                <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-ex-bg border border-ex-border text-ex-ink">
                  <LeafOutlineIcon size={13} className="text-ex-forest" strokeWidth={2} />
                  {typeLabel}
                </span>
              )}
            </div>
          </div>

          {/* Language chips */}
          {availableLangs.length > 0 && (
            <LanguageSelector options={availableLangs} variant="chip" className="mt-4 mb-4" />
          )}

          {/* Listen button pops out of existence, then the ring springs in */}
          {started ? (
            <div className="flex flex-col items-center">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 34 }}
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
                  <circle
                    cx="48"
                    cy="48"
                    r={RING_R}
                    fill="none"
                    className="stroke-ex-border"
                    strokeWidth="5"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r={RING_R}
                    fill="none"
                    className="stroke-ex-forest"
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
                  className="btn-3d-green absolute rounded-full flex items-center justify-center bg-ex-forest text-white"
                  style={{
                    width: 64,
                    height: 64,
                    top: '50%',
                    left: '50%',
                    x: '-50%',
                    y: '-50%',
                    border: 'none',
                  }}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
                </motion.button>
              </motion.div>

              <p className="mt-4 font-bold text-sm tabular-nums text-ex-muted">
                <strong className="text-ex-ink">{formatTime(elapsed)}</strong>
                {duration > 0 && ` / ${formatTime(duration)}`}
              </p>
              {/* Only offer this when there is actually a facts section to reach. */}
              {facts.length > 0 && (
                <button
                  onClick={() => factsRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="mt-2 text-xs font-bold text-ex-forest"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Learn more ↓
                </button>
              )}
            </div>
          ) : (
            <motion.button
              onClick={listen}
              disabled={!currentSrc}
              whileTap={{ scale: 0.98 }}
              animate={
                popping
                  ? {
                      scale: [1, 1.18, 0],
                      opacity: [1, 1, 0],
                      filter: ['brightness(1)', 'brightness(1.35)', 'brightness(1)'],
                    }
                  : { scale: 1, opacity: 1, filter: 'brightness(1)' }
              }
              transition={
                popping
                  ? {
                      duration: MORPH_DELAY / 1000,
                      times: [0, 0.4, 1],
                      ease: ['easeOut', 'easeIn'],
                    }
                  : SPRING
              }
              className="btn-3d-green w-full h-14 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 bg-ex-forest text-white"
              style={{ border: 'none' }}
            >
              <PlayIcon size={20} />
              Listen{durationLabel}
            </motion.button>
          )}

          {/* Full-view-only content */}
          <AnimatePresence initial={false}>
            {expanded && facts.length > 0 && (
              <motion.section
                ref={factsRef}
                key="about"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="mt-6"
              >
                <h3
                  className="text-xs font-extrabold uppercase tracking-wider text-ex-muted"
                  style={{ letterSpacing: '0.05em' }}
                >
                  About
                </h3>
                <ol
                  className="mt-2.5 rounded-2xl px-5 py-4 space-y-2.5 list-decimal list-outside text-sm font-semibold bg-ex-bg border border-ex-border text-ex-ink"
                  style={{ paddingLeft: 34 }}
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
