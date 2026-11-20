'use client'

import { Component, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { track } from '@vercel/analytics'

export type PipState =
  'idle' | 'speaking' | 'thinking' | 'celebrating' | 'surprised' | 'sad' | 'sleeping'

/** wobnimo has no auto-sleep; an idle Pip nods off after this long without a poke or state change. */
export const SLEEP_AFTER_MS = 20_000

interface PipMascotProps {
  state: PipState
  size: number | { width: number; height: number }
  className?: string
  interactive?: boolean
}

interface PipCanvasProps {
  state: PipState
  interactive: boolean
  onReady: () => void
  onPoke: () => void
}

// Kept outside dynamic(): Next rewrites import() inside its loader to a require-style resolve,
// which fails on wobnimo's ESM-only exports map.
const loadWobnimo = () => Promise.all([import('wobnimo/react'), import('wobnimo/characters/pip')])

const PipCanvas = dynamic<PipCanvasProps>(
  async () => {
    const [{ Mascot }, { pip }] = await loadWobnimo()
    return function PipCanvas({ state, interactive, onReady, onPoke }) {
      return (
        <Mascot
          character={pip}
          state={state}
          onReady={onReady}
          interactive={interactive}
          onPoke={onPoke}
          maxPixelRatio={3}
          style={{ width: '100%', height: '100%' }}
        />
      )
    }
  },
  { ssr: false }
)

/** wobnimo's Mascot throws without WebGL2, so probe first; no animation under reduced motion. */
type StaticReason = 'reduced_motion' | 'no_webgl2' | 'canvas_failed'

let canAnimate: boolean | undefined
let staticReason: StaticReason | null = null
function getCanAnimate(): boolean {
  if (canAnimate === undefined) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      canAnimate = false
      staticReason = 'reduced_motion'
    } else {
      const gl = document.createElement('canvas').getContext('webgl2')
      canAnimate = gl !== null
      if (!canAnimate) staticReason = 'no_webgl2'
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }
  return canAnimate
}

// Once per page load, not per Pip instance: how many visitors never see a live Pip, and why.
let staticTracked = false
function trackStatic(reason: StaticReason) {
  if (staticTracked) return
  staticTracked = true
  track('pip_static', { reason })
}

const subscribe = () => () => {}

/** Canvas can throw after the probe (context loss, shader failure, failed chunk import); keep the poster instead of blanking the route. */
class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.warn('PipMascot canvas failed, showing poster', error)
    trackStatic('canvas_failed')
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** A passed className replaces the default `relative`, so it must include its own position class. */
export default function PipMascot({ state, size, className, interactive = false }: PipMascotProps) {
  const { width, height } = typeof size === 'number' ? { width: size, height: size } : size
  const live = useSyncExternalStore(subscribe, getCanAnimate, () => false)
  const [ready, setReady] = useState(false)
  const [asleep, setAsleep] = useState(false)
  const [pokes, setPokes] = useState(0)
  const [prevState, setPrevState] = useState(state)

  // Any change of the requested state wakes Pip.
  if (prevState !== state) {
    setPrevState(state)
    setAsleep(false)
  }

  useEffect(() => {
    if (!getCanAnimate() && staticReason) trackStatic(staticReason)
  }, [])

  useEffect(() => {
    if (!live || state !== 'idle') return
    const timer = setTimeout(() => setAsleep(true), SLEEP_AFTER_MS)
    return () => clearTimeout(timer)
  }, [live, state, pokes])

  const handlePoke = () => {
    setAsleep(false)
    setPokes((n) => n + 1)
  }

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none ${className ?? 'relative'}`}
      style={{ width, height }}
    >
      {!ready && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/pip.webp"
          alt=""
          aria-hidden="true"
          width={width}
          height={height}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
        />
      )}
      {live && (
        <div className={`absolute inset-0 ${interactive ? 'pointer-events-auto' : ''}`}>
          <CanvasBoundary>
            <PipCanvas
              state={asleep && state === 'idle' ? 'sleeping' : state}
              interactive={interactive}
              onReady={() => setReady(true)}
              onPoke={handlePoke}
            />
          </CanvasBoundary>
        </div>
      )}
    </div>
  )
}
