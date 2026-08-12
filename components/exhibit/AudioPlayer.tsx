'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Gallery from '@/components/exhibit/Gallery'
import LanguageSelector from '@/components/common/LanguageSelector'
import { ChevronDownIcon, CloseIcon, PauseIcon, PlayIcon } from '@/components/icons'
import { useStore } from '@/lib/store'
import { formatTime, getAvailableLangs, parseFacts } from '@/lib/utils'
import type { ExhibitData } from '@/lib/types'

const RING_R = 43
const RING_C = 2 * Math.PI * RING_R // ≈ 270

export default function AudioPlayer({
  exhibit,
  audioByLang,
  onClose,
  onEnded,
}: {
  exhibit: ExhibitData
  audioByLang: Record<string, string | null>
  onClose: () => void
  onEnded: (listenDurationSec: number) => void
}) {
  const language = useStore((s) => s.language)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showLearnMore, setShowLearnMore] = useState(false)

  const currentSrc = audioByLang[language] ?? null
  const availableLangs = getAvailableLangs(audioByLang)
  const facts = parseFacts(exhibit.facts)

  useEffect(() => {
    const el = audioRef.current
    if (!el || !currentSrc) return
    el.src = currentSrc
    el.currentTime = 0
    setElapsed(0)
    const tryPlay = async () => {
      const played = await el.play().catch(() => false)
      setIsPlaying(played !== false)
    }
    tryPlay()
  }, [currentSrc])

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

  const progress = duration > 0 ? elapsed / duration : 0
  const offset = RING_C * (1 - progress)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 flex flex-col"
      style={{ background: '#fff', zIndex: 50, fontFamily: 'var(--font-body)' }}
    >
      <audio
        ref={audioRef}
        preload="auto"
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onTimeUpdate={() => setElapsed(audioRef.current?.currentTime ?? 0)}
        onEnded={() => onEnded(Math.round(elapsed))}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-14 right-5 w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: '#f8f7f4', border: 'none', zIndex: 2 }}
        aria-label="Close player"
      >
        <CloseIcon size={16} color="#2b2b2b" strokeWidth={2.4} />
      </button>

      <div className="flex-1 overflow-y-auto flex flex-col items-center px-5 pt-16 pb-10">
        <Gallery />

        <h2
          className="mt-2 text-xl font-bold text-center"
          style={{ fontFamily: 'var(--font-display)', color: '#2b2b2b', letterSpacing: '-0.3px' }}
        >
          {exhibit.name}
        </h2>

        {availableLangs.length > 1 && (
          <LanguageSelector options={availableLangs} variant="chip-sm" className="mt-3" />
        )}

        {/* Progress ring */}
        <div className="flex flex-col items-center mt-5 w-full">
          <div className="relative" style={{ width: 96, height: 96 }}>
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
                strokeDashoffset={offset}
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
          </div>

          <p className="mt-4 font-bold text-sm tabular-nums" style={{ color: '#8a8a8a' }}>
            <strong style={{ color: '#2b2b2b' }}>{formatTime(elapsed)}</strong>
            {duration > 0 && ` / ${formatTime(duration)}`}
          </p>

          {facts.length > 0 && (
            <>
              <button
                onClick={() => setShowLearnMore((v) => !v)}
                className="mt-4 flex items-center gap-1 font-bold text-sm"
                style={{ color: '#8a8a8a', background: 'none', border: 'none' }}
                aria-expanded={showLearnMore}
              >
                Learn more
                <motion.span
                  className="flex"
                  animate={{ rotate: showLearnMore ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDownIcon size={14} color="currentColor" strokeWidth={2.4} />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {showLearnMore && (
                  <motion.div
                    key="facts"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: 'easeInOut' }}
                    className="w-full overflow-hidden"
                  >
                    <ol
                      className="mt-4 w-full rounded-2xl px-5 py-4 space-y-2.5 list-decimal list-outside text-sm font-semibold"
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
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}
