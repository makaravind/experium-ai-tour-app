'use client'

import { useEffect, useState } from 'react'
import LanguageSelector from '@/components/common/LanguageSelector'
import { LeafIcon } from '@/components/icons'
import { LANGUAGES } from '@/lib/utils'

export default function LoadingScreen({ onDone }: { onDone: () => void }) {
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

  return (
    <div
      className="fixed inset-0 flex flex-col items-center px-7 pb-8 bg-ex-bg"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {/* Logo */}
      <div
        className="mt-16 w-28 h-28 rounded-3xl flex items-center justify-center text-white"
        style={{
          background:
            'radial-gradient(120% 120% at 30% 20%, var(--color-ex-forest-light), var(--color-ex-forest-deep))',
          boxShadow: 'var(--ex-shadow-soft)',
        }}
      >
        <LeafIcon size={56} strokeWidth={1.6} />
      </div>

      <h1
        className="mt-5 text-2xl font-bold text-ex-ink"
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.3px' }}
      >
        Experium Park
      </h1>
      <p className="mt-8 text-sm font-semibold text-ex-muted">Preparing your audio tour…</p>

      {/* Progress bar */}
      <div className="mt-3.5 w-full h-3 rounded-full overflow-hidden bg-ex-sage">
        <div
          className="h-full rounded-full transition-all bg-ex-forest"
          style={{ width: `${pct}%`, transitionDuration: '80ms' }}
        />
      </div>
      <p className="mt-2 self-start text-xs font-bold tabular-nums text-ex-muted">{pct}%</p>

      {/* Language picker */}
      <div className="mt-auto w-full">
        <p
          className="mb-3 text-center text-xs font-extrabold uppercase tracking-wider text-ex-muted"
          style={{ letterSpacing: '0.05em' }}
        >
          Choose your language
        </p>
        <LanguageSelector options={LANGUAGES} variant="block" />
      </div>
    </div>
  )
}
