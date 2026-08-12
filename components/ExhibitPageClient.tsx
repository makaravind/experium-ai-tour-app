'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { MILESTONE_NUMBERS } from '@/lib/constants'

// ─── types ────────────────────────────────────────────────────────────────────

interface ExhibitData {
  name: string
  type: string | null
  tier: string
  scientificName: string | null
}

interface Props {
  exhibitId: string
  qrCodeId: string
  exhibit: ExhibitData
  audioByLang: Record<string, string | null>
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ─── LoadingScreen ────────────────────────────────────────────────────────────

function LoadingScreen({ onDone }: { onDone: () => void }) {
  const { language, setLanguage } = useStore()
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const duration = 1800
    const tick = setInterval(() => {
      const elapsed = Date.now() - start
      const p = Math.min(100, Math.round((elapsed / duration) * 100))
      setPct(p)
      if (p >= 100) {
        clearInterval(tick)
        setTimeout(onDone, 200)
      }
    }, 30)
    return () => clearInterval(tick)
  }, [onDone])

  const langs: { code: 'en' | 'hi' | 'te'; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी' },
    { code: 'te', label: 'తెలుగు' },
  ]

  return (
    <div
      className="fixed inset-0 flex flex-col items-center px-7 pb-8"
      style={{ background: '#f8f7f4', fontFamily: 'var(--font-body)' }}
    >
      {/* Logo */}
      <div
        className="mt-16 w-28 h-28 rounded-3xl flex items-center justify-center"
        style={{
          background: 'radial-gradient(120% 120% at 30% 20%, #7fa06a, #4d6b46)',
          boxShadow: '0 2px 10px rgba(43,43,43,.08)',
        }}
      >
        <svg
          width="56"
          height="56"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2C7 7 5 11 5 15a7 7 0 0 0 14 0c0-4-2-8-7-13Z" />
          <path d="M12 22V9" />
        </svg>
      </div>

      <h1
        className="mt-5 text-2xl font-bold"
        style={{ fontFamily: 'var(--font-display)', color: '#2b2b2b', letterSpacing: '-0.3px' }}
      >
        Experium Park
      </h1>
      <p className="mt-8 text-sm font-semibold" style={{ color: '#8a8a8a' }}>
        Preparing your audio tour…
      </p>

      {/* Progress bar */}
      <div
        className="mt-3.5 w-full h-3 rounded-full overflow-hidden"
        style={{ background: '#a3b18a' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: '#588157', transitionDuration: '80ms' }}
        />
      </div>
      <p className="mt-2 self-start text-xs font-bold tabular-nums" style={{ color: '#8a8a8a' }}>
        {pct}%
      </p>

      {/* Language picker */}
      <div className="mt-auto w-full">
        <p
          className="mb-3 text-center text-xs font-extrabold uppercase tracking-wider"
          style={{ color: '#8a8a8a', letterSpacing: '0.05em' }}
        >
          Choose your language
        </p>
        <div className="flex gap-2.5">
          {langs.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => {
                setLanguage(code)
                localStorage.setItem('experium_lang', code)
              }}
              className="flex-1 h-14 rounded-2xl border-2 text-base font-extrabold transition-colors"
              style={
                language === code
                  ? { background: '#588157', borderColor: '#588157', color: '#fff' }
                  : { background: 'transparent', borderColor: '#a3b18a', color: '#2b2b2b' }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── InfoModal ────────────────────────────────────────────────────────────────

function InfoModal({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const commit = () => {
    localStorage.setItem('experium_user_info', JSON.stringify({ name, phone, email }))
    localStorage.setItem('experium_onboarded', '1')
    onDone()
  }

  const inputStyle = {
    width: '100%',
    height: 48,
    border: '1px solid #e8e5df',
    borderRadius: 12,
    padding: '0 14px',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    color: '#2b2b2b',
    background: '#fff',
    outline: 'none',
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{ background: '#f8f7f4', fontFamily: 'var(--font-body)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: '#fff', boxShadow: '0 12px 34px rgba(43,43,43,.14)' }}
      >
        <h2
          className="text-lg font-bold"
          style={{ fontFamily: 'var(--font-display)', color: '#2b2b2b', letterSpacing: '-0.3px' }}
        >
          Personalize your experience
        </h2>
        <p className="mt-1 text-sm font-semibold" style={{ color: '#8a8a8a' }}>
          Optional — helps us tailor recommendations.
        </p>

        <label className="block mt-3.5">
          <span
            className="block text-xs font-extrabold uppercase tracking-wider mb-1.5"
            style={{ color: '#8a8a8a', letterSpacing: '0.05em' }}
          >
            Name
          </span>
          <input
            style={inputStyle}
            type="text"
            placeholder="Your name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block mt-3.5">
          <span
            className="block text-xs font-extrabold uppercase tracking-wider mb-1.5"
            style={{ color: '#8a8a8a', letterSpacing: '0.05em' }}
          >
            Phone
          </span>
          <input
            style={inputStyle}
            type="tel"
            placeholder="Phone number"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="block mt-3.5">
          <span
            className="block text-xs font-extrabold uppercase tracking-wider mb-1.5"
            style={{ color: '#8a8a8a', letterSpacing: '0.05em' }}
          >
            Email
          </span>
          <input
            style={inputStyle}
            type="email"
            placeholder="Email address"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <button
          onClick={commit}
          className="btn-3d-green w-full h-14 mt-5 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2"
          style={{ background: '#588157', color: '#fff', border: 'none' }}
        >
          Continue →
        </button>
        <button
          onClick={commit}
          className="w-full mt-3.5 py-1.5 font-bold text-sm text-center"
          style={{ background: 'none', border: 'none', color: '#8a8a8a' }}
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}

// ─── MapStub ──────────────────────────────────────────────────────────────────

function MapStub({ discovered }: { discovered: boolean }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{
        background: 'radial-gradient(120% 90% at 20% 12%, #eef3e6 0%, #e6efdc 40%, #dfe9d2 100%)',
      }}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path
          d="M-30 120 Q90 60 200 130 T430 150 L430 380 Q300 340 180 400 T-30 380 Z"
          fill="#d7e6c4"
          opacity=".9"
        />
        <path
          d="M-30 470 Q120 420 250 500 T430 520 L430 900 L-30 900 Z"
          fill="#cfe0ba"
          opacity=".85"
        />
        <ellipse cx="290" cy="560" rx="86" ry="60" fill="#bcd6e3" />
        <path
          d="M60 820 C120 700 40 620 120 540 S250 460 190 360 300 230 210 140 250 60 210 10"
          fill="none"
          stroke="#efe9d8"
          strokeWidth="20"
          strokeLinecap="round"
        />
        <g fill="#7fa06a" stroke="#5f7f4d" strokeWidth="2">
          <circle cx="70" cy="230" r="15" />
          <circle cx="330" cy="300" r="14" />
          <circle cx="55" cy="420" r="12" />
          <circle cx="150" cy="680" r="16" />
          <circle cx="345" cy="700" r="13" />
        </g>
      </svg>

      {/* GPS dot */}
      <div className="absolute" style={{ left: 170, top: 470, transform: 'translate(-50%, -50%)' }}>
        <div
          className="rounded-full"
          style={{
            width: 120,
            height: 120,
            background: 'rgba(74,144,217,.14)',
            border: '1px solid rgba(74,144,217,.4)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 14,
            height: 14,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            background: '#4a90d9',
            border: '2.5px solid #fff',
            boxShadow: '0 1px 4px rgba(43,43,43,.35)',
          }}
        />
      </div>

      {/* Current exhibit pin */}
      <div
        className="absolute"
        style={{
          left: 200,
          top: 430,
          transform: 'translate(-50%, -100%)',
          filter: 'drop-shadow(0 3px 3px rgba(43,43,43,.22))',
        }}
      >
        <svg width="40" height="50" viewBox="0 0 30 38" aria-hidden="true">
          <path
            d="M15 1C7 1 1 7 1 15c0 9 14 22 14 22s14-13 14-22C29 7 23 1 15 1Z"
            fill={discovered ? '#588157' : '#dda15e'}
            stroke="#fff"
            strokeWidth="2.4"
          />
          <circle cx="15" cy="15" r="5" fill="#fff" />
        </svg>
      </div>
    </div>
  )
}

// ─── TabBar ───────────────────────────────────────────────────────────────────

function TabBar() {
  return (
    <nav
      className="absolute left-4 right-4 bottom-6 h-16 flex items-center justify-around rounded-[28px]"
      style={{
        background: '#fff',
        border: '1px solid #e8e5df',
        boxShadow: '0 8px 26px rgba(43,43,43,.14)',
        zIndex: 40,
        fontFamily: 'var(--font-body)',
      }}
      aria-label="Primary"
    >
      <button
        className="flex flex-col items-center gap-0.5 text-[10.5px] font-extrabold flex-1"
        style={{ color: '#8a8a8a', border: 'none', background: 'none' }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8a8a8a"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 11 12 3l9 8" />
          <path d="M5 10v10h14V10" />
        </svg>
        Home
      </button>

      <button
        className="flex flex-col items-center"
        style={{ flex: '0 0 auto', marginTop: -24, border: 'none', background: 'none' }}
        aria-label="Scan a marker"
      >
        <span
          className="btn-3d-orange flex items-center justify-center rounded-full"
          style={{ width: 62, height: 62, background: '#dda15e', border: '3px solid #fff' }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M4 12h16" />
          </svg>
        </span>
        <span
          className="mt-1.5 text-[10.5px] font-extrabold"
          style={{ color: '#dda15e', fontFamily: 'var(--font-body)' }}
        >
          Scan
        </span>
      </button>

      <button
        className="flex flex-col items-center gap-0.5 text-[10.5px] font-extrabold flex-1"
        style={{ color: '#588157', border: 'none', background: 'none' }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#588157"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z" />
          <path d="M9 3v16M15 5v16" />
        </svg>
        Map
      </button>
    </nav>
  )
}

// ─── BottomSheet ──────────────────────────────────────────────────────────────

function BottomSheet({
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
  const { language, setLanguage } = useStore()

  const availableLangs = (
    [
      { code: 'en', label: 'EN' },
      { code: 'hi', label: 'हि' },
      { code: 'te', label: 'తె' },
    ] as { code: 'en' | 'hi' | 'te'; label: string }[]
  ).filter(({ code }) => !!audioByLang[code])

  const durationLabel = audioDuration > 0 ? ` · ${formatTime(audioDuration)}` : ''

  const typeLabel = exhibit.type?.replace(/_/g, ' ')

  return (
    <div
      className="absolute left-0 right-0 bottom-0 rounded-t-3xl pt-2.5 px-4 pb-[108px]"
      style={{
        background: '#fff',
        boxShadow: '0 -8px 32px rgba(43,43,43,.12)',
        zIndex: 30,
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Grab handle */}
      <div
        className="mx-auto mb-4 rounded-full"
        style={{ width: 36, height: 4, background: '#e8e5df' }}
      />

      {/* Exhibit row */}
      <div className="flex gap-3 items-center pr-9">
        {/* Photo placeholder */}
        <div
          className="w-14 h-14 rounded-xl flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #7fa06a, #4d6b46)',
            position: 'relative',
            overflow: 'hidden',
          }}
        />
        <div>
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
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#dda15e">
                  <path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 17l-5.5 2.5 1-6.3L3 8.9 9 8z" />
                </svg>
                Featured
              </span>
            )}
          </div>
          {exhibit.scientificName && (
            <p className="italic text-sm mt-0.5" style={{ color: '#8a8a8a' }}>
              {exhibit.scientificName}
            </p>
          )}
          {typeLabel && (
            <span
              className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: '#f8f7f4', border: '1px solid #e8e5df', color: '#2b2b2b' }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#588157"
                strokeWidth="2"
              >
                <path d="M12 2C7 7 5 11 5 15a7 7 0 0 0 14 0c0-4-2-8-7-13Z" />
              </svg>
              {typeLabel}
            </span>
          )}
        </div>
      </div>

      {/* Language chips */}
      {availableLangs.length > 0 && (
        <div className="flex gap-2 mt-4 mb-4">
          {availableLangs.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => setLanguage(code)}
              className="rounded-full px-4 py-2 text-sm font-extrabold border-2 transition-colors"
              style={
                language === code
                  ? { background: '#588157', borderColor: '#588157', color: '#fff' }
                  : { background: 'transparent', borderColor: '#a3b18a', color: '#2b2b2b' }
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Listen button */}
      <button
        onClick={onListen}
        disabled={!audioByLang[language]}
        className="btn-3d-green w-full h-14 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2"
        style={{ background: '#588157', color: '#fff', border: 'none' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
          <path d="M8 5v14l11-7z" />
        </svg>
        Listen{durationLabel}
      </button>
    </div>
  )
}

// ─── AudioPlayer ──────────────────────────────────────────────────────────────

const RING_R = 43
const RING_C = 2 * Math.PI * RING_R // ≈ 270

function AudioPlayer({
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
  const { language, setLanguage } = useStore()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showLearnMore, setShowLearnMore] = useState(false)

  const currentSrc = audioByLang[language] ?? null

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

  const availableLangs = (
    [
      { code: 'en', label: 'EN' },
      { code: 'hi', label: 'हि' },
      { code: 'te', label: 'తె' },
    ] as { code: 'en' | 'hi' | 'te'; label: string }[]
  ).filter(({ code }) => !!audioByLang[code])

  return (
    <div
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
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2b2b2b"
          strokeWidth="2.4"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      <div className="flex flex-col items-center px-5 pt-16">
        {/* Hero image */}
        <div
          className="w-full rounded-2xl overflow-hidden relative"
          style={{ aspectRatio: '16/9', background: 'linear-gradient(160deg, #6f9557, #456a3f)' }}
        />

        {/* Gallery dots */}
        <div className="flex gap-1.5 justify-center mt-3.5 mb-1" aria-hidden="true">
          {[true, false, false, false].map((on, i) => (
            <span
              key={i}
              className="rounded-full"
              style={
                on
                  ? { width: 16, height: 6, background: '#588157' }
                  : { width: 6, height: 6, background: '#e8e5df' }
              }
            />
          ))}
        </div>

        <h2
          className="mt-2 text-xl font-bold text-center"
          style={{ fontFamily: 'var(--font-display)', color: '#2b2b2b', letterSpacing: '-0.3px' }}
        >
          {exhibit.name}
        </h2>
        {exhibit.scientificName && (
          <p className="italic text-sm text-center mt-0.5" style={{ color: '#8a8a8a' }}>
            {exhibit.scientificName}
          </p>
        )}

        {/* Language chips in player */}
        {availableLangs.length > 1 && (
          <div className="flex gap-2 mt-3">
            {availableLangs.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                className="rounded-full px-3.5 py-1.5 text-xs font-extrabold border-2 transition-colors"
                style={
                  language === code
                    ? { background: '#588157', borderColor: '#588157', color: '#fff' }
                    : { background: 'transparent', borderColor: '#a3b18a', color: '#2b2b2b' }
                }
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Progress ring */}
        <div className="flex flex-col items-center mt-5">
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
            <button
              onClick={togglePlay}
              className="btn-3d-green absolute rounded-full flex items-center justify-center"
              style={{
                width: 64,
                height: 64,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%,-50%)',
                background: '#588157',
                border: 'none',
              }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>

          <p className="mt-4 font-bold text-sm tabular-nums" style={{ color: '#8a8a8a' }}>
            <strong style={{ color: '#2b2b2b' }}>{formatTime(elapsed)}</strong>
            {duration > 0 && ` / ${formatTime(duration)}`}
          </p>

          <button
            onClick={() => setShowLearnMore((v) => !v)}
            className="mt-4 flex items-center gap-1 font-bold text-sm"
            style={{ color: '#8a8a8a', background: 'none', border: 'none' }}
          >
            Learn more
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              style={{
                transform: showLearnMore ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Ad banner placeholder */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center gap-3 px-5 py-3 pb-7"
        style={{ borderTop: '1px solid #e8e5df', background: '#fff' }}
      >
        <div
          className="w-11 h-11 rounded-lg flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #d9c39a, #c9a86f)' }}
        />
        <div className="flex-1 min-w-0">
          <p
            className="text-[9.5px] font-extrabold uppercase tracking-wider"
            style={{ color: '#8a8a8a' }}
          >
            Sponsored
          </p>
          <p className="text-sm font-bold leading-tight mt-0.5" style={{ color: '#2b2b2b' }}>
            Discover more at Experium
          </p>
        </div>
        <span className="text-xs font-extrabold" style={{ color: '#dda15e' }}>
          Open →
        </span>
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ totalDiscovered }: { totalDiscovered: number }) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-full font-extrabold text-sm whitespace-nowrap"
      style={{
        top: 64,
        background: '#588157',
        color: '#fff',
        boxShadow: '0 8px 24px rgba(63,107,58,.4)',
        zIndex: 35,
        fontFamily: 'var(--font-body)',
      }}
      role="status"
    >
      +1 🌿 <span style={{ opacity: 0.85 }}>· {totalDiscovered}/50 discovered</span>
    </div>
  )
}

// ─── MilestoneCelebration ─────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#ffffff', '#dda15e', '#a3b18a', '#f8f7f4', '#b8834a']

// Pre-compute so render stays pure
const CONFETTI_PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  delay: `${((i * 0.11) % 0.9).toFixed(2)}s`,
  rotate: `${(i * 23) % 180}deg`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}))

function MilestoneCelebration({
  totalDiscovered,
  onDismiss,
}: {
  totalDiscovered: number
  onDismiss: () => void
}) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center text-center px-8 overflow-hidden"
      style={{
        background: 'linear-gradient(165deg, #588157 0%, #3f6b3a 100%)',
        zIndex: 45,
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {CONFETTI_PARTICLES.map((p, i) => (
          <span
            key={i}
            className="absolute rounded-sm"
            style={{
              width: 9,
              height: 14,
              left: p.left,
              top: -20,
              background: p.color,
              transform: `rotate(${p.rotate})`,
              animation: `fall 2.6s ease-in ${p.delay} forwards`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes fall {
          0% { transform: translateY(-40px) rotate(0); opacity: 0; }
          12% { opacity: .95; }
          100% { transform: translateY(560px) rotate(320deg); opacity: .9; }
        }
      `}</style>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="absolute top-14 right-5 w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,.16)', border: 'none', zIndex: 4 }}
        aria-label="Dismiss"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      <div className="relative flex flex-col items-center" style={{ zIndex: 3 }}>
        {/* Badge */}
        <div
          className="rounded-full flex items-center justify-center mb-6"
          style={{ width: 132, height: 132, border: '3px dashed rgba(255,255,255,.55)' }}
        >
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: 98,
              height: 98,
              background: 'rgba(255,255,255,.14)',
              border: '2px solid rgba(255,255,255,.4)',
            }}
          >
            <svg
              width="46"
              height="46"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="1.8"
            >
              <path d="M12 2C7 7 5 11 5 15a7 7 0 0 0 14 0c0-4-2-8-7-13Z" />
              <path d="M12 22V9" />
            </svg>
          </div>
        </div>

        <p
          className="text-xs font-extrabold uppercase tracking-widest"
          style={{ color: 'rgba(255,255,255,.7)', letterSpacing: '0.18em' }}
        >
          Milestone reached
        </p>
        <h2
          className="mt-2 text-xl font-bold"
          style={{ fontFamily: 'var(--font-display)', color: '#fff', letterSpacing: '-0.3px' }}
        >
          {totalDiscovered === 1 ? 'First Discovery!' : `Explorer — ${totalDiscovered} Discovered!`}
        </h2>
        <p className="mt-1 text-sm font-semibold" style={{ color: 'rgba(255,255,255,.85)' }}>
          {totalDiscovered >= 10
            ? "You're deep in the park. Keep going!"
            : totalDiscovered >= 3
              ? 'Warming up nicely!'
              : 'Your journey begins!'}
        </p>

        <button
          onClick={onDismiss}
          className="btn-3d-orange mt-8 h-14 px-8 rounded-2xl font-extrabold text-base flex items-center gap-2"
          style={{ background: '#dda15e', color: '#fff', border: 'none' }}
        >
          Keep exploring →
        </button>
      </div>
    </div>
  )
}

// ─── ExhibitView ──────────────────────────────────────────────────────────────

function ExhibitView({
  exhibit,
  audioByLang,
  qrCodeId,
  exhibitId,
}: {
  exhibit: ExhibitData
  audioByLang: Record<string, string | null>
  qrCodeId: string
  exhibitId: string
}) {
  const { language, visitorId, totalDiscovered, setTotalDiscovered, markVisited } = useStore()
  const [showPlayer, setShowPlayer] = useState(false)
  const [discovered, setDiscovered] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [showMilestone, setShowMilestone] = useState(false)
  const [audioDuration, setAudioDuration] = useState(0)

  const currentAudioUrl = audioByLang[language] ?? null

  const handleAudioEnd = useCallback(
    async (listenDurationSec: number) => {
      setShowPlayer(false)

      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorId: visitorId ?? `anon-${Date.now()}`,
            qrCodeId,
            exhibitId,
            listenDurationSec,
          }),
        })
        const data = await res.json()
        const total: number = data.total_discovered ?? 0
        setTotalDiscovered(total)
        markVisited(exhibitId)
        setDiscovered(true)
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
        if (MILESTONE_NUMBERS.includes(total)) {
          setTimeout(() => setShowMilestone(true), 400)
        }
      } catch {
        // non-fatal — show toast anyway
        setDiscovered(true)
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
      }
    },
    [qrCodeId, exhibitId, visitorId, setTotalDiscovered, markVisited]
  )

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ fontFamily: 'var(--font-body)' }}>
      <MapStub discovered={discovered} />

      {/* Search bar */}
      <div
        className="absolute left-4 right-4 flex gap-2.5 items-center"
        style={{ top: 60, zIndex: 20 }}
      >
        <div
          className="flex-1 h-11 flex items-center gap-2 px-4 rounded-full font-semibold text-sm"
          style={{
            background: '#fff',
            border: '1px solid #e8e5df',
            boxShadow: '0 2px 10px rgba(43,43,43,.08)',
            color: '#8a8a8a',
          }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8a8a8a"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
          Search exhibits
        </div>
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{
            background: '#fff',
            border: '1px solid #e8e5df',
            boxShadow: '0 2px 10px rgba(43,43,43,.08)',
            color: '#588157',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <circle cx="12" cy="12" r="5" />
          </svg>
        </div>
      </div>

      {/* Toast */}
      {showToast && <Toast totalDiscovered={totalDiscovered} />}

      {/* Bottom sheet */}
      <BottomSheet
        exhibit={exhibit}
        audioByLang={audioByLang}
        audioDuration={audioDuration}
        onListen={() => setShowPlayer(true)}
      />

      <TabBar />

      {/* Hidden audio for duration metadata */}
      {currentAudioUrl && (
        <audio
          src={currentAudioUrl}
          preload="metadata"
          onLoadedMetadata={(e) => setAudioDuration((e.target as HTMLAudioElement).duration)}
          style={{ display: 'none' }}
        />
      )}

      {/* Audio player (full-screen) */}
      {showPlayer && (
        <AudioPlayer
          exhibit={exhibit}
          audioByLang={audioByLang}
          onClose={() => setShowPlayer(false)}
          onEnded={handleAudioEnd}
        />
      )}

      {/* Milestone celebration */}
      {showMilestone && (
        <MilestoneCelebration
          totalDiscovered={totalDiscovered}
          onDismiss={() => setShowMilestone(false)}
        />
      )}
    </div>
  )
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export default function ExhibitPageClient({ exhibitId, qrCodeId, exhibit, audioByLang }: Props) {
  const onboardingStep = useStore((s) => s.onboardingStep)
  const setOnboardingStep = useStore((s) => s.setOnboardingStep)
  const setVisitorId = useStore((s) => s.setVisitorId)

  const handleLoadingDone = useCallback(() => setOnboardingStep('info'), [setOnboardingStep])

  useEffect(() => {
    const onboarded = localStorage.getItem('experium_onboarded')
    setOnboardingStep(onboarded ? 'exhibit' : 'loading')

    import('@fingerprintjs/fingerprintjs')
      .then((FingerprintJS) => FingerprintJS.load())
      .then((fp) => fp.get())
      .then((result) => setVisitorId(result.visitorId))
      .catch(() => {})
  }, [setOnboardingStep, setVisitorId])

  if (onboardingStep === null) return null

  if (onboardingStep === 'loading') {
    return <LoadingScreen onDone={handleLoadingDone} />
  }

  if (onboardingStep === 'info') {
    return <InfoModal onDone={() => setOnboardingStep('exhibit')} />
  }

  return (
    <ExhibitView
      exhibit={exhibit}
      audioByLang={audioByLang}
      qrCodeId={qrCodeId}
      exhibitId={exhibitId}
    />
  )
}
