'use client'

import { useState, useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'

export type PipState = 'idle' | 'speaking' | 'thinking' | 'celebrating'

interface PipMascotProps {
  state: PipState
  size: number | { width: number; height: number }
  className?: string
}

interface PipCanvasProps {
  state: PipState
  onReady: () => void
}

// Kept outside dynamic(): Next rewrites import() inside its loader to a require-style resolve,
// which fails on wobnimo's ESM-only exports map.
const loadWobnimo = () => Promise.all([import('wobnimo/react'), import('wobnimo/characters/pip')])

const PipCanvas = dynamic<PipCanvasProps>(
  async () => {
    const [{ Mascot }, { pip }] = await loadWobnimo()
    return function PipCanvas({ state, onReady }) {
      return (
        <Mascot
          character={pip}
          state={state}
          onReady={onReady}
          interactive={false}
          style={{ width: '100%', height: '100%' }}
        />
      )
    }
  },
  { ssr: false }
)

/** wobnimo's Mascot throws without WebGL2, so probe first; no animation under reduced motion. */
let canAnimate: boolean | undefined
function getCanAnimate(): boolean {
  if (canAnimate === undefined) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      canAnimate = false
    } else {
      const gl = document.createElement('canvas').getContext('webgl2')
      canAnimate = gl !== null
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }
  return canAnimate
}

const subscribe = () => () => {}

export default function PipMascot({ state, size, className }: PipMascotProps) {
  const { width, height } = typeof size === 'number' ? { width: size, height: size } : size
  const live = useSyncExternalStore(subscribe, getCanAnimate, () => false)
  const [ready, setReady] = useState(false)

  return (
    <div
      aria-hidden="true"
      className={`relative pointer-events-none select-none ${className ?? ''}`}
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
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
        />
      )}
      {live && (
        <div className="absolute inset-0">
          <PipCanvas state={state} onReady={() => setReady(true)} />
        </div>
      )}
    </div>
  )
}
