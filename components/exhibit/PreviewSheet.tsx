'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, animate, motion, useDragControls, useMotionValue } from 'framer-motion'
import Gallery from '@/components/exhibit/Gallery'
import LanguageSelector from '@/components/common/LanguageSelector'
import {
  CloseIcon,
  CompassIcon,
  LeafOutlineIcon,
  PauseIcon,
  PlayIcon,
  StarIcon,
} from '@/components/icons'
import { useStore } from '@/lib/store'
import { LANGUAGES, formatTime, getAvailableLangs, parseFacts } from '@/lib/utils'
import type { ExhibitAudio, Language, PreviewExhibit } from '@/lib/types'

const SPRING = { duration: 0.3, ease: [0.4, 0, 0.2, 1] } as const
const SHEET_SPRING = { type: 'spring', stiffness: 400, damping: 40, restDelta: 0.5 } as const
const REVEAL_AT = 0.18
const TAB_BAR_CLEARANCE = 108
const RING_R = 43
const RING_C = 2 * Math.PI * RING_R
const MORPH_DELAY = 280
const START_TIMEOUT = 8000
const TOAST_MS = 3000

type FallbackReason = 'error' | 'timeout' | 'missing'

const langName = (code: Language) => LANGUAGES.find((l) => l.code === code)?.name ?? code

