'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { track } from '@vercel/analytics'
import { detectPlatform, type Platform } from '@/lib/platform'
import { useStore } from '@/lib/store'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

const subscribe = () => () => {}
const getReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION).matches

const STEPS: Record<Platform, string | null> = {
  ios: 'To see Pip move, turn off Settings → Accessibility → Motion → Reduce Motion.',
  android:
    'To see Pip move, turn off Settings → Accessibility → Remove animations (the name can differ by phone).',
  other: null,
}

/** One-time note for visitors whose Reduce Motion setting keeps Pip on its still poster. */
export default function PipMotionHint() {
  const reducedMotion = useSyncExternalStore(subscribe, getReducedMotion, () => false)
  const seen = useStore((s) => s.pipMotionHintSeen)
  const setSeen = useStore((s) => s.setPipMotionHintSeen)
  const visible = reducedMotion && !seen
  const platform = useMemo(
    () => (visible ? detectPlatform(navigator.userAgent, navigator.maxTouchPoints) : 'other'),
    [visible]
  )

  useEffect(() => {
    if (visible) track('pip_motion_hint_shown', { platform })
  }, [visible, platform])

  if (!visible) return null

  const steps = STEPS[platform]
  return (
    <div
      role="status"
      className="fixed inset-x-4 z-[60] flex items-start gap-3 rounded-2xl p-4 bg-ex-paper"
      style={{
        top: 'calc(env(safe-area-inset-top) + 12px)',
        boxShadow: 'var(--ex-shadow-modal)',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/pip.webp" alt="" aria-hidden="true" width={44} height={44} className="flex-none" />
      <div className="flex-1 min-w-0">
        <div
          className="text-base font-bold text-ex-ink"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.3px' }}
        >
          Pip is resting
        </div>
        <p className="mt-0.5 text-sm text-ex-ink">Reduce Motion is on, so Pip holds still.</p>
        {steps && <p className="mt-1 text-[13px] text-ex-muted">{steps}</p>}
        <button
          type="button"
          onClick={() => {
            track('pip_motion_hint_dismissed', { platform })
            setSeen(true)
          }}
          className="mt-3 h-10 px-5 rounded-full font-extrabold text-sm bg-ex-forest text-white"
          style={{ border: 'none' }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}