export default function PreviewSheet({
  exhibit,
  audio = [],
  onNavigate,
  onClose,
  autoPlay,
  onFirstPlay,
  onQuartile,
  onAudioEnded,
}: {
  exhibit: PreviewExhibit | null
  audio?: ExhibitAudio[]
  autoPlay?: boolean
  onNavigate?: () => void
  onClose?: () => void
  onFirstPlay?: () => void
  onQuartile?: (sec: number, quartile: number) => void
  onAudioEnded?: () => void
}) {
  const router = useRouter()
  const language = useStore((s) => s.language)
  const setLanguage = useStore((s) => s.setLanguage)
  const precacheLanguage = useStore((s) => s.precacheLanguage)
  const [expanded, setExpanded] = useState(false)
  const [started, setStarted] = useState(false)
  const [popping, setPopping] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [peekH, setPeekH] = useState<number | undefined>(undefined)
  const [fullH, setFullH] = useState(900)
  const yOffset = exhibit && peekH !== undefined ? fullH - peekH : fullH
  const y = useMotionValue(fullH)
  const audioRef = useRef<HTMLAudioElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const factsRef = useRef<HTMLElement>(null)
  const morphTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedQuartiles = useRef<Set<number>>(new Set())
  const prevExhibitId = useRef<string | null>(null)
  const autoPlayFired = useRef(false)
  const playIntent = useRef(false)
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadedSrc = useRef<string | null>(null)
  const fallbackRef = useRef<(reason: FallbackReason) => string | null>(() => null)
  const dragControls = useDragControls()

  const currentSrc = audio.find((a) => a.language === language)?.audio_url ?? null
  const hasAudio = audio.length > 0

  const clearIntent = () => {
    playIntent.current = false
    if (startTimer.current) clearTimeout(startTimer.current)
    startTimer.current = null
  }

  useEffect(
    () => () => {
      clearTimeout(morphTimer.current ?? undefined)
      clearTimeout(startTimer.current ?? undefined)
      clearTimeout(toastTimer.current ?? undefined)
    },
    []
  )

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS)
  }

  // Back to the Play state: no fake "playing" ring after a failed start.
  const stopPlayback = () => {
    clearIntent()
    if (morphTimer.current) clearTimeout(morphTimer.current)
    audioRef.current?.pause()
    setIsPlaying(false)
    setStarted(false)
    setPopping(false)
  }

  const startPlayback = (el: HTMLAudioElement) => {
    playIntent.current = true
    if (startTimer.current) clearTimeout(startTimer.current)
    startTimer.current = setTimeout(() => fallbackRef.current('timeout'), START_TIMEOUT)
    el.play().catch((err) => {
      // AbortError: src swapped mid-start. Other failures surface via the `error` event.
      if (err?.name === 'NotAllowedError') stopPlayback()
    })
  }

  // Returns the revert src (when one exists) so `listen()` can carry on with it before the re-render.
  const fallback = (reason: FallbackReason) => {
    const from = language
    const to = precacheLanguage
    const toUrl =
      to && to !== from ? (audio.find((a) => a.language === to)?.audio_url ?? null) : null
    console.log('[audio] fallback', { from, to: toUrl ? to : null, reason })
    const fromName = langName(from)
    if (startTimer.current) clearTimeout(startTimer.current)
    startTimer.current = null
    if (to && toUrl) {
      const msg =
        reason === 'missing'
          ? `Not available in ${fromName}. Switched to ${langName(to)}.`
          : `${fromName} needs internet. Switched to ${langName(to)}.`
      showToast(msg)
      setLanguage(to) // src-swap effect plays it if playIntent is set
      return toUrl
    }
    showToast(
      reason === 'missing'
        ? `Not available in ${fromName}.`
        : "Couldn't play audio. Check your connection."
    )
    stopPlayback()
    return null
  }

  useEffect(() => {
    fallbackRef.current = fallback
  })

  useEffect(() => {
    setFullH(window.innerHeight) // eslint-disable-line react-hooks/set-state-in-effect
  }, [])

  // Measure peek height once; park sheet at correct initial position.
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const h = el.offsetHeight
    setPeekH(h)
    y.set(exhibit ? fullH - h : fullH)
  }, [fullH, y]) // eslint-disable-line react-hooks/exhaustive-deps

  // Animate in/out when exhibit changes.

  useEffect(() => {
    if (peekH === undefined) return
    if (!exhibit) {
      if (morphTimer.current) clearTimeout(morphTimer.current)
      audioRef.current?.pause()
      clearIntent()
      setStarted(false) // eslint-disable-line react-hooks/set-state-in-effect
      setPopping(false)
      setExpanded(false)
      animate(y, fullH, SHEET_SPRING)
    } else if (exhibit.id !== prevExhibitId.current || y.get() > fullH - peekH - 5) {
      if (morphTimer.current) clearTimeout(morphTimer.current)
      audioRef.current?.pause()
      clearIntent()
      setStarted(false)
      setPopping(false)
      setExpanded(false)
      animate(y, fullH - peekH, SHEET_SPRING)
    }
    prevExhibitId.current = exhibit?.id ?? null
  }, [exhibit?.id, peekH]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset autoPlay guard when exhibit changes so re-navigation with autoplay=1 works
  useEffect(() => {
    autoPlayFired.current = false
  }, [exhibit?.id])

  useEffect(() => {
    const el = audioRef.current
    if (!el || !currentSrc || loadedSrc.current === currentSrc) return
    // playIntent covers a revert after a failed start, where `paused` is browser-dependent.
    const resume = playIntent.current || !el.paused
    loadedSrc.current = currentSrc
    el.src = currentSrc
    el.currentTime = 0
    setElapsed(0)
    if (resume) startPlayback(el)
  }, [currentSrc]) // eslint-disable-line react-hooks/exhaustive-deps

  const expand = (velocity = 0) => {
    setExpanded(true)
    animate(y, 0, { ...SHEET_SPRING, velocity })
  }

  const collapse = (velocity = 0) => {
    if (morphTimer.current) clearTimeout(morphTimer.current)
    if (sheetRef.current) sheetRef.current.scrollTop = 0
    audioRef.current?.pause()
    clearIntent()
    setStarted(false)
    setPopping(false)
    setExpanded(false)
    animate(y, yOffset, { ...SHEET_SPRING, velocity })
  }

  const handleClose = () => {
    collapse()
    setTimeout(() => onClose?.(), 300)
  }

  const listen = () => {
    if (!hasAudio) {
      if (exhibit?.qr_code) router.push(`/s/${exhibit.qr_code}?scansrc=app&autoplay=1`)
      return
    }
    const el = audioRef.current
    if (!el) return
    let src = currentSrc
    if (!src) {
      src = fallbackRef.current('missing')
      if (!src) return
      el.src = src
      loadedSrc.current = src
    }
    firedQuartiles.current = new Set()
    expand()
    setIsPlaying(true)
    setPopping(true)
    el.currentTime = 0
    setElapsed(0)
    startPlayback(el)
    onFirstPlay?.()
    morphTimer.current = setTimeout(() => setStarted(true), MORPH_DELAY)
  }

  useEffect(() => {
    if (!autoPlay || peekH === undefined || autoPlayFired.current) return
    autoPlayFired.current = true
    listen()
  }, [peekH, autoPlay]) // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (isPlaying) {
      el.pause()
      setIsPlaying(false)
    } else {
      playIntent.current = true
      el.play()
      setIsPlaying(true)
    }
  }

  const availableLangs =
    audio.length > 0
      ? getAvailableLangs(audio)
      : LANGUAGES.filter((l) => exhibit?.languages?.includes(l.code) ?? false)
  const facts = parseFacts(exhibit?.facts)
  const durationLabel = duration > 0 ? ` · ${formatTime(duration)}` : ''
  const typeLabel = exhibit?.type?.replace(/_/g, ' ')
  const progress = duration > 0 ? elapsed / duration : 0

  return (
    <>
      {onClose && exhibit && <div className="fixed inset-0 z-40" onClick={handleClose} />}
      <motion.div
        ref={sheetRef}
        className="fixed left-0 right-0 bottom-0 rounded-t-3xl overflow-y-auto overflow-x-clip bg-ex-paper"
        style={{
          boxShadow: 'var(--ex-shadow-sheet)',
          zIndex: 50,
          fontFamily: 'var(--font-body)',
          height: fullH,
          y,
        }}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: yOffset }}
        dragElastic={{ top: 0, bottom: 0.2 }}
        dragMomentum={false}
        onDrag={() => {
          const revealed = y.get() < yOffset * (1 - REVEAL_AT)
          if (revealed !== expanded) setExpanded(revealed)
        }}
        onDragEnd={(_, info) => {
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
                  onQuartile?.(Math.round(el.currentTime), q)
                }
              }
            }
          }}
          onEnded={() => {
            collapse()
            onAudioEnded?.()
          }}
          onPlay={() => setIsPlaying(true)}
          onPlaying={() => {
            if (startTimer.current) clearTimeout(startTimer.current)
            startTimer.current = null
          }}
          onPause={(e) => {
            // A src swap while playing can fire `pause`, but play() has already re-run.
            if (!e.currentTarget.paused) return
            clearIntent()
            setIsPlaying(false)
          }}
          onError={(e) => {
            const err = e.currentTarget.error
            if (!err || err.code === MediaError.MEDIA_ERR_ABORTED) return
            fallbackRef.current('error')
          }}
        />

        <div ref={contentRef}>
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

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-lg font-bold leading-tight text-ex-ink"
                    style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.3px' }}
                  >
                    {exhibit?.name}
                  </span>
                  {exhibit?.tier === 'a' && (
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

            {availableLangs.length > 0 && (
              <LanguageSelector options={availableLangs} variant="chip" className="mt-4 mb-4" />
            )}

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
              <div className={`mt-4 ${onNavigate ? 'flex gap-3' : ''}`}>
                <motion.button
                  onClick={listen}
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
                  className={`btn-3d-green h-14 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 bg-ex-forest text-white ${onNavigate ? 'flex-1' : 'w-full'}`}
                  style={{ border: 'none' }}
                >
                  <PlayIcon size={20} />
                  Listen{hasAudio ? durationLabel : ''}
                </motion.button>
                {onNavigate && (
                  <button
                    onClick={onNavigate}
                    className="flex-1 h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 bg-ex-sage text-white"
                    style={{ border: 'none' }}
                  >
                    <CompassIcon size={20} />
                    Navigate
                  </button>
                )}
              </div>
            )}

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

      <AnimatePresence>
        {toast && (
          <motion.div
            key="fallback-toast"
            role="status"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed left-1/2 px-4 py-2 rounded-full text-sm font-semibold bg-ex-forest text-white"
            style={{ top: 60, x: '-50%', zIndex: 55, boxShadow: 'var(--ex-shadow-soft)' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
